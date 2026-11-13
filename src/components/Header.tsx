import type { ComponentType, SVGProps } from "react";
import { useMemo } from "react";
import type { FolderId } from "../data/mock";
import { ArchiveIcon, MailPlus, SearchIcon, SendIcon, StarIcon, TrayIcon } from "../icons";
import { formatCount, useStore } from "../store";

const titles: Record<FolderId, string> = {
  inbox: "Inbox",
  sent: "Sent items",
  starred: "Starred",
  archive: "Archive",
  drafts: "Drafts",
};

export function useFolderCount(folder: FolderId) {
  const mail = useStore((s) => s.mail);
  return useMemo(
    () =>
      folder === "starred"
        ? mail.filter((m) => m.starred && m.folder !== "archive").length
        : mail.filter((m) => m.folder === folder).length,
    [mail, folder],
  );
}

export function PageHeader() {
  const folder = useStore((s) => s.folder);
  const count = useFolderCount(folder);
  return (
    <header
      className="flex h-[90px] shrink-0 items-center border-b border-line pl-[36px] pr-[24px] text-[24px] leading-none text-ink-title"
      data-tauri-drag-region
    >
      <h1 className="font-normal tracking-[-0.01em]" data-tauri-drag-region>
        {titles[folder]}
      </h1>
      <span className="mx-[24px] size-[6px] rounded-full bg-[var(--dot)]" aria-hidden />
      <span className="tabular tracking-[-0.01em]" data-tauri-drag-region>
        {formatCount(count)} emails
      </span>
    </header>
  );
}

type Pill = { id: FolderId; label: string; Icon: ComponentType<SVGProps<SVGSVGElement> & { size?: number }> };
const pills: Pill[] = [
  { id: "inbox", label: "Inbox", Icon: TrayIcon },
  { id: "sent", label: "Sent items", Icon: SendIcon },
  { id: "starred", label: "Starred", Icon: StarIcon },
  { id: "archive", label: "Archive", Icon: ArchiveIcon },
];

export function Toolbar() {
  const folder = useStore((s) => s.folder);
  const setFolder = useStore((s) => s.setFolder);
  const setPanel = useStore((s) => s.setPanel);
  const setPaletteOpen = useStore((s) => s.setPaletteOpen);
  const count = useFolderCount(folder);

  return (
    <div className="flex h-[81px] shrink-0 items-center border-b border-line pl-[22px] pr-[24px]" data-tauri-drag-region>
      <button
        type="button"
        onClick={() => setPanel("continue")}
        className="btn-continue flex h-[48px] shrink-0 items-center gap-[9px] rounded-full pl-[20px] pr-[18px] text-[20px] font-medium tracking-[-0.01em]"
        title="Let AI work through your inbox"
      >
        <MailPlus size={25} />
        Continue
      </button>

      <span className="mx-[17px] h-[28px] w-px shrink-0 bg-[var(--divider)]" aria-hidden />

      <div className="no-scrollbar flex min-w-0 flex-1 items-center gap-[8px] overflow-x-auto">
        {pills.map(({ id, label, Icon }) => {
          const active = id === folder;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setFolder(id)}
              aria-current={active ? "page" : undefined}
              className={
                "flex h-[46px] shrink-0 items-center gap-[12px] rounded-full pl-[18px] pr-[19px] text-[20px] font-medium tracking-[-0.01em] transition-colors duration-150 " +
                (active ? "bg-pill text-ink-2" : "text-[var(--ink-pill)] hover:bg-pill")
              }
            >
              <Icon size={22} />
              <span>{label}</span>
              {active && <span className="tabular ml-[2px] text-[17px] font-normal tracking-[0] text-ink">{formatCount(count)}</span>}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setPaletteOpen(true)}
        className="ml-[16px] flex h-[46px] w-[260px] shrink-0 items-center gap-[10px] rounded-full border border-line bg-surface pl-[18px] pr-[8px] text-[16px] text-ink-faint transition-colors hover:border-[var(--checkbox)]"
      >
        <SearchIcon size={18} />
        <span className="flex-1 text-left">Search or ask AI</span>
        <kbd className="rounded-[8px] bg-pill px-[8px] py-[4px] font-sans text-[13px] text-ink-muted">⌘K</kbd>
      </button>
    </div>
  );
}
