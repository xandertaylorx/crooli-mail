# Crooli Mail — Product & Build Plan

> Owner: **Crooli** ([crooli.com](https://crooli.com))
> Status: **Phase 1 done** (UI built to the references, running on mock data, with a working Claude Code/Codex bridge). **Next: Phase 2, real mail.**
> Reference designs: `design/reference/inbox-claude.png`, `design/reference/inbox-codex.png`
> Brand: `design/brand/` (synced from the Crooli Design System artifact)

---

## 1. What we're building

A **macOS-first desktop email client** (Windows later). It works with any mailbox you already have, like Gmail or Outlook, and has a clean, modern UI.

It's **AI-powered with no API keys and no accounts.** Crooli finds whichever coding agent is already installed on the machine, either **Claude Code** (`claude`) or **Codex** (`codex`), and drives it locally. The user's own subscription (Claude Max, ChatGPT Pro, and so on) pays for the AI.

**Pillars**
1. **Lightning fast.** Opening the app, switching folders, search and scrolling should all feel instant (<16ms per interaction, cold start < 500ms).
2. **Pixel-identical to the reference designs.** The screenshots in `design/reference/` are the spec.
3. **Zero friction.** No Crooli account, no signup, no cloud backend and no telemetry by default. Mail and AI both stay on the user's machine plus their mail provider.
4. **AI that does real work.** It summarizes, triages, drafts replies, runs "Continue" (the agent works through your inbox) and answers questions about your mail.

---

## 2. Tech stack (proposed)

| Layer | Choice | Why |
|---|---|---|
| Shell | **Tauri v2** (Rust) | Native webview, ~10MB binary, low RAM, one codebase for macOS and Windows |
| UI | **React + TypeScript + Vite** | Fast iteration on a pixel-perfect design |
| Styling | **Tailwind CSS** + design tokens in CSS vars | Keeps the exact spacing, radii and colors from the mockups consistent |
| List virtualization | `@tanstack/react-virtual` | 14k+ emails scroll at 60fps or better |
| State | Zustand + TanStack Query | Lightweight, cache-friendly |
| Local store | **SQLite (rusqlite) + FTS5** | Offline-first cache with instant full-text search |
| Mail sync | Rust: `async-imap` + `lettre` (SMTP) for every provider | One code path, real IMAP IDLE push, fast incremental sync |
| Auth to mail | **v1: IMAP/SMTP + app passwords** (Gmail, iCloud, Yahoo, Fastmail, custom domains) and **Microsoft OAuth** for Outlook. **Later: "Sign in with Google"** | No Google verification needed to launch (see §4b). Secrets go in the **macOS Keychain** / Windows Credential Manager |
| AI | Subprocess bridge to `claude` / `codex` CLI | Uses the user's existing install and subscription |
| Font | **Crooli Sans** (bundled, OFL) + Plus Jakarta Sans 800 for the logo word only | Crooli brand. It's a Geist fork, so it's very close to the Inter look in the mockups |

**Alternative considered:** native SwiftUI. It gives the best Mac feel, but Windows would need a full rewrite, and pixel-matching a custom design is harder. Tauri wins for "Mac first, Windows later".

---

## 3. Design spec (from reference images)

The screenshots are the source of truth. Anything new should look like it belongs in them.

**Overall**
- Light, airy, neutral grays. White cards sit on a very light gray (`~#F7F7F8`) canvas.
- Large rounded corners: window ~24px, cards ~16px, pills fully rounded.
- Hairline borders (`~#E8E8EA`) with very soft or no shadows.
- Typography is Inter in the mockup, but we use Crooli Sans. Titles are regular weight in medium gray, names are medium weight in near-black, previews are regular in dark gray.
- Thousands separator is a **dot** (`14.171`), which is a locale-style format. Make it a setting later.

**Crooli brand overrides** (the mockups set the layout, the brand sets the identity)
- **Logo:** the Crooli mark replaces the mockup's asterisk. The rail tile is `design/brand/logos/app-icon-tile.svg`: a black rounded square with the white mark. The full lockup (mark + "Crooli" in Plus Jakarta Sans 800) goes on onboarding, About and the website.
- **Type:** Crooli Sans everywhere instead of Inter.
- **Colour:** neutrals map to brand tokens (`ink`, `ink-soft`, `ink-muted`, `rule`, `oat`, `card`). `lapis` is the only accent (focus ring, selection, verified badge). Claude and OpenAI logos keep their own colours.
- **Dark mode:** comes free from the brand's dark token values. Crooli is dark-first, so dark mode should ship in v1, not later.
- **Copy:** British spelling, plain and calm, no emoji, no exclamation marks.
- **App icon** (Dock/Finder): build it from the Crooli mark. It still needs designing.

**Left icon rail** (~84px wide, light grey background, right border)
- Top: the Crooli logo tile (see above).
- Icon buttons, top to bottom: compose-AI (mail + sparkle), favorites/starred, **Inbox (active: white rounded tile with subtle border)**, folders, org/hierarchy (rules/labels), clipboard (tasks), documents (drafts/attachments).
- Icons are filled, mid-gray, ~20px.

**Header**
- `Inbox  •  14.171 emails`: large (~22px) regular gray text with a dot separator.
- Hairline divider underneath.

**Toolbar row**
- **"Continue"** primary pill: black background, white text, mail-plus icon. This kicks off the AI agent.
- Vertical divider.
- Folder pills: `Inbox 14.171` (active: light gray fill, rounded) and `Sent items` (inactive: no fill, paper-plane icon). The row scrolls horizontally for more folders.

**AI provider card** (white card, rounded, full width)
- Left: provider logo + model name + plan.
  - Claude: orange Claude starburst, `Opus 4.8`, subtitle `Max (20x)`.
  - Codex: black OpenAI knot, `GPT 5.5`, subtitle `Pro (20x)`.
- Right: **segmented usage meter**, ~40 thin vertical rounded bars. Filled bars use the provider color (Claude orange `~#D97757`, OpenAI black). Unfilled bars are light gray. It shows remaining usage / rate-limit headroom.
- The real model and plan are detected at runtime. The mockup values are only examples.

**Inbox list card**
- Header row: checkbox + "Inbox" label (gray) on the left, filter/sort icon on the right.
- **Promo banner:** "Upgrade with AI / For more powerful Inbox" over an illustrated sky-and-futuristic-garden-building image that fades to white at the bottom. It can be dismissed. The artwork is Crooli's own and ships as-is. Put the full-resolution source in `design/brand/art/`.
- **Email rows:** circular avatar (photo or brand logo) · sender name (medium, near-black) · blue verified badge · date right-aligned (`05.16`, `June 29`) · 2-line preview, truncated with an ellipsis. Unread/selected rows get a faint gray background. Rows are separated by hairlines.

**To produce before building UI**
- `design/tokens.json`: colors, radii, spacing, font sizes measured from the PNGs.
- Icon set: map each rail icon to a library (Phosphor "fill" / SF Symbols-like) or custom SVGs.
- Colour, type, radius and shadow tokens already exist in `design/brand/tokens.json`. `design/tokens.json` only adds the mockup-specific layout measurements (rail width, card radii, row height, pill sizes).

---

## 4. AI integration — "bring your own agent"

**Detection (on launch, cached)**
1. Look for `claude` and `codex` on `PATH`, then in common install locations (`~/.claude/local`, `~/.local/bin`, `/opt/homebrew/bin`, `/usr/local/bin`, npm global bin).
2. Run `--version` and check auth status, so we can show the user if they're not logged in.
3. If both exist, the user picks one in settings and the card shows the active one. If neither exists, show onboarding with copy-paste install instructions.

**Invocation**
- Claude Code: `claude -p --output-format stream-json` (headless). The prompt goes over stdin. Tools are restricted or disabled so it can't touch the filesystem unless we want it to.
- Codex: `codex exec --json` (headless) with the sandbox set to read-only.
- Both sit behind one Rust trait, `AgentProvider`, with methods like `complete(prompt, context) -> Stream<Event>`, `usage()` and `model_info()`.
- Stream tokens to the UI so it feels instant.
- **Email context goes in through a local MCP server that Crooli exposes** (`search_mail`, `read_thread`, `draft_reply`, `label`, `archive`). The agent pulls only what it needs, and every write action needs user confirmation in the UI.

**Usage meter**
- Read the plan, usage and rate-limit info each CLI exposes (status/usage commands or stream metadata). If the exact numbers aren't available, estimate from our own call log. Investigate this in Phase 0.

**AI features (priority order)**
1. Thread summary (one-liner in the list and a full version in the reader)
2. Draft reply in the user's voice (learned from Sent items)
3. **Continue**: the agent works the inbox (triage, draft replies, flag what needs you) and proposes actions in a review queue
4. Ask your inbox ("what did Deel say about my withdrawal?")
5. Smart categories / auto-labels
6. Unsubscribe and cleanup suggestions

**Privacy rule:** nothing leaves the machine except to (a) the user's mail provider and (b) the user's own Claude Code / Codex install. No Crooli servers.

---

## 4b. Connecting mail without the Google approval process

"Sign in with Google" means Crooli has to pass Google's app review plus a yearly security assessment for full Gmail access. Until then, it's capped at 100 test users. We don't need it to launch.

**v1: works with any mailbox, no Google review**
- **Gmail:** IMAP + an **app password**. The user turns on 2-Step Verification, makes an app password at myaccount.google.com/apppasswords, and pastes it into Crooli. Gmail's IMAP is on by default.
- **iCloud:** IMAP + an app-specific password from account.apple.com.
- **Yahoo, AOL, Fastmail, Zoho, custom domains, work servers:** IMAP + password or app password.
- **Outlook / Hotmail / Microsoft 365:** Microsoft has switched off plain passwords for IMAP, so these need OAuth. Microsoft's app registration is free and self-serve, with no paid audit, so we do it in v1.

**Make it painless**
- The user types only their email address. Crooli fills in the servers by itself (known providers, then the provider's autoconfig file, DNS records and the Mozilla ISP database).
- For Gmail and iCloud, show a short step-by-step with a button that opens the right page to make the app password.
- Test the connection before saving, with a plain error if it fails ("That password didn't work. Make sure it's an app password, not your normal one").

**Later:** add one-click "Sign in with Google" once Crooli passes Google's review. App-password accounts keep working, so nobody has to switch.

---

## 5. Performance plan

- **Local-first:** the UI only ever reads SQLite. Sync runs in the Rust background and pushes deltas over Tauri events.
- Virtualized lists with fixed row height, and no layout thrash.
- FTS5 search with an index over subject, sender and body text. Results return in under 50ms on 100k messages.
- Lazy body fetch. Headers and snippets sync first, bodies on open plus prefetch for the top N.
- HTML emails render in a sandboxed iframe with remote images blocked by default (privacy and speed).
- Keyboard-first: `j/k`, `e` archive, `r` reply, `c` compose, `/` search, `⌘K` command palette.
- Budgets go into CI later: cold start, folder switch and search latency.

---

## 6. Roadmap

**Phase 0 — Spikes (1 week)**
- Tauri v2 hello-world window with a custom titlebar matching the mockup frame
- Prove headless `claude -p` and `codex exec` streaming from Rust
- Find out how to get model, plan and usage info from each CLI
- Gmail via app password and IMAP IDLE proof of concept, plus Microsoft OAuth loopback flow

**Phase 1 — Static UI clone (pixel-perfect)**
- Extract design tokens and build the components: rail, header, toolbar pills, provider card, usage meter, list card, banner, email row
- Hook up mock data, then overlay screenshots for 1:1 diff checks

**Phase 2 — Real mail**
- Account connect: email-only setup with auto-detected servers. Gmail, iCloud and any IMAP via app password, Outlook via Microsoft OAuth
- SQLite schema, sync engine, folders, read/unread, archive, delete, send
- Reader pane plus composer

**Phase 3 — AI**
- AgentProvider with Claude Code and Codex, provider card with live usage
- Summaries, draft reply, Continue mode with review queue, Ask-your-inbox

**Phase 4 — Polish & ship macOS**
- Keyboard shortcuts, command palette, notifications, dark mode
- Signed and notarized `.dmg`, auto-update (Tauri updater)

**Phase 5 — Windows**
- Windows build, Credential Manager, Mica/backdrop tweaks, and CLI detection paths on Windows

---

## 7. Open questions

- **When to apply for Google's review** to add one-click "Sign in with Google". It isn't needed for launch (see §4b).
- Exact way to read **usage/limits** from the Claude Code and Codex CLIs, which may change between versions.
- Final product name: "Crooli Mail" or just "Crooli"? Also the bundle ID (e.g. `com.crooli.mail`) and the download page on crooli.com.
- Dock app icon built from the Crooli mark.
- Add the full-resolution banner artwork file to `design/brand/art/`. The mockup copy is too small to ship.
- Licensing: open source or closed?
