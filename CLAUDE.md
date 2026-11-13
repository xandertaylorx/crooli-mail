# CLAUDE.md

Guidance for Claude Code (and other agents) working in this repo.

## Project

**Crooli Mail** (working name) is a product of **Crooli** ([crooli.com](https://crooli.com)). Crooli owns the app, the brand and the code. It's a macOS-first (Windows later) desktop email client with a modern UI. Its AI runs on the user's locally installed **Claude Code** (`claude`) or **Codex** (`codex`) CLI. There are no API keys, no Crooli accounts and no backend.

The full plan is in `PLAN.md`. Read it before making architectural decisions.

**Current status: Phase 1 (pixel-matched UI on mock data) is built, and the AI bridge to Claude Code/Codex works. Real mail sync (IMAP) isn't built yet.**

## Commands

- `pnpm app`: run the desktop app (Tauri dev, hot reload)
- `pnpm dev`: UI only in a browser at http://localhost:1420 (AI is simulated; `?provider=codex` shows the Codex state)
- `npx tsc -p .`: typecheck the UI
- `cd src-tauri && cargo test && cargo clippy`: Rust checks
- `pnpm tauri build --target universal-apple-darwin --bundles app`: release app. Then `codesign --force --deep -s - --identifier com.crooli.mail "Crooli Mail.app"`, zip it with `ditto -c -k --keepParent` as `CrooliMail-<version>-mac-universal.zip`, and attach the zip to a GitHub release. The installer picks the newest `*mac-universal.zip`.
- `cd web && pnpm dev`: the website at http://localhost:5180

## Non-negotiables

1. **The design must match `design/reference/*.png` pixel-for-pixel.** These images are the spec.
   - Before building or changing any UI, open the reference images and compare.
   - Use the design tokens (once `design/tokens.json` exists). Never hardcode random colors or spacing.
   - Large radii, hairline borders, soft neutral greys, black primary pill button.
   - Verify visually: run the app, take a screenshot, compare it to the reference, and fix the differences.
2. **It's a Crooli product, so use the Crooli brand** (`design/brand/`, synced from the Crooli Design System artifact):
   - **Logo:** the Crooli mark (two arcs round a dot). The icon-rail tile is `design/brand/logos/app-icon-tile.svg`. It **replaces the asterisk tile in the mockups**. The full logo is the mark plus "Crooli" in Plus Jakarta Sans ExtraBold (800, -0.03em) with a 10px gap (`crooli-wordmark-*.svg`). Use Plus Jakarta Sans only for that word. Use the black mark on light grounds and the white mark on dark ones.
   - **Font:** Crooli Sans (`design/brand/fonts/`, OFL, variable 100–900). It **replaces Inter in the mockups**. Bundle it, and ship `OFL.txt` with the app.
   - **Colours:** use `design/brand/tokens.json` (ink, ink-soft, ink-muted, rule, oat, lapis…). `lapis` is the only interface accent (focus, state, verified badge). Provider logos (Claude orange, OpenAI black) keep their own colours.
   - **Icons:** 16–20px, outline, 1.5px round strokes, `currentColor`. No emoji, no icon fonts.
   - **Copy:** plain, British spelling ("colour", "organise"), no hype, no exclamation marks.
   - **Where the mockups and the brand disagree:** the mockups win on layout, sizes and radii, and the brand wins on logo, font, colour tokens and copy. Light theme matches the mockups. Dark theme comes from the brand's dark token values.
3. **Speed is a feature.** The UI reads only from local SQLite. Lists are virtualized. Nothing blocks the main thread. Don't add heavy dependencies without a reason.
4. **No accounts, no servers, no telemetry.** Data goes only to the user's mail provider and to the user's local `claude`/`codex` process.
5. **AI never acts without approval.** Sending, deleting, archiving and labeling done by the agent go through a user-confirmed review step.
6. **Secrets go in the OS keychain** (macOS Keychain / Windows Credential Manager). Never put them in plaintext, logs or SQLite.

## Stack (planned)

- **Tauri v2** (Rust) shell and backend
- **React + TypeScript + Vite** frontend, **Tailwind** with CSS-variable tokens
- **SQLite + FTS5** (rusqlite) local store and search
- Mail: `async-imap`, `lettre` SMTP, plus Gmail API / MS Graph adapters later
- AI: `AgentProvider` trait in Rust wrapping `claude -p --output-format stream-json` and `codex exec --json`, with Crooli exposing mailbox tools to the agent over a local MCP server

## Conventions

- Keep platform-specific code behind small modules (`platform/macos`, `platform/windows`) so the Windows port is cheap.
- Rust owns all I/O (network, disk, subprocesses). The frontend talks to it only through typed Tauri commands and events.
- Name components to match the design: `IconRail`, `PageHeader`, `FolderPills`, `ContinueButton`, `AgentCard`, `UsageMeter`, `MailListCard`, `PromoBanner`, `MailRow`.
- Model names and plans in the UI (e.g. "Opus 4.8 · Max (20x)") come from runtime detection. The mockup values are examples only.
- The banner illustration in the mockups is Crooli's own art. Use the full-resolution file from `design/brand/art/`, not a crop of the screenshot.

## Layout

```
src/                React UI: components/ (IconRail, Header, AgentCard, MailList, Reader, CommandPalette),
                    styles.css (tokens), icons.tsx, store.ts, data/mock.ts, lib/agent.ts
src-tauri/src/      Rust: agent.rs (detect claude/codex, run prompts, stream output)
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
