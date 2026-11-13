//! Real mail: IMAP for reading, SMTP for sending, passwords in the OS keychain.
//!
//! Accounts are stored (without passwords) in the app config dir. Each folder's newest
//! messages are cached on disk so the app opens instantly, then synced incrementally:
//! only UIDs above the last one we saw are downloaded, and flags are refreshed.

use chrono::Utc;
use imap::types::{Fetch, Flag, NameAttribute};
use lettre::message::{header::ContentType, Mailbox, Message};
use lettre::transport::smtp::authentication::Credentials;
use lettre::{SmtpTransport, Transport};
use mail_parser::{MessageParser, MimeHeaders};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::net::{TcpStream, ToSocketAddrs};
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};
use std::time::Duration;

type Session = imap::Session<native_tls::TlsStream<TcpStream>>;

const KEYCHAIN_SERVICE: &str = "com.crooli.mail";
const CACHE_KEEP: usize = 600;
const CACHE_VERSION: u32 = 2;
const NEW_FETCH_CAP: u32 = 150;
const PREVIEW_MAX_BYTES: u32 = 250_000;

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Account {
    pub email: String,
    pub name: String,
    pub provider: String,
    pub imap_host: String,
    pub imap_port: u16,
    pub smtp_host: String,
    pub smtp_port: u16,
    /// true: STARTTLS on a plain port (587). false: TLS from the start (465).
    pub smtp_starttls: bool,
    /// Login name if it isn't the email address.
    #[serde(default)]
    pub username: Option<String>,
}

impl Account {
    fn login(&self) -> &str {
        self.username.as_deref().filter(|u| !u.is_empty()).unwrap_or(&self.email)
    }
    fn is_gmail(&self) -> bool {
        self.imap_host.contains("gmail.com") || self.imap_host.contains("googlemail.com")
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Header {
    pub uid: u32,
    pub from_name: String,
    pub from_address: String,
    pub to: String,
    /// Recipients' names and addresses, ", "-joined and in the same order.
    #[serde(default)]
    pub to_names: String,
    #[serde(default)]
    pub to_addresses: String,
    pub subject: String,
    /// ms since epoch
    pub date: i64,
    pub preview: String,
    pub seen: bool,
    pub flagged: bool,
    pub draft: bool,
}

#[derive(Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct FolderCache {
    /// Bumped when the cached format changes, so old caches are rebuilt.
    #[serde(default)]
    version: u32,
    uid_validity: Option<u32>,
    #[serde(default)]
    total: u32,
    messages: Vec<Header>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderView {
    /// How many messages the server has in this folder
    pub total: u32,
    /// The newest ones, newest first
    pub messages: Vec<Header>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Body {
    pub text: String,
    pub html: Option<String>,
    pub to: String,
    pub cc: String,
    pub message_id: Option<String>,
    pub references: Option<String>,
    pub attachments: Vec<String>,
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

/// Debug builds only: lets tests talk to a local server with a self-signed certificate.
fn dev_insecure_tls() -> bool {
    cfg!(debug_assertions) && std::env::var("CROOLI_DEV_INSECURE_TLS").as_deref() == Ok("1")
}

fn config_dir() -> PathBuf {
    if cfg!(debug_assertions) {
        if let Ok(d) = std::env::var("CROOLI_DEV_CONFIG_DIR") {
            let d = PathBuf::from(d);
            let _ = std::fs::create_dir_all(&d);
            return d;
        }
    }
    let d = dirs::config_dir().unwrap_or_else(std::env::temp_dir).join("com.crooli.mail");
    let _ = std::fs::create_dir_all(&d);
    d
}

fn cache_dir() -> PathBuf {
    let d = dirs::cache_dir().unwrap_or_else(std::env::temp_dir).join("com.crooli.mail");
    let _ = std::fs::create_dir_all(&d);
    d
}

fn load_accounts() -> Vec<Account> {
    std::fs::read(config_dir().join("accounts.json"))
        .ok()
        .and_then(|b| serde_json::from_slice(&b).ok())
        .unwrap_or_default()
}

fn save_accounts(a: &[Account]) -> Result<(), String> {
    let json = serde_json::to_vec_pretty(a).map_err(|e| e.to_string())?;
    std::fs::write(config_dir().join("accounts.json"), json).map_err(|e| e.to_string())
}

fn account(email: &str) -> Result<Account, String> {
    load_accounts().into_iter().find(|a| a.email == email).ok_or_else(|| format!("No account for {email}"))
}

fn keychain(email: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYCHAIN_SERVICE, email).map_err(|e| e.to_string())
}

fn password(email: &str) -> Result<String, String> {
    keychain(email)?.get_password().map_err(|e| format!("Couldn't read the password from the Keychain: {e}"))
}

fn cache_path(email: &str, folder: &str) -> PathBuf {
    let safe: String = format!("{email}-{folder}").chars().map(|c| if c.is_ascii_alphanumeric() { c } else { '_' }).collect();
    cache_dir().join(format!("{safe}.json"))
}

fn read_cache(email: &str, folder: &str) -> FolderCache {
    std::fs::read(cache_path(email, folder))
        .ok()
        .and_then(|b| serde_json::from_slice::<FolderCache>(&b).ok())
        .filter(|c| c.version == CACHE_VERSION)
        .unwrap_or(FolderCache { version: CACHE_VERSION, ..Default::default() })
}

pub fn cached_headers(email: &str, folder: &str) -> Vec<Header> {
    read_cache(email, folder).messages
}

fn write_cache(email: &str, folder: &str, c: &FolderCache) {
    if let Ok(b) = serde_json::to_vec(c) {
        let _ = std::fs::write(cache_path(email, folder), b);
    }
}

// ---------------------------------------------------------------------------
// IMAP connections
// ---------------------------------------------------------------------------

fn friendly(e: impl std::fmt::Display) -> String {
    let s = e.to_string();
    let l = s.to_lowercase();
    if l.contains("authenticationfailed") || l.contains("invalid credentials") || l.contains("authentication failed") || l.contains("login failed") || l.contains("[auth") {
        "The email address or app password wasn’t accepted. Check you pasted an app password, not your normal password.".into()
    } else if l.contains("timed out") || l.contains("would block") {
        "The mail server didn’t answer in time. Check your connection and try again.".into()
    } else if l.contains("failed to lookup") || l.contains("nodename") || l.contains("dns") {
        "Couldn’t find that mail server. Check the server name.".into()
    } else {
        s
    }
}

fn connect(acct: &Account, pass: &str) -> Result<Session, String> {
    let addr = (acct.imap_host.as_str(), acct.imap_port)
        .to_socket_addrs()
        .map_err(friendly)?
        .next()
        .ok_or("Couldn’t find that mail server. Check the server name.")?;
    let tcp = TcpStream::connect_timeout(&addr, Duration::from_secs(15)).map_err(friendly)?;
    let _ = tcp.set_read_timeout(Some(Duration::from_secs(90)));
    let _ = tcp.set_write_timeout(Some(Duration::from_secs(30)));
    let tls = native_tls::TlsConnector::builder()
        .danger_accept_invalid_certs(dev_insecure_tls())
        .danger_accept_invalid_hostnames(dev_insecure_tls())
        .build()
        .map_err(|e| e.to_string())?;
    let stream = tls.connect(&acct.imap_host, tcp).map_err(friendly)?;
    let mut client = imap::Client::new(stream);
    client.read_greeting().map_err(friendly)?;
    client.login(acct.login(), pass).map_err(|(e, _)| friendly(e))
}

fn pool() -> &'static Mutex<HashMap<String, Session>> {
    static P: OnceLock<Mutex<HashMap<String, Session>>> = OnceLock::new();
    P.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Runs `f` on a pooled session, reconnecting once if the pooled one has gone stale.
fn with_session<T>(acct: &Account, mut f: impl FnMut(&mut Session) -> Result<T, String>) -> Result<T, String> {
    let pooled = pool().lock().unwrap().remove(&acct.email);
    if let Some(mut s) = pooled {
        if let Ok(v) = f(&mut s) {
            pool().lock().unwrap().insert(acct.email.clone(), s);
            return Ok(v);
        }
    }
    let mut s = connect(acct, &password(&acct.email)?)?;
    let v = f(&mut s)?;
    pool().lock().unwrap().insert(acct.email.clone(), s);
    Ok(v)
}

/// Maps Crooli's folders to this server's mailbox names, using SPECIAL-USE where offered.
fn mailbox_for(s: &mut Session, folder: &str) -> Result<(String, bool), String> {
    if folder == "inbox" {
        return Ok(("INBOX".into(), false));
    }
    let names = s.list(Some(""), Some("*")).map_err(friendly)?;
    let mut by_attr: HashMap<String, String> = HashMap::new();
    let mut all: Vec<String> = Vec::new();
    for n in names.iter() {
        all.push(n.name().to_string());
        for a in n.attributes() {
            if let NameAttribute::Custom(c) = a {
                by_attr.entry(c.to_lowercase()).or_insert_with(|| n.name().to_string());
            }
        }
    }
    let find = |attrs: &[&str], names: &[&str]| -> Option<String> {
        attrs
            .iter()
            .find_map(|a| by_attr.get(*a).cloned())
            .or_else(|| names.iter().find_map(|n| all.iter().find(|x| x.eq_ignore_ascii_case(n)).cloned()))
    };
    let found = match folder {
        "sent" => find(&["\\sent"], &["Sent", "Sent Messages", "Sent Items", "Sent Mail", "INBOX.Sent"]),
        "drafts" => find(&["\\drafts"], &["Drafts", "INBOX.Drafts"]),
        "trash" => find(&["\\trash"], &["Trash", "Deleted Messages", "Deleted Items", "Bin", "INBOX.Trash"]),
        "archive" => find(&["\\archive", "\\all"], &["Archive", "Archives", "INBOX.Archive"]),
        "starred" => find(&["\\flagged"], &[]),
        _ => None,
    };
    match (folder, found) {
        (_, Some(name)) => Ok((name, false)),
        // No dedicated starred mailbox: show flagged mail from the inbox.
        ("starred", None) => Ok(("INBOX".into(), true)),
        (f, None) => Err(format!("This account has no {f} folder.")),
    }
}

fn decode_header_value(raw: &[u8]) -> String {
    let src = [b"Subject: ".as_slice(), raw, b"\r\n\r\n"].concat();
    MessageParser::default()
        .parse_headers(&src[..])
        .and_then(|m| m.subject().map(String::from))
        .unwrap_or_else(|| String::from_utf8_lossy(raw).into_owned())
}

fn addr_parts(a: &imap_proto::types::Address) -> (String, String) {
    let name = a.name.map(decode_header_value).unwrap_or_default();
    let mailbox = a.mailbox.map(|m| String::from_utf8_lossy(m).into_owned()).unwrap_or_default();
    let host = a.host.map(|h| String::from_utf8_lossy(h).into_owned()).unwrap_or_default();
    let address = if host.is_empty() { mailbox } else { format!("{mailbox}@{host}") };
    (name, address)
}

fn squash(s: &str, max: usize) -> String {
    let mut out = String::with_capacity(max);
    let mut last_space = true;
    for c in s.chars() {
        if c.is_whitespace() {
            if !last_space {
                out.push(' ');
                last_space = true;
            }
        } else {
            out.push(c);
            last_space = false;
        }
        if out.len() >= max {
            break;
        }
    }
    out.trim().to_string()
}

fn html_to_text(html: &str) -> String {
    let mut out = String::new();
    let mut in_tag = false;
    let mut skip = false;
    let lower = html.to_lowercase();
    let bytes: Vec<char> = html.chars().collect();
    let lchars: Vec<char> = lower.chars().collect();
    let mut i = 0;
    while i < bytes.len() {
        let c = bytes[i];
        if c == '<' {
            let rest: String = lchars[i..(i + 8).min(lchars.len())].iter().collect();
            if rest.starts_with("<style") || rest.starts_with("<script") || rest.starts_with("<head") {
                skip = true;
            } else if rest.starts_with("</style") || rest.starts_with("</script") || rest.starts_with("</head") {
                skip = false;
            }
            if rest.starts_with("<br") || rest.starts_with("<p") || rest.starts_with("</p") || rest.starts_with("<div") || rest.starts_with("<tr") {
                out.push('\n');
            }
            in_tag = true;
        } else if c == '>' {
            in_tag = false;
        } else if !in_tag && !skip {
            out.push(c);
        }
        i += 1;
    }
    out.replace("&nbsp;", " ").replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", "\"").replace("&#39;", "'").replace("&zwnj;", "")
}

fn preview_of(raw: &[u8]) -> String {
    let Some(m) = MessageParser::default().parse(raw) else { return String::new() };
    let text = m.body_text(0).map(|t| t.into_owned()).filter(|t| !t.trim().is_empty());
    let text = text.or_else(|| m.body_html(0).map(|h| html_to_text(&h))).unwrap_or_default();
    // Drop quoted replies so the preview shows what's new.
    let fresh: Vec<&str> = text.lines().filter(|l| !l.trim_start().starts_with('>')).collect();
    squash(&fresh.join(" "), 220)
}

fn header_from(f: &Fetch, folder: &str) -> Option<Header> {
    let uid = f.uid?;
    let env = f.envelope();
    let (from_name, from_address) = env
        .and_then(|e| e.from.as_ref())
        .and_then(|v| v.first())
        .map(addr_parts)
        .unwrap_or_default();
    let recipients: Vec<(String, String)> = env.and_then(|e| e.to.as_ref()).map(|v| v.iter().map(addr_parts).collect()).unwrap_or_default();
    let to = recipients.iter().map(|(n, a)| if n.is_empty() { a.clone() } else { n.clone() }).collect::<Vec<_>>().join(", ");
    let to_names = recipients.iter().map(|(n, _)| n.replace(", ", " ")).collect::<Vec<_>>().join(", ");
    let to_addresses = recipients.iter().map(|(_, a)| a.clone()).collect::<Vec<_>>().join(", ");
    let subject = env.and_then(|e| e.subject).map(decode_header_value).unwrap_or_default();
    let date = f.internal_date().map(|d| d.timestamp_millis()).unwrap_or_else(|| Utc::now().timestamp_millis());
    let flags = f.flags();
    let _ = folder;
    Some(Header {
        uid,
        from_name,
        from_address,
        to,
        to_names,
        to_addresses,
        subject,
        date,
        preview: f.body().map(preview_of).unwrap_or_default(),
        seen: flags.iter().any(|x| matches!(x, Flag::Seen)),
        flagged: flags.iter().any(|x| matches!(x, Flag::Flagged)),
        draft: flags.iter().any(|x| matches!(x, Flag::Draft)),
    })
}

fn uid_list(uids: &[u32]) -> String {
    uids.iter().map(|u| u.to_string()).collect::<Vec<_>>().join(",")
}

fn sync_folder(acct: &Account, folder: &str) -> Result<FolderView, String> {
    let mut cache = read_cache(&acct.email, folder);
    let merged = with_session(acct, |s| {
        let (mbox, flagged_only) = mailbox_for(s, folder)?;
        let info = s.select(&mbox).map_err(friendly)?;
        if cache.uid_validity != info.uid_validity {
            cache = FolderCache { version: CACHE_VERSION, uid_validity: info.uid_validity, total: 0, messages: vec![] };
        }
        let mut total = info.exists;
        let known_max = cache.messages.iter().map(|m| m.uid).max().unwrap_or(0);

        // 1. New messages: UIDs above the newest we have, capped to the latest few.
        let mut new_uids: Vec<u32> = if flagged_only {
            s.uid_search("FLAGGED").map_err(friendly)?.into_iter().filter(|u| *u > known_max).collect()
        } else if info.exists == 0 {
            vec![]
        } else {
            s.uid_search(format!("UID {}:*", known_max + 1)).map_err(friendly)?.into_iter().filter(|u| *u > known_max).collect()
        };
        if flagged_only {
            total = s.uid_search("FLAGGED").map_err(friendly)?.len() as u32;
        }
        new_uids.sort_unstable_by(|a, b| b.cmp(a));
        new_uids.truncate(NEW_FETCH_CAP as usize);

        let mut fresh: Vec<Header> = Vec::new();
        if !new_uids.is_empty() {
            let set = uid_list(&new_uids);
            let meta = s.uid_fetch(&set, "(UID FLAGS INTERNALDATE ENVELOPE RFC822.SIZE)").map_err(friendly)?;
            let small: Vec<u32> = meta.iter().filter(|f| f.size.unwrap_or(u32::MAX) <= PREVIEW_MAX_BYTES).filter_map(|f| f.uid).collect();
            let mut by_uid: HashMap<u32, Header> = meta.iter().filter_map(|f| header_from(f, folder)).map(|h| (h.uid, h)).collect();
            // 2. Bodies for previews, only for messages small enough to be cheap.
            for chunk in small.chunks(25) {
                let bodies = s.uid_fetch(uid_list(chunk), "(UID BODY.PEEK[])").map_err(friendly)?;
                for b in bodies.iter() {
                    if let (Some(uid), Some(raw)) = (b.uid, b.body()) {
                        if let Some(h) = by_uid.get_mut(&uid) {
                            h.preview = preview_of(raw);
                        }
                    }
                }
            }
            fresh = by_uid.into_values().collect();
        }

        // 3. Refresh flags for what we already had, and drop anything deleted on the server.
        let mut existing = std::mem::take(&mut cache.messages);
        if !existing.is_empty() {
            let min = existing.iter().map(|m| m.uid).min().unwrap_or(1);
            let flags = s.uid_fetch(format!("{min}:{known_max}"), "(UID FLAGS)").map_err(friendly)?;
            let mut live: HashMap<u32, (bool, bool)> = HashMap::new();
            for f in flags.iter() {
                if let Some(u) = f.uid {
                    let fl = f.flags();
                    live.insert(u, (fl.iter().any(|x| matches!(x, Flag::Seen)), fl.iter().any(|x| matches!(x, Flag::Flagged))));
                }
            }
            existing.retain_mut(|m| match live.get(&m.uid) {
                Some(&(seen, flagged)) => {
                    m.seen = seen;
                    m.flagged = flagged;
                    !flagged_only || flagged
                }
                None => false,
            });
        }
        let mut all = fresh;
        all.extend(existing);
        all.sort_unstable_by_key(|m| std::cmp::Reverse(m.date));
        all.truncate(CACHE_KEEP);
        Ok((all, total))
    })?;
    cache.messages = merged.0.clone();
    cache.total = merged.1;
    write_cache(&acct.email, folder, &cache);
    Ok(FolderView { total: merged.1, messages: merged.0 })
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async fn blocking<T: Send + 'static>(f: impl FnOnce() -> Result<T, String> + Send + 'static) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(f).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn list_accounts() -> Vec<Account> {
    load_accounts()
}

/// Checks the details work (IMAP sign-in and SMTP reachability), then saves the account
/// and puts the password in the Keychain.
#[tauri::command]
pub async fn connect_account(account: Account, password: String) -> Result<Account, String> {
    blocking(move || {
        let mut acct = account;
        acct.email = acct.email.trim().to_lowercase();
        let pass: String = password.chars().filter(|c| !c.is_whitespace() || acct.provider == "imap").collect();
        let mut s = connect(&acct, &pass)?;
        s.select("INBOX").map_err(friendly)?;
        let _ = s.logout();

        let smtp = smtp_transport(&acct, &pass)?;
        match smtp.test_connection() {
            Ok(true) => {}
            Ok(false) => return Err(format!("Couldn’t reach the sending server {}:{}.", acct.smtp_host, acct.smtp_port)),
            Err(e) => return Err(format!("Couldn’t reach the sending server: {}", friendly(e))),
        }

        keychain(&acct.email)?.set_password(&pass).map_err(|e| format!("Couldn’t save to the Keychain: {e}"))?;
        let mut all = load_accounts();
        all.retain(|a| a.email != acct.email);
        all.push(acct.clone());
        save_accounts(&all)?;
        Ok(acct)
    })
    .await
}

#[tauri::command]
pub async fn remove_account(email: String) -> Result<(), String> {
    blocking(move || {
        if let Some(mut s) = pool().lock().unwrap().remove(&email) {
            let _ = s.logout();
        }
        let _ = keychain(&email).and_then(|k| k.delete_credential().map_err(|e| e.to_string()));
        let mut all = load_accounts();
        all.retain(|a| a.email != email);
        save_accounts(&all)?;
        for f in ["inbox", "sent", "drafts", "archive", "trash", "starred"] {
            let _ = std::fs::remove_file(cache_path(&email, f));
        }
        Ok(())
    })
    .await
}

/// Whatever is cached on disk for this folder, for an instant first paint.
#[tauri::command]
pub fn cached_folder(email: String, folder: String) -> FolderView {
    let c = read_cache(&email, &folder);
    FolderView { total: c.total.max(c.messages.len() as u32), messages: c.messages }
}

/// Syncs the folder with the server and returns the up-to-date list.
#[tauri::command]
pub async fn sync_folder_cmd(email: String, folder: String) -> Result<FolderView, String> {
    blocking(move || sync_folder(&account(&email)?, &folder)).await
}

#[tauri::command]
pub async fn get_message(email: String, folder: String, uid: u32) -> Result<Body, String> {
    blocking(move || {
        let acct = account(&email)?;
        let raw = with_session(&acct, |s| {
            let (mbox, _) = mailbox_for(s, &folder)?;
            s.select(&mbox).map_err(friendly)?;
            let f = s.uid_fetch(uid.to_string(), "(UID BODY.PEEK[])").map_err(friendly)?;
            f.iter().find_map(|x| x.body().map(|b| b.to_vec())).ok_or_else(|| "That message is no longer on the server.".to_string())
        })?;
        let m = MessageParser::default().parse(&raw[..]).ok_or("Couldn’t read that message.")?;
        let html = m.body_html(0).map(|h| h.into_owned());
        let text = m
            .body_text(0)
            .map(|t| t.into_owned())
            .filter(|t| !t.trim().is_empty())
            .or_else(|| html.as_deref().map(html_to_text))
            .unwrap_or_default();
        let list = |a: Option<&mail_parser::Address>| -> String {
            a.map(|a| a.iter().filter_map(|x| x.address().map(String::from)).collect::<Vec<_>>().join(", ")).unwrap_or_default()
        };
        let attachments = m.attachments().filter_map(|a| a.attachment_name().map(String::from)).collect();
        Ok(Body {
            text,
            html,
            to: list(m.to()),
            cc: list(m.cc()),
            message_id: m.message_id().map(|s| format!("<{s}>")),
            references: m.references().as_text().map(String::from),
            attachments,
        })
    })
    .await
}

#[tauri::command]
pub async fn set_flag(email: String, folder: String, uid: u32, flag: String, on: bool) -> Result<(), String> {
    blocking(move || {
        let acct = account(&email)?;
        let f = match flag.as_str() {
            "seen" => "\\Seen",
            "flagged" => "\\Flagged",
            _ => return Err("Unknown flag".into()),
        };
        with_session(&acct, |s| {
            let (mbox, _) = mailbox_for(s, &folder)?;
            s.select(&mbox).map_err(friendly)?;
            s.uid_store(uid.to_string(), format!("{}FLAGS ({f})", if on { "+" } else { "-" })).map_err(friendly)?;
            Ok(())
        })?;
        // Keep the cache in step so a restart shows the same thing.
        let mut c = read_cache(&email, &folder);
        for m in c.messages.iter_mut().filter(|m| m.uid == uid) {
            if flag == "seen" {
                m.seen = on;
            } else {
                m.flagged = on;
            }
        }
        write_cache(&email, &folder, &c);
        Ok(())
    })
    .await
}

#[tauri::command]
pub async fn move_message(email: String, folder: String, uid: u32, to: String) -> Result<(), String> {
    blocking(move || {
        let acct = account(&email)?;
        with_session(&acct, |s| {
            let (from, _) = mailbox_for(s, &folder)?;
            let (dest, _) = mailbox_for(s, &to)?;
            s.select(&from).map_err(friendly)?;
            if s.uid_mv(uid.to_string(), &dest).is_err() {
                // Servers without MOVE: copy, mark deleted, expunge just that message.
                s.uid_copy(uid.to_string(), &dest).map_err(friendly)?;
                s.uid_store(uid.to_string(), "+FLAGS (\\Deleted)").map_err(friendly)?;
                s.uid_expunge(uid.to_string()).map_err(friendly)?;
            }
            Ok(())
        })?;
        let mut c = read_cache(&email, &folder);
        c.messages.retain(|m| m.uid != uid);
        write_cache(&email, &folder, &c);
        Ok(())
    })
    .await
}

fn smtp_transport(acct: &Account, pass: &str) -> Result<SmtpTransport, String> {
    let builder = if acct.smtp_starttls {
        SmtpTransport::starttls_relay(&acct.smtp_host)
    } else {
        SmtpTransport::relay(&acct.smtp_host)
    }
    .map_err(|e| e.to_string())?;
    let builder = if dev_insecure_tls() {
        use lettre::transport::smtp::client::{Tls, TlsParameters};
        let p = TlsParameters::builder(acct.smtp_host.clone())
            .dangerous_accept_invalid_certs(true)
            .dangerous_accept_invalid_hostnames(true)
            .build()
            .map_err(|e| e.to_string())?;
        builder.tls(if acct.smtp_starttls { Tls::Required(p) } else { Tls::Wrapper(p) })
    } else {
        builder
    };
    Ok(builder
        .port(acct.smtp_port)
        .credentials(Credentials::new(acct.login().to_string(), pass.to_string()))
        .timeout(Some(Duration::from_secs(30)))
        .build())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Outgoing {
    to: String,
    #[serde(default)]
    cc: String,
    subject: String,
    body: String,
    #[serde(default)]
    in_reply_to: Option<String>,
    #[serde(default)]
    references: Option<String>,
}

fn build(acct: &Account, o: &Outgoing) -> Result<Message, String> {
    let from: Mailbox = format!("{} <{}>", acct.name, acct.email)
        .parse()
        .or_else(|_| acct.email.parse())
        .map_err(|e: lettre::address::AddressError| e.to_string())?;
    let mut b = Message::builder().from(from).subject(o.subject.clone());
    let mut any = false;
    for r in o.to.split([',', ';']).map(str::trim).filter(|r| !r.is_empty()) {
        b = b.to(r.parse().map_err(|_| format!("“{r}” isn’t a valid email address."))?);
        any = true;
    }
    for r in o.cc.split([',', ';']).map(str::trim).filter(|r| !r.is_empty()) {
        b = b.cc(r.parse().map_err(|_| format!("“{r}” isn’t a valid email address."))?);
    }
    if let Some(id) = &o.in_reply_to {
        b = b.in_reply_to(id.clone());
        b = b.references(o.references.clone().map(|r| format!("{r} {id}")).unwrap_or_else(|| id.clone()));
    }
    if !any {
        return Err("Add someone to send it to.".into());
    }
    b.header(ContentType::TEXT_PLAIN).body(o.body.clone()).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn send_message(email: String, message: Outgoing) -> Result<(), String> {
    blocking(move || {
        let acct = account(&email)?;
        let pass = password(&acct.email)?;
        let msg = build(&acct, &message)?;
        smtp_transport(&acct, &pass)?.send(&msg).map_err(|e| format!("Sending failed: {}", friendly(e)))?;
        // Gmail files sent mail itself; other servers need a copy in Sent.
        if !acct.is_gmail() {
            let raw = msg.formatted();
            let _ = with_session(&acct, |s| {
                let (sent, _) = mailbox_for(s, "sent")?;
                s.append_with_flags(&sent, &raw, &[Flag::Seen]).map_err(friendly)
            });
        }
        Ok(())
    })
    .await
}

#[tauri::command]
pub async fn save_draft(email: String, message: Outgoing) -> Result<(), String> {
    blocking(move || {
        let acct = account(&email)?;
        let mut m = message;
        if m.to.trim().is_empty() {
            m.to = acct.email.clone(); // drafts may not have a recipient yet
        }
        let raw = build(&acct, &m)?.formatted();
        with_session(&acct, |s| {
            let (drafts, _) = mailbox_for(s, "drafts")?;
            s.append_with_flags(&drafts, &raw, &[Flag::Draft, Flag::Seen]).map_err(friendly)
        })
    })
    .await
}

/// Opens an https link in the default browser (used for the provider set-up pages).
#[tauri::command]
pub fn open_url(url: String) -> Result<(), String> {
    if !url.starts_with("https://") {
        return Err("Only https links can be opened.".into());
    }
    #[cfg(target_os = "macos")]
    let r = std::process::Command::new("open").arg(&url).spawn();
    #[cfg(target_os = "windows")]
    let r = std::process::Command::new("cmd").args(["/C", "start", "", &url]).spawn();
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    let r = std::process::Command::new("xdg-open").arg(&url).spawn();
    r.map(|_| ()).map_err(|e| e.to_string())
}

/// End-to-end test against a local GreenMail server (java -Dgreenmail.setup.test.all
/// -Dgreenmail.users=test:secret@localhost -jar greenmail-standalone.jar). Run with:
/// `GREENMAIL=1 CROOLI_DEV_INSECURE_TLS=1 CROOLI_DEV_CONFIG_DIR=/tmp/crooli-test cargo test greenmail -- --ignored --nocapture`
#[cfg(test)]
mod tests {
    use super::*;

    macro_rules! rt {
        ($e:expr) => {
            tauri::async_runtime::block_on($e)
        };
    }

    fn acct() -> Account {
        Account {
            email: "test@localhost".into(),
            name: "Test Person".into(),
            provider: "imap".into(),
            imap_host: "127.0.0.1".into(),
            imap_port: 3993,
            smtp_host: "127.0.0.1".into(),
            smtp_port: 3465,
            smtp_starttls: false,
            username: Some("test".into()),
        }
    }

    fn out(subject: &str) -> Outgoing {
        Outgoing { to: "test@localhost".into(), cc: String::new(), subject: subject.into(), body: "Hi,\n\nThis came through Crooli Mail.\n\n> quoted line".into(), in_reply_to: None, references: None }
    }

    #[test]
    fn html_and_previews() {
        assert_eq!(html_to_text("<style>x{}</style><p>Hello&nbsp;<b>there</b></p>").trim(), "Hello there");
        let raw = b"From: A <a@x.com>\r\nSubject: Hi\r\nContent-Type: text/plain\r\n\r\nNew line here\r\n> old quoted\r\n";
        assert_eq!(preview_of(raw), "New line here");
        assert_eq!(decode_header_value(b"=?UTF-8?B?wqMyLDQ1MCBpcyBvbiBpdHMgd2F5?="), "£2,450 is on its way");
    }

    #[test]
    #[ignore]
    fn greenmail() {
        assert_eq!(std::env::var("GREENMAIL").as_deref(), Ok("1"));
        let a = rt!(connect_account(acct(), "secret".into())).expect("connect");
        let mut s = connect(&a, "secret").unwrap();
        for f in ["Sent", "Drafts", "Trash"] {
            let _ = s.create(f);
        }
        let _ = s.logout();

        rt!(send_message(a.email.clone(), out("Hello from Crooli"))).expect("send");
        std::thread::sleep(Duration::from_millis(800));
        let inbox = rt!(sync_folder_cmd(a.email.clone(), "inbox".into())).expect("sync inbox").messages;
        assert_eq!(inbox.len(), 1);
        assert_eq!(inbox[0].subject, "Hello from Crooli");
        assert!(inbox[0].preview.contains("This came through Crooli Mail"), "preview: {}", inbox[0].preview);
        assert_eq!(cached_folder(a.email.clone(), "inbox".into()).messages.len(), 1, "cache written");

        let uid = inbox[0].uid;
        let body = rt!(get_message(a.email.clone(), "inbox".into(), uid)).expect("body");
        assert!(body.text.contains("This came through Crooli Mail"));

        rt!(set_flag(a.email.clone(), "inbox".into(), uid, "seen".into(), true)).expect("seen");
        rt!(set_flag(a.email.clone(), "inbox".into(), uid, "flagged".into(), true)).expect("flag");
        let inbox = rt!(sync_folder_cmd(a.email.clone(), "inbox".into())).unwrap().messages;
        assert!(inbox[0].seen && inbox[0].flagged, "flags synced");
        assert_eq!(rt!(sync_folder_cmd(a.email.clone(), "starred".into())).unwrap().messages.len(), 1);

        rt!(save_draft(a.email.clone(), out("A draft"))).expect("draft");
        assert_eq!(rt!(sync_folder_cmd(a.email.clone(), "drafts".into())).unwrap().messages.len(), 1);
        assert_eq!(rt!(sync_folder_cmd(a.email.clone(), "sent".into())).unwrap().messages.len(), 1, "copy in Sent");

        rt!(move_message(a.email.clone(), "inbox".into(), uid, "trash".into())).expect("move");
        assert_eq!(rt!(sync_folder_cmd(a.email.clone(), "inbox".into())).unwrap().messages.len(), 0);
        assert_eq!(rt!(sync_folder_cmd(a.email.clone(), "trash".into())).unwrap().messages.len(), 1);

        let err = rt!(connect_account(acct(), "wrong".into())).unwrap_err();
        assert!(err.contains("app password"), "{err}");

        rt!(remove_account(a.email.clone())).expect("remove");
        assert!(list_accounts().is_empty());
    }
}
