// Real mail accounts, via the Rust side (src-tauri/src/mail.rs).
import { invoke } from "@tauri-apps/api/core";
import type { FolderId } from "../data/mock";

export interface Account {
  email: string;
  name: string;
  provider: ProviderKey;
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
  smtpStarttls: boolean;
  username?: string | null;
}

export interface Header {
  uid: number;
  fromName: string;
  fromAddress: string;
  to: string;
  toNames: string;
  toAddresses: string;
  subject: string;
  date: number;
  preview: string;
  seen: boolean;
  flagged: boolean;
  draft: boolean;
}

export interface FolderView {
  total: number;
  messages: Header[];
}

export interface Body {
  text: string;
  html: string | null;
  to: string;
  cc: string;
  messageId: string | null;
  references: string | null;
  attachments: string[];
}

export interface Contact {
  name: string;
  address: string;
  count: number;
}

export interface Outgoing {
  to: string;
  cc?: string;
  subject: string;
  body: string;
  inReplyTo?: string | null;
  references?: string | null;
}

export const mailApi = {
  listAccounts: () => invoke<Account[]>("list_accounts"),
  connect: (account: Account, password: string) => invoke<Account>("connect_account", { account, password }),
  remove: (email: string) => invoke<void>("remove_account", { email }),
  cached: (email: string, folder: FolderId) => invoke<FolderView>("cached_folder", { email, folder }),
  sync: (email: string, folder: FolderId) => invoke<FolderView>("sync_folder_cmd", { email, folder }),
  body: (email: string, folder: FolderId, uid: number) => invoke<Body>("get_message", { email, folder, uid }),
  flag: (email: string, folder: FolderId, uid: number, flag: "seen" | "flagged", on: boolean) =>
    invoke<void>("set_flag", { email, folder, uid, flag, on }),
  move: (email: string, folder: FolderId, uid: number, to: FolderId) => invoke<void>("move_message", { email, folder, uid, to }),
  send: (email: string, message: Outgoing) => invoke<void>("send_message", { email, message }),
  saveDraft: (email: string, message: Outgoing) => invoke<void>("save_draft", { email, message }),
  openUrl: (url: string) => invoke<void>("open_url", { url }),
  senderIcon: (address: string) => invoke<string | null>("sender_icon", { address }),
  contacts: (email: string) => invoke<Contact[]>("contacts", { email }),
};

/* ------------------------------------------------------------------ providers */

export type ProviderKey = "gmail" | "icloud" | "outlook" | "yahoo" | "fastmail" | "imap";

export interface Step {
  text: string;
  link?: { label: string; url: string };
}

export interface Provider {
  key: ProviderKey;
  name: string;
  domains: string[];
  servers?: Pick<Account, "imapHost" | "imapPort" | "smtpHost" | "smtpPort" | "smtpStarttls">;
  steps: Step[];
  note?: string;
  passwordLabel: string;
  passwordHint?: string;
  /** Can't be connected with an app password at all. */
  unsupported?: string;
}

export const PROVIDERS: Provider[] = [
  {
    key: "gmail",
    name: "Gmail",
    domains: ["gmail.com", "googlemail.com"],
    servers: { imapHost: "imap.gmail.com", imapPort: 993, smtpHost: "smtp.gmail.com", smtpPort: 465, smtpStarttls: false },
    steps: [
      { text: "Turn on 2-Step Verification for your Google Account, if it isn’t on already.", link: { label: "Open 2-Step Verification", url: "https://myaccount.google.com/signinoptions/twosv" } },
      { text: "Open App passwords, type “Crooli Mail” as the name and press Create.", link: { label: "Open App passwords", url: "https://myaccount.google.com/apppasswords" } },
      { text: "Google shows a 16-letter password once. Copy it and paste it below. The spaces don’t matter." },
    ],
    note: "IMAP is always on for Gmail. If App passwords says it isn’t available, 2-Step Verification is off, or your work or school admin has turned app passwords off.",
    passwordLabel: "App password",
    passwordHint: "abcd efgh ijkl mnop",
  },
  {
    key: "icloud",
    name: "iCloud Mail",
    domains: ["icloud.com", "me.com", "mac.com"],
    servers: { imapHost: "imap.mail.me.com", imapPort: 993, smtpHost: "smtp.mail.me.com", smtpPort: 587, smtpStarttls: true },
    steps: [
      { text: "Sign in to your Apple Account.", link: { label: "Open Apple Account", url: "https://account.apple.com/account/manage" } },
      { text: "Go to Sign-In and Security, choose App-Specific Passwords, then the + button. Name it “Crooli Mail” and press Create." },
      { text: "Copy the password Apple shows and paste it below, with your @icloud.com address." },
    ],
    note: "App-specific passwords need two-factor authentication, which most Apple Accounts have. iCloud Mail must be turned on in iCloud settings.",
    passwordLabel: "App-specific password",
    passwordHint: "abcd-efgh-ijkl-mnop",
  },
  {
    key: "outlook",
    name: "Outlook",
    domains: ["outlook.com", "hotmail.com", "live.com", "msn.com"],
    steps: [],
    unsupported:
      "Microsoft only lets apps into Outlook.com, Hotmail and Microsoft 365 mail through its own Microsoft sign-in. Passwords and app passwords don’t work for mail any more. Mail doesn’t have Microsoft sign-in yet. It’s next on the list.",
    passwordLabel: "Password",
  },
  {
    key: "yahoo",
    name: "Yahoo Mail",
    domains: ["yahoo.com", "yahoo.co.uk", "ymail.com", "rocketmail.com"],
    servers: { imapHost: "imap.mail.yahoo.com", imapPort: 993, smtpHost: "smtp.mail.yahoo.com", smtpPort: 465, smtpStarttls: false },
    steps: [
      { text: "Open Account security in your Yahoo account.", link: { label: "Open Account security", url: "https://login.yahoo.com/account/security" } },
      { text: "Choose Generate app password (it may say Generate and manage app passwords). Type “Crooli Mail” and press Generate." },
      { text: "Copy the password Yahoo shows and paste it below." },
    ],
    passwordLabel: "App password",
  },
  {
    key: "fastmail",
    name: "Fastmail",
    domains: ["fastmail.com", "fastmail.fm"],
    servers: { imapHost: "imap.fastmail.com", imapPort: 993, smtpHost: "smtp.fastmail.com", smtpPort: 465, smtpStarttls: false },
    steps: [
      { text: "Open Fastmail and go to Settings, then Privacy & Security, then Manage app passwords and access.", link: { label: "Open Fastmail", url: "https://app.fastmail.com/" } },
      { text: "Choose New app password. For access, pick Mail (IMAP/POP/SMTP), name it “Crooli Mail”, then Generate password." },
      { text: "Copy the password and paste it below." },
    ],
    passwordLabel: "App password",
  },
  {
    key: "imap",
    name: "Other",
    domains: [],
    steps: [
      { text: "Find your provider’s IMAP and SMTP settings. They’re usually on a help page called “IMAP settings” or “Use your email with other apps”." },
      { text: "If your provider offers app passwords, make one called “Crooli Mail” and use it here. Otherwise use your normal password." },
    ],
    note: "Most providers use port 993 for IMAP, and 465 (TLS) or 587 (STARTTLS) for sending.",
    passwordLabel: "Password or app password",
  },
];

export const providerFor = (email: string): ProviderKey | null => {
  const d = email.split("@")[1]?.toLowerCase().trim();
  if (!d) return null;
  return PROVIDERS.find((p) => p.domains.includes(d))?.key ?? null;
};

/* ------------------------------------------------------------------ avatars */

const PASTELS: [string, string][] = [
  ["#ffe1cc", "#8a3b0c"],
  ["#d6ecff", "#0b4a80"],
  ["#e4f5e6", "#1f6b33"],
  ["#f0e6ff", "#5a2ea6"],
  ["#fff3c4", "#7a5a00"],
  ["#ffe0e6", "#8a1c38"],
  ["#dff4f2", "#0f5e57"],
  ["#ececec", "#3a3a3a"],
];

export function initialsAvatar(name: string, address: string) {
  const base = (name || address).replace(/["'<>]/g, "").trim();
  const parts = base.split(/[\s._-]+/).filter(Boolean);
  const text = ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
  let h = 0;
  for (const c of address || name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const [bg, fg] = PASTELS[h % PASTELS.length];
  return { kind: "initials" as const, bg, fg, text };
}
