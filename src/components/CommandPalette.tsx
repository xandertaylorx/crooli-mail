import { useEffect, useMemo, useRef, useState } from "react";
import { MailPlus, SearchIcon, SparkleIcon } from "../icons";
import { formatDate, useStore } from "../store";
import { Avatar } from "./MailList";

type Cmd = { id: string; label: string; hint?: string; run: () => void };

export function CommandPalette() {
  const open = useStore((s) => s.paletteOpen);
  const setOpen = useStore((s) => s.setPaletteOpen);
  const mail = useStore((s) => s.mail);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const commands: Cmd[] = useMemo(() => {
    const s = useStore.getState();
    const close = () => setOpen(false);
    const list: Cmd[] = [
      { id: "continue", label: "Continue — let AI work through your inbox", run: () => (s.setPanel("continue"), close()) },
      { id: "compose", label: "New message", hint: "C", run: () => (s.setPanel("compose"), close()) },
      { id: "inbox", label: "Go to Inbox", run: () => (s.setFolder("inbox"), close()) },
      { id: "sent", label: "Go to Sent items", run: () => (s.setFolder("sent"), close()) },
      { id: "starred", label: "Go to Starred", run: () => (s.setFolder("starred"), close()) },
      { id: "archive", label: "Go to Archive", run: () => (s.setFolder("archive"), close()) },
    ];
    for (const a of s.agents.filter((x) => x.installed && x.provider !== s.provider))
      list.push({
        id: `ai-${a.provider}`,
        label: `Switch AI to ${a.provider === "claude" ? "Claude Code" : "Codex"}`,
        run: () => (s.setProvider(a.provider), close()),
      });
    if (q.trim())
      list.push({
        id: "filter",
        label: `Filter the list by “${q.trim()}”`,
        hint: "↵",
        run: () => (s.setQuery(q.trim()), close()),
      });
    return list;
  }, [q, setOpen, open]); // eslint-disable-line react-hooks/exhaustive-deps

  const needle = q.trim().toLowerCase();
  const cmds = needle ? commands.filter((c) => c.id === "filter" || c.label.toLowerCase().includes(needle)) : commands;
  const hits = useMemo(() => {
    if (needle.length < 2) return [];
    const out = [];
    for (const m of mail) {
      if (m.folder === "archive") continue;
      if (m.fromName.toLowerCase().includes(needle) || m.subject.toLowerCase().includes(needle) || m.preview.toLowerCase().includes(needle)) {
        out.push(m);
        if (out.length >= 6) break;
      }
    }
    return out;
  }, [needle, mail]);

  const total = cmds.length + hits.length;
  const runAt = (i: number) => {
    if (i < cmds.length) return cmds[i].run();
    const m = hits[i - cmds.length];
    if (m) {
      const s = useStore.getState();
      if (s.folder !== m.folder) s.setFolder(m.folder);
      s.setPanel(null);
      s.select(m.id);
      setOpen(false);
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-[var(--overlay)] pt-[14vh] backdrop-blur-[2px]" onMouseDown={() => setOpen(false)}>
      <div
        className="pop-in w-[620px] overflow-hidden rounded-[20px] border border-line bg-surface shadow-[0_24px_80px_rgba(0,0,0,0.16)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex h-[60px] items-center gap-[12px] border-b border-line-soft px-[20px]">
          <SearchIcon size={20} className="text-ink-muted" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
              else if (e.key === "ArrowDown") (e.preventDefault(), setActive((a) => Math.min(total - 1, a + 1)));
              else if (e.key === "ArrowUp") (e.preventDefault(), setActive((a) => Math.max(0, a - 1)));
              else if (e.key === "Enter") runAt(active);
            }}
            placeholder="Search mail, run a command…"
            className="flex-1 bg-transparent text-[18px] text-ink outline-none placeholder:text-ink-faint"
          />
          <kbd className="rounded-[8px] bg-pill px-[8px] py-[4px] font-sans text-[12px] text-ink-muted">esc</kbd>
        </div>
        <div className="scroll-quiet max-h-[420px] overflow-y-auto p-[8px]">
          {cmds.map((c, i) => (
            <button
              key={c.id}
              type="button"
              onMouseEnter={() => setActive(i)}
              onClick={() => runAt(i)}
              className={"flex h-[44px] w-full items-center gap-[12px] rounded-[12px] px-[12px] text-left text-[16px] text-ink-2 " + (active === i ? "bg-pill" : "")}
            >
              {c.id === "continue" || c.id.startsWith("ai-") ? (
                <SparkleIcon size={18} className="text-claude" />
              ) : c.id === "compose" ? (
                <MailPlus size={18} className="text-ink-muted" />
              ) : (
                <SearchIcon size={18} className="text-ink-muted" />
              )}
              <span className="flex-1 truncate">{c.label}</span>
              {c.hint && <kbd className="font-sans text-[13px] text-ink-faint">{c.hint}</kbd>}
            </button>
          ))}
          {hits.length > 0 && <div className="px-[12px] pb-[4px] pt-[12px] text-[12px] font-medium uppercase tracking-[0.05em] text-ink-faint">Mail</div>}
          {hits.map((m, j) => {
            const i = cmds.length + j;
            return (
              <button
                key={m.id}
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => runAt(i)}
                className={"flex w-full items-center gap-[12px] rounded-[12px] px-[12px] py-[8px] text-left " + (active === i ? "bg-pill" : "")}
              >
                <Avatar avatar={m.avatar} size={30} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium text-ink">{m.fromName}</span>
                  <span className="block truncate text-[14px] text-ink-muted">{m.subject}</span>
                </span>
                <span className="text-[13px] text-ink-faint">{formatDate(m.date)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
