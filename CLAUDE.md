# CLAUDE.md

Guidance for Claude Code (and other agents) working in this repo.

## Project

**Crooli Mail** (working name) is a product of **Crooli** ([crooli.com](https://crooli.com)). Crooli owns the app, the brand and the code. It's a macOS-first (Windows later) desktop email client with a modern UI. Its AI runs on the user's locally installed **Claude Code** (`claude`) or **Codex** (`codex`) CLI. There are no API keys, no Crooli accounts and no backend.

The full plan is in `PLAN.md`. Read it before making architectural decisions.

**Current status: real mail works.** IMAP and SMTP accounts with app passwords (Gmail, iCloud, Yahoo, Fastmail, any IMAP) are in `src-tauri/src/mail.rs`. Passwords live in the Keychain, folders are cached on disk and synced incrementally. Outlook isn't supported yet because it needs Microsoft sign-in (OAuth). The desktop app never shows sample mail. Sample mail (`src/data/mock.ts`) is only for the website's browser demo (`LIVE` is false outside Tauri).

## Commands

- `pnpm app`: run the desktop app (Tauri dev, hot reload)
- `pnpm dev`: UI only in a browser at http://localhost:1420 (AI is simulated; `?provider=codex` shows the Codex state)
- `npx tsc -p .`: typecheck the UI
- `cd src-tauri && cargo test && cargo clippy`: Rust checks
- `scripts/release.sh`: build, sign and package a universal release into `dist-release/`. Add `--publish` to create the GitHub release `v<version>` with the installer zip, the signed updater archive and `latest.json`. Bump the version in `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` and `package.json` first. Put release notes in `RELEASE_NOTES.md` (git-ignored) and they show in the app's Updates section.
- `cd web && pnpm dev`: the website at http://localhost:5180

## Non-negotiables

1. **`design/reference/*.png` sets the look, not the pixel sizes.** Keep their structure and feel: icon rail, title row, black Continue pill, AI card with a bar meter, list card with a banner, calm rows, hairlines and soft greys.
   - The app uses a **tighter scale than the mockups**, which were roughly 1.4× too big. Body 13–14.5px, rows 88px, toolbar and header 52px, rail 68px, cards 12px radius. Don't drift back up.
   - Colours live as CSS variables in `src/styles.css` (light, plus dark from the brand). Never hardcode one-off colours or spacing.
   - Verify visually: run the app, take a screenshot, and fix what looks off, in both light and dark.
   - **No verified ticks.** No decorative badges that don't mean anything.
   - **No heavy focus outlines.** Inputs show focus with their own border. Keyboard-focused buttons get a quiet grey ring (`styles.css`). Never a thick blue box.
   - **Preferences live in Settings**, not on each email: show emails as designed, load remote images (off by default), sender photos and logos.
2. **It's a Crooli product, so use the Crooli brand** (`design/brand/`, synced from the Crooli Design System artifact):
   - **Logo:** the Crooli mark (two arcs round a dot). In the app's rail it's **the bare mark in ink, with no tile behind it**. It replaces the asterisk tile in the mockups. (`app-icon-tile.svg` is only for the Dock icon.) The full logo is the mark plus "Crooli" in Plus Jakarta Sans ExtraBold (800, -0.03em) with a 10px gap (`crooli-wordmark-*.svg`). Use Plus Jakarta Sans only for that word. Use the black mark on light grounds and the white mark on dark ones.
   - **Font:** Crooli Sans (`design/brand/fonts/`, OFL, variable 100–900). It **replaces Inter in the mockups**. Bundle it, and ship `OFL.txt` with the app.
   - **Colours:** use `design/brand/tokens.json` (ink, ink-soft, ink-muted, rule, oat, lapis…). `lapis` is the only interface accent (focus, unread, state). Provider logos (Claude orange, OpenAI black) keep their own colours.
   - **Icons:** the rail set in `src/icons.tsx` (`Ico*`): 20px grid, 1.6px round strokes, with a filled variant when active. New icons follow it. No emoji, no icon fonts.
   - **Copy:** plain, British spelling ("colour", "organise"), no hype, no exclamation marks.
   - **Where the mockups and the brand disagree:** the mockups win on layout, sizes and radii, and the brand wins on logo, font, colour tokens and copy. Light theme matches the mockups. Dark theme comes from the brand's dark token values.
3. **Speed is a feature.** The UI reads only from local SQLite. Lists are virtualized. Nothing blocks the main thread. Don't add heavy dependencies without a reason.
4. **No accounts, no servers, no telemetry.** Data goes only to the user's mail provider and to the user's local `claude`/`codex` process.
5. **AI never acts without approval.** Sending, deleting, archiving and labeling done by the agent go through a user-confirmed review step.
6. **No fake UI.** Every control does something real, or it's left out. If a feature needs something that isn't built yet (like sending without an account), the control is disabled and says why. No upsells: Crooli is free. The usage meter shows only real numbers from the provider, with their source, and is hidden when there are none (Codex). Sample mail is labelled "Sample mail".
7. **AI defaults are light.** Claude Code runs `--model haiku` and Codex runs `-m gpt-6-luna -c model_reasoning_effort="low"`, falling back to Codex's default if that model is rejected. Users can change this in AI and settings. Crooli only calls the AI when the user presses a button.
8. **Secrets go in the OS keychain** (macOS Keychain / Windows Credential Manager). Never put them in plaintext, logs or SQLite.

## Stack (planned)

- **Tauri v2** (Rust) shell and backend
- **React + TypeScript + Vite** frontend, **Tailwind** with CSS-variable tokens
- **SQLite + FTS5** (rusqlite) local store and search
- Mail: `async-imap`, `lettre` SMTP, plus Gmail API / MS Graph adapters later
- AI: `AgentProvider` trait in Rust wrapping `claude -p --output-format stream-json` and `codex exec --json`, with Crooli exposing mailbox tools to the agent over a local MCP server

## Conventions

- Keep platform-specific code behind small modules (`platform/macos`, `platform/windows`) so the Windows port is cheap.
- Rust owns all I/O (network, disk, subprocesses). The frontend talks to it only through typed Tauri commands and events.
- Components: `IconRail`, `PageHeader`, `Toolbar`, `AgentCard` (plus `AiPanel`), `ListColumn`, `MailRow`, `PixelBanner`, `ReaderPane`, `CommandPalette`.
- Plan and usage come from runtime detection (`~/.claude.json` for Claude, `~/.codex/auth.json` for Codex). Never show mockup values in the app.
- The list banner is `PixelBanner`, a pixel-art scene drawn in code (day and night). Its message is about the user's AI being ready, never an upgrade.

## Layout

```
src/                React UI: components/ (IconRail, Header, AgentCard, MailList, Reader, CommandPalette),
                    styles.css (tokens), icons.tsx, store.ts, data/mock.ts, lib/agent.ts
src-tauri/src/      Rust: agent.rs (detect claude/codex, run prompts, stream output);
                    mail.rs (accounts, Keychain, IMAP sync and cache, SMTP send, drafts);
                    people.rs (Gravatar photos, company logos from the sender's site, contact suggestions)
web/                Website (mail.crooli.com). Vite + React; embeds the real app UI from ../src
                    as live demos via web/demo/ (?scene=continue|draft|summary|compose|palette,
                    &theme=dark, &provider=codex). Installer: web/public/install.sh.
                    Deployed by Vercel with Root Directory = web.
design/reference/   UI mockups (source of truth for layout)
design/brand/       Crooli brand: BRAND.md, tokens.json, logos/, fonts/
PLAN.md             Plan and roadmap
README.md           Public overview
```

The brand files come from the Crooli Design System artifact (https://claude.ai/artifact/XhbKNL5tCACkshCeKLES74). If the brand changes, re-sync from there. Don't hand-edit `tokens.json`.

## Auto-update

- The app checks GitHub for `latest.json` at launch and every 6 hours (Settings → Updates; can be switched off). It only installs when the user presses "Install and restart".
- Update archives are signed with Crooli's own key. The **public** key is in `src-tauri/tauri.conf.json`. The **private** key lives at `~/.tauri/crooli-mail-updater.key` and must never be committed or shared. If it's lost, installed copies can't be updated and users must reinstall with the curl command.
- The app is ad-hoc signed (no Apple Developer ID), which is why the curl installer exists. Updates downloaded by the app itself aren't quarantined, so they don't trigger Gatekeeper either.
- Updates are only offered by releases newer than the installed version. The first release with the updater built in is the first one users can update *from*.
