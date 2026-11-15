// Sample mailbox for the website demo. Every person, company and address here is made up.

export type Avatar =
  | { kind: "image"; src: string }
  | { kind: "brand"; bg: string; fg: string; label: string; size?: number; weight?: number }
  | { kind: "initials"; bg: string; fg: string; text: string };

export type FolderId = "inbox" | "sent" | "drafts" | "archive" | "starred" | "trash";

export interface Email {
  id: number;
  folder: FolderId;
  fromName: string;
  fromAddress: string;
  verified: boolean;
  avatar: Avatar;
  subject: string;
  preview: string;
  body: string;
  date: Date;
  unread: boolean;
  starred: boolean;
  /* Real mail only */
  uid?: number;
  html?: string | null;
  to?: string;
  cc?: string;
  messageId?: string | null;
  references?: string | null;
  attachments?: string[];
  bodyLoaded?: boolean;
  isDraft?: boolean;
  /** Who the avatar is for: the sender, or the recipient for sent mail. */
  peer?: string;
}

export const INBOX_TOTAL = 14171;

// "Today" for the mock: Noor's message arrives at 05.16.
const now = new Date();
const today0516 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 5, 16);
const june29 = (h: number, m: number) => {
  const y = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1;
  return new Date(y, 5, 29, h, m);
};

const fixed: Omit<Email, "id">[] = [
  {
    folder: "inbox",
    fromName: "Noor Calloway",
    fromAddress: "noor@hollinreeve.example",
    verified: true,
    avatar: { kind: "initials", bg: "#ffe1cc", fg: "#8a3b0c", text: "NC" },
    subject: "Your insights on our UX design",
    preview:
      "We’re refining our product and need your insights on our user experience (UX) design. Could you spare 20 minutes this week for a quick call?",
    body: `Hi,

We’re refining our product and need your insights on our user experience (UX) design. You’ve used the beta more than almost anyone, so your view matters a lot to us.

Could you spare 20 minutes this week for a quick call? I’m free Tuesday after 14.00 or any time Thursday morning. If a call doesn’t suit, a few written notes on the onboarding flow and the new inbox layout would be just as helpful.

Thanks so much,
Noor`,
    date: today0516,
    unread: true,
    starred: false,
  },
  {
    folder: "inbox",
    fromName: "Hana from Larkspur Pay",
    fromAddress: "hana@larkspurpay.example",
    verified: true,
    avatar: { kind: "brand", bg: "#c5b3fd", fg: "#14102b", label: "larkspur", size: 10, weight: 700 },
    subject: "Your money is on the way",
    preview:
      "Your money is on the way! Your Larkspur withdrawal is all set, and your money is on its way to your bank account. It should arrive within 1–3 working days.",
    body: `Your money is on the way!

Your Larkspur withdrawal is all set, and your money is on its way to your bank account.

Amount: £2,450.00
Destination: Bank account ending 4417
Expected arrival: within 1–3 working days

You can follow the transfer at any time from the Withdrawals page in your Larkspur dashboard.

Hana
Larkspur Payments`,
    date: june29(16, 2),
    unread: false,
    starred: false,
  },
  {
    folder: "inbox",
    fromName: "Tidewell Weekly",
    fromAddress: "no-reply@tidewell.example",
    verified: true,
    avatar: { kind: "brand", bg: "#1f6f78", fg: "#fff", label: "T", size: 17, weight: 700 },
    subject: "Your weekly reads",
    preview:
      "Five new posts from writers you follow, plus a long read on how small teams ship calm software.",
    body: `This week on Tidewell

Five new posts from writers you follow, plus a long read on how small teams ship calm software.

1. The quiet interface — why the best tools feel like nothing at all
2. Shipping on Fridays, and other myths
3. A field guide to local-first apps
4. What we learnt from 10,000 support emails
5. Notes on taste

Happy reading.`,
    date: june29(9, 30),
    unread: false,
    starred: false,
  },
];

// ---------- deterministic generator for the remaining messages ----------
let seed = 7;
const rand = () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};
const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];

const senders: { name: string; address: string; verified: boolean; avatar: Avatar }[] = [
  { name: "Mapleline", address: "updates@mapleline.example", verified: true, avatar: { kind: "brand", bg: "#5e6ad2", fg: "#fff", label: "M", size: 17, weight: 700 } },
  { name: "Draftboard", address: "no-reply@draftboard.example", verified: true, avatar: { kind: "brand", bg: "#1e1e1e", fg: "#fff", label: "D", size: 17, weight: 700 } },
  { name: "Wren Hallett", address: "wren@fieldnote.example", verified: false, avatar: { kind: "initials", bg: "#ffe1cc", fg: "#8a3b0c", text: "WH" } },
  { name: "Ledgerly", address: "receipts@ledgerly.example", verified: true, avatar: { kind: "brand", bg: "#635bff", fg: "#fff", label: "L", size: 17, weight: 700 } },
  { name: "Codeshelf", address: "noreply@codeshelf.example", verified: true, avatar: { kind: "brand", bg: "#0d1117", fg: "#fff", label: "CS", size: 13, weight: 700 } },
  { name: "Jonas Verbeek", address: "jonas@verbeek.example", verified: false, avatar: { kind: "initials", bg: "#d6ecff", fg: "#0b4a80", text: "JV" } },
  { name: "Quillpad", address: "team@quillpad.example", verified: true, avatar: { kind: "brand", bg: "#ffffff", fg: "#111", label: "Q", size: 17, weight: 700 } },
  { name: "Amara Quist", address: "amara@quistworks.example", verified: false, avatar: { kind: "initials", bg: "#e4f5e6", fg: "#1f6b33", text: "AQ" } },
  { name: "Shipyard", address: "notifications@shipyard.example", verified: true, avatar: { kind: "brand", bg: "#000", fg: "#fff", label: "S", size: 17, weight: 700 } },
  { name: "Felix Ashdown", address: "felix@ashdown.example", verified: false, avatar: { kind: "initials", bg: "#f0e6ff", fg: "#5a2ea6", text: "FA" } },
  { name: "Brookbank", address: "help@brookbank.example", verified: true, avatar: { kind: "brand", bg: "#ff4f40", fg: "#fff", label: "B", size: 17, weight: 700 } },
  { name: "Stayhaven", address: "automated@stayhaven.example", verified: true, avatar: { kind: "brand", bg: "#ff385c", fg: "#fff", label: "S", size: 17, weight: 700 } },
  { name: "Lucia Fenwick", address: "lucia@fenwick.example", verified: false, avatar: { kind: "initials", bg: "#fff3c4", fg: "#7a5a00", text: "LF" } },
  { name: "Launchpad Daily", address: "hello@launchpaddaily.example", verified: true, avatar: { kind: "brand", bg: "#da552f", fg: "#fff", label: "L", size: 17, weight: 700 } },
];

const topics: [string, string][] = [
  ["Weekly product update", "Here’s what shipped this week: faster sync, a new command bar and a handful of fixes you asked for."],
  ["Invoice for October", "Your invoice is ready. The total of £48.00 will be charged to the card on file on the 1st."],
  ["Quick question about the brief", "Had a look at the brief — mostly clear, but could we talk through the timeline for the second phase?"],
  ["You were mentioned in a comment", "“Can we tighten the spacing on the list rows?” — reply directly from the thread or open the file."],
  ["Your trip is confirmed", "Pack your bags. Your booking is confirmed and the host has sent check-in details for your stay."],
  ["Pull request review requested", "A new pull request is waiting on your review: refactor the sync engine to use incremental updates."],
  ["Coffee next week?", "It’s been ages — are you around next week for a coffee? I’m near the studio most mornings."],
  ["Deployment ready", "Your latest deployment is live. Build completed in 42 seconds with no warnings."],
  ["Security alert", "A new sign-in to your account was detected from a Mac in London. If this was you, there’s nothing to do."],
  ["Notes from today’s call", "Thanks for the time today. I’ve pulled together the notes and next steps so we don’t lose track."],
  ["Payment received", "Good news — we’ve received your payment. Your receipt is attached for your records."],
  ["Launch day is here", "We’re live! Thank you for being part of the journey. Here’s how you can help spread the word today."],
];

function generate(): Email[] {
  const out: Email[] = fixed.map((e, i) => ({ ...e, id: i + 1 }));
  let t = out[out.length - 1].date.getTime();
  for (let i = out.length; i < INBOX_TOTAL; i++) {
    t -= Math.floor(20 * 60 * 1000 + rand() * 6 * 60 * 60 * 1000);
    const s = pick(senders);
    const [subject, preview] = pick(topics);
    out.push({
      id: i + 1,
      folder: "inbox",
      fromName: s.name,
      fromAddress: s.address,
      verified: s.verified,
      avatar: s.avatar,
      subject,
      preview,
      body: `${preview}\n\nBest,\n${s.name.split(" ")[0]}`,
      date: new Date(t),
      unread: rand() < 0.04,
      starred: rand() < 0.03,
    });
  }
  return out;
}

function generateSent(): Email[] {
  const out: Email[] = [];
  let t = Date.now() - 3 * 60 * 60 * 1000;
  for (let i = 0; i < 1286; i++) {
    t -= Math.floor(rand() * 30 * 60 * 60 * 1000);
    const s = pick(senders.filter((x) => !x.verified));
    const [subject] = pick(topics);
    out.push({
      id: 100000 + i,
      folder: "sent",
      fromName: `To: ${s.name}`,
      fromAddress: s.address,
      verified: false,
      avatar: s.avatar,
      subject: `Re: ${subject}`,
      preview: "Thanks — that works for me. I’ll send the updated files over by the end of the day.",
      body: "Thanks — that works for me. I’ll send the updated files over by the end of the day.",
      date: new Date(t),
      unread: false,
      starred: false,
    });
  }
  return out;
}

export const mockMail: Email[] = [...generate(), ...generateSent()];
