import { useEffect } from "react";
import { CommandPalette } from "./components/CommandPalette";
import { PageHeader, Toolbar } from "./components/Header";
import { IconRail } from "./components/IconRail";
import { ListColumn } from "./components/MailList";
import { ReaderPane } from "./components/Reader";
import { detectAgents } from "./lib/agent";
import { applyDemoScene } from "./lib/demo";
import { startAutoUpdates } from "./lib/updates";
import { applyTheme, useStore } from "./store";

export default function App() {
  const setAgents = useStore((s) => s.setAgents);
  const toast = useStore((s) => s.toast);

  useEffect(() => {
    applyTheme(useStore.getState().theme);
    useStore.getState().loadAccounts();
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
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "r") {
        e.preventDefault();
        s.refresh();
      } else if (e.key === "Escape") {
        if (s.paletteOpen) s.setPaletteOpen(false);
        else if (s.panel) s.setPanel(null);
        else if (s.query) s.setQuery("");
      } else if (!typing && !e.metaKey && !e.ctrlKey && e.key === "c") {
        e.preventDefault();
        s.openCompose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => startAutoUpdates(), []);

  // New mail: check every 90 seconds, and whenever the window comes back to the front.
  useEffect(() => {
    const tick = () => useStore.getState().refresh({ quiet: true });
    const id = window.setInterval(tick, 90_000);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", tick);
    };
  }, []);

  return (
    <div className="flex h-full bg-window">
      <IconRail />
      <main className="mb-[8px] mr-[8px] mt-[8px] flex min-w-0 flex-1 flex-col overflow-hidden rounded-[14px] border border-line bg-canvas">
        <div className="bg-surface">
          <PageHeader />
          <Toolbar />
        </div>
        <div className="flex min-h-0 flex-1">
          <ListColumn />
          <ReaderPane />
        </div>
      </main>
      <CommandPalette />
      {toast && (
        <div className="pop-in fixed bottom-[24px] left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#1c1c1c] px-[16px] py-[8px] text-[13px] text-white shadow-[0_8px_30px_rgba(0,0,0,0.18)]">
          {toast}
        </div>
      )}
    </div>
  );
}
