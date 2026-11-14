// The tweet list. Run `node social/tweets.mjs` to check every tweet fits X's 280-character limit
// (links count as 23, as on X) and to regenerate social/TWEETS.md.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = "https://mail.crooli.com";
const INSTALL = `curl -fsSL ${SITE}/install.sh | bash`;

export const ALT = {
  "01-hero": "The Crooli Mail app on a blue gradient: an inbox on the left and an open email on the right, with the headline 'An email client with your AI in it.'",
  "02-continue": "The Continue panel in Crooli Mail, listing emails sorted under Needs you, For your information and Can go.",
  "03-draft": "An email from Rico open in Crooli Mail with an AI-written reply already in the reply box.",
  "04-connect": "The Connect your mail screen in Crooli Mail, showing numbered steps for making a Gmail app password.",
  "05-dark": "Crooli Mail in dark mode, using Codex as the AI.",
  "06-ai-settings": "The Settings panel in Crooli Mail showing Claude Code selected, the Haiku model, and 5-hour and weekly usage bars.",
  "07-install": "A Terminal window running the one-line curl install command for Crooli Mail.",
  "08-privacy": "Four cards: your mail stays yours, your AI runs locally, nothing behind your back, passwords in the Keychain.",
  "09-keyboard": "Six keyboard shortcuts: J K to move, E archive, F forward, C compose, S star, Command Return to send.",
  "10-launch": "The Crooli mark above the word Mail and the install command, on a dark background.",
};

// Each tweet: { text, image? }. Keep to 280 characters, British spelling, no emoji, no exclamation marks.
export const groups = [
  {
    title: "Launch thread",
    note: "Post as one thread. Pin the first tweet.",
    tweets: [
      { image: "10-launch", text: `We made an email client with your AI in it.\n\nIt is called Mail. It is free, it is for Mac, and there is no account to make. It uses the Claude Code or Codex you already have installed.\n\n${SITE}` },
      { image: "04-connect", text: `It works with Gmail, iCloud, Yahoo, Fastmail and any IMAP inbox.\n\nPick your provider and Mail shows you exactly what to click to make an app password, step by step. It checks the details work before it saves anything.` },
      { image: "02-continue", text: `Press Continue and your AI reads what came in and sorts it into three piles: what needs you, what is just for information, and what can go.\n\nIt only suggests. Nothing is sent, archived or deleted until you say so.` },
      { image: "03-draft", text: `Open an email, press Draft with AI, and the reply writes itself into the box. Edit it, redraft it, or send it.\n\nLeave halfway and it is saved to Drafts, so you never lose it.` },
      { image: "06-ai-settings", text: `The AI runs on the plan you already pay for.\n\nMail finds Claude Code or Codex on your Mac, uses the lightest model by default (Haiku, or Luna on Codex), and shows how much of your limit is left. No API keys.` },
      { image: "08-privacy", text: `No Crooli account. No Crooli servers.\n\nYour mail goes between your Mac and your provider. Passwords sit in the macOS Keychain. Remote images are off by default, so most senders cannot tell you opened their email.` },
      { image: "07-install", text: `Install it with one line in Terminal:\n\n${INSTALL}\n\nmacOS 13 or later, Apple Silicon and Intel. Because it is fetched with curl, macOS shows no "damaged app" warning. Windows is next.` },
    ],
  },
  {
    title: "Stand-alone showcase tweets",
    note: "One a day. Each has an image.",
    tweets: [
      { image: "01-hero", text: `An email client with your AI in it.\n\nFree for Mac. Gmail, iCloud, Yahoo, Fastmail and any IMAP inbox. No account.\n\n${SITE}` },
      { image: "09-keyboard", text: `Mail is built so your hands never leave the keyboard.\n\nJ and K to move, E to archive, F to forward, C to compose, S to star, Command Return to send, and / to search.` },
      { image: "05-dark", text: `A proper dark mode, and a switch between Claude Code and Codex whenever you like.\n\nThe whole interface is set in Crooli Sans, our own open source typeface.` },
      { image: "02-continue", text: `One button, one job.\n\nContinue reads your latest mail and tells you what needs a reply, what is just for information, and what can go. You decide what happens next.` },
      { image: "03-draft", text: `Replies that sound like you, not like a robot.\n\nDraft with AI writes a short, plain reply into the box. Change it, redraft it, or throw it away. It never sends by itself.` },
      { image: "04-connect", text: `Connecting Gmail used to mean hunting through settings.\n\nIn Mail you pick Gmail, press the button that opens Google's app password page, paste the 16 letters back in, and you are done in about two minutes.` },
      { image: "06-ai-settings", text: `Mail shows how much of your Claude limit is left, in the app, from the numbers Claude Code already keeps on your Mac. It reads them and nothing else.\n\nCodex does not share its usage, so Mail hides the meter rather than inventing one.` },
      { image: "08-privacy", text: `Four promises:\n\nYour mail stays yours.\nYour AI runs on your Mac.\nNothing happens behind your back.\nPasswords live in the Keychain.\n\nNo Crooli account, no Crooli servers.` },
      { image: "07-install", text: `Why a Terminal install?\n\nApps downloaded in a browser get quarantined, and macOS warns you. Files fetched with curl are not flagged, so there is nothing to click through.\n\nRead the script first if you like: ${SITE}/install.sh` },
    ],
  },
  {
    title: "Small feature tweets (no image needed)",
    note: "Good for filling the gaps between the bigger ones.",
    tweets: [
      { text: `Type a few letters in To and Mail suggests the people you actually write to, ranked by how often you do.` },
      { text: `Click away from a half-written email and Mail saves it to Drafts instead of losing it. Click the draft and you are straight back in.` },
      { text: `Sender photos and company logos instead of grey circles with letters. Gravatar for people, the company's own icon for businesses. One switch in Settings turns it off.` },
      { text: `Forwarding cleans the email first. Invisible padding characters, tracking links and runs of blank lines are stripped out, so what you forward reads like an email and not like source code.` },
      { text: `Remote images in email can tell a sender when and where you opened it. Mail keeps them off by default. One setting turns them on if you want them.` },
      { text: `Mail updates itself. It checks GitHub for a new version when you open it, shows an Update button when one is ready, and only installs when you press it. Updates are signed with Crooli's own key.` },
      { text: `Mail keeps each folder cached on your Mac, so it opens straight to your mail and only downloads what is new.` },
      { text: `The AI only sees an email when you press Summarise, Draft or Continue, and only through the Claude Code or Codex on your own Mac. Nothing runs in the background.` },
      { text: `Mail defaults to the smallest models: Haiku for Claude Code and Luna for Codex. Email does not need a giant model, and it keeps your limits for the work that does.` },
    ],
  },
  {
    title: "Behind the scenes",
    note: "For build-in-public days.",
    tweets: [
      { image: "05-dark", text: `The first version of Mail was built from two screenshots. Then we looked at it properly and everything was about 40% too big.\n\nIt is all on a tighter scale now: small calm type, 88px rows, one set of icons. Light and dark.` },
      { text: `The little pixel scene above your inbox is drawn in code, day and night, and follows your theme. It is not an advert. There is nothing to upgrade, because Mail is free.` },
      { text: `We wanted email that was quick and calm and used the AI people already pay for, instead of another subscription and another account. So we built it.` },
      { text: `Mail is built with Tauri and Rust, so the app is small and starts fast, and the same code can come to Windows later.` },
    ],
  },
  {
    title: "Replies to questions you will get",
    note: "Copy and paste.",
    tweets: [
      { text: `Is it free? Yes. Mail has no subscription. The AI features use the Claude Code or Codex plan you already have.` },
      { text: `Outlook, Hotmail and Microsoft 365 are not supported yet. Microsoft only lets apps in through its own sign in, which Mail does not have yet. It is next on the list.` },
      { text: `Windows is planned. Mail is built so the same code can run there. Mac comes first.` },
      { text: `Can I see the code? Yes, it is public on GitHub: https://github.com/xandertaylorx/crooli-mail` },
      { text: `Do I need an API key? No. Mail uses the Claude Code or Codex that is already installed and signed in on your Mac.` },
      { text: `Does Crooli see my email? No. There is no Crooli account and no Crooli server. Mail talks to your mail provider and to the AI on your Mac, and nowhere else.` },
    ],
  },
  {
    title: "Conversation starters",
    note: "Ask, then reply to the answers.",
    tweets: [
      { text: `What is the one thing your email client gets wrong? Reply and we will have a look.` },
      { text: `Be honest: how many unread emails do you have right now?` },
    ],
  },
];

const count = (s) => [...s.replace(/https?:\/\/\S+/g, "x".repeat(23))].length;

let bad = 0;
let total = 0;
let md = `# Tweets for X\n\nGenerated by \`node social/tweets.mjs\`. Edit the tweets in \`social/tweets.mjs\`, not here.\n\nEvery tweet fits X's 280-character limit (links count as 23). Images are in \`social/images/\` (1600x900, shown at 2400x1350). Alt text for each image is at the bottom.\n\n`;
for (const g of groups) {
  md += `## ${g.title}\n\n_${g.note}_\n\n`;
  g.tweets.forEach((t, i) => {
    const n = count(t.text);
    total++;
    if (n > 280) { bad++; console.error(`TOO LONG (${n}): ${t.text.slice(0, 60)}…`); }
    md += `**${i + 1}.** ${t.image ? `Image: \`images/${t.image}.jpg\`` : "No image"} · ${n} characters\n\n${t.text.split("\n").map((l) => `> ${l}`).join("\n")}\n\n`;
  });
}
md += `## Alt text\n\n${Object.entries(ALT).map(([k, v]) => `- \`${k}.jpg\`: ${v}`).join("\n")}\n\n## Posting plan\n\n1. Day 1: the launch thread. Pin its first tweet.\n2. Days 2 to 10: one stand-alone showcase tweet a day.\n3. In between: small feature tweets, with no image.\n4. When someone asks a question, reply with the matching answer from the replies section.\n5. A 20 second screen recording of Continue sorting a real inbox will do better than any still, if you want to add one.\n`;
writeFileSync(join(dirname(fileURLToPath(import.meta.url)), "TWEETS.md"), md);
console.log(`${total} tweets, ${bad} too long`);
process.exit(bad ? 1 : 0);
