import { useVirtualizer } from "@tanstack/react-virtual";
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Avatar as AvatarT, Email } from "../data/mock";
import { CloseIcon, StarIcon } from "../icons";
import { PROVIDERS } from "../lib/mail";
import { useSenderIcon } from "../lib/icons-cache";
import { formatDate, LIVE, useStore, visibleMail } from "../store";
import { AgentCard } from "./AgentCard";
import { folderTitle } from "./Header";
import { PixelBanner } from "./PixelBanner";

export const ROW_HEIGHT = 88;

export function Avatar({ avatar, size = 32, address }: { avatar: AvatarT; size?: number; address?: string }) {
  const common = { width: size, height: size } as const;
  const enabled = useStore((s) => s.senderIcons) && LIVE;
  const icon = useSenderIcon(address, enabled);
  if (icon) {
    // Photos (JPEG) fill the circle; logos sit on white with a little room around them.
    const photo = icon.startsWith("data:image/jpeg");
    return (
      <span style={common} className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-black/[0.06]">
        <img src={icon} alt="" draggable={false} className={photo ? "size-full object-cover" : "size-[72%] object-contain"} />
      </span>
    );
  }
  switch (avatar.kind) {
    case "image":
      return <img src={avatar.src} alt="" style={common} className="shrink-0 rounded-full object-cover" draggable={false} />;
    case "substack":
      return (
        <span style={{ ...common, background: "#ff6719" }} className="flex shrink-0 items-center justify-center rounded-full">
          <svg width={size * 0.42} height={size * 0.46} viewBox="0 0 18 20" aria-hidden>
            <path d="M1 1h16v2.4H1zM1 5.6h16V8H1zM1 10.2h16V19l-8-4.4L1 19z" fill="#fff" />
          </svg>
        </span>
      );
    case "brand":
      return (
        <span
          style={{ ...common, background: avatar.bg, color: avatar.fg, fontSize: ((avatar.size ?? 15) * size) / 42, fontWeight: avatar.weight ?? 600 }}
          className="flex shrink-0 items-center justify-center rounded-full tracking-[-0.03em] ring-1 ring-black/5"
        >
          {avatar.label}
        </span>
      );
    case "initials":
      return (
        <span style={{ ...common, background: avatar.bg, color: avatar.fg, fontSize: size * 0.36 }} className="flex shrink-0 items-center justify-center rounded-full font-semibold">
          {avatar.text}
        </span>
      );
  }
}

const MailRow = memo(function MailRow({ email, selected, onSelect }: { email: Email; selected: boolean; onSelect: (id: number) => void }) {
  return (
    <div
      role="option"
      aria-selected={selected}
      onMouseDown={() => onSelect(email.id)}
      className={
        "relative flex h-[88px] gap-[11px] border-b border-line-soft pl-[14px] pr-[14px] pt-[12px] transition-colors duration-100 " +
        (selected ? "bg-[var(--row-selected)]" : "hover:bg-[var(--row-hover)]")
      }
    >
      {selected && <span className="absolute inset-y-[10px] left-0 w-[2.5px] rounded-r-full bg-[var(--ink)]" aria-hidden />}
      <div className="pt-[2px]">
        <Avatar avatar={email.avatar} address={email.peer} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex h-[20px] items-center gap-[6px]">
          <span className={"truncate text-[14px] tracking-[-0.01em] text-ink " + (email.unread ? "font-semibold" : "font-medium")}>{email.fromName}</span>
          {email.starred && <StarIcon size={12} filled className="shrink-0 text-[#f5b301]" />}
          {email.unread && <span className="ml-auto size-[6px] shrink-0 rounded-full bg-verified" aria-label="Unread" />}
          <span className={"tabular shrink-0 text-[12px] " + (email.unread ? "font-medium text-[var(--date-unread)]" : "ml-auto text-ink-muted")}>
            {formatDate(email.date)}
          </span>
        </div>
        <div className="mt-[1px] truncate text-[13px] font-medium tracking-[-0.005em] text-ink-2">{email.subject}</div>
        <p className="line-clamp-1 text-[13px] leading-[19px] tracking-[-0.005em] text-[var(--ink-preview)]">{email.preview}</p>
      </div>
    </div>
  );
});

function AiBanner() {
  const dismiss = useStore((s) => s.dismissBanner);
  const setPanel = useStore((s) => s.setPanel);
  const agents = useStore((s) => s.agents);
  const loaded = useStore((s) => s.agentsLoaded);
  const ready = agents.some((a) => a.installed);
  if (!loaded) return null;
  return (
    <div className="group relative h-[84px] overflow-hidden border-b border-line-soft">
      <PixelBanner />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,var(--banner-fade)_0%,var(--banner-fade)_28%,transparent_72%)]" />
      <button
        type="button"
        onClick={() => setPanel(ready ? "continue" : "ai")}
        className="absolute inset-0 flex flex-col justify-center pl-[16px] text-left text-[var(--banner-ink)]"
      >
        <span className="text-[14.5px] font-semibold tracking-[-0.015em]">{ready ? "Your AI is ready" : "Turn on AI"}</span>
        <span className="mt-[2px] text-[12.5px] opacity-80">
          {ready ? "Press Continue to sort today’s mail" : "Install Claude Code or Codex. Crooli finds it by itself."}
        </span>
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Hide this"
        className="absolute right-[8px] top-[8px] flex size-[22px] items-center justify-center rounded-full bg-black/25 text-white opacity-0 backdrop-blur transition-opacity duration-150 group-hover:opacity-100"
      >
        <CloseIcon size={12} />
      </button>
    </div>
  );
}

function ConnectCard() {
  const setPanel = useStore((s) => s.setPanel);
  return (
    <section className="mt-[10px] rounded-[12px] border border-line bg-surface p-[18px] shadow-[var(--card-shadow)]">
      <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">Connect your mail</h2>
      <p className="mt-[4px] text-[13px] leading-[1.5] text-ink-muted">Pick your provider. Mail shows you exactly what to do, step by step.</p>
      <div className="mt-[14px] grid grid-cols-2 gap-[6px]">
        {PROVIDERS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPanel("connect")}
            className="h-[36px] rounded-[9px] border border-line px-[10px] text-left text-[13px] font-medium text-ink-2 transition-colors hover:border-[var(--checkbox)] hover:text-ink"
          >
            {p.name}
          </button>
        ))}
      </div>
    </section>
  );
}

function SkeletonRows() {
  return (
    <div aria-label="Loading mail">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex h-[88px] gap-[11px] border-b border-line-soft px-[14px] pt-[14px]">
          <div className="size-[32px] shrink-0 animate-pulse rounded-full bg-pill" />
          <div className="flex-1 space-y-[8px] pt-[2px]">
            <div className="h-[10px] w-[40%] animate-pulse rounded-full bg-pill" />
            <div className="h-[10px] w-[70%] animate-pulse rounded-full bg-pill" />
            <div className="h-[10px] w-[90%] animate-pulse rounded-full bg-pill" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ListColumn() {
  const mail = useStore((s) => s.mail);
  const folder = useStore((s) => s.folder);
  const query = useStore((s) => s.query);
  const filter = useStore((s) => s.filter);
  const selectedId = useStore((s) => s.selectedId);
  const select = useStore((s) => s.select);
  const bannerDismissed = useStore((s) => s.bannerDismissed);
  const loaded = useStore((s) => s.agentsLoaded);
  const accounts = useStore((s) => s.accounts.length);
  const accountsLoaded = useStore((s) => s.accountsLoaded);
  const syncing = useStore((s) => s.syncing);
  const syncError = useStore((s) => s.syncError);
  const refresh = useStore((s) => s.refresh);
  const items = useMemo(() => visibleMail({ mail, folder, query, filter }), [mail, folder, query, filter]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const rowsRef = useRef<HTMLDivElement>(null);
  const [margin, setMargin] = useState(0);
  const showBanner = folder === "inbox" && !bannerDismissed && !query && filter === "all" && (!LIVE || accounts > 0);
  const needsAccount = LIVE && accountsLoaded && accounts === 0;

  useLayoutEffect(() => {
    if (rowsRef.current) setMargin(rowsRef.current.offsetTop);
  }, [showBanner, folder, loaded]);

  const v = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
    scrollMargin: margin,
  });

  // Keyboard: J/K or arrows move, E archive, # or Delete trash, S star.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, [contenteditable]") || e.metaKey || e.ctrlKey || e.altKey) return;
      const s = useStore.getState();
      if (s.paletteOpen) return;
      const idx = items.findIndex((m) => m.id === selectedId);
      const go = (n?: Email) => {
        if (!n) return;
        select(n.id);
        v.scrollToIndex(items.indexOf(n), { align: "auto" });
      };
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        go(items[Math.min(items.length - 1, idx + 1)]);
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        go(items[Math.max(0, idx - 1)]);
      } else if ((e.key === "e" || e.key === "#" || e.key === "Backspace" || e.key === "Delete") && selectedId != null) {
        const to = e.key === "e" ? "archive" : "trash";
        if (folder === to) return;
        const next = items[idx + 1] ?? items[idx - 1];
        s.move(selectedId, to);
        s.showToast(to === "archive" ? "Archived" : "Moved to Trash");
        select(next?.id ?? null);
      } else if (e.key === "s" && selectedId != null) {
        s.toggleStar(selectedId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, selectedId, select, v, folder]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [folder, filter]);

  return (
    <div ref={scrollRef} className="scroll-quiet list-column relative h-full w-[392px] shrink-0 overflow-y-auto pb-[12px] pl-[12px] pt-[12px]">
      <AgentCard />

      {needsAccount ? (
        <ConnectCard />
      ) : (
      <section className="mt-[10px] overflow-hidden rounded-[12px] border border-line bg-surface shadow-[var(--card-shadow)]">
        <div className="flex h-[40px] items-center border-b border-line-soft px-[14px]">
          <span className="text-[13px] font-medium text-ink-muted">
            {folderTitle[folder]}
            {filter !== "all" && <span className="text-ink-faint"> · Unread</span>}
          </span>
          <span className="tabular ml-auto text-[12px] text-ink-faint">{items.length ? `${new Intl.NumberFormat("de-DE").format(items.length)}` : ""}</span>
        </div>

        {syncError && (
          <div className="flex items-start gap-[8px] border-b border-line-soft bg-[#fdecea] px-[14px] py-[9px] text-[12.5px] leading-[1.45] text-[#a4241a] dark:bg-[#2a1210] dark:text-[#ff8a7e]">
            <span className="min-w-0 flex-1">{syncError}</span>
            <button type="button" onClick={() => refresh()} className="shrink-0 font-medium underline underline-offset-2">
              Retry
            </button>
          </div>
        )}
        {showBanner && <AiBanner />}
        {LIVE && syncing && items.length === 0 && <SkeletonRows />}

        <div ref={rowsRef} role="listbox" aria-label="Messages" className="relative" style={{ height: v.getTotalSize() }}>
          {v.getVirtualItems().map((row) => {
            const email = items[row.index];
            return (
              <div key={email.id} className="absolute inset-x-0 top-0" style={{ height: ROW_HEIGHT, transform: `translateY(${row.start - v.options.scrollMargin}px)` }}>
                <MailRow email={email} selected={email.id === selectedId} onSelect={select} />
              </div>
            );
          })}
        </div>

        {items.length === 0 && !(LIVE && syncing) && (
          <div className="px-[20px] py-[40px] text-center text-[13px] text-ink-muted">
            {query
              ? `Nothing matches “${query}” in the newest mail`
              : filter === "unread"
                ? "No unread mail. Nice."
                : folder === "drafts"
                  ? "No drafts. Anything you leave half-written is saved here."
                  : folder === "starred"
                    ? "Nothing starred. Press S on a message to star it."
                    : "Nothing here."}
          </div>
        )}
      </section>
      )}
    </div>
  );
}
