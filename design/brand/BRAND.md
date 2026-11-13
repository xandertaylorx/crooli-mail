Crooli is dark first and almost colourless: near-black surfaces, hairline edges, white type, set entirely in Crooli Sans. One cool blue, `lapis`, is the only accent.

## Content fundamentals

- Write plainly, in the first person plural: "we rebuilt it from the ground up", "our own typeface". No hype, no exclamation marks, no emoji.
- Use British spelling: "colour", "colourless", "organise".
- Post titles are in title case ("A New Look for Crooli", "Introducing Crooli Sans, Our Open-Source Typeface"). Section headings inside a post are sentence case ("Dark first, and almost colourless", "A newsroom you can scan").
- Say what changed and why in the opening paragraph, then reassure: "Nothing behind it has changed: accounts, forms, the newsroom and every product link work exactly as before."
- Describe the experience in concrete terms: "calm to read, quick to find your way around, and clearly ours."

## Visual foundations

- **Theme.** Dark is the default; light is a clean white mirror of it, chosen with the header toggle and remembered. Every token has both values; never hard-code one. Page ground is `ivory`, raised surfaces `oat`, `oat-deep` and `card`.
- **Colour.** Text is `ink`, secondary text `ink-soft`, metadata `ink-muted`. Use `lapis` only for focus, links in prose and state, never as decoration; the products and artwork carry the colour. `danger` and `success` always come with a word or icon.
- **Type.** Set everything in Crooli Sans (`--font-sans`, `--font-display`). Headlines use `display` and `section-title`: weight 600 with tight negative tracking. Body is `body` at weight 400. Labels above headlines use `kicker` in uppercase mono. Wrap headlines with `text-wrap: balance`.
- **Edges, not boxes.** Separate regions with a 1px `rule` hairline and outlined controls with `line-strong`. Prefer a hairline to a filled card; where a frame is wanted, use a hairline with small crosshair ticks at the corners.
- **Radii.** `radius` (8px) on buttons and fields, `radius-lg` (12px) on cards and panels, `radius-pill` on tags.
- **Shadows.** Rare. `shadow-sm` for a resting lift, `shadow` for floating panels and the glass header.
- **Buttons.** Primary: `ink` fill, `ivory` text, hover `ink-hover`. Ghost: transparent, 1px `line-strong` border, `ink` text. Both are 40px tall with `button` text and 16px side padding.
- **Focus.** A solid 2px `lapis` outline, 3px offset, on every focusable element in both themes.
- **Links.** In prose, a link is `ink` at weight 500 with a highlighter swipe in `link-mark` that fills in on hover. Outside prose, `text-link`: ink with a 1px `rule-strong` underline that darkens on hover.
- **Imagery and artwork.** Story artwork is generated from the headline as a panel of tiny dots, rippling, drifting or rising by subject. Keep it monochrome; a product's own icon may appear in its own colours.
- **Motion.** Ease with `cubic-bezier(0.22, 1, 0.36, 1)`; colour and border transitions run 160ms. Respect `prefers-reduced-motion`.
- **Layout.** Content is at most `wrap` (1200px) wide with a 20px to 48px gutter. Sections are separated by a hairline and generous vertical padding (72px to 136px).

## Iconography

The mark is two arcs round a dot, drawn on a 32px grid with 2.5px round-capped strokes (see Logos). Interface icons are 16px, outline only, stroke `currentColor` at 1.5px with round caps and joins, no fill. There are no emoji and no icon font.

## Logos

The Crooli logo is the mark followed by the word "Crooli" set in `logo-word`: Plus Jakarta Sans ExtraBold (weight 800), letter-spacing -0.03em, line-height 1.2, with a 10px gap between them. That word is the one place the logo font is used: set "Crooli" in the logo this way, never in Crooli Sans, and never use Plus Jakarta Sans for any other text. Size the mark to the cap height of the word (24px mark beside 18.4px text in the site header), `ink` for both, and load the font with `family=Plus+Jakarta+Sans:wght@800` from Google Fonts. See the Logo card for the lockup.

Use the mark on its own where space is tight. Use `LOGO-WHITE-TRANSPARENT.svg` on dark grounds and `LOGO-BLACK-TRANSPARENT.svg` on light ones; to recolour the mark, inline the SVG and set `currentColor`.

## Typeface

Crooli Sans sets all interface and editorial text; the logo word is the only exception (see Logos). Crooli Sans is our own open-source typeface, a fork of Geist with a friendlier character: single-storey a, round dots, cleaner R and G. It ships as two variable fonts (upright and italic, weights 100 to 900) under the SIL Open Font License. Declare both in `type.fonts`; the licence file sits beside them in `fonts/`.

## Not synced

Built from `xandertaylorx/company-tizzle` at `main@e5596c9` (read-only; nothing was run or built). Not brought over: the `-rgb` colour-part variables (the translucent `line`, `line-strong` and `glow` tokens carry their literal values instead); the `--gutter` token and the fluid `clamp()` type sizes (fixed at the top of each range, noted per style); the easing curve (stated under Visual foundations); the raster logos and wallpapers in `public/brand-assets`; the roughly 300 KB of page-level styles in `src/styles.css` beyond the token blocks; and components, since the repository is a site, not a component library.
