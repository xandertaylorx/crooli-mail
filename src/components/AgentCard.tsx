import openaiMark from "../assets/openai-mark.png";
import { ClaudeMark } from "../icons";
import type { AgentInfo } from "../lib/agent";
import { useStore } from "../store";

const BARS = 26;

function OpenAIMark({ size = 32 }: { size?: number }) {
  return (
    <span
      aria-label="OpenAI"
      className="block"
      style={{
        width: size + 8,
        height: size + 8,
        backgroundColor: "var(--openai)",
        WebkitMaskImage: `url(${openaiMark})`,
        maskImage: `url(${openaiMark})`,
        WebkitMaskSize: "contain",
        maskSize: "contain",
      }}
    />
  );
}

export function UsageMeter({ remaining, color }: { remaining: number; color: string }) {
  const on = Math.max(0, Math.min(BARS, Math.round(remaining * BARS)));
  return (
    <div
      className="flex h-[30px] w-[240px] items-stretch gap-[2.8px]"
      role="meter"
      aria-label="Usage left in this window"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(remaining * 100)}
      title={`${Math.round(remaining * 100)}% of your current usage window left`}
    >
      {Array.from({ length: BARS }, (_, i) => (
        <span
          key={i}
          className="meter-bar flex-1 rounded-[2.5px] transition-colors duration-300"
          style={{ backgroundColor: i < on ? color : "var(--meter-off)", animationDelay: `${i * 14}ms` }}
        />
      ))}
    </div>
  );
}

export function AgentCard() {
  const agents = useStore((s) => s.agents);
  const provider = useStore((s) => s.provider);
  const setProvider = useStore((s) => s.setProvider);
  const showToast = useStore((s) => s.showToast);

  const installed = agents.filter((a) => a.installed);
  const agent: AgentInfo | undefined = agents.find((a) => a.provider === provider && a.installed);

  const cycle = () => {
    if (installed.length < 2) {
      if (!agent) showToast("Install Claude Code or Codex to turn on AI");
      return;
    }
    const next = installed[(installed.findIndex((a) => a.provider === provider) + 1) % installed.length];
    setProvider(next.provider);
  };

  if (!agent) {
    return (
      <div className="flex h-[80px] items-center rounded-[16px] border border-line bg-surface px-[20px] shadow-[var(--card-shadow)]">
        <div>
          <div className="text-[20px] leading-[24px] text-ink-2">No AI connected</div>
          <div className="text-[15px] leading-[20px] text-ink-muted">Install Claude Code or Codex, then reopen Crooli</div>
        </div>
      </div>
    );
  }

  const isClaude = agent.provider === "claude";
  return (
    <button
      type="button"
      onClick={cycle}
      title={installed.length > 1 ? "Switch AI provider" : agent.path ?? undefined}
      className="flex h-[80px] w-full items-center rounded-[16px] border border-line bg-surface pl-[20px] pr-[20px] text-left shadow-[var(--card-shadow)] transition-colors duration-150 hover:border-[var(--checkbox)]"
    >
      <span className="flex size-[36px] shrink-0 items-center justify-center">
        {isClaude ? <ClaudeMark size={36} /> : <OpenAIMark size={32} />}
      </span>
      <span className="ml-[16px] flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[20px] leading-[24px] tracking-[-0.01em] text-ink-2">
          {agent.model ?? (isClaude ? "Claude" : "Codex")}
        </span>
        <span className="truncate text-[15px] leading-[20px] text-ink-muted">
          {agent.plan ?? (isClaude ? "Claude Code" : "Codex CLI")}
        </span>
      </span>
      <UsageMeter remaining={agent.remaining ?? 1} color={isClaude ? "var(--claude)" : "var(--openai)"} />
    </button>
  );
}
