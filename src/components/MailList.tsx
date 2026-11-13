import { useVirtualizer } from "@tanstack/react-virtual";
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import banner from "../assets/banner-placeholder.png";
import type { Avatar as AvatarT, Email } from "../data/mock";
import { CloseIcon, FilterLines, StarIcon, VerifiedBadge } from "../icons";
import { formatDate, useStore, visibleMail } from "../store";
import { AgentCard } from "./AgentCard";

export const ROW_HEIGHT = 139; // 138 + 1px hairline, measured from the reference

export function Avatar({ avatar, size = 42 }: { avatar: AvatarT; size?: number }) {
  const common = { width: size, height: size } as const;
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
          style={{ ...common, background: avatar.bg, color: avatar.fg, fontSize: avatar.size ?? 15, fontWeight: avatar.weight ?? 600 }}
          className="flex shrink-0 items-center justify-center rounded-full tracking-[-0.03em] ring-1 ring-black/5"
        >
          {avatar.label}
        </span>
      );
    case "initials":
      return (
        <span
          style={{ ...common, background: avatar.bg, color: avatar.fg }}
          className="flex shrink-0 items-center justify-center rounded-full text-[15px] font-semibold"
        >
          {avatar.text}
        </span>
      );
  }
}

const MailRow = memo(function MailRow({
  email,
  selected,
  onSelect,
}: {
  email: Email;
  selected: boolean;
  onSelect: (id: number) => void;
}) {
  return (
    <div
      role="option"
      aria-selected={selected}
      onMouseDown={() => onSelect(email.id)}
      className={
        "group relative flex h-[139px] gap-[14px] border-b border-line-soft pl-[27px] pr-[29px] pt-[24px] transition-colors duration-100 " +
        (selected ? "bg-[var(--row-selected)]" : "hover:bg-[var(--row-hover)]")
      }
    >
      <div className="pt-[9px]">
        <Avatar avatar={email.avatar} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex h-[28px] items-center gap-[8px]">
          <span className="truncate text-[20px] font-medium tracking-[-0.015em] text-ink">{email.fromName}</span>
          {email.verified && <VerifiedBadge size={25} className="-my-[2px] shrink-0" />}
          {email.starred && <StarIcon size={16} filled className="shrink-0 text-[#f5b301]" />}
          <span
            className={
              "tabular ml-auto shrink-0 pl-[10px] text-[18px] tracking-[-0.01em] " +
              (email.unread ? "text-[var(--date-unread)] [-webkit-text-stroke:0.2px_currentColor]" : "text-ink-2")
            }
          >
            {formatDate(email.date)}
          </span>
        </div>
        <p className="mt-[7px] line-clamp-2 text-[18px] leading-[28px] tracking-[-0.01em] text-[var(--ink-preview)]">
          {email.preview}
        </p>
      </div>
    </div>
  );
});

function PromoBanner() {
  const dismiss = useStore((s) => s.dismissBanner);
  const setPanel = useStore((s) => s.setPanel);
  return (
    <div className="group relative h-[127px] overflow-hidden">
      <button type="button" onClick={() => setPanel("continue")} className="block size-full" aria-label="Upgrade with AI. For more powerful Inbox">
        {/* Placeholder crop of Crooli's banner art from the reference. Swap for design/brand/art/ source when added. */}
        <img src={banner} alt="" className="size-full object-cover" style={{ opacity: "var(--banner-dim, 1)" }} draggable={false} />
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-[12px] top-[12px] flex size-[28px] items-center justify-center rounded-full bg-white/80 text-[#444] opacity-0 backdrop-blur transition-opacity duration-150 group-hover:opacity-100"
      >
        <CloseIcon size={14} />
      </button>
    </div>
  );
}

export function ListColumn() {
  const state = useStore();
  const { folder, query, selectedId, select, bannerDismissed } = state;
  const items = useMemo(() => visibleMail(state), [state.mail, folder, query]); // eslint-disable-line react-hooks/exhaustive-deps

  const scrollRef = useRef<HTMLDivElement>(null);
  const rowsRef = useRef<HTMLDivElement>(null);
  const [margin, setMargin] = useState(0);

  useLayoutEffect(() => {
    if (rowsRef.current) setMargin(rowsRef.current.offsetTop);
  }, [bannerDismissed, folder]);

  const v = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 6,
    scrollMargin: margin,
  });

  // Keyboard: j/k or arrows to move, e archive, s star, Enter opens.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, [contenteditable]") || e.metaKey || e.ctrlKey || e.altKey) return;
      const idx = items.findIndex((m) => m.id === selectedId);
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        const n = items[Math.min(items.length - 1, idx + 1)];
        if (n) {
          select(n.id);
          v.scrollToIndex(items.indexOf(n), { align: "auto" });
        }
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        const n = items[Math.max(0, idx - 1)];
        if (n) {
          select(n.id);
          v.scrollToIndex(items.indexOf(n), { align: "auto" });
        }
      } else if (e.key === "e" && selectedId != null) {
        const next = items[idx + 1] ?? items[idx - 1];
        useStore.getState().archive(selectedId);
        useStore.getState().showToast("Archived");
        select(next?.id ?? null);
      } else if (e.key === "s" && selectedId != null) {
        useStore.getState().toggleStar(selectedId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, selectedId, select, v]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [folder]);

  const allSelected = false;

  return (
    <div ref={scrollRef} className="scroll-quiet list-column relative h-full w-[528px] shrink-0 overflow-y-auto pb-[23px] pl-[23px] pt-[24px]">
      <AgentCard />

      <section className="mt-[23px] overflow-hidden rounded-[16px] border border-line bg-surface shadow-[var(--card-shadow)]">
        <div className="flex h-[65px] items-center pl-[30px] pr-[26px]">
          <label className="flex items-center gap-[15px]">
            <span
              className={
                "flex size-[20px] items-center justify-center rounded-[5px] border-[1.5px] " +
                (allSelected ? "border-ink bg-ink" : "border-[var(--checkbox)]")
              }
            />
            <span className="text-[20px] tracking-[-0.01em] text-ink-muted">
              {folder === "inbox" ? "Inbox" : folder === "sent" ? "Sent items" : folder[0].toUpperCase() + folder.slice(1)}
            </span>
          </label>
          <button type="button" className="ml-auto rounded-[8px] p-[2px] text-[#696a6c] hover:text-ink" aria-label="Filter and sort">
            <FilterLines size={24} />
          </button>
        </div>

        {folder === "inbox" && !bannerDismissed && !query && <PromoBanner />}

        <div ref={rowsRef} role="listbox" aria-label="Messages" className="relative" style={{ height: v.getTotalSize() }}>
          {v.getVirtualItems().map((row) => {
            const email = items[row.index];
            return (
              <div
                key={email.id}
                className="absolute inset-x-0 top-0"
                style={{ height: ROW_HEIGHT, transform: `translateY(${row.start - v.options.scrollMargin}px)` }}
              >
                <MailRow email={email} selected={email.id === selectedId} onSelect={select} />
              </div>
            );
          })}
        </div>

        {items.length === 0 && (
          <div className="px-[30px] py-[48px] text-center text-[16px] text-ink-muted">
            {query ? `Nothing matches “${query}”` : "Nothing here. Enjoy the quiet."}
          </div>
        )}
      </section>
    </div>
  );
}
