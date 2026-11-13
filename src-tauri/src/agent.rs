//! Bring-your-own-agent bridge: finds the user's Claude Code / Codex CLI and runs
//! one-shot prompts headlessly, streaming text back to the UI.
//!
//! Nothing here talks to a Crooli server. The CLIs use the user's own login.

use serde::Serialize;
use serde_json::Value;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, OnceLock};
use tauri::ipc::Channel;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::Command;
use tokio::sync::oneshot;

#[derive(Serialize, Clone, Debug)]
pub struct AgentInfo {
    provider: &'static str,
    installed: bool,
    path: Option<String>,
    version: Option<String>,
    model: Option<String>,
    plan: Option<String>,
    remaining: Option<f64>,
}

#[derive(Serialize, Clone)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum AgentEvent {
    Delta { text: String },
    Done { text: String },
    Error { message: String },
}

// ---------------------------------------------------------------------------
// Environment: GUI apps on macOS don't inherit the user's shell PATH.
// ---------------------------------------------------------------------------

fn home() -> PathBuf {
    dirs::home_dir().unwrap_or_else(|| PathBuf::from("/"))
}

fn login_path() -> &'static str {
    static PATH: OnceLock<String> = OnceLock::new();
    PATH.get_or_init(|| {
        let mut parts: Vec<String> = Vec::new();
        #[cfg(unix)]
        {
            let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".into());
            if let Ok(out) = std::process::Command::new(shell)
                .args(["-ilc", "printf '%s' \"$PATH\""])
                .stdin(Stdio::null())
                .stderr(Stdio::null())
                .output()
            {
                let s = String::from_utf8_lossy(&out.stdout);
                // Interactive shells can print banners; the PATH is the last line.
                if let Some(line) = s.lines().last() {
                    parts.extend(line.split(':').map(String::from));
                }
            }
        }
        let h = home();
        for extra in [
            h.join(".local/bin"),
            h.join(".claude/local"),
            h.join(".npm-global/bin"),
            h.join(".bun/bin"),
            h.join(".volta/bin"),
            h.join(".cargo/bin"),
            PathBuf::from("/opt/homebrew/bin"),
            PathBuf::from("/usr/local/bin"),
            PathBuf::from("/usr/bin"),
            PathBuf::from("/bin"),
        ] {
            parts.push(extra.to_string_lossy().into_owned());
        }
        if let Ok(p) = std::env::var("PATH") {
            parts.extend(p.split(if cfg!(windows) { ';' } else { ':' }).map(String::from));
        }
        let mut seen = std::collections::HashSet::new();
        parts.retain(|p| !p.is_empty() && seen.insert(p.clone()));
        parts.join(if cfg!(windows) { ";" } else { ":" })
    })
}

fn which(bin: &str) -> Option<PathBuf> {
    let sep = if cfg!(windows) { ';' } else { ':' };
    let exts: &[&str] = if cfg!(windows) { &[".exe", ".cmd", ""] } else { &[""] };
    for dir in login_path().split(sep) {
        for ext in exts {
            let p = Path::new(dir).join(format!("{bin}{ext}"));
            if p.is_file() {
                return Some(p);
            }
        }
    }
    None
}

async fn version_of(path: &Path) -> Option<String> {
    let out = Command::new(path)
        .arg("--version")
        .env("PATH", login_path())
        .stdin(Stdio::null())
        .output()
        .await
        .ok()?;
    let s = String::from_utf8_lossy(&out.stdout);
    s.split_whitespace().find(|t| t.chars().next().is_some_and(|c| c.is_ascii_digit())).map(String::from)
}

fn read_json(p: PathBuf) -> Option<Value> {
    serde_json::from_slice(&std::fs::read(p).ok()?).ok()
}

// ---------------------------------------------------------------------------
// Claude Code
// ---------------------------------------------------------------------------

/// "opus" -> "Opus", "claude-opus-4-8" -> "Opus 4.8", "claude-sonnet-4-5-20250929" -> "Sonnet 4.5"
fn claude_model_name(raw: &str) -> String {
    let raw = raw.trim().trim_end_matches("[1m]");
    let s = raw.strip_prefix("claude-").unwrap_or(raw);
    let mut parts = s.split('-').filter(|p| !(p.len() >= 8 && p.chars().all(|c| c.is_ascii_digit())));
    let family = parts.next().unwrap_or(s);
    let mut name = capitalise(family);
    let nums: Vec<&str> = parts.filter(|p| p.chars().all(|c| c.is_ascii_digit())).collect();
    if !nums.is_empty() {
        name.push(' ');
        name.push_str(&nums.join("."));
    }
    name
}

fn capitalise(s: &str) -> String {
    let mut c = s.chars();
    match c.next() {
        Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
        None => String::new(),
    }
}

fn claude_details() -> (Option<String>, Option<String>, Option<f64>) {
    let h = home();
    let model = std::env::var("ANTHROPIC_MODEL")
        .ok()
        .or_else(|| read_json(h.join(".claude/settings.json")).and_then(|v| v["model"].as_str().map(String::from)))
        .map(|m| claude_model_name(&m));

    let state = read_json(h.join(".claude.json"));
    let plan = state.as_ref().and_then(|v| {
        let acct = &v["oauthAccount"];
        let tier = acct["userRateLimitTier"].as_str().or(acct["organizationRateLimitTier"].as_str()).unwrap_or("");
        let org = acct["organizationType"].as_str().unwrap_or("");
        let base = if org.contains("max") || tier.contains("max") {
            "Max"
        } else if org.contains("pro") {
            "Pro"
        } else if org.contains("team") {
            "Team"
        } else if org.contains("enterprise") {
            "Enterprise"
        } else {
            return None;
        };
        let mult = ["20x", "5x"].into_iter().find(|m| tier.contains(m));
        Some(match mult {
            Some(m) => format!("{base} ({m})"),
            None => base.to_string(),
        })
    });

    // Claude Code caches the account's usage; the meter shows what's left of the 5-hour window.
    let remaining = state.as_ref().and_then(|v| {
        let w = &v["cachedUsageUtilization"]["utilization"]["five_hour"];
        let used = w["utilization"].as_f64()?;
        Some((1.0 - used / 100.0).clamp(0.0, 1.0))
    });
    (model, plan, remaining)
}

// ---------------------------------------------------------------------------
// Codex
// ---------------------------------------------------------------------------

fn codex_details() -> (Option<String>, Option<String>) {
    let h = home();
    let model = std::fs::read_to_string(h.join(".codex/config.toml")).ok().and_then(|t| {
        t.lines().find_map(|l| {
            let l = l.trim();
            let rest = l.strip_prefix("model")?.trim_start();
            let v = rest.strip_prefix('=')?.trim().trim_matches('"');
            Some(v.to_string())
        })
    });
    let model = model.map(|m| {
        let m = m.replace("gpt-", "GPT ");
        m.split('-').map(capitalise).collect::<Vec<_>>().join(" ")
    });
    let plan = read_json(h.join(".codex/auth.json")).and_then(|v| {
        let tok = v["tokens"]["id_token"].as_str()?;
        let payload = tok.split('.').nth(1)?;
        use base64::Engine;
        let bytes = base64::engine::general_purpose::URL_SAFE_NO_PAD.decode(payload.trim_end_matches('=')).ok()?;
        let claims: Value = serde_json::from_slice(&bytes).ok()?;
        let plan = claims["https://api.openai.com/auth"]["chatgpt_plan_type"].as_str()?;
        Some(capitalise(plan))
    });
    (model, plan)
}

#[tauri::command]
pub async fn detect_agents() -> Vec<AgentInfo> {
    let claude_path = which("claude");
    let codex_path = which("codex");
    let (cv, xv) = tokio::join!(
        async {
            match &claude_path {
                Some(p) => version_of(p).await,
                None => None,
            }
        },
        async {
            match &codex_path {
                Some(p) => version_of(p).await,
                None => None,
            }
        }
    );
    let (cm, cp, cr) = claude_details();
    let (xm, xp) = codex_details();
    vec![
        AgentInfo {
            provider: "claude",
            installed: claude_path.is_some(),
            path: claude_path.map(|p| p.to_string_lossy().into_owned()),
            version: cv,
            model: cm,
            plan: cp,
            remaining: cr,
        },
        AgentInfo {
            provider: "codex",
            installed: codex_path.is_some(),
            path: codex_path.map(|p| p.to_string_lossy().into_owned()),
            version: xv,
            model: xm,
            plan: xp,
            remaining: None,
        },
    ]
}

// ---------------------------------------------------------------------------
// Running prompts
// ---------------------------------------------------------------------------

static NEXT_ID: AtomicU64 = AtomicU64::new(1);

fn runs() -> &'static Mutex<HashMap<u64, oneshot::Sender<()>>> {
    static RUNS: OnceLock<Mutex<HashMap<u64, oneshot::Sender<()>>>> = OnceLock::new();
    RUNS.get_or_init(|| Mutex::new(HashMap::new()))
}

/// A scratch working directory so the agent never runs inside a user project.
fn scratch_dir() -> PathBuf {
    let d = std::env::temp_dir().join("crooli-mail-agent");
    let _ = std::fs::create_dir_all(&d);
    d
}

#[tauri::command]
pub async fn run_agent(provider: String, prompt: String, on_event: Channel<AgentEvent>) -> Result<u64, String> {
    let bin = which(&provider).ok_or_else(|| format!("{provider} isn't installed"))?;
    let mut cmd = Command::new(&bin);
    match provider.as_str() {
        "claude" => {
            cmd.args([
                "-p",
                "--output-format",
                "stream-json",
                "--verbose",
                "--include-partial-messages",
                "--tools",
                "",
                "--strict-mcp-config",
                "--no-session-persistence",
            ]);
        }
        "codex" => {
            cmd.args(["exec", "--json", "--skip-git-repo-check", "--sandbox", "read-only", "-"]);
        }
        other => return Err(format!("Unknown provider {other}")),
    }
    cmd.current_dir(scratch_dir())
        .env("PATH", login_path())
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);

    let mut child = cmd.spawn().map_err(|e| format!("Couldn't start {provider}: {e}"))?;
    let mut stdin = child.stdin.take().ok_or("no stdin")?;
    let stdout = child.stdout.take().ok_or("no stdout")?;
    let stderr = child.stderr.take().ok_or("no stderr")?;

    let id = NEXT_ID.fetch_add(1, Ordering::Relaxed);
    let (cancel_tx, mut cancel_rx) = oneshot::channel();
    runs().lock().unwrap().insert(id, cancel_tx);

    tauri::async_runtime::spawn(async move {
        let _ = stdin.write_all(prompt.as_bytes()).await;
        drop(stdin);

        let mut lines = BufReader::new(stdout).lines();
        let mut full = String::new();
        let mut finished = false;
        loop {
            tokio::select! {
                _ = &mut cancel_rx => {
                    let _ = child.kill().await;
                    break;
                }
                line = lines.next_line() => {
                    let Ok(Some(line)) = line else { break };
                    let Ok(v) = serde_json::from_str::<Value>(&line) else { continue };
                    if provider == "claude" {
                        handle_claude(&v, &mut full, &mut finished, &on_event);
                    } else {
                        handle_codex(&v, &mut full, &mut finished, &on_event);
                    }
                }
            }
        }
        if !finished {
            let status = child.wait().await.ok();
            if status.is_some_and(|s| s.success()) || !full.is_empty() {
                let _ = on_event.send(AgentEvent::Done { text: full });
            } else {
                let mut err = String::new();
                let mut r = BufReader::new(stderr);
                let _ = tokio::io::AsyncReadExt::read_to_string(&mut r, &mut err).await;
                let msg = err.lines().rev().find(|l| !l.trim().is_empty()).unwrap_or("The agent stopped unexpectedly").to_string();
                let _ = on_event.send(AgentEvent::Error { message: msg });
            }
        }
        runs().lock().unwrap().remove(&id);
    });

    Ok(id)
}

fn handle_claude(v: &Value, full: &mut String, finished: &mut bool, ch: &Channel<AgentEvent>) {
    match v["type"].as_str() {
        Some("stream_event") => {
            let ev = &v["event"];
            if ev["type"] == "content_block_delta" && ev["delta"]["type"] == "text_delta" {
                if let Some(t) = ev["delta"]["text"].as_str() {
                    full.push_str(t);
                    let _ = ch.send(AgentEvent::Delta { text: t.to_string() });
                }
            }
        }
        Some("result") => {
            *finished = true;
            if v["is_error"].as_bool().unwrap_or(false) {
                let msg = v["result"].as_str().unwrap_or("The agent returned an error").to_string();
                let _ = ch.send(AgentEvent::Error { message: msg });
            } else {
                let text = v["result"].as_str().map(String::from).unwrap_or_else(|| full.clone());
                let _ = ch.send(AgentEvent::Done { text });
            }
        }
        _ => {}
    }
}

fn handle_codex(v: &Value, full: &mut String, finished: &mut bool, ch: &Channel<AgentEvent>) {
    // Newer `codex exec --json` emits item.* / turn.* events; older builds emit {"msg": {...}}.
    let ty = v["type"].as_str().or(v["msg"]["type"].as_str()).unwrap_or("");
    match ty {
        "item.completed" if v["item"]["type"] == "agent_message" => {
            if let Some(t) = v["item"]["text"].as_str() {
                let t = if full.is_empty() { t.to_string() } else { format!("\n\n{t}") };
                full.push_str(&t);
                let _ = ch.send(AgentEvent::Delta { text: t });
            }
        }
        "agent_message_delta" => {
            if let Some(t) = v["msg"]["delta"].as_str() {
                full.push_str(t);
                let _ = ch.send(AgentEvent::Delta { text: t.to_string() });
            }
        }
        "agent_message" if full.is_empty() => {
            if let Some(t) = v["msg"]["message"].as_str() {
                full.push_str(t);
                let _ = ch.send(AgentEvent::Delta { text: t.to_string() });
            }
        }
        "turn.completed" | "task_complete" => {
            *finished = true;
            let _ = ch.send(AgentEvent::Done { text: full.clone() });
        }
        "turn.failed" | "error" => {
            *finished = true;
            let msg = v["error"]["message"]
                .as_str()
                .or(v["message"].as_str())
                .or(v["msg"]["message"].as_str())
                .unwrap_or("Codex returned an error")
                .to_string();
            let _ = ch.send(AgentEvent::Error { message: msg });
        }
        _ => {}
    }
}

#[tauri::command]
pub fn cancel_agent(run_id: u64) {
    if let Some(tx) = runs().lock().unwrap().remove(&run_id) {
        let _ = tx.send(());
    }
}

#[cfg(test)]
mod tests {
    use super::claude_model_name;

    #[test]
    fn model_names() {
        assert_eq!(claude_model_name("opus"), "Opus");
        assert_eq!(claude_model_name("claude-opus-4-8"), "Opus 4.8");
        assert_eq!(claude_model_name("claude-sonnet-4-5-20250929"), "Sonnet 4.5");
        assert_eq!(claude_model_name("claude-opus-4-6[1m]"), "Opus 4.6");
    }
}
