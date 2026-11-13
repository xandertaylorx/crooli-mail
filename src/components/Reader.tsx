import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Email } from "../data/mock";
import { ArchiveIcon, CloseIcon, ForwardIcon, ReplyIcon, SparkleIcon, StarIcon, TrashIcon } from "../icons";
import { runAgent, type AgentEvent } from "../lib/agent";
import { mailApi } from "../lib/mail";
import { LIVE, useStore, visibleMail, type ComposeSeed } from "../store";
import { AiPanel, ProviderLogo } from "./AgentCard";
import { ConnectPanel } from "./ConnectPanel";
import { Avatar } from "./MailList";
import { RecipientInput } from "./RecipientInput";

/** Streams one agent run into local state, using the provider and model from settings. */
function useAgentRun() {
  const provider = useStore((s) => s.provider);
  const model = useStore((s) => s.model[s.provider]);
  const hasAgent = useStore((s) => s.agents.some((a) => a.installed && a.provider === s.provider));
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const cancelRef = useRef<null | (() => void)>(null);
  const gen = useRef(0);

  const start = (prompt: string) => {
    if (!hasAgent) {
      useStore.getState().setPanel("ai");
      return;
    }
    cancelRef.current?.();
    const mine = ++gen.current;
    setText("");
    setStatus("running");
    const go = (m: string, retried: boolean) => {
      cancelRef.current = runAgent(provider, m, prompt, (e: AgentEvent) => {
        if (mine !== gen.current) return; // a newer run (or a stop) owns the state now
        if (e.type === "delta") setText((t) => t + e.text);
        else if (e.type === "done") {
          setText((t) => (t.length ? t : e.text));
          setStatus("done");
        } else if (!retried && provider === "codex" && m && /model/i.test(e.message)) {
          // The chosen Codex model isn't available on this account: fall back to Codex's own default.
          go("", true);
        } else {
          setText(e.message);
          setStatus("error");
        }
      });
    };
    go(model, false);
  };
  const stop = () => {
    gen.current++;
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
  return { text, status, start, stop, reset };
}

function ActiveLogo({ size = 16 }: { size?: number }) {
  const provider = useStore((s) => s.provider);
  return <ProviderLogo provider={provider} size={size} />;
}

function IconButton({ label, onClick, children, active }: { label: string; onClick: () => void; children: React.ReactNode; active?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={"flex size-[30px] items-center justify-center rounded-[8px] transition-colors hover:bg-pill hover:text-ink " + (active ? "text-ink" : "text-ink-muted")}
    >
      {children}
    </button>
  );
}

function PanelHeader({ title, sub, onClose, children }: { title: string; sub?: string; onClose: () => void; children?: React.ReactNode }) {
  return (
    <div className="flex h-[52px] shrink-0 items-center gap-[10px] border-b border-line-soft px-[20px]">
      <span className="text-[15px] font-semibold tracking-[-0.01em] text-ink">{title}</span>
      {sub && <span className="text-[13px] text-ink-muted">{sub}</span>}
      <div className="ml-auto flex items-center gap-[4px]">
        {children}
        <IconButton label="Close" onClick={onClose}>
          <CloseIcon size={15} />
        </IconButton>
      </div>
    </div>
  );
}

const emailContext = (m: Email) => `From: ${m.fromName} <${m.fromAddress}>\nDate: ${m.date.toUTCString()}\nSubject: ${m.subject}\n\n${m.body || m.preview}`;

const btnGhost =
  "flex h-[30px] shrink-0 items-center whitespace-nowrap rounded-full border border-line px-[14px] text-[13px] font-medium text-ink-2 transition-colors hover:bg-pill hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent";

const btnQuiet =
  "flex h-[30px] items-center gap-[6px] rounded-[8px] px-[10px] text-[13px] font-medium text-ink-2 transition-colors hover:bg-pill disabled:opacity-40 disabled:hover:bg-transparent";


/** HTML email in a locked-down frame: no scripts, and remote content only if Settings allow it. */
function HtmlBody({ html, images }: { html: string; images: boolean }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [h, setH] = useState(200);
  const csp = `default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data: cid:${images ? " https: http:" : ""};`;
  const doc = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><base target="_blank"><style>html,body{margin:0;background:#fff;color:#222;font:14px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;word-wrap:break-word}body{padding:18px 20px}img{max-width:100%;height:auto}table{max-width:100%}a{color:#0a6cf0}${images ? "" : 'img[src^="http"],img[src^="//"]{display:none!important}'}</style></head><body>${html}</body></html>`;

  useLayoutEffect(() => {
    const f = ref.current;
    if (!f) return;
    const fit = () => {
      const d = f.contentDocument;
      if (!d?.body) return;
      setH(Math.min(20000, Math.max(80, d.documentElement.scrollHeight)));
      d.querySelectorAll("a[href]").forEach((a) => {
        a.addEventListener("click", (e) => {
          e.preventDefault();
          const href = (a as HTMLAnchorElement).href;
          if (href.startsWith("https://")) (LIVE ? mailApi.openUrl(href) : Promise.resolve(window.open(href, "_blank", "noopener"))).catch(() => {});
        });
      });
    };
    f.addEventListener("load", fit);
    const t = window.setTimeout(fit, 400);
    return () => {
      f.removeEventListener("load", fit);
      window.clearTimeout(t);
    };
  }, [doc]);

  return (
    <div className="mt-[18px] overflow-hidden rounded-[10px] bg-white">
      {/* allow-same-origin (without scripts) only so we can size the frame and catch link clicks */}
      <iframe ref={ref} title="Message" sandbox="allow-same-origin allow-popups" srcDoc={doc} style={{ height: h }} className="block w-full border-0" />
    </div>
  );
}

function MessageView({ email }: { email: Email }) {
  const move = useStore((s) => s.move);
  const toggleStar = useStore((s) => s.toggleStar);
  const select = useStore((s) => s.select);
  const showToast = useStore((s) => s.showToast);
  const send = useStore((s) => s.send);
  const saveDraft = useStore((s) => s.saveDraft);
  const summary = useAgentRun();
  const draft = useAgentRun();
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const htmlMail = useStore((s) => s.htmlMail);
  const loadImages = useStore((s) => s.loadImages);
  const summaryBtn = useRef<HTMLButtonElement>(null);
  const draftBtn = useRef<HTMLButtonElement>(null);
  const demoAuto = useStore((s) => s.demoAuto);
  const loading = LIVE && !email.bodyLoaded;

  useEffect(() => {
    summary.reset();
    draft.reset();
    setReply("");
  }, [email.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (draft.status !== "idle") setReply(draft.text);
  }, [draft.text, draft.status]);

  // Website demo scenes start a summary or a draft straight away.
  useEffect(() => {
    if (!demoAuto) return;
    const t = window.setTimeout(() => {
      (demoAuto === "summary" ? summaryBtn : draftBtn).current?.click();
      useStore.setState({ demoAuto: null });
    }, 700);
    return () => window.clearTimeout(t);
  }, [demoAuto]);

  const leave = (to: "archive" | "trash") => {
    const s = useStore.getState();
    const list = visibleMail(s);
    const i = list.findIndex((m) => m.id === email.id);
    const n = list[i + 1] ?? list[i - 1];
    move(email.id, to);
    showToast(to === "archive" ? "Archived" : "Moved to Trash");
    select(n?.id ?? null);
  };

  const replyMsg = () => ({
    to: email.fromAddress,
    subject: /^re:/i.test(email.subject) ? email.subject : `Re: ${email.subject}`,
    body: reply,
    inReplyTo: email.messageId ?? null,
    references: email.references ?? null,
  });

  const doSend = async () => {
    if (!reply.trim() || sending) return;
    setSending(true);
    try {
      await send(replyMsg());
      setReply("");
      draft.reset();
      showToast(`Sent to ${email.fromName}`);
    } catch (e) {
      showToast(typeof e === "string" ? e : e instanceof Error ? e.message : "Sending failed.");
    } finally {
      setSending(false);
    }
  };

  const outgoing = email.folder === "sent";

  const forward = () => {
    const when = email.date.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    const header = [
      "---------- Forwarded message ----------",
      `From: ${email.fromName}${email.fromAddress && !outgoing ? ` <${email.fromAddress}>` : ""}`,
      `Date: ${when}`,
      `Subject: ${email.subject}`,
      email.to ? `To: ${email.to}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    useStore.getState().openCompose({
      to: "",
      subject: /^fwd?:/i.test(email.subject) ? email.subject : `Fwd: ${email.subject}`,
      body: `\n\n${header}\n\n${email.body || email.preview}`,
    });
  };

  // F forwards the open message.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "f" || e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement).closest("input, textarea, [contenteditable]")) return;
      if (useStore.getState().panel) return;
      e.preventDefault();
      forward();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <article className="flex h-full flex-col">
      <div className="flex h-[52px] shrink-0 items-center gap-[2px] border-b border-line-soft px-[12px]">
        {email.folder !== "archive" && (
          <IconButton label="Archive (E)" onClick={() => leave("archive")}>
            <ArchiveIcon size={17} />
          </IconButton>
        )}
        {email.folder !== "trash" ? (
          <IconButton label="Move to Trash (Delete)" onClick={() => leave("trash")}>
            <TrashIcon size={17} />
          </IconButton>
        ) : (
          <button type="button" className={btnQuiet} onClick={() => leave("archive")}>
            Restore to Archive
          </button>
        )}
        <IconButton label={email.starred ? "Unstar (S)" : "Star (S)"} onClick={() => toggleStar(email.id)} active={email.starred}>
          <StarIcon size={17} filled={email.starred} className={email.starred ? "text-[#f5b301]" : ""} />
        </IconButton>
        <span className="mx-[4px] h-[16px] w-px bg-line" aria-hidden />
        <IconButton label="Forward (F)" onClick={forward}>
          <ForwardIcon size={17} />
        </IconButton>
        <button
          ref={summaryBtn}
          type="button"
          disabled={loading}
          onClick={() =>
            summary.status === "running"
              ? summary.stop()
              : summary.start(`SUMMARY. Summarise this email in one or two plain sentences for a busy reader. British spelling. No preamble.\n\n${emailContext(email)}`)
          }
          className={btnQuiet + " ml-auto"}
        >
          <SparkleIcon size={14} className="text-claude" />
          {summary.status === "running" ? "Stop" : "Summarise"}
        </button>
      </div>

      <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto px-[28px] pb-[24px] pt-[22px]">
        <h2 className="selectable text-[20px] font-semibold leading-[1.25] tracking-[-0.02em] text-ink [text-wrap:balance]">{email.subject}</h2>

        <div className="mt-[14px] flex items-center gap-[10px]">
          <Avatar avatar={email.avatar} size={32} address={email.peer} />
          <div className="min-w-0">
            <div className="text-[13.5px] font-medium text-ink">{email.fromName}</div>
            <div className="selectable truncate text-[12px] text-ink-muted">
              {outgoing ? `To ${email.to || email.fromName.replace(/^To: /, "")}` : email.fromAddress}
              {email.cc ? ` · Cc ${email.cc}` : ""}
            </div>
          </div>
          <time className="ml-auto shrink-0 text-[12px] text-ink-muted">
            {email.date.toLocaleString("en-GB", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
          </time>
        </div>

        {summary.status !== "idle" && (
          <div className="pop-in mt-[18px] rounded-[10px] bg-canvas px-[14px] py-[12px]">
            <div className="mb-[4px] flex items-center gap-[6px] text-[11.5px] font-medium uppercase tracking-[0.05em] text-ink-faint">
              <ActiveLogo size={13} /> Summary
            </div>
            <p className={"selectable whitespace-pre-wrap text-[14px] leading-[1.55] " + (summary.status === "error" ? "text-[#c4281c]" : "text-ink-2") + (summary.status === "running" ? " caret" : "")}>
              {summary.text}
            </p>
          </div>
        )}

        {loading ? (
          <div className="mt-[22px] space-y-[10px]" aria-label="Loading message">
            {[92, 100, 76, 88].map((w, i) => (
              <div key={i} className="h-[12px] animate-pulse rounded-full bg-pill" style={{ width: `${w}%` }} />
            ))}
          </div>
        ) : email.html && htmlMail ? (
          <HtmlBody html={email.html} images={loadImages} />
        ) : (
          <div className="selectable mt-[20px] max-w-[640px] whitespace-pre-wrap text-[14.5px] leading-[1.65] text-ink-2">{email.body || email.preview}</div>
        )}

        {email.attachments && email.attachments.length > 0 && (
          <div className="mt-[18px] flex flex-wrap gap-[6px]">
            {email.attachments.map((a, i) => (
              <span key={i} className="rounded-[8px] border border-line px-[10px] py-[5px] text-[12.5px] text-ink-2">
                📎 {a}
              </span>
            ))}
          </div>
        )}
      </div>

      {!outgoing && email.folder !== "drafts" && (
        <div className="shrink-0 border-t border-line-soft px-[16px] pb-[14px] pt-[10px]">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                doSend();
              }
            }}
            placeholder={`Reply to ${email.fromName.split(" ")[0]}`}
            rows={reply ? 6 : 2}
            className={
              "block w-full resize-none bg-transparent px-[4px] py-[6px] text-[14px] leading-[1.55] text-ink outline-none placeholder:text-ink-faint focus-visible:outline-none " +
              (draft.status === "running" ? "caret" : "")
            }
          />
          <div className="mt-[6px] flex items-center gap-[4px]">
            <button
              ref={draftBtn}
              type="button"
              disabled={loading}
              onClick={() =>
                draft.status === "running"
                  ? draft.stop()
                  : draft.start(
                      `DRAFT. Write a short, warm, plain reply to this email from me. British spelling. No subject line, no placeholders like [Name]. Output only the reply body.\n\n${emailContext(email)}`,
                    )
              }
              className={btnQuiet + " -ml-[6px]"}
            >
              <SparkleIcon size={14} className="text-claude" />
              {draft.status === "running" ? "Stop" : reply ? "Redraft" : "Draft with AI"}
            </button>
            <button
              type="button"
              onClick={() => useStore.getState().openCompose({ ...replyMsg(), to: email.fromAddress })}
              className={btnQuiet}
              title="Open in a full message window"
            >
              <ReplyIcon size={14} />
              Expand
            </button>
            <button
              type="button"
              disabled={!reply.trim()}
              onClick={async () => {
                await saveDraft(replyMsg()).catch((e) => showToast(String(e)));
                setReply("");
                draft.reset();
                showToast("Saved to Drafts");
              }}
              className={btnGhost + " ml-auto"}
            >
              Save draft
            </button>
            <button
              type="button"
              disabled={!reply.trim() || sending}
              onClick={doSend}
              title={LIVE ? "Send (⌘↩)" : "Sending works in the app, not this demo"}
              className="btn-continue h-[30px] rounded-full px-[14px] text-[13px] font-medium disabled:opacity-35"
            >
              {sending ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

function ContinueView() {
  const setPanel = useStore((s) => s.setPanel);
  const run = useAgentRun();

  useEffect(() => {
    const s = useStore.getState();
    const top = visibleMail({ ...s, folder: "inbox", query: "", filter: "all" }).slice(0, 12);
    const digest = top.map((m, i) => `#${i + 1} ${emailContext(m)}`).join("\n\n---\n\n");
    run.start(
      `TRIAGE. You are the assistant inside the Crooli Mail app. Work through these inbox emails for me. Group them under **Needs you**, **For your information** and **Can go**. One short bullet per email, plain and calm, British spelling. Don't invent details.\n\n${digest}`,
    );
    return run.stop;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex h-full flex-col">
      <PanelHeader
        title="Continue"
        sub={run.status === "running" ? "Reading your latest 12 emails…" : run.status === "done" ? "Done" : ""}
        onClose={() => setPanel(null)}
      >
        {run.status === "running" && (
          <button type="button" onClick={run.stop} className={btnQuiet}>
            Stop
          </button>
        )}
      </PanelHeader>
      <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto px-[28px] py-[22px]">
        <div className={"selectable max-w-[640px] text-[14.5px] leading-[1.65] " + (run.status === "error" ? "text-[#c4281c]" : "text-ink-2") + (run.status === "running" ? " caret" : "")}>
          {run.text.split("\n").map((l, i) => {
            const h = l.match(/^\*\*(.+)\*\*$/);
            if (h)
              return (
                <h3 key={i} className="mb-[4px] mt-[16px] text-[11.5px] font-semibold uppercase tracking-[0.06em] text-ink-faint first:mt-0">
                  {h[1]}
                </h3>
              );
            if (!l.trim()) return null;
            return (
              <p key={i} className="py-[2px]">
                {l.replace(/\*\*/g, "")}
              </p>
            );
          })}
        </div>
        {run.status === "done" && <p className="pop-in mt-[22px] text-[12.5px] text-ink-muted">Suggestions only. Nothing has been sent, archived or deleted.</p>}
      </div>
    </div>
  );
}

function ComposeView({ seed }: { seed: ComposeSeed }) {
  const setPanel = useStore((s) => s.setPanel);
  const showToast = useStore((s) => s.showToast);
  const saveDraft = useStore((s) => s.saveDraft);
  const send = useStore((s) => s.send);
  const run = useAgentRun();
  const [to, setTo] = useState(seed.to);
  const [cc, setCc] = useState(seed.cc ?? "");
  const [showCc, setShowCc] = useState(!!seed.cc);
  const [subject, setSubject] = useState(seed.subject);
  const [ask, setAsk] = useState("");
  const [body, setBody] = useState(seed.body);
  const [sending, setSending] = useState(false);
  const done = useRef(false);
  const latest = useRef({ to, cc, subject, body });
  latest.current = { to, cc, subject, body };

  useEffect(() => {
    if (run.status !== "idle") setBody(run.text);
  }, [run.text, run.status]);

  // A draft body can arrive after the panel opens.
  useEffect(() => {
    if (seed.body && !latest.current.body) setBody(seed.body);
  }, [seed.body]);

  // Leaving without sending keeps your work: it's saved to Drafts.
  useEffect(
    () => () => {
      const m = latest.current;
      const changed = m.body.trim() !== seed.body.trim() || m.subject !== seed.subject || m.to !== seed.to;
      if (done.current || !changed || (!m.body.trim() && !m.subject.trim())) return;
      saveDraft({ ...m, inReplyTo: seed.inReplyTo, references: seed.references, draftId: seed.draftId })
        .then(() => useStore.getState().showToast("Draft saved"))
        .catch(() => {});
    },
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const doSend = async () => {
    if (sending) return;
    setSending(true);
    try {
      await send({ to, cc, subject, body, inReplyTo: seed.inReplyTo, references: seed.references, draftId: seed.draftId });
      done.current = true;
      showToast("Sent");
      setPanel(null);
    } catch (e) {
      showToast(typeof e === "string" ? e : e instanceof Error ? e.message : "Sending failed.");
    } finally {
      setSending(false);
    }
  };

  const field = "w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-faint focus-visible:outline-none";
  return (
    <div
      className="flex h-full flex-col"
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          doSend();
        }
      }}
    >
      <PanelHeader title={seed.draftId != null ? "Edit draft" : seed.inReplyTo ? "Reply" : "New message"} onClose={() => setPanel(null)}>
        <button
          type="button"
          onClick={() => {
            done.current = true;
            setPanel(null);
            if (seed.draftId != null) {
              useStore.getState().move(seed.draftId, "trash");
              showToast("Draft deleted");
            }
          }}
          className={btnQuiet}
        >
          Discard
        </button>
      </PanelHeader>
      <div className="flex min-h-0 flex-1 flex-col px-[20px]">
        <label className="flex items-center gap-[10px] border-b border-line-soft py-[11px]">
          <span className="w-[56px] text-[13px] text-ink-muted">To</span>
          <RecipientInput autoFocus={!to} value={to} onChange={setTo} className={field} placeholder="Start typing a name or address" />
          {!showCc && (
            <button type="button" onClick={() => setShowCc(true)} className="text-[12.5px] text-ink-faint hover:text-ink">
              Cc
            </button>
          )}
        </label>
        {showCc && (
          <label className="flex items-center gap-[10px] border-b border-line-soft py-[11px]">
            <span className="w-[56px] text-[13px] text-ink-muted">Cc</span>
            <RecipientInput value={cc} onChange={setCc} className={field} />
          </label>
        )}
        <label className="flex items-center gap-[10px] border-b border-line-soft py-[11px]">
          <span className="w-[56px] text-[13px] text-ink-muted">Subject</span>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} className={field} />
        </label>
        <textarea
          autoFocus={!!to}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className={"min-h-0 flex-1 resize-none py-[14px] leading-[1.6] " + field + (run.status === "running" ? " caret" : "")}
          placeholder="Write your message, or ask AI below."
        />
      </div>
      <div className="flex shrink-0 items-center gap-[8px] border-t border-line-soft px-[16px] py-[12px]">
        <SparkleIcon size={14} className="shrink-0 text-claude" />
        <input
          value={ask}
          onChange={(e) => setAsk(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.metaKey && ask.trim()) {
              e.preventDefault();
              run.start(
                `DRAFT. Write an email body (no subject line) for this request. Plain, warm, British spelling. Output only the body.\nTo: ${to}\nSubject: ${subject}\n${body.trim() ? `Current draft:\n${body}\n` : ""}Request: ${ask}`,
              );
            }
          }}
          placeholder={body.trim() ? "Ask AI to change it, e.g. “shorter and friendlier”" : "Ask AI to write it, e.g. “thank Maya, suggest Thursday”"}
          className={field + " text-[13.5px]"}
        />
        <button
          type="button"
          disabled={!body.trim() && !subject.trim()}
          onClick={async () => {
            done.current = true;
            await saveDraft({ to, cc, subject, body, inReplyTo: seed.inReplyTo, references: seed.references, draftId: seed.draftId }).catch((e) => showToast(String(e)));
            showToast("Saved to Drafts");
            setPanel(null);
          }}
          className={btnGhost}
        >
          Save draft
        </button>
        <button
          type="button"
          disabled={!to.trim() || !body.trim() || sending}
          onClick={doSend}
          title={LIVE ? "Send (⌘↩)" : "Sending works in the app, not this demo"}
          className="btn-continue h-[30px] rounded-full px-[14px] text-[13px] font-medium disabled:opacity-35"
        >
          {sending ? "Sending…" : "Send"}
        </button>
      </div>
    </div>
  );
}

export function ReaderPane() {
  const panel = useStore((s) => s.panel);
  const compose = useStore((s) => s.compose);
  const selectedId = useStore((s) => s.selectedId);
  const accounts = useStore((s) => s.accounts.length);
  const email = useStore((s) => s.mail.find((m) => m.id === selectedId));
  const openCompose = useStore((s) => s.openCompose);

  return (
    <div className="h-full min-w-0 flex-1 py-[12px] pr-[12px]">
      <div className="h-full overflow-hidden rounded-[12px] border border-line bg-surface shadow-[var(--card-shadow)]">
        {panel === "connect" ? (
          <ConnectPanel />
        ) : panel === "ai" ? (
          <AiPanel />
        ) : panel === "continue" ? (
          <ContinueView key="continue" />
        ) : panel === "compose" && compose ? (
          <ComposeView key={compose.draftId ?? `new-${compose.subject}-${compose.to}`} seed={compose} />
        ) : email && !email.isDraft ? (
          <MessageView email={email} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-[10px] text-ink-faint">
            <span className="text-[14px]">{LIVE && !accounts ? "Connect an account to see your mail" : "No message selected"}</span>
            <span className="text-[12.5px]">J and K move through your mail · C writes a new one</span>
            <button type="button" onClick={() => openCompose()} className={btnQuiet + " mt-[4px] border border-line"}>
              New message
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
