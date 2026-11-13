// Auto-update, via Tauri's updater plugin. Update files are signed with Crooli's own key
// (the public half is in tauri.conf.json) and fetched from this project's GitHub releases.
// Nothing is installed without the user pressing "Install and restart".
import { create } from "zustand";
import { isTauri } from "./agent";

type Phase = "idle" | "checking" | "upToDate" | "available" | "downloading" | "installing" | "error";

interface Updates {
  phase: Phase;
  current: string;
  version: string | null;
  notes: string | null;
  progress: number; // 0..1 while downloading
  error: string | null;
  checkedAt: number | null;
  auto: boolean;
  setAuto: (v: boolean) => void;
  check: (opts?: { quiet?: boolean }) => Promise<void>;
  install: () => Promise<void>;
}

const load = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};

// The Update object from the plugin, kept outside the store since it isn't plain data.
let pending: import("@tauri-apps/plugin-updater").Update | null = null;

const msg = (e: unknown) => {
  const s = typeof e === "string" ? e : e instanceof Error ? e.message : String(e);
  return /network|dns|connect|timed out|error sending request/i.test(s) ? "Couldn’t reach GitHub. Check your connection." : s;
};

export const useUpdates = create<Updates>((set, get) => ({
  phase: "idle",
  current: "",
  version: null,
  notes: null,
  progress: 0,
  error: null,
  checkedAt: null,
  auto: load("crooli.autoUpdate") !== "0",

  setAuto: (auto) => {
    try {
      localStorage.setItem("crooli.autoUpdate", auto ? "1" : "0");
    } catch {
      /* ignore */
    }
    set({ auto });
  },

  check: async ({ quiet } = {}) => {
    if (!isTauri() || ["checking", "downloading", "installing"].includes(get().phase)) return;
    if (!get().current) import("@tauri-apps/api/app").then((a) => a.getVersion()).then((current) => set({ current })).catch(() => {});
    set({ phase: "checking", error: null });
    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const u = await check();
      pending = u;
      if (u) set({ phase: "available", version: u.version, notes: u.body ?? null, checkedAt: Date.now() });
      else set({ phase: "upToDate", version: null, notes: null, checkedAt: Date.now() });
    } catch (e) {
      // A quiet (automatic) check never nags: it just goes back to idle.
      set(quiet ? { phase: "idle" } : { phase: "error", error: msg(e) });
    }
  },

  install: async () => {
    if (!pending || get().phase !== "available") return;
    set({ phase: "downloading", progress: 0, error: null });
    try {
      let total = 0;
      let got = 0;
      await pending.downloadAndInstall((ev) => {
        if (ev.event === "Started") total = ev.data.contentLength ?? 0;
        else if (ev.event === "Progress") {
          got += ev.data.chunkLength;
          if (total) set({ progress: Math.min(1, got / total) });
        } else if (ev.event === "Finished") set({ phase: "installing", progress: 1 });
      });
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch (e) {
      set({ phase: "error", error: msg(e) });
    }
  },
}));

/** Called once at startup: checks shortly after launch, then every 6 hours. */
export function startAutoUpdates() {
  if (!isTauri()) return () => {};
  const u = useUpdates.getState();
  import("@tauri-apps/api/app").then((a) => a.getVersion()).then((current) => useUpdates.setState({ current })).catch(() => {});
  const run = () => {
    if (useUpdates.getState().auto) useUpdates.getState().check({ quiet: true });
  };
  const first = window.setTimeout(run, 6000);
  const every = window.setInterval(run, 6 * 3600e3);
  void u;
  return () => {
    window.clearTimeout(first);
    window.clearInterval(every);
  };
}
