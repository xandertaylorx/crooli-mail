import { useEffect, useMemo, useRef } from "react";
import type { FolderId } from "../data/mock";
import { CloseIcon, MailPlus, SearchIcon } from "../icons";
import { useUpdates } from "../lib/updates";
import { filterCounts, folderMail, formatCount, LIVE, useStore, type Filter } from "../store";

export const folderTitle: Record<FolderId, string> = {
  inbox: "Inbox",
  sent: "Sent",
  starred: "Starred",
  archive: "Archive",
  drafts: "Drafts",
  trash: "Trash",
};

export function useFolderCounts() {
  const mail = useStore((s) => s.mail);
  const folder = useStore((s) => s.folder);
  return useMemo(() => filterCounts(folderMail({ mail, folder })), [mail, folder]);
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={spinning ? "animate-spin" : ""} aria-hidden>
      <path d="M16.5 10a6.5 6.5 0 1 1-1.9-4.6M16.5 3.5v3.3h-3.3" />
    </svg>
  );
}

export function PageHeader() {
  const folder = useStore((s) => s.folder);
  const total = useStore((s) => s.folderTotal);
  const active = useStore((s) => s.active);
  const syncing = useStore((s) => s.syncing);
  const refresh = useStore((s) => s.refresh);
  const { all } = useFolderCounts();
  const update = useUpdates((u) => (u.phase === "available" || u.phase === "downloading" || u.phase === "installing" ? u : null));
  const setPanel = useStore((s) => s.setPanel);
  const count = LIVE ? Math.max(total, all) : all;
  return (
    <header className="flex h-[52px] shrink-0 items-center border-b border-line pl-[24px] pr-[12px] text-[17px] leading-none text-ink-title" data-tauri-drag-region>
      <h1 className="font-medium tracking-[-0.015em] text-ink" data-tauri-drag-region>
        {folderTitle[folder]}
      </h1>
      {(!LIVE || active) && (
        <>
          <span className="mx-[12px] size-[4px] rounded-full bg-[var(--dot)]" aria-hidden />
          <span className="tabular tracking-[-0.01em]" data-tauri-drag-region>
            {formatCount(count)} {count === 1 ? "email" : "emails"}
          </span>
        </>
      )}
      {LIVE && (
        <div className="ml-auto flex items-center gap-[6px]">
          {update && (
            <button
              type="button"
              onClick={() => setPanel("ai")}
              className="flex h-[26px] items-center gap-[6px] rounded-full bg-[var(--ink)] px-[10px] text-[12px] font-medium text-[var(--surface)] transition-opacity hover:opacity-85"
              title="A new version of Mail is ready"
            >
              <span className="size-[6px] rounded-full bg-[#5ad27c]" aria-hidden />
              {update.phase === "available" ? `Update ${update.version}` : "Updating…"}
            </button>
          )}
        </div>
      )}
      {LIVE && active && (
        <div className="ml-[6px] flex items-center gap-[6px]">
          <span className="max-w-[260px] truncate text-[12.5px] text-ink-faint">{active}</span>
          <button
            type="button"
            onClick={() => refresh()}
            disabled={syncing}
            title="Check for new mail (⌘R)"
            aria-label="Check for new mail"
            className="flex size-[30px] items-center justify-center rounded-[8px] text-ink-muted transition-colors hover:bg-pill hover:text-ink"
          >
            <RefreshIcon spinning={syncing} />
          </button>
        </div>
      )}
      {!LIVE && <span className="ml-auto rounded-full border border-line px-[10px] py-[4px] text-[12px] text-ink-muted">Demo mailbox</span>}
    </header>
  );
}

const filters: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
];

export function Toolbar() {
  const filter = useStore((s) => s.filter);
  const setFilter = useStore((s) => s.setFilter);
  const setPanel = useStore((s) => s.setPanel);
  const panel = useStore((s) => s.panel);
  const query = useStore((s) => s.query);
  const setQuery = useStore((s) => s.setQuery);
  const counts = useFolderCounts();
  const searchRef = useRef<HTMLInputElement>(null);

  // "/" jumps to search, anywhere outside a text field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || (e.target as HTMLElement).closest("input, textarea, [contenteditable]")) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex h-[52px] shrink-0 items-center border-b border-line pl-[16px] pr-[16px]" data-tauri-drag-region>
      <button
        type="button"
        onClick={() => setPanel(panel === "continue" ? null : "continue")}
        className="btn-continue flex h-[32px] shrink-0 items-center gap-[7px] rounded-full pl-[12px] pr-[14px] text-[14px] font-medium tracking-[-0.01em]"
        title="Let your AI sort the inbox"
      >
        <MailPlus size={17} />
        Continue
      </button>

      <span className="mx-[12px] h-[18px] w-px shrink-0 bg-[var(--divider)]" aria-hidden />

      <div className="flex min-w-0 flex-1 items-center gap-[4px]" role="tablist" aria-label="Show">
        {filters.map(({ id, label }) => {
          const on = id === filter;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setFilter(id)}
              className={
                "flex h-[30px] shrink-0 items-center gap-[7px] rounded-full px-[12px] text-[13.5px] font-medium tracking-[-0.005em] transition-colors duration-150 " +
                (on ? "bg-pill text-ink" : "text-[var(--ink-pill)] hover:bg-pill")
              }
            >
              {label}
              <span className={"tabular text-[12.5px] font-normal " + (on ? "text-ink-muted" : "text-ink-faint")}>{formatCount(counts[id])}</span>
            </button>
          );
        })}
      </div>

      <label className="ml-[12px] flex h-[32px] w-[260px] shrink-0 items-center gap-[8px] rounded-full border border-line bg-surface pl-[12px] pr-[6px] text-ink-faint transition-colors focus-within:border-[var(--ink-faint)]">
        <SearchIcon size={15} />
        <input
          ref={searchRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setQuery("");
              e.currentTarget.blur();
            }
          }}
          placeholder="Search this folder"
          className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-faint focus-visible:outline-none"
        />
        {query ? (
          <button type="button" onClick={() => setQuery("")} className="flex size-[20px] items-center justify-center rounded-full text-ink-muted hover:bg-pill" aria-label="Clear search">
            <CloseIcon size={11} />
          </button>
        ) : (
          <kbd className="rounded-[6px] bg-pill px-[6px] py-[2px] font-sans text-[11px] text-ink-muted">/</kbd>
        )}
      </label>
    </div>
  );
}
