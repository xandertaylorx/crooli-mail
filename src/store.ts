import { create } from "zustand";
import { mockMail, type Email, type FolderId } from "./data/mock";
import type { AgentInfo, ProviderId } from "./lib/agent";
import type { DemoAuto } from "./lib/demo";

export type Panel = null | "continue" | "compose";

interface State {
  mail: Email[];
  folder: FolderId;
  selectedId: number | null;
  query: string;
  bannerDismissed: boolean;
  agents: AgentInfo[];
  provider: ProviderId;
  panel: Panel;
  paletteOpen: boolean;
  toast: string | null;
  demoAuto: DemoAuto;

  setFolder: (f: FolderId) => void;
  select: (id: number | null) => void;
  setQuery: (q: string) => void;
  dismissBanner: () => void;
  setAgents: (a: AgentInfo[]) => void;
  setProvider: (p: ProviderId) => void;
  setPanel: (p: Panel) => void;
  setPaletteOpen: (o: boolean) => void;
  archive: (id: number) => void;
  toggleStar: (id: number) => void;
  markRead: (id: number) => void;
  showToast: (t: string) => void;
}

const loadBool = (k: string) => {
  try {
    return localStorage.getItem(k) === "1";
  } catch {
    return false;
  }
};

export const useStore = create<State>((set, get) => ({
  mail: mockMail,
  folder: "inbox",
  selectedId: 1,
  query: "",
  bannerDismissed: loadBool("crooli.bannerDismissed"),
  agents: [],
  provider: "claude",
  panel: null,
  paletteOpen: false,
  toast: null,
  demoAuto: null,

  setFolder: (folder) => set({ folder, selectedId: null, query: "" }),
  select: (selectedId) => {
    set({ selectedId });
    if (selectedId != null) get().markRead(selectedId);
  },
  setQuery: (query) => set({ query }),
  dismissBanner: () => {
    try {
      localStorage.setItem("crooli.bannerDismissed", "1");
    } catch {
      /* ignore */
    }
    set({ bannerDismissed: true });
  },
  setAgents: (agents) => {
    const installed = agents.filter((a) => a.installed);
    let saved: string | null = null;
    try {
      saved = localStorage.getItem("crooli.provider");
    } catch {
      /* ignore */
    }
    const provider = (installed.find((a) => a.provider === saved) ?? installed[0])?.provider ?? "claude";
    set({ agents, provider });
  },
  setProvider: (provider) => {
    try {
      localStorage.setItem("crooli.provider", provider);
    } catch {
      /* ignore */
    }
    set({ provider });
  },
  setPanel: (panel) => set({ panel }),
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  archive: (id) =>
    set((s) => ({
      mail: s.mail.map((m) => (m.id === id ? { ...m, folder: "archive" } : m)),
    })),
  toggleStar: (id) => set((s) => ({ mail: s.mail.map((m) => (m.id === id ? { ...m, starred: !m.starred } : m)) })),
  markRead: (id) => {
    const m = get().mail.find((x) => x.id === id);
    if (m?.unread) set((s) => ({ mail: s.mail.map((x) => (x.id === id ? { ...x, unread: false } : x)) }));
  },
  showToast: (toast) => {
    set({ toast });
    window.setTimeout(() => {
      if (get().toast === toast) set({ toast: null });
    }, 2400);
  },
}));

export function visibleMail(s: Pick<State, "mail" | "folder" | "query">): Email[] {
  const q = s.query.trim().toLowerCase();
  const inFolder =
    s.folder === "starred" ? s.mail.filter((m) => m.starred && m.folder !== "archive") : s.mail.filter((m) => m.folder === s.folder);
  if (!q) return inFolder;
  return inFolder.filter(
    (m) =>
      m.fromName.toLowerCase().includes(q) ||
      m.subject.toLowerCase().includes(q) ||
      m.preview.toLowerCase().includes(q),
  );
}

// 14.171 — dot thousands separator, as in the reference.
export const formatCount = (n: number) => new Intl.NumberFormat("de-DE").format(n);

export function formatDate(d: Date): string {
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return `${String(d.getHours()).padStart(2, "0")}.${String(d.getMinutes()).padStart(2, "0")}`;
  const sameYear = d.getFullYear() === now.getFullYear() || now.getTime() - d.getTime() < 300 * 864e5;
  const month = d.toLocaleString("en-GB", { month: "long" });
  return sameYear ? `${month} ${d.getDate()}` : `${d.getDate()} ${month.slice(0, 3)} ${d.getFullYear()}`;
}
