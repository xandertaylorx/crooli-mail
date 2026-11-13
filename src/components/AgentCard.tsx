import { useState } from "react";
import openaiMark from "../assets/openai-mark.png";
import { ClaudeMark, CloseIcon } from "../icons";
import { useUpdates } from "../lib/updates";
import { detectAgents, runAgent, type AgentInfo, type ProviderId, type UsageWindow } from "../lib/agent";
import { LIVE, MODELS, useStore, type Theme } from "../store";

const BARS = 20;
const NAMES: Record<ProviderId, string> = { claude: "Claude Code", codex: "Codex" };

export function OpenAIMark({ size = 22 }: { size?: number }) {
  return (
    <span
      aria-label="OpenAI"
      className="block shrink-0"
      style={{
        width: size,
        height: size,
        backgroundColor: "var(--openai)",
        WebkitMaskImage: `url(${openaiMark})`,
        maskImage: `url(${openaiMark})`,
        WebkitMaskSize: "125%",
        maskSize: "125%",
        WebkitMaskPosition: "center",
        maskPosition: "center",
      }}
    />
  );
}

export function ProviderLogo({ provider, size = 22 }: { provider: ProviderId; size?: number }) {
  return provider === "claude" ? <ClaudeMark size={size} /> : <OpenAIMark size={size} />;
}

const pct = (w: UsageWindow) => `${Math.round(w.left * 100)}%`;

function resetText(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (d.getTime() < Date.now()) return "has reset since";
  const sameDay = d.toDateString() === new Date().toDateString();
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `resets ${sameDay ? time : `${d.toLocaleDateString("en-GB", { weekday: "short" })} ${time}`}`;
}

function ago(ms: number | null) {
  if (!ms) return "";
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} days ago`;
}

export function UsageMeter({ left, color, bars = BARS }: { left: number; color: string; bars?: number }) {
  const on = Math.max(0, Math.min(bars, Math.round(left * bars)));
  return (
    <span className="flex h-[16px] w-[96px] shrink-0 items-stretch gap-[2px]" aria-hidden>
      {Array.from({ length: bars }, (_, i) => (
        <span key={i} className="meter-bar flex-1 rounded-[1.5px]" style={{ backgroundColor: i < on ? color : "var(--meter-off)", animationDelay: `${i * 12}ms` }} />
      ))}
    </span>
  );
}

function useActiveAgent() {
  const agents = useStore((s) => s.agents);
  const provider = useStore((s) => s.provider);
  return agents.find((a) => a.provider === provider && a.installed);
}

/** The compact card at the top of the list. Click opens the AI panel. */
export function AgentCard() {
  const loaded = useStore((s) => s.agentsLoaded);
  const model = useStore((s) => s.model);
  const panel = useStore((s) => s.panel);
  const setPanel = useStore((s) => s.setPanel);
  const agent = useActiveAgent();
  if (!loaded) return <div className="h-[52px] rounded-[12px] border border-line bg-surface" />;

  const five = agent?.usage?.fiveHour ?? null;
  const modelLabel = agent ? (MODELS[agent.provider].find((m) => m.id === model[agent.provider])?.label ?? "Default") : "";
  const sub = !agent
    ? "Install Claude Code or Codex"
    : five
      ? `${pct(five)} of your 5-hour limit left${agent.demo ? " · demo" : ""}`
      : agent.provider === "codex"
        ? "Codex doesn’t share usage with other apps"
        : "Usage not available yet";

  return (
    <button
      type="button"
      onClick={() => setPanel(panel === "ai" ? null : "ai")}
      title="AI settings and usage"
      className={
        "flex h-[52px] w-full items-center gap-[11px] rounded-[12px] border bg-surface px-[12px] text-left shadow-[var(--card-shadow)] transition-colors duration-150 " +
        (panel === "ai" ? "border-[var(--checkbox)]" : "border-line hover:border-[var(--checkbox)]")
      }
    >
      <span className="flex size-[24px] shrink-0 items-center justify-center">
        {agent ? <ProviderLogo provider={agent.provider} size={22} /> : <span className="size-[18px] rounded-full border-[1.5px] border-dashed border-[var(--checkbox)]" />}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-[6px] text-[13.5px] font-medium tracking-[-0.01em] text-ink">
          {agent ? NAMES[agent.provider] : "No AI connected"}
          {agent && <span className="rounded-[5px] bg-pill px-[5px] py-[1px] text-[11px] font-medium text-ink-muted">{modelLabel}</span>}
        </span>
        <span className="truncate text-[12px] text-ink-muted">{sub}</span>
      </span>
      {five && <UsageMeter left={five.left} color={agent?.provider === "claude" ? "var(--claude)" : "var(--openai)"} />}
    </button>
  );
}

/* ------------------------------------------------------------------ panel */

function Section({ title, children, note }: { title: string; children: React.ReactNode; note?: React.ReactNode }) {
  return (
    <section className="border-b border-line-soft px-[24px] py-[18px]">
      <h3 className="mb-[10px] text-[12px] font-medium uppercase tracking-[0.05em] text-ink-faint">{title}</h3>
      {children}
      {note && <p className="mt-[10px] text-[12.5px] leading-[1.5] text-ink-muted">{note}</p>}
    </section>
  );
}

function Toggle({ label, sub, value, onChange }: { label: string; sub?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={value} onClick={() => onChange(!value)} className="flex w-full items-center gap-[12px] py-[8px] text-left">
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-medium text-ink">{label}</span>
        {sub && <span className="block text-[12px] text-ink-muted">{sub}</span>}
      </span>
      <span className={"relative h-[20px] w-[34px] shrink-0 rounded-full transition-colors " + (value ? "bg-[var(--ink)]" : "bg-[var(--checkbox)]")}>
        <span className={"absolute top-[2px] size-[16px] rounded-full bg-[var(--surface)] shadow-sm transition-[left] duration-150 " + (value ? "left-[16px]" : "left-[2px]")} />
      </span>
    </button>
  );
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-[9px] bg-pill p-[3px]" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.id || "default"}
          type="button"
          role="radio"
          aria-checked={o.id === value}
          onClick={() => onChange(o.id)}
          className={
            "h-[28px] rounded-[7px] px-[12px] text-[13px] font-medium transition-colors " +
            (o.id === value ? "bg-surface text-ink shadow-[0_1px_2px_rgba(0,0,0,0.08)]" : "text-ink-muted hover:text-ink")
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function UsageRow({ label, w, color }: { label: string; w: UsageWindow; color: string }) {
  return (
    <div className="flex items-center gap-[12px] py-[6px]">
      <span className="w-[92px] text-[13px] text-ink-2">{label}</span>
      <span className="relative h-[6px] flex-1 overflow-hidden rounded-full bg-[var(--meter-off)]">
        <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${w.left * 100}%`, background: color }} />
      </span>
      <span className="tabular w-[190px] whitespace-nowrap text-right text-[12.5px] text-ink-muted">
        <span className="font-medium text-ink">{pct(w)} left</span> · {resetText(w.resetsAt)}
      </span>
    </div>
  );
}

const INSTALL: Record<ProviderId, string> = {
  claude: "curl -fsSL https://claude.ai/install.sh | bash",
  codex: "npm install -g @openai/codex",
};

function ProviderOption({ a, selected, onPick }: { a: AgentInfo; selected: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      disabled={!a.installed}
      onClick={onPick}
      className={
        "flex w-full items-start gap-[12px] rounded-[12px] border p-[12px] text-left transition-colors " +
        (selected ? "border-[var(--ink)] bg-surface" : a.installed ? "border-line hover:border-[var(--checkbox)]" : "border-dashed border-line")
      }
    >
      <span className="mt-[1px] flex size-[24px] items-center justify-center">
        <ProviderLogo provider={a.provider} size={22} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-[8px] text-[14px] font-medium text-ink">
          {NAMES[a.provider]}
          {a.plan && <span className="text-[12px] font-normal text-ink-muted">{a.plan} plan</span>}
        </span>
        {a.installed ? (
          <span className="mt-[2px] block truncate text-[12px] text-ink-muted">
            {a.demo ? "Demo on the website" : [a.version && `v${a.version}`, a.path].filter(Boolean).join(" · ")}
          </span>
        ) : (
          <span className="mt-[4px] block text-[12px] text-ink-muted">
            Not installed. In Terminal: <code className="selectable rounded-[5px] bg-pill px-[5px] py-[1px] font-mono text-[11.5px] text-ink-2">{INSTALL[a.provider]}</code>
          </span>
        )}
      </span>
      <span className={"mt-[4px] size-[16px] shrink-0 rounded-full border-[1.5px] " + (selected ? "border-[5px] border-[var(--ink)]" : "border-[var(--checkbox)]")} />
    </button>
  );
}

export function AiPanel() {
  const agents = useStore((s) => s.agents);
  const provider = useStore((s) => s.provider);
  const setProvider = useStore((s) => s.setProvider);
  const model = useStore((s) => s.model);
  const setModel = useStore((s) => s.setModel);
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const setAgents = useStore((s) => s.setAgents);
  const setPanel = useStore((s) => s.setPanel);
  const htmlMail = useStore((s) => s.htmlMail);
  const loadImages = useStore((s) => s.loadImages);
  const senderIcons = useStore((s) => s.senderIcons);
  const setPref = useStore((s) => s.setPref);
  const agent = useActiveAgent();
  const [test, setTest] = useState<{ state: "idle" | "running" | "ok" | "error"; text: string }>({ state: "idle", text: "" });
  const [rescanning, setRescanning] = useState(false);

  const runTest = () => {
    if (!agent) return;
    const t0 = performance.now();
    let out = "";
    setTest({ state: "running", text: "" });
    runAgent(agent.provider, model[agent.provider], "PING. Reply with just the word: ok", (e) => {
      if (e.type === "delta") out += e.text;
      else if (e.type === "done") setTest({ state: "ok", text: `Replied “${(e.text || out).trim().slice(0, 40)}” in ${((performance.now() - t0) / 1000).toFixed(1)} s` });
      else setTest({ state: "error", text: e.message });
    });
  };

  const rescan = async () => {
    setRescanning(true);
    try {
      setAgents(await detectAgents());
    } finally {
      setRescanning(false);
    }
  };

  const usage = agent?.usage;
  const color = provider === "claude" ? "var(--claude)" : "var(--openai)";

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-[52px] shrink-0 items-center gap-[10px] border-b border-line-soft px-[20px]">
        <span className="text-[15px] font-semibold tracking-[-0.01em] text-ink">Settings</span>
        <button type="button" onClick={() => setPanel(null)} className="ml-auto flex size-[30px] items-center justify-center rounded-full text-ink-muted hover:bg-pill hover:text-ink" aria-label="Close">
          <CloseIcon size={15} />
        </button>
      </div>
      <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto">
        {LIVE && <AccountsSection />}
        <Section
          title="Your AI"
          note={
            <>
              Crooli uses the AI already on your Mac and your existing plan. No API keys.{" "}
              <button type="button" onClick={rescan} className="font-medium text-ink underline decoration-[var(--checkbox)] underline-offset-2">
                {rescanning ? "Looking…" : "Look again"}
              </button>
            </>
          }
        >
          <div className="grid gap-[8px]">
            {(["claude", "codex"] as ProviderId[]).map((p) => {
              const a = agents.find((x) => x.provider === p) ?? { provider: p, installed: false, path: null, version: null, plan: null, usage: null };
              return <ProviderOption key={p} a={a} selected={!!agent && agent.provider === p} onPick={() => setProvider(p)} />;
            })}
          </div>
        </Section>

        {agent && (
          <Section title="Model" note={MODELS[provider].find((m) => m.id === model[provider])?.note}>
            <Segmented value={model[provider]} options={MODELS[provider].map((m) => ({ id: m.id, label: m.label }))} onChange={(m) => setModel(provider, m)} />
          </Section>
        )}

        {agent && (
          <Section
            title="Usage"
            note={
              usage
                ? `From your Claude account, as last seen by Claude Code ${ago(usage.asOf)}. Crooli only reads it.`
                : provider === "codex"
                  ? "Codex doesn’t share its usage limits with other apps, so Crooli can’t show a meter."
                  : "Claude Code hasn’t recorded your usage yet. Use it once and this fills in."
            }
          >
            {usage?.fiveHour && <UsageRow label="5-hour limit" w={usage.fiveHour} color={color} />}
            {usage?.sevenDay && <UsageRow label="Weekly limit" w={usage.sevenDay} color={color} />}
            {!usage && <p className="text-[13px] text-ink-2">No usage data.</p>}
          </Section>
        )}

        {agent && (
          <Section title="Check" note="Sends one tiny message to your AI and times the reply.">
            <div className="flex items-center gap-[12px]">
              <button
                type="button"
                onClick={runTest}
                disabled={test.state === "running"}
                className="h-[32px] rounded-[9px] border border-line bg-surface px-[14px] text-[13px] font-medium text-ink transition-colors hover:bg-pill disabled:opacity-60"
              >
                {test.state === "running" ? "Waiting for a reply…" : "Test connection"}
              </button>
              {test.state === "ok" && <span className="text-[13px] text-[#2e9d55]">✓ {test.text}</span>}
              {test.state === "error" && <span className="truncate text-[13px] text-[#c4281c]">{test.text}</span>}
            </div>
          </Section>
        )}

        <Section title="Reading" note="Remote images can tell a sender when and where you opened their email. Keeping them off is more private.">
          <Toggle label="Show emails as designed" sub="Off shows every email as plain text." value={htmlMail} onChange={(v) => setPref("htmlMail", v)} />
          <Toggle label="Load remote images" sub="Pictures hosted on the sender’s servers." value={loadImages} onChange={(v) => setPref("loadImages", v)} />
          <Toggle label="Sender photos and logos" sub="Looks up profile pictures (Gravatar) and company logos (the sender’s own website)." value={senderIcons} onChange={(v) => setPref("senderIcons", v)} />
        </Section>

        {LIVE && <UpdatesSection />}

        <Section title="Appearance">
          <Segmented<Theme>
            value={theme}
            options={[
              { id: "system", label: "System" },
              { id: "light", label: "Light" },
              { id: "dark", label: "Dark" },
            ]}
            onChange={setTheme}
          />
        </Section>

        <p className="px-[24px] py-[18px] text-[12.5px] leading-[1.55] text-ink-muted">
          Crooli only messages your AI when you press Summarise, Draft or Continue. Nothing runs in the background, and nothing is sent,
          archived or deleted without you.
        </p>
      </div>
    </div>
  );
}

function AccountsSection() {
  const accounts = useStore((s) => s.accounts);
  const active = useStore((s) => s.active);
  const setActive = useStore((s) => s.setActive);
  const removeAccount = useStore((s) => s.removeAccount);
  const setPanel = useStore((s) => s.setPanel);
  const [confirm, setConfirm] = useState<string | null>(null);
  return (
    <Section title="Mail accounts" note="Removing an account deletes its password from the Keychain and its cache from this Mac. Your mail stays on the server.">
      <div className="grid gap-[8px]">
        {accounts.map((a) => (
          <div key={a.email} className={"flex items-center gap-[12px] rounded-[12px] border p-[12px] " + (a.email === active ? "border-[var(--ink)]" : "border-line")}>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-medium text-ink">{a.email}</span>
              <span className="block truncate text-[12px] text-ink-muted">
                {a.name} · {a.imapHost}
              </span>
            </span>
            {a.email !== active && (
              <button type="button" onClick={() => setActive(a.email)} className="h-[28px] rounded-[8px] px-[10px] text-[12.5px] font-medium text-ink hover:bg-pill">
                Use
              </button>
            )}
            {confirm === a.email ? (
              <button type="button" onClick={() => removeAccount(a.email)} className="h-[28px] rounded-[8px] bg-[#c4281c] px-[10px] text-[12.5px] font-medium text-white">
                Remove {a.email.split("@")[0]}?
              </button>
            ) : (
              <button type="button" onClick={() => setConfirm(a.email)} className="h-[28px] rounded-[8px] px-[10px] text-[12.5px] font-medium text-ink-muted hover:bg-pill hover:text-ink">
                Remove
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => setPanel("connect")}
          className="flex h-[44px] items-center justify-center rounded-[12px] border border-dashed border-line text-[13.5px] font-medium text-ink-2 transition-colors hover:border-[var(--checkbox)] hover:text-ink"
        >
          + Add an account
        </button>
      </div>
    </Section>
  );
}

function UpdatesSection() {
  const u = useUpdates();
  const busy = u.phase === "checking" || u.phase === "downloading" || u.phase === "installing";
  const when = u.checkedAt ? new Date(u.checkedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : null;
  return (
    <Section
      title="Updates"
      note="Updates come from Crooli’s releases on GitHub and are checked against Crooli’s signature before anything is installed. Mail restarts to finish."
    >
      <div className="flex items-center gap-[12px]">
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-medium text-ink">
            {u.phase === "available"
              ? `Version ${u.version} is available`
              : u.phase === "downloading"
                ? `Downloading ${Math.round(u.progress * 100)}%`
                : u.phase === "installing"
                  ? "Installing, then restarting…"
                  : u.phase === "checking"
                    ? "Checking…"
                    : u.phase === "upToDate"
                      ? "Mail is up to date"
                      : u.phase === "error"
                        ? "Couldn’t check for updates"
                        : "Updates"}
          </span>
          <span className="block text-[12px] text-ink-muted">
            {u.phase === "error" ? u.error : `You have ${u.current ? `version ${u.current}` : "the latest build"}${when && u.phase === "upToDate" ? ` · checked ${when}` : ""}`}
          </span>
        </span>
        {u.phase === "available" ? (
          <button type="button" onClick={u.install} className="btn-continue h-[32px] rounded-full px-[14px] text-[13px] font-medium">
            Install and restart
          </button>
        ) : (
          <button
            type="button"
            onClick={() => u.check()}
            disabled={busy}
            className="h-[32px] shrink-0 rounded-full border border-line bg-surface px-[14px] text-[13px] font-medium text-ink transition-colors hover:bg-pill disabled:opacity-50"
          >
            Check now
          </button>
        )}
      </div>
      {u.phase === "downloading" && (
        <div className="mt-[10px] h-[4px] overflow-hidden rounded-full bg-[var(--meter-off)]">
          <div className="h-full rounded-full bg-[var(--ink)] transition-[width] duration-200" style={{ width: `${u.progress * 100}%` }} />
        </div>
      )}
      {u.phase === "available" && u.notes && <p className="selectable mt-[10px] whitespace-pre-wrap rounded-[10px] bg-canvas px-[12px] py-[9px] text-[12.5px] leading-[1.5] text-ink-2">{u.notes}</p>}
      <div className="mt-[6px]">
        <Toggle label="Check automatically" sub="A quick check at launch and every few hours. Nothing installs until you press the button." value={u.auto} onChange={u.setAuto} />
      </div>
    </Section>
  );
}
