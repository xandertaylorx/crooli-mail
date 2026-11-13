import { create } from "zustand";
import { mockMail, type Email, type FolderId } from "./data/mock";
import { isTauri, type AgentInfo, type ProviderId } from "./lib/agent";
import type { DemoAuto } from "./lib/demo";
import { initialsAvatar, mailApi, type Account, type Contact, type Header, type Outgoing } from "./lib/mail";

/** The desktop app shows real accounts. Sample mail is only for the website's demo. */
export const LIVE = isTauri();

export type Panel = null | "continue" | "compose" | "ai" | "connect";
export type Filter = "all" | "unread";
export type Theme = "system" | "light" | "dark";

export interface ComposeSeed {
  to: string;
  cc?: string;
  subject: string;
  body: string;
  inReplyTo?: string | null;
  references?: string | null;
  /** Editing an existing draft: it's replaced when saved or sent. */
  draftId?: number;
}

/** Models Crooli asks the agent to use. Mail work is light, so the defaults are the smallest. */
export const MODELS: Record<ProviderId, { id: string; label: string; note: string }[]> = {
  claude: [
    { id: "haiku", label: "Haiku", note: "Fastest, lightest on your limits" },
    { id: "sonnet", label: "Sonnet", note: "Better writing, slower" },
    { id: "opus", label: "Opus", note: "Most capable, uses the most" },
  ],
  codex: [
    { id: "gpt-6-luna", label: "Luna", note: "Lightest, low reasoning effort" },
    { id: "", label: "Your default", note: "Whatever Codex is set to use" },
  ],
};

interface State {
  mail: Email[];
  folder: FolderId;
  folderTotal: number;
  filter: Filter;
  selectedId: number | null;
  query: string;
  bannerDismissed: boolean;

  accounts: Account[];
  accountsLoaded: boolean;
  active: string | null;
  syncing: boolean;
  syncError: string | null;

  agents: AgentInfo[];
  agentsLoaded: boolean;
  provider: ProviderId;
  model: Record<ProviderId, string>;
  theme: Theme;
  htmlMail: boolean;
  loadImages: boolean;
  senderIcons: boolean;

  contacts: Contact[];
  loadContacts: () => void;

  panel: Panel;
  compose: ComposeSeed | null;
  paletteOpen: boolean;
  toast: string | null;
  demoAuto: DemoAuto;

  setFolder: (f: FolderId) => void;
  setFilter: (f: Filter) => void;
  select: (id: number | null) => void;
  setQuery: (q: string) => void;
  dismissBanner: () => void;

  loadAccounts: () => Promise<void>;
  accountAdded: (a: Account) => void;
  removeAccount: (email: string) => Promise<void>;
  setActive: (email: string) => void;
  refresh: (opts?: { quiet?: boolean }) => Promise<void>;
  loadBody: (id: number) => Promise<void>;

  setAgents: (a: AgentInfo[]) => void;
  setProvider: (p: ProviderId) => void;
  setModel: (p: ProviderId, m: string) => void;
  setTheme: (t: Theme) => void;
  setPref: (k: "htmlMail" | "loadImages" | "senderIcons", v: boolean) => void;

  setPanel: (p: Panel) => void;
  openCompose: (seed?: Partial<ComposeSeed>) => void;
  setPaletteOpen: (o: boolean) => void;

  move: (id: number, to: FolderId) => void;
  toggleStar: (id: number) => void;
  markRead: (id: number) => void;
  send: (m: Outgoing & { draftId?: number }) => Promise<void>;
  saveDraft: (m: Outgoing & { draftId?: number }) => Promise<void>;
  showToast: (t: string) => void;
}

const load = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const save = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* ignore */
  }
};

let localId = 900000;
let syncSeq = 0;

function fromHeader(h: Header, folder: FolderId): Email {
  const outgoing = folder === "sent" || folder === "drafts";
  const who = outgoing ? h.to : h.fromName;
  const addr = outgoing ? h.to : h.fromAddress;
  return {
    id: h.uid,
    uid: h.uid,
    folder,
    fromName: outgoing ? (h.to ? `To: ${h.to}` : "No recipient yet") : h.fromName || h.fromAddress || "Unknown sender",
    fromAddress: h.fromAddress,
    verified: false,
    avatar: initialsAvatar(who, addr),
    subject: h.subject || "(No subject)",
    preview: h.preview,
    body: "",
    date: new Date(h.date),
    unread: !h.seen,
    starred: h.flagged,
    isDraft: h.draft || folder === "drafts",
    peer: outgoing ? h.toAddresses.split(", ")[0] : h.fromAddress,
  };
}

const errText = (e: unknown) => (typeof e === "string" ? e : e instanceof Error ? e.message : "Something went wrong.");

export const useStore = create<State>((set, get) => ({
  mail: LIVE ? [] : mockMail,
  folder: "inbox",
  folderTotal: 0,
  filter: "all",
  selectedId: LIVE ? null : 1,
  query: "",
  bannerDismissed: load("crooli.aiBannerDismissed") === "1",

  accounts: [],
  accountsLoaded: !LIVE,
  active: load("crooli.activeAccount"),
  syncing: false,
  syncError: null,

  agents: [],
  agentsLoaded: false,
  provider: "claude",
  model: {
    claude: load("crooli.model.claude") ?? "haiku",
    codex: load("crooli.model.codex") ?? "gpt-6-luna",
  },
  theme: (load("crooli.theme") as Theme) ?? "system",
  htmlMail: load("crooli.htmlMail") !== "0",
  loadImages: load("crooli.loadImages") === "1",
  senderIcons: load("crooli.senderIcons") !== "0",

  contacts: [],
  loadContacts: () => {
    if (!LIVE) {
      const seen = new Map<string, Contact>();
      for (const m of mockMail.slice(0, 400)) {
        const c = seen.get(m.fromAddress) ?? { name: m.fromName, address: m.fromAddress, count: 0 };
        c.count++;
        seen.set(m.fromAddress, c);
      }
      set({ contacts: [...seen.values()].filter((c) => !/no-?reply|notifications|automated/.test(c.address)).sort((a, b) => b.count - a.count) });
      return;
    }
    const { active } = get();
    if (active) mailApi.contacts(active).then((contacts) => set({ contacts })).catch(() => {});
  },

  panel: null,
  compose: null,
  paletteOpen: false,
  toast: null,
  demoAuto: null,

  /* ---------- navigation ---------- */
  setFolder: (folder) => {
    set({ folder, filter: "all", selectedId: null, query: "", panel: null, syncError: null });
    if (LIVE) {
      set({ mail: [], folderTotal: 0 });
      get().refresh();
    }
  },
  setFilter: (filter) => set({ filter }),
  select: (selectedId) => {
    const s = get();
    const m = s.mail.find((x) => x.id === selectedId);
    // Opening a draft edits it.
    if (m?.isDraft && s.folder === "drafts") {
      s.openCompose({ to: m.to ?? m.fromName.replace(/^To: /, ""), subject: m.subject === "(No subject)" ? "" : m.subject, body: m.body, draftId: m.id });
      if (LIVE && !m.bodyLoaded) {
        s.loadBody(m.id).then(() => {
          const d = get().mail.find((x) => x.id === m.id);
          const c = get().compose;
          if (d && c?.draftId === m.id && !c.body) set({ compose: { ...c, body: d.body, to: d.to || c.to } });
        });
      }
      set({ selectedId });
      return;
    }
    set({ selectedId, panel: null });
    if (selectedId != null) {
      s.markRead(selectedId);
      if (LIVE) s.loadBody(selectedId);
    }
  },
  setQuery: (query) => set({ query }),
  dismissBanner: () => {
    save("crooli.aiBannerDismissed", "1");
    set({ bannerDismissed: true });
  },

  /* ---------- accounts and sync ---------- */
  loadAccounts: async () => {
    if (!LIVE) return;
    const accounts = await mailApi.listAccounts().catch(() => [] as Account[]);
    const active = accounts.find((a) => a.email === get().active)?.email ?? accounts[0]?.email ?? null;
    set({ accounts, active, accountsLoaded: true, panel: accounts.length ? get().panel : "connect" });
    if (active) get().refresh();
  },
  accountAdded: (a) => {
    const accounts = [...get().accounts.filter((x) => x.email !== a.email), a];
    save("crooli.activeAccount", a.email);
    set({ accounts, active: a.email, panel: null, folder: "inbox", mail: [], selectedId: null });
    get().refresh();
  },
  removeAccount: async (email) => {
    await mailApi.remove(email);
    const accounts = get().accounts.filter((a) => a.email !== email);
    const active = accounts[0]?.email ?? null;
    set({ accounts, active, mail: [], selectedId: null, folderTotal: 0, panel: accounts.length ? "ai" : "connect" });
    if (active) get().refresh();
  },
  setActive: (email) => {
    save("crooli.activeAccount", email);
    set({ active: email, folder: "inbox", mail: [], selectedId: null, panel: null });
    get().refresh();
  },
  refresh: async ({ quiet } = {}) => {
    const { active, folder } = get();
    if (!LIVE || !active) return;
    const seq = ++syncSeq;
    const keep = (list: Header[], total: number) => {
      if (seq !== syncSeq) return;
      // Keep bodies we've already loaded.
      const old = new Map(get().mail.map((m) => [m.id, m]));
      const mail = list.map((h) => {
        const e = fromHeader(h, folder);
        const o = old.get(e.id);
        return o?.bodyLoaded ? { ...e, body: o.body, html: o.html, to: o.to, cc: o.cc, messageId: o.messageId, references: o.references, attachments: o.attachments, bodyLoaded: true } : e;
      });
      set({ mail, folderTotal: total });
    };
    if (!get().mail.length) {
      const cached = await mailApi.cached(active, folder).catch(() => null);
      if (cached && cached.messages.length) keep(cached.messages, cached.total);
    }
    if (!quiet) set({ syncing: true });
    try {
      const fresh = await mailApi.sync(active, folder);
      keep(fresh.messages, fresh.total);
      if (seq === syncSeq) set({ syncError: null });
    } catch (e) {
      if (seq === syncSeq) set({ syncError: errText(e) });
    } finally {
      if (seq === syncSeq) set({ syncing: false });
    }
  },
  loadBody: async (id) => {
    const { active, folder } = get();
    const m = get().mail.find((x) => x.id === id);
    if (!LIVE || !active || !m?.uid || m.bodyLoaded) return;
    try {
      const b = await mailApi.body(active, folder, m.uid);
      set((s) => ({
        mail: s.mail.map((x) =>
          x.id === id ? { ...x, body: b.text, html: b.html, to: b.to, cc: b.cc, messageId: b.messageId, references: b.references, attachments: b.attachments, bodyLoaded: true } : x,
        ),
      }));
    } catch (e) {
      set((s) => ({ mail: s.mail.map((x) => (x.id === id ? { ...x, body: `Couldn’t load this message. ${errText(e)}`, bodyLoaded: false } : x)) }));
    }
  },

  /* ---------- AI and appearance ---------- */
  setAgents: (agents) => {
    const installed = agents.filter((a) => a.installed);
    const saved = load("crooli.provider");
    const provider = (installed.find((a) => a.provider === saved) ?? installed[0])?.provider ?? "claude";
    set({ agents, provider, agentsLoaded: true });
  },
  setProvider: (provider) => {
    save("crooli.provider", provider);
    set({ provider });
  },
  setModel: (p, m) => {
    save(`crooli.model.${p}`, m);
    set({ model: { ...get().model, [p]: m } });
  },
  setTheme: (theme) => {
    save("crooli.theme", theme);
    applyTheme(theme);
    set({ theme });
  },

  setPref: (k, v) => {
    save(`crooli.${k}`, v ? "1" : "0");
    set({ [k]: v } as Pick<State, typeof k>);
  },

  /* ---------- panels ---------- */
  setPanel: (panel) => (panel === "compose" ? get().openCompose() : set({ panel })),
  openCompose: (seed) => {
    set({ panel: "compose", compose: { to: "", subject: "", body: "", ...seed } });
    get().loadContacts();
  },
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),

  /* ---------- actions ---------- */
  move: (id, to) => {
    const { active, folder, mail } = get();
    const m = mail.find((x) => x.id === id);
    if (!m) return;
    if (!LIVE) {
      set({ mail: mail.map((x) => (x.id === id ? { ...x, folder: to } : x)) });
      return;
    }
    set({ mail: mail.filter((x) => x.id !== id), folderTotal: Math.max(0, get().folderTotal - 1) });
    if (active && m.uid)
      mailApi.move(active, folder, m.uid, to).catch((e) => {
        get().showToast(errText(e));
        get().refresh({ quiet: true });
      });
  },
  toggleStar: (id) => {
    const m = get().mail.find((x) => x.id === id);
    if (!m) return;
    set((s) => ({ mail: s.mail.map((x) => (x.id === id ? { ...x, starred: !x.starred } : x)) }));
    const { active, folder } = get();
    if (LIVE && active && m.uid) mailApi.flag(active, folder, m.uid, "flagged", !m.starred).catch((e) => get().showToast(errText(e)));
  },
  markRead: (id) => {
    const m = get().mail.find((x) => x.id === id);
    if (!m?.unread) return;
    set((s) => ({ mail: s.mail.map((x) => (x.id === id ? { ...x, unread: false } : x)) }));
    const { active, folder } = get();
    if (LIVE && active && m.uid) mailApi.flag(active, folder, m.uid, "seen", true).catch(() => {});
  },
  send: async ({ draftId, ...m }) => {
    const { active } = get();
    if (!LIVE) throw new Error("This is the website demo. Install Mail to send for real.");
    if (!active) throw new Error("Connect an account first.");
    await mailApi.send(active, m);
    if (draftId != null) get().move(draftId, "trash");
    if (get().folder === "sent") get().refresh({ quiet: true });
  },
  saveDraft: async ({ draftId, ...m }) => {
    const { active, folder } = get();
    if (LIVE && active) {
      await mailApi.saveDraft(active, m);
      if (draftId != null) get().move(draftId, "trash");
      if (folder === "drafts") get().refresh({ quiet: true });
      return;
    }
    const others = draftId != null ? get().mail.filter((x) => x.id !== draftId) : get().mail;
    const d: Email = {
      id: localId++,
      folder: "drafts",
      fromName: m.to ? `To: ${m.to}` : "No recipient yet",
      fromAddress: m.to,
      to: m.to,
      verified: false,
      avatar: initialsAvatar(m.to, m.to),
      subject: m.subject || "(No subject)",
      preview: m.body.replace(/\s+/g, " ").slice(0, 160),
      body: m.body,
      date: new Date(),
      unread: false,
      starred: false,
      isDraft: true,
      bodyLoaded: true,
    };
    set({ mail: [d, ...others] });
  },
  showToast: (toast) => {
    set({ toast });
    window.setTimeout(() => {
      if (get().toast === toast) set({ toast: null });
    }, 2600);
  },
}));

export function applyTheme(t: Theme) {
  const el = document.documentElement;
  if (t === "system") delete el.dataset.theme;
  else el.dataset.theme = t;
}

export function folderMail(s: Pick<State, "mail" | "folder">): Email[] {
  if (LIVE) return s.mail;
  return s.folder === "starred" ? s.mail.filter((m) => m.starred && m.folder !== "trash") : s.mail.filter((m) => m.folder === s.folder);
}

export function visibleMail(s: Pick<State, "mail" | "folder" | "query" | "filter">): Email[] {
  let out = folderMail(s);
  if (s.filter === "unread") out = out.filter((m) => m.unread);
  const q = s.query.trim().toLowerCase();
  if (!q) return out;
  return out.filter(
    (m) =>
      m.fromName.toLowerCase().includes(q) ||
      m.fromAddress.toLowerCase().includes(q) ||
      m.subject.toLowerCase().includes(q) ||
      m.preview.toLowerCase().includes(q),
  );
}

export function filterCounts(list: Email[]) {
  let unread = 0;
  for (const m of list) if (m.unread) unread++;
  return { all: list.length, unread };
}

// 14.171: dot thousands separator, as in the reference.
export const formatCount = (n: number) => new Intl.NumberFormat("de-DE").format(n);

export function formatDate(d: Date): string {
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return `${String(d.getHours()).padStart(2, "0")}.${String(d.getMinutes()).padStart(2, "0")}`;
  const month = d.toLocaleString("en-GB", { month: "long" });
  return now.getTime() - d.getTime() < 300 * 864e5 ? `${month} ${d.getDate()}` : `${d.getDate()} ${month.slice(0, 3)} ${d.getFullYear()}`;
}
