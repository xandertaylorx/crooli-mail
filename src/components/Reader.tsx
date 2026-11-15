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

const escapeHtml = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Strips the document wrapper so an email can sit inside another message, keeping its styles. */
const innerHtml = (h: string) =>
  h
    .replace(/<!doctype[^>]*>/gi, "")
    .replace(/<\/?(html|body|head)[^>]*>/gi, "")
    .replace(/<title[\s\S]*?<\/title>/gi, "")
    .replace(/<meta[^>]*>/gi, "");

const emailContext = (m: Email) => `From: ${m.fromName} <${m.fromAddress}>\nDate: ${m.date.toUTCString()}\nSubject: ${m.subject}\n\n${m.body || m.preview}`;

const btnGhost =
  "flex h-[30px] shrink-0 items-center whitespace-nowrap rounded-full border border-line px-[14px] text-[13px] font-medium text-ink-2 transition-colors hover:bg-pill hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent";

const btnQuiet =
  "flex h-[30px] items-center gap-[6px] rounded-[8px] px-[10px] text-[13px] font-medium text-ink-2 transition-colors hover:bg-pill disabled:opacity-40 disabled:hover:bg-transparent";


function useIsDark() {
  const read = () => {
    const forced = document.documentElement.dataset.theme;
    return forced === "dark" || (forced !== "light" && typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches);
  };
  const [dark, setDark] = useState(read);
  useEffect(() => {
    const on = () => setDark(read());
    const q = typeof matchMedia !== "undefined" ? matchMedia("(prefers-color-scheme: dark)") : null;
    q?.addEventListener("change", on);
    const mo = new MutationObserver(on);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    on();
    return () => {
      q?.removeEventListener("change", on);
      mo.disconnect();
    };
  }, []);
  return dark;
}

/** HTML email in a locked-down frame: no scripts, and remote content only if Settings allow it.
 *  In dark mode the page is inverted (images are turned back) so it reads as light text on dark grey. */
export function HtmlBody({ html, images, className = "mt-[18px]" }: { html: string; images: boolean; className?: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [h, setH] = useState(200);
  const dark = useIsDark();
  const csp = `default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data: cid:${images ? " https: http:" : ""};`;
  const base = dark ? "#e6e6e6" : "#fff";
  const darkCss = dark ? "img,video,picture,svg{filter:invert(1) hue-rotate(180deg)}" : "";
  const doc = `<!doctype html><html><head><meta charset="utf-8"><meta name="color-scheme" content="light"><meta http-equiv="Content-Security-Policy" content="${csp}"><base target="_blank"><style>html,body{margin:0;background:${base};color:#222;font:14px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;word-wrap:break-word}body{padding:18px 20px}img{max-width:100%;height:auto}table{max-width:100%}a{color:#0a6cf0}${darkCss}${images ? "" : 'img[src^="http"],img[src^="//"]{display:none!important}'}</style></head><body>${html}</body></html>`;

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
    <div className={className + " overflow-hidden rounded-[10px]"} style={{ background: dark ? "#191919" : "#fff" }}>
      {/* allow-same-origin (without scripts) only so we can size the frame and catch link clicks */}
      <iframe
        ref={ref}
        title="Message"
        sandbox="allow-same-origin allow-popups"
        srcDoc={doc}
        style={{ height: h, filter: dark ? "invert(1) hue-rotate(180deg)" : undefined }}
        className="block w-full border-0"
      />
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

  const forward = async () => {
    // Make sure the whole message is loaded, not just the preview.
    if (LIVE && !email.bodyLoaded) await useStore.getState().loadBody(email.id);
    const m = useStore.getState().mail.find((x) => x.id === email.id) ?? email;
    const when = m.date.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    const from = m.fromAddress && !outgoing ? `${m.fromName} <${m.fromAddress}>` : m.fromName;
    const rows: [string, string][] = [["From", from], ["Date", when], ["Subject", m.subject], ["To", m.to ?? ""]];
    const kept = rows.filter(([, v]) => v);
    const headerText = ["---------- Forwarded message ----------", ...kept.map(([k, v]) => `${k}: ${v}`)].join("\n");
    const headerHtml =
      `<div style="font:13px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#555"><b>---------- Forwarded message ----------</b><br>` +
      kept.map(([k, v]) => `${k}: ${k === "From" ? `<b>${escapeHtml(v)}</b>` : escapeHtml(v)}`).join("<br>") +
      "</div>";
    useStore.getState().openCompose({
      to: "",
      subject: /^fwd?:/i.test(m.subject) ? m.subject : `Fwd: ${m.subject}`,
      body: "",
      forward: { headerText, headerHtml, text: (m.body || m.preview).trim(), html: m.html ?? null },
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

interface TriageItem {
  n: number | null;
  who: string;
  text: string;
}
interface TriageGroup {
  title: string;
  items: TriageItem[];
}

/** Turns the agent's text into groups of items. Tolerant: it streams in line by line. */
function parseTriage(text: string): TriageGroup[] {
  const groups: TriageGroup[] = [];
  for (const raw of text.split("\n")) {
    const l = raw.trim();
    if (!l) continue;
    const h = l.match(/^(?:#+\s*)?\*\*(.+?)\*\*:?$/) ?? l.match(/^#+\s*(.+)$/);
    if (h) {
      groups.push({ title: h[1].replace(/[:*]/g, "").trim(), items: [] });
      continue;
    }
    if (!groups.length) groups.push({ title: "", items: [] });
    let t = l.replace(/^[-•*]\s*/, "");
    let n: number | null = null;
    const ref = t.match(/^\[(\d{1,2})\]\s*/) ?? t.match(/^#(\d{1,2})\s*[:.\-–—]?\s*/);
    if (ref) {
      n = Number(ref[1]);
      t = t.slice(ref[0].length);
    }
    let who = "";
    const w = t.match(/^\*\*(.+?)\*\*\s*[:\-–—]?\s*/);
    if (w) {
      who = w[1].replace(/[:]$/, "");
      t = t.slice(w[0].length);
    }
    groups[groups.length - 1].items.push({ n, who, text: t.replace(/\*\*/g, "") });
  }
  return groups;
}

const GROUP_STYLE: Record<string, { dot: string; hint: string }> = {
  "needs you": { dot: "var(--focus)", hint: "Worth a reply or a decision" },
  "for your information": { dot: "var(--ink-faint)", hint: "Good to know, nothing to do" },
  "can go": { dot: "var(--checkbox)", hint: "Safe to archive when you like" },
};

function ContinueView() {
  const setPanel = useStore((s) => s.setPanel);
  const select = useStore((s) => s.select);
  const run = useAgentRun();
  const [top, setTop] = useState<Email[]>([]);

  useEffect(() => {
    const s = useStore.getState();
    const list = visibleMail({ ...s, folder: "inbox", query: "", filter: "all" }).slice(0, 12);
    setTop(list);
    const digest = list.map((m, i) => `#${i + 1} ${emailContext(m)}`).join("\n\n---\n\n");
    run.start(
      `TRIAGE. You are the assistant inside the Crooli Mail app. Sort these inbox emails for me into three groups, in this order: **Needs you**, **For your information**, **Can go**. Use exactly this format, with nothing before or after it:\n\n**Needs you**\n- [2] **Sender name**: one short line on what it is and what I should do.\n\nRules: [n] is the email's number from the list. Each email appears once, under one group. Skip a group that would be empty. Plain, calm, British spelling. Don't invent details.\n\n${digest}`,
    );
    return run.stop;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const groups = parseTriage(run.text).filter((g) => g.items.length || g.title);
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  const open = (n: number | null) => {
    const m = n ? top[n - 1] : null;
    if (!m) return;
    setPanel(null);
    select(m.id);
  };

  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Continue" sub={run.status === "running" ? "Reading your latest emails…" : ""} onClose={() => setPanel(null)}>
        {run.status === "running" && (
          <button type="button" onClick={run.stop} className={btnQuiet}>
            Stop
          </button>
        )}
      </PanelHeader>
      <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto px-[28px] pb-[28px] pt-[24px]">
        <div className="mx-auto max-w-[680px]">
          <h2 className="text-[22px] font-semibold leading-[1.2] tracking-[-0.02em] text-ink">
            {run.status === "running" && !total ? "Looking through your inbox" : total ? `${total} ${total === 1 ? "email" : "emails"}, sorted` : "Your inbox"}
          </h2>
          <p className="mt-[4px] text-[13px] text-ink-muted">
            {run.status === "error" ? "Your AI couldn’t finish." : `From your latest ${top.length || 12} emails. Suggestions only, nothing is sent, archived or deleted.`}
          </p>

          {run.status === "error" && <p className="selectable mt-[18px] rounded-[12px] bg-canvas px-[14px] py-[12px] text-[13.5px] leading-[1.55] text-[#c4281c]">{run.text}</p>}

          {run.status === "running" && !groups.length && (
            <div className="mt-[22px] space-y-[10px]" aria-label="Working">
              {[88, 72, 80].map((w, i) => (
                <div key={i} className="h-[58px] animate-pulse rounded-[12px] bg-canvas" style={{ width: `${w}%` }} />
              ))}
            </div>
          )}

          <div className="mt-[22px] space-y-[18px]">
            {groups.map((g, gi) => {
              const st = GROUP_STYLE[g.title.toLowerCase()] ?? { dot: "var(--ink-faint)", hint: "" };
              return (
                <section key={gi} className="pop-in">
                  {g.title && (
                    <div className="mb-[8px] flex items-baseline gap-[8px] px-[2px]">
                      <span className="size-[8px] shrink-0 translate-y-[-1px] self-center rounded-full" style={{ background: st.dot }} />
                      <h3 className="text-[13.5px] font-semibold tracking-[-0.01em] text-ink">{g.title}</h3>
                      <span className="tabular text-[12px] text-ink-faint">{g.items.length}</span>
                      {st.hint && <span className="ml-auto hidden text-[12px] text-ink-faint sm:inline">{st.hint}</span>}
                    </div>
                  )}
                  <ul className="divide-y divide-[var(--line-soft)] overflow-hidden rounded-[12px] border border-line bg-surface shadow-[var(--card-shadow)]">
                    {g.items.map((it, i) => {
                      const m = it.n ? top[it.n - 1] : null;
                      const last = run.status === "running" && gi === groups.length - 1 && i === g.items.length - 1;
                      const body = (
                        <>
                          {m && (
                            <span className="mt-[1px] shrink-0">
                              <Avatar avatar={m.avatar} size={30} address={m.peer} />
                            </span>
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13.5px] font-medium text-ink">{it.who || m?.fromName || "Email"}</span>
                            <span className={"selectable block text-[13.5px] leading-[1.5] text-ink-2" + (last ? " caret" : "")}>{it.text}</span>
                          </span>
                        </>
                      );
                      return (
                        <li key={i}>
                          {m ? (
                            <button type="button" onClick={() => open(it.n)} title={m.subject} className="flex w-full items-start gap-[12px] px-[14px] py-[12px] text-left transition-colors hover:bg-canvas">
                              {body}
                            </button>
                          ) : (
                            <div className="flex items-start gap-[12px] px-[14px] py-[12px]">{body}</div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        </div>
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
  const fwd = seed.forward;
  const loadImages = useStore((s) => s.loadImages);

  /** What goes out: your note, then the forwarded message exactly as it was received. */
  const outgoing = (m: { to: string; cc: string; subject: string; body: string }) => {
    if (!fwd) return { ...m, inReplyTo: seed.inReplyTo, references: seed.references, draftId: seed.draftId };
    const note = m.body.trim();
    return {
      ...m,
      body: `${note ? note + "\n\n" : ""}${fwd.headerText}\n\n${fwd.text}\n`,
      html: fwd.html
        ? `${note ? `<div>${escapeHtml(note).replace(/\n/g, "<br>")}</div><br>` : ""}<div>${fwd.headerHtml}<br>${innerHtml(fwd.html)}</div>`
        : null,
      inReplyTo: seed.inReplyTo,
      references: seed.references,
      draftId: seed.draftId,
    };
  };

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
      saveDraft(outgoing(m))
        .then(() => useStore.getState().showToast("Draft saved"))
        .catch(() => {});
    },
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const doSend = async () => {
    if (sending) return;
    setSending(true);
    try {
      await send(outgoing({ to, cc, subject, body }));
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
          <RecipientInput autoFocus={LIVE && !to} value={to} onChange={setTo} className={field} placeholder="Start typing a name or address" />
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
        <div className="scroll-quiet flex min-h-0 flex-1 flex-col overflow-y-auto">
          <textarea
            autoFocus={LIVE && !!to}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className={(fwd ? "min-h-[84px] shrink-0 " : "min-h-0 flex-1 ") + "resize-none py-[14px] leading-[1.6] " + field + (run.status === "running" ? " caret" : "")}
            placeholder={fwd ? "Add a note (optional)" : "Write your message, or ask AI below."}
          />
          {fwd && (
            <div className="pb-[16px]">
              <div className="mb-[8px] text-[11.5px] font-medium uppercase tracking-[0.05em] text-ink-faint">Forwarded message</div>
              <div className="selectable mb-[8px] whitespace-pre-line text-[12.5px] leading-[1.55] text-ink-muted">{fwd.headerText.split("\n").slice(1).join("\n")}</div>
              {fwd.html ? (
                <HtmlBody html={fwd.html} images={loadImages} className="mt-0" />
              ) : (
                <div className="selectable whitespace-pre-wrap rounded-[10px] bg-canvas px-[14px] py-[12px] text-[13.5px] leading-[1.6] text-ink-2">{fwd.text}</div>
              )}
            </div>
          )}
        </div>
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
          placeholder={body.trim() ? "Ask AI to change it, e.g. “shorter and friendlier”" : "Ask AI to write it, e.g. “thank Wren, suggest Thursday”"}
          className={field + " text-[13.5px]"}
        />
        <button
          type="button"
          disabled={!body.trim() && !subject.trim() && !fwd}
          onClick={async () => {
            done.current = true;
            await saveDraft(outgoing({ to, cc, subject, body })).catch((e) => showToast(String(e)));
            showToast("Saved to Drafts");
            setPanel(null);
          }}
          className={btnGhost}
        >
          Save draft
        </button>
        <button
          type="button"
          disabled={!to.trim() || (!body.trim() && !fwd) || sending}
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
