import type { ComponentType } from "react";
import type { FolderId } from "../data/mock";
import { CrooliMark, IcoArchive, IcoCompose, IcoDrafts, IcoInbox, IcoSent, IcoSettings, IcoStar, IcoTrash } from "../icons";
import { useStore } from "../store";

type Icon = ComponentType<{ size?: number; active?: boolean }>;

const folders: { id: FolderId; label: string; Icon: Icon }[] = [
  { id: "inbox", label: "Inbox", Icon: IcoInbox },
  { id: "starred", label: "Starred", Icon: IcoStar },
  { id: "sent", label: "Sent", Icon: IcoSent },
  { id: "drafts", label: "Drafts", Icon: IcoDrafts },
  { id: "archive", label: "Archive", Icon: IcoArchive },
  { id: "trash", label: "Trash", Icon: IcoTrash },
];

function RailButton({ label, active, onClick, Icon }: { label: string; active?: boolean; onClick: () => void; Icon: Icon }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      className={
        "flex size-[38px] items-center justify-center rounded-[10px] border transition-colors duration-150 " +
        (active
          ? "border-line bg-surface text-icon-active shadow-[var(--tile-shadow)]"
          : "border-transparent text-icon hover:bg-[var(--pill)] hover:text-icon-active")
      }
    >
      <Icon size={20} active={active} />
    </button>
  );
}

export function IconRail() {
  const folder = useStore((s) => s.folder);
  const panel = useStore((s) => s.panel);
  const setFolder = useStore((s) => s.setFolder);
  const setPanel = useStore((s) => s.setPanel);

  return (
    <nav className="flex h-full w-[68px] shrink-0 flex-col items-center pb-[12px]" data-tauri-drag-region>
      {/* Room for the macOS traffic lights */}
      <div className="h-[40px] w-full shrink-0" data-tauri-drag-region />
      <div className="flex size-[38px] items-center justify-center text-[var(--ink)]" aria-label="Crooli" data-tauri-drag-region>
        <CrooliMark size={34} />
      </div>

      <div className="mt-[14px]">
        <RailButton label="New message (C)" active={panel === "compose"} onClick={() => setPanel(panel === "compose" ? null : "compose")} Icon={IcoCompose} />
      </div>
      <span className="my-[10px] h-px w-[22px] bg-line" aria-hidden />

      <ul className="flex flex-col gap-[4px]">
        {folders.map(({ id, label, Icon }) => (
          <li key={id}>
            <RailButton label={label} active={id === folder && panel !== "compose" && panel !== "ai"} onClick={() => setFolder(id)} Icon={Icon} />
          </li>
        ))}
      </ul>

      <div className="mt-auto">
        <RailButton label="AI and settings" active={panel === "ai"} onClick={() => setPanel(panel === "ai" ? null : "ai")} Icon={IcoSettings} />
      </div>
    </nav>
  );
}
