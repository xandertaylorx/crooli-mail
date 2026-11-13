// Bridge to the user's local AI agent (Claude Code or Codex), via the Rust side.
// In a plain browser (the website's live demo) a simulated agent stands in, and the
// UI labels it as a demo.
import { Channel, invoke } from "@tauri-apps/api/core";

export type ProviderId = "claude" | "codex";

export interface UsageWindow {
  /** 0..1 of the window left */
  left: number;
  resetsAt: string | null;
}

export interface AgentInfo {
  provider: ProviderId;
  installed: boolean;
  path: string | null;
  version: string | null;
  /** The plan the CLI is signed in with, e.g. "Pro" or "Max (20x)". */
  plan: string | null;
  /** Claude Code caches the account's usage limits; Codex doesn't share them. */
  usage: { fiveHour: UsageWindow | null; sevenDay: UsageWindow | null; asOf: number | null } | null;
  demo?: boolean;
}

export type AgentEvent =
  | { type: "delta"; text: string }
  | { type: "done"; text: string }
  | { type: "error"; message: string };

export const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const inHours = (h: number) => new Date(Date.now() + h * 3600e3).toISOString();
const demoAgents: AgentInfo[] = [
  {
    provider: "claude",
    installed: true,
    path: null,
    version: null,
    plan: "Max (20x)",
    usage: { fiveHour: { left: 0.92, resetsAt: inHours(3.2) }, sevenDay: { left: 0.7, resetsAt: inHours(70) }, asOf: Date.now() },
    demo: true,
  },
  { provider: "codex", installed: true, path: null, version: null, plan: "Pro", usage: null, demo: true },
];

export async function detectAgents(): Promise<AgentInfo[]> {
  if (!isTauri()) {
    const want = new URLSearchParams(location.search).get("provider");
    return want === "codex" ? [...demoAgents].reverse() : demoAgents;
  }
  return invoke<AgentInfo[]>("detect_agents");
}

/** Runs a one-shot prompt and streams text back. Returns a cancel function. */
export function runAgent(provider: ProviderId, model: string, prompt: string, onEvent: (e: AgentEvent) => void): () => void {
  if (!isTauri()) return simulate(prompt, onEvent);
  const channel = new Channel<AgentEvent>();
  channel.onmessage = onEvent;
  let runId: number | null = null;
  let cancelled = false;
  invoke<number>("run_agent", { provider, model: model || null, prompt, onEvent: channel })
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
  const text = prompt.startsWith("PING")
    ? "ok"
    : prompt.includes("DRAFT")
      ? "Hi Rico,\n\nHappy to help. Thursday morning works well for me. Would 10.00 suit? If it’s easier, I can send written notes on the onboarding flow beforehand.\n\nBest,"
      : prompt.includes("TRIAGE")
        ? "**Needs you**\n• Rico Oktananda wants 20 minutes this week for UX feedback. Suggest Thursday 10.00.\n\n**For your information**\n• Deel: your £2,450.00 withdrawal is on its way (1–3 working days).\n• Substack: five new posts from writers you follow.\n\n**Can go**\n• Older newsletters you haven’t opened."
        : "Rico wants 20 minutes this week for feedback on the product’s UX: Tuesday after 14.00 or Thursday morning, or written notes on onboarding instead.";
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
