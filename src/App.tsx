import { useEffect } from "react";
import { CommandPalette } from "./components/CommandPalette";
import { PageHeader, Toolbar } from "./components/Header";
import { IconRail } from "./components/IconRail";
import { ListColumn } from "./components/MailList";
import { ReaderPane } from "./components/Reader";
import { detectAgents } from "./lib/agent";
import { applyDemoScene } from "./lib/demo";
import { useStore } from "./store";

export default function App() {
  const setAgents = useStore((s) => s.setAgents);
  const toast = useStore((s) => s.toast);
  const query = useStore((s) => s.query);
  const setQuery = useStore((s) => s.setQuery);

  useEffect(() => {
    detectAgents()
      .then(setAgents)
      .then(applyDemoScene)
      .catch(() => setAgents([]));
  }, [setAgents]);

  // Global shortcuts: ⌘K palette, C compose, Esc closes things.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useStore.getState();
      const typing = (e.target as HTMLElement).closest("input, textarea, [contenteditable]");
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        s.setPaletteOpen(!s.paletteOpen);
      } else if (e.key === "Escape") {
        if (s.paletteOpen) s.setPaletteOpen(false);
        else if (s.panel) s.setPanel(null);
        else if (s.query) s.setQuery("");
      } else if (!typing && !e.metaKey && !e.ctrlKey && (e.key === "c" || e.key === "/")) {
        e.preventDefault();
        if (e.key === "c") s.setPanel("compose");
        else s.setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex h-full bg-window">
      <IconRail />
      <main className="mb-[11px] mr-[11px] mt-[11px] flex min-w-0 flex-1 flex-col overflow-hidden rounded-[16px] border border-line bg-canvas">
        <div className="bg-surface">
          <PageHeader />
          <Toolbar />
        </div>
        {query && (
          <div className="flex h-[40px] shrink-0 items-center gap-[8px] border-b border-line bg-surface px-[24px] text-[14px] text-ink-muted">
            Showing results for “{query}”
            <button type="button" className="rounded-full bg-pill px-[10px] py-[2px] text-ink-2" onClick={() => setQuery("")}>
              Clear
            </button>
          </div>
        )}
        <div className="flex min-h-0 flex-1">
          <ListColumn />
          <ReaderPane />
        </div>
      </main>
      <CommandPalette />
      {toast && (
        <div className="pop-in fixed bottom-[28px] left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#1c1c1c] px-[18px] py-[10px] text-[15px] text-white shadow-[0_8px_30px_rgba(0,0,0,0.18)]">
          {toast}
        </div>
      )}
    </div>
  );
}
