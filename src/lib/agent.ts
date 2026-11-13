// Bridge to the user's local AI agent (Claude Code or Codex), via the Rust side.
// In a plain browser (vite dev without Tauri) we fall back to a simulated agent
// so the UI can still be previewed.
import { Channel, invoke } from "@tauri-apps/api/core";

export type ProviderId = "claude" | "codex";

export interface AgentInfo {
  provider: ProviderId;
  installed: boolean;
  path: string | null;
  version: string | null;
  model: string | null; // display name, e.g. "Opus 4.8"
  plan: string | null; // display name, e.g. "Max (20x)"
  remaining: number | null; // 0..1 of the current usage window left
}

export type AgentEvent =
  | { type: "delta"; text: string }
  | { type: "done"; text: string }
  | { type: "error"; message: string };

export const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const previewAgents: AgentInfo[] = [
  { provider: "claude", installed: true, path: null, version: null, model: "Opus 4.8", plan: "Max (20x)", remaining: 0.96 },
  { provider: "codex", installed: true, path: null, version: null, model: "GPT 5.5", plan: "Pro (20x)", remaining: 0.96 },
];

export async function detectAgents(): Promise<AgentInfo[]> {
  if (!isTauri()) {
    // Browser preview: ?provider=codex shows the Codex state from the second reference image.
    const want = new URLSearchParams(location.search).get("provider");
    return want === "codex" ? [...previewAgents].reverse() : previewAgents;
  }
  return invoke<AgentInfo[]>("detect_agents");
}

/** Runs a one-shot prompt and streams text back. Returns a cancel function. */
export function runAgent(provider: ProviderId, prompt: string, onEvent: (e: AgentEvent) => void): () => void {
  if (!isTauri()) return simulate(prompt, onEvent);
  const channel = new Channel<AgentEvent>();
  channel.onmessage = onEvent;
  let runId: number | null = null;
  let cancelled = false;
  invoke<number>("run_agent", { provider, prompt, onEvent: channel })
    .then((id) => {
      runId = id;
      if (cancelled) invoke("cancel_agent", { runId: id });
    })
    .catch((err) => onEvent({ type: "error", message: String(err) }));
  return () => {
    cancelled = true;
    if (runId !== null) invoke("cancel_agent", { runId });
  };
}

function simulate(prompt: string, onEvent: (e: AgentEvent) => void) {
  const text = prompt.includes("DRAFT")
    ? "Hi Rico,\n\nHappy to help. Thursday morning works well for me — would 10.00 suit? If it’s easier, I can also send written notes on the onboarding flow beforehand.\n\nBest,"
    : prompt.includes("TRIAGE")
      ? "**Needs you**\n• Rico Oktananda wants 20 minutes this week for UX feedback. I’ve drafted a reply proposing Thursday 10.00.\n\n**For your information**\n• Deel: your £2,450.00 withdrawal is on its way (1–3 working days).\n• Substack: five new posts from writers you follow.\n\n**Suggested**\n• Archive 41 newsletters older than 30 days."
      : "Rico is asking for 20 minutes this week to get your feedback on the product’s UX — Tuesday after 14.00 or Thursday morning, or written notes on onboarding instead.";
  let i = 0;
  const id = window.setInterval(() => {
    const n = 2 + Math.floor(Math.random() * 5);
    const chunk = text.slice(i, i + n);
    i += n;
    if (chunk) onEvent({ type: "delta", text: chunk });
    if (i >= text.length) {
      window.clearInterval(id);
      onEvent({ type: "done", text });
    }
  }, 18);
  return () => window.clearInterval(id);
}
