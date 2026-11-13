import { useEffect, useRef, useState } from "react";
import type { Email } from "../data/mock";
import { ArchiveIcon, ClaudeMark, CloseIcon, ReplyIcon, SparkleIcon, StarIcon, TrashIcon, VerifiedBadge } from "../icons";
import { runAgent, type AgentEvent } from "../lib/agent";
import { useStore, visibleMail } from "../store";
import { Avatar } from "./MailList";

/** Streams one agent run into local state. */
function useAgentRun() {
  const provider = useStore((s) => s.provider);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const cancelRef = useRef<null | (() => void)>(null);

  const start = (prompt: string) => {
    cancelRef.current?.();
    setText("");
    setStatus("running");
    cancelRef.current = runAgent(provider, prompt, (e: AgentEvent) => {
      if (e.type === "delta") setText((t) => t + e.text);
      else if (e.type === "done") {
        setText((t) => (t.length ? t : e.text));
        setStatus("done");
      } else {
        setText(e.message);
        setStatus("error");
      }
    });
  };
  const stop = () => {
    cancelRef.current?.();
    cancelRef.current = null;
    setStatus((s) => (s === "running" ? "done" : s));
  };
  const reset = () => {
    stop();
    setText("");
    setStatus("idle");
  };
  useEffect(() => () => cancelRef.current?.(), []);
  return { text, status, start, stop, reset, provider };
}

function ProviderDot() {
  const provider = useStore((s) => s.provider);
  return provider === "claude" ? (
    <ClaudeMark size={18} />
  ) : (
    <span className="flex size-[18px] items-center justify-center rounded-full bg-[var(--openai)] text-[10px] font-bold text-[var(--surface)]">AI</span>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="flex size-[38px] items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-pill hover:text-ink"
    >
      {children}
    </button>
  );
}

const emailContext = (m: Email) =>
  `From: ${m.fromName} <${m.fromAddress}>\nDate: ${m.date.toUTCString()}\nSubject: ${m.subject}\n\n${m.body}`;

function MessageView({ email }: { email: Email }) {
  const archive = useStore((s) => s.archive);
  const toggleStar = useStore((s) => s.toggleStar);
  const select = useStore((s) => s.select);
  const showToast = useStore((s) => s.showToast);
  const summary = useAgentRun();
  const draft = useAgentRun();
  const [reply, setReply] = useState("");

  useEffect(() => {
    summary.reset();
    draft.reset();
    setReply("");
  }, [email.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (draft.status !== "idle") setReply(draft.text);
  }, [draft.text, draft.status]);

  // Website demo scenes: start a summary or draft straight away.
  const demoAuto = useStore((s) => s.demoAuto);
  useEffect(() => {
    if (!demoAuto) return;
    const t = window.setTimeout(() => {
      if (demoAuto === "summary") summaryBtn.current?.click();
      else draftBtn.current?.click();
      useStore.setState({ demoAuto: null });
    }, 700);
    return () => window.clearTimeout(t);
  }, [demoAuto]);
  const summaryBtn = useRef<HTMLButtonElement>(null);
  const draftBtn = useRef<HTMLButtonElement>(null);

  const next = () => {
    const s = useStore.getState();
    const list = visibleMail(s);
    const i = list.findIndex((m) => m.id === email.id);
    return list[i + 1] ?? list[i - 1];
  };

  return (
    <article className="flex h-full flex-col">
      <div className="flex h-[64px] shrink-0 items-center gap-[2px] border-b border-line-soft px-[16px]">
        <IconButton
          label="Archive (E)"
          onClick={() => {
            const n = next();
            archive(email.id);
            showToast("Archived");
            select(n?.id ?? null);
          }}
        >
          <ArchiveIcon size={20} />
        </IconButton>
        <IconButton label="Delete" onClick={() => showToast("Connect a mailbox to delete")}>
          <TrashIcon size={20} />
        </IconButton>
        <IconButton label={email.starred ? "Unstar (S)" : "Star (S)"} onClick={() => toggleStar(email.id)}>
          <StarIcon size={20} filled={email.starred} className={email.starred ? "text-[#f5b301]" : ""} />
        </IconButton>
        <div className="ml-auto" />
        <button
          ref={summaryBtn}
          type="button"
          onClick={() =>
            summary.start(
              `SUMMARY. Summarise this email in one or two plain sentences for a busy reader. British spelling. No preamble.\n\n${emailContext(email)}`,
            )
          }
          className="flex h-[38px] items-center gap-[8px] rounded-full border border-line px-[14px] text-[15px] font-medium text-ink-2 transition-colors hover:bg-pill"
        >
          <SparkleIcon size={16} className="text-claude" />
          Summarise
        </button>
      </div>

      <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto px-[40px] pb-[32px] pt-[32px]">
        <h2 className="selectable text-[28px] font-semibold leading-[1.2] tracking-[-0.025em] text-ink [text-wrap:balance]">{email.subject}</h2>

        <div className="mt-[20px] flex items-center gap-[12px]">
          <Avatar avatar={email.avatar} size={40} />
          <div className="min-w-0">
            <div className="flex items-center gap-[6px]">
              <span className="text-[17px] font-medium text-ink">{email.fromName}</span>
              {email.verified && <VerifiedBadge size={17} />}
            </div>
            <div className="selectable truncate text-[14px] text-ink-muted">{email.fromAddress}</div>
          </div>
          <time className="ml-auto shrink-0 text-[14px] text-ink-muted">
            {email.date.toLocaleString("en-GB", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
          </time>
        </div>

        {summary.status !== "idle" && (
          <div className="pop-in mt-[24px] rounded-[14px] border border-line bg-canvas p-[16px]">
            <div className="mb-[6px] flex items-center gap-[8px] text-[13px] font-medium uppercase tracking-[0.04em] text-ink-muted">
              <ProviderDot /> Summary
              <button type="button" onClick={summary.reset} className="ml-auto rounded-full p-[4px] hover:bg-pill" aria-label="Close summary">
                <CloseIcon size={14} />
              </button>
            </div>
            <p className={"selectable whitespace-pre-wrap text-[16px] leading-[1.55] text-ink-2 " + (summary.status === "running" ? "caret" : "")}>
              {summary.text}
            </p>
          </div>
        )}

        <div className="selectable mt-[28px] max-w-[680px] whitespace-pre-wrap text-[17px] leading-[1.65] tracking-[-0.005em] text-ink-2">
          {email.body}
        </div>
      </div>

      <div className="shrink-0 border-t border-line-soft p-[16px]">
        <div className="rounded-[16px] border border-line bg-surface transition-shadow focus-within:shadow-[0_0_0_3px_var(--line)]">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder={`Reply to ${email.fromName.split(" ")[0]}…`}
            rows={reply ? 5 : 2}
            className={
              "block w-full resize-none rounded-t-[16px] bg-transparent px-[16px] pt-[14px] text-[16px] leading-[1.55] text-ink outline-none placeholder:text-ink-faint " +
              (draft.status === "running" ? "caret" : "")
            }
          />
          <div className="flex items-center gap-[8px] px-[10px] pb-[10px]">
            <button
              ref={draftBtn}
              type="button"
              onClick={() =>
                draft.status === "running"
                  ? draft.stop()
                  : draft.start(
                      `DRAFT. Write a short, warm, plain reply to this email from me. British spelling. No subject line, no placeholders like [Name]. Output only the reply body.\n\n${emailContext(email)}`,
                    )
              }
              className="flex h-[36px] items-center gap-[8px] rounded-full bg-pill px-[14px] text-[15px] font-medium text-ink-2 transition-colors hover:bg-[var(--pill-hover)]"
            >
              <SparkleIcon size={16} className="text-claude" />
              {draft.status === "running" ? "Stop" : reply ? "Redraft" : "Draft with AI"}
            </button>
            <button
              type="button"
              disabled={!reply.trim()}
              onClick={() => showToast("Connect a mailbox to send")}
              className="btn-continue ml-auto flex h-[36px] items-center gap-[8px] rounded-full px-[16px] text-[15px] font-medium disabled:opacity-40"
            >
              <ReplyIcon size={16} />
              Send
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function ContinueView() {
  const setPanel = useStore((s) => s.setPanel);
  const run = useAgentRun();
  useEffect(() => {
    const s = useStore.getState();
    const top = visibleMail({ ...s, folder: "inbox", query: "" }).slice(0, 12);
    const digest = top.map((m, i) => `#${i + 1} ${emailContext(m)}`).join("\n\n---\n\n");
    run.start(
      `TRIAGE. You are the assistant inside the Crooli Mail app. Work through these inbox emails for me. Group them under **Needs you**, **For your information** and **Suggested** (actions such as archive or unsubscribe). One short bullet per email, plain and calm, British spelling. Don't invent details.\n\n${digest}`,
    );
    return run.stop;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const lines = run.text.split("\n");
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-[64px] shrink-0 items-center gap-[10px] border-b border-line-soft px-[24px]">
        <ProviderDot />
        <span className="text-[17px] font-medium text-ink">Continue</span>
        <span className="text-[15px] text-ink-muted">{run.status === "running" ? "Working through your inbox…" : run.status === "done" ? "Ready for review" : ""}</span>
        <div className="ml-auto flex items-center gap-[6px]">
          {run.status === "running" && (
            <button type="button" onClick={run.stop} className="h-[34px] rounded-full px-[14px] text-[15px] text-ink-muted hover:bg-pill">
              Stop
            </button>
          )}
          <IconButton label="Close" onClick={() => setPanel(null)}>
            <CloseIcon size={18} />
          </IconButton>
        </div>
      </div>
      <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto px-[40px] py-[32px]">
        <div className={"selectable max-w-[680px] text-[17px] leading-[1.65] text-ink-2 " + (run.status === "running" ? "caret" : "")}>
          {lines.map((l, i) => {
            const h = l.match(/^\*\*(.+)\*\*$/);
            if (h)
              return (
                <h3 key={i} className="mb-[6px] mt-[18px] text-[13px] font-semibold uppercase tracking-[0.05em] text-ink-muted first:mt-0">
                  {h[1]}
                </h3>
              );
            if (!l.trim()) return null;
            return (
              <p key={i} className="py-[3px]">
                {l.replace(/\*\*/g, "")}
              </p>
            );
          })}
        </div>
        {run.status === "error" && <p className="mt-[16px] text-[15px] text-[#c4281c]">The agent stopped with an error. Check that it’s signed in, then try again.</p>}
        {run.status === "done" && (
          <p className="pop-in mt-[28px] text-[14px] text-ink-muted">
            Nothing is sent, archived or deleted until you approve it.
          </p>
        )}
      </div>
    </div>
  );
}

function ComposeView() {
  const setPanel = useStore((s) => s.setPanel);
  const showToast = useStore((s) => s.showToast);
  const run = useAgentRun();
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [ask, setAsk] = useState("");
  const [body, setBody] = useState("");
  useEffect(() => {
    if (run.status !== "idle") setBody(run.text);
  }, [run.text, run.status]);

  const field = "w-full bg-transparent text-[16px] text-ink outline-none placeholder:text-ink-faint";
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-[64px] shrink-0 items-center gap-[10px] border-b border-line-soft px-[24px]">
        <span className="text-[17px] font-medium text-ink">New message</span>
        <div className="ml-auto">
          <IconButton label="Close" onClick={() => setPanel(null)}>
            <CloseIcon size={18} />
          </IconButton>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col px-[24px]">
        <label className="flex items-center gap-[12px] border-b border-line-soft py-[14px]">
          <span className="w-[64px] text-[15px] text-ink-muted">To</span>
          <input autoFocus value={to} onChange={(e) => setTo(e.target.value)} className={field} placeholder="name@example.com" />
        </label>
        <label className="flex items-center gap-[12px] border-b border-line-soft py-[14px]">
          <span className="w-[64px] text-[15px] text-ink-muted">Subject</span>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} className={field} />
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className={"min-h-0 flex-1 resize-none py-[16px] leading-[1.6] " + field + (run.status === "running" ? " caret" : "")}
          placeholder="Write something, or ask AI below."
        />
      </div>
      <div className="flex shrink-0 items-center gap-[8px] border-t border-line-soft p-[16px]">
        <div className="flex h-[42px] flex-1 items-center gap-[10px] rounded-full border border-line bg-surface pl-[14px] pr-[6px]">
          <SparkleIcon size={16} className="shrink-0 text-claude" />
          <input
            value={ask}
            onChange={(e) => setAsk(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && ask.trim())
                run.start(`DRAFT. Write an email body (no subject line) for this request. Plain, warm, British spelling. Output only the body.\nTo: ${to}\nSubject: ${subject}\nRequest: ${ask}`);
            }}
            placeholder="Ask AI to write it — e.g. “thank Maya for the brief, suggest Thursday”"
            className={field + " text-[15px]"}
          />
        </div>
        <button
          type="button"
          disabled={!to || !body.trim()}
          onClick={() => showToast("Connect a mailbox to send")}
          className="btn-continue flex h-[42px] items-center rounded-full px-[18px] text-[15px] font-medium disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </div>
  );
}

export function ReaderPane() {
  const panel = useStore((s) => s.panel);
  const selectedId = useStore((s) => s.selectedId);
  const email = useStore((s) => s.mail.find((m) => m.id === selectedId));

  return (
    <div className="h-full min-w-0 flex-1 py-[23px] pr-[23px]">
      <div className="h-full overflow-hidden rounded-[16px] border border-line bg-surface shadow-[var(--card-shadow)]">
        {panel === "continue" ? (
          <ContinueView key="continue" />
        ) : panel === "compose" ? (
          <ComposeView key="compose" />
        ) : email ? (
          <MessageView email={email} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-[8px] text-ink-faint">
            <span className="text-[17px]">No message selected</span>
            <span className="text-[14px]">Use J and K to move through your mail</span>
          </div>
        )}
      </div>
    </div>
  );
}
