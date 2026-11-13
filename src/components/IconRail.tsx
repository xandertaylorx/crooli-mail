import type { ComponentType, SVGProps } from "react";
import { CrooliMark, RailCompose, RailDocs, RailFolder, RailInbox, RailRules, RailStarred, RailTasks } from "../icons";
import { useStore } from "../store";

type Item = {
  id: string;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;
};

const items: Item[] = [
  { id: "compose", label: "Write with AI  (C)", Icon: RailCompose },
  { id: "starred", label: "Starred", Icon: RailStarred },
  { id: "inbox", label: "Inbox", Icon: RailInbox },
  { id: "archive", label: "Archive", Icon: RailFolder },
  { id: "rules", label: "Rules", Icon: RailRules },
  { id: "tasks", label: "Tasks", Icon: RailTasks },
  { id: "drafts", label: "Drafts", Icon: RailDocs },
];

export function IconRail() {
  const folder = useStore((s) => s.folder);
  const setFolder = useStore((s) => s.setFolder);
  const setPanel = useStore((s) => s.setPanel);
  const showToast = useStore((s) => s.showToast);

  const onClick = (id: string) => {
    if (id === "compose") return setPanel("compose");
    if (id === "inbox" || id === "starred" || id === "archive" || id === "drafts") return setFolder(id);
    showToast(`${id[0].toUpperCase()}${id.slice(1)} are coming soon`);
  };

  return (
    <nav className="flex h-full w-[83px] shrink-0 flex-col items-center" data-tauri-drag-region>
      {/* Space for the macOS traffic lights */}
      <div className="h-[44px] w-full shrink-0" data-tauri-drag-region />
      <div
        className="flex size-[34px] items-center justify-center rounded-[9px] bg-[#1c1c1c] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
        aria-label="Crooli"
        data-tauri-drag-region
      >
        <CrooliMark size={38} className="shrink-0" />
      </div>
      <ul className="mt-[24px] flex flex-col gap-[9px]">
        {items.map(({ id, label, Icon }) => {
          const active = id === folder;
          return (
            <li key={id}>
              <button
                type="button"
                title={label}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                onClick={() => onClick(id)}
                className={
                  "group flex size-[48px] items-center justify-center rounded-[12px] border transition-colors duration-150 " +
                  (active
                    ? "border-line bg-surface text-icon-active shadow-[var(--tile-shadow)]"
                    : "border-transparent text-icon hover:bg-[var(--pill)] hover:text-icon-active")
                }
              >
                <Icon size={28} />
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
