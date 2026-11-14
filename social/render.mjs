// Renders the X (Twitter) images in social/images/ from the HTML templates defined below.
// The app screens are the real Crooli Mail demo, loaded live from https://mail.crooli.com/demo,
// so deploy the site first if the app has changed.
//
//   node social/render.mjs            render everything
//   node social/render.mjs 03 06      render only images whose id starts with 03 or 06
//
// Needs Google Chrome installed. Output: 1600x900 at 1.5x (2400x1350) JPEGs.
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const BUILD = join(here, "build");
const OUT = join(here, "images");
mkdirSync(BUILD, { recursive: true });
mkdirSync(OUT, { recursive: true });
const FONT = pathToFileURL(resolve(here, "../design/brand/fonts/CrooliSans-Variable.woff2")).href;

const PAL = {
  sky: ["#0a2347", "#2a66b8", "#7db8ee", "#e9f4fe"],
  garden: ["#0d2515", "#2b7239", "#86c874", "#ecf6e1"],
  clay: ["#341309", "#b94f33", "#ee9e80", "#fbeee6"],
  lapis: ["#081a3a", "#0a5fd6", "#78acfa", "#e3eefd"],
  dawn: ["#222b57", "#6f7fcf", "#f0b3a0", "#fdf1e8"],
  ink: ["#0b0b0b", "#171717", "#22416a", "#6aa3e0"],
};

const MARK = `<svg width="34" height="34" viewBox="0 0 32 32" fill="none"><path d="M8 16a8 8 0 0 1 8-8c2.5 0 4.5 1 6 2.5m2 5.5a8 8 0 0 1-8 8c-2.5 0-4.5-1-6-2.5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><circle cx="16" cy="16" r="3" fill="currentColor"/></svg>`;
const NOISE = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .55 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

const css = (p, light) => {
  const [a, b, c, d] = PAL[p] ?? PAL.sky;
  return `
  @font-face{font-family:"Crooli Sans";src:url("${FONT}") format("woff2");font-weight:100 900}
  *{box-sizing:border-box;margin:0}
  html,body{width:1600px;height:900px;overflow:hidden}
  body{font-family:"Crooli Sans",system-ui,sans-serif;color:${light ? "#161616" : "#fff"};-webkit-font-smoothing:antialiased;position:relative;
    background:
      radial-gradient(1100px 700px at 100% 100%, ${d}cc, transparent 62%),
      radial-gradient(900px 600px at 78% 8%, ${c}99, transparent 60%),
      linear-gradient(125deg, ${a} 0%, ${b} 52%, ${c} 100%);}
  ${light ? "body{background:#f5f5f3}" : ""}
  body::after{content:"";position:absolute;inset:0;background:${NOISE};opacity:.08;mix-blend-mode:overlay;pointer-events:none}
  .brand{position:absolute;left:80px;top:62px;display:flex;align-items:center;gap:8px;font-weight:600;font-size:30px;letter-spacing:-.035em;z-index:3}
  .brand svg{margin-left:-6px}
  .tag{position:absolute;right:80px;top:68px;font-size:19px;opacity:.75;letter-spacing:-.01em;z-index:3}
  .head{position:absolute;left:80px;top:150px;z-index:3;max-width:1300px}
  h1{font-size:78px;line-height:1;letter-spacing:-.048em;font-weight:600;text-wrap:balance}
  h1 .dim{opacity:.62}
  .sub{margin-top:20px;font-size:26px;opacity:.82;letter-spacing:-.012em;max-width:900px;line-height:1.35}
  .win{position:absolute;left:150px;top:392px;width:1300px;height:540px;overflow:hidden;border-radius:16px 16px 0 0;background:var(--wbg,#fcfcfc);
    box-shadow:0 60px 120px -30px rgba(0,0,0,.55),0 0 0 1px rgba(255,255,255,.14),0 0 0 1px rgba(0,0,0,.2);z-index:2}
  .win iframe{position:absolute;left:0;top:0;width:1440px;height:920px;border:0;transform:scale(.90278);transform-origin:0 0}
  .lights{position:absolute;left:15px;top:14px;display:flex;gap:7px;z-index:4}
  .lights i{width:11px;height:11px;border-radius:50%;background:#ff5f57}.lights i:nth-child(2){background:#febc2e}.lights i:nth-child(3){background:#28c840}
  .mono{font-family:ui-monospace,"SF Mono",Menlo,monospace}
  `;
};

const win = (scene, dark) => `<div class="win" style="--wbg:${dark ? "#0a0a0a" : "#fcfcfc"}"><div class="lights"><i></i><i></i><i></i></div><iframe src="https://mail.crooli.com/demo?${scene}" scrolling="no"></iframe></div>`;
// Just the reader pane of the app (the right-hand card), shown large. side: where the card sits.
const PANE = { x: 463, y: 127, w: 954, h: 770 };
const pane = (scene, side = "right") => {
  const W = 880, s = W / PANE.w, H = Math.round(PANE.h * s);
  const left = side === "right" ? 640 : 80;
  return `<div style="position:absolute;left:${left}px;top:${Math.round((900 - H) / 2 + 24)}px;width:${W}px;height:${H}px;overflow:hidden;border-radius:18px;background:#fff;box-shadow:0 50px 100px -30px rgba(0,0,0,.5),0 0 0 1px rgba(0,0,0,.12);z-index:2"><iframe src="https://mail.crooli.com/demo?${scene}" scrolling="no" style="position:absolute;border:0;width:1440px;height:920px;left:${-PANE.x * s}px;top:${-PANE.y * s}px;transform:scale(${s});transform-origin:0 0"></iframe></div>`;
};
const split = (title, dim, sub, side = "right") => `<div style="position:absolute;${side === "right" ? "left:80px" : "left:1020px"};top:240px;width:500px;z-index:3;${side === "right" ? "" : "text-align:left"}"><h1 style="font-size:66px">${title}${dim ? `<br><span class="dim">${dim}</span>` : ""}</h1><p class="sub" style="font-size:24px">${sub}</p></div>`;
const head = (title, dim, sub) => `<div class="head"><h1>${title}${dim ? `<br><span class="dim">${dim}</span>` : ""}</h1>${sub ? `<p class="sub">${sub}</p>` : ""}</div>`;
const page = (p, body, opts = {}) => `<!doctype html><meta charset="utf-8"><style>${css(p, opts.light)}${opts.css ?? ""}</style><body><div class="brand">${MARK}Mail</div>${opts.tag === false ? "" : `<div class="tag">mail.crooli.com</div>`}${body}</body>`;

const keys = (k) => k.map((x) => `<kbd>${x}</kbd>`).join("");

const images = [
  { id: "01-hero", p: "sky", wait: 5000, html: page("sky", head("An email client", "with your AI in it.", "Free for Mac. Works with Gmail, iCloud and any IMAP inbox. No account.") + win("theme=light&banner=off")) },
  { id: "02-continue", p: "dawn", wait: 9000, html: page("dawn", split("One button.", "Your inbox, sorted.", "Your AI reads what came in and sorts it into what needs you, what is just for information and what can go.") + pane("scene=continue&theme=light&banner=off")) },
  { id: "03-draft", p: "garden", wait: 9000, html: page("garden", split("Replies that sound like you.", "Not like a robot.", "Press Draft with AI and the reply writes itself into the box. Edit it, then send it.", "left") + pane("scene=draft&theme=light&banner=off", "left")) },
  { id: "04-connect", p: "lapis", wait: 5000, html: page("lapis", split("Your mail in two minutes.", "Step by step.", "Gmail, iCloud, Yahoo, Fastmail or any IMAP server. Mail shows you exactly what to click.") + pane("scene=connect&theme=light&banner=off")) },
  { id: "05-dark", p: "ink", wait: 5000, html: page("ink", head("Light or dark.", "Claude or Codex.", "A tight, quiet layout with a proper dark mode, set in Crooli Sans.") + win("theme=dark&provider=codex&select=2&banner=off", true)) },
  { id: "06-ai-settings", p: "clay", wait: 5000, html: page("clay", split("Uses the plan", "you already pay for.", "Mail finds Claude Code or Codex on your Mac, picks the lightest model, and shows how much of your limit is left.", "left") + pane("scene=settings&theme=light&banner=off", "left")) },
  {
    id: "07-install", p: "lapis", wait: 1500,
    html: page("lapis", `<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding-top:30px">
      <h1 style="font-size:92px">Install in one line.<br><span class="dim">No warnings to click through.</span></h1>
      <div class="mono" style="margin-top:64px;width:1180px;border-radius:22px;background:rgba(18,18,18,.94);box-shadow:0 50px 100px -30px rgba(0,0,0,.6),0 0 0 1px rgba(255,255,255,.08);text-align:left;overflow:hidden">
        <div style="display:flex;gap:9px;padding:22px 26px;border-bottom:1px solid rgba(255,255,255,.08)"><i style="width:14px;height:14px;border-radius:50%;background:#4a4845"></i><i style="width:14px;height:14px;border-radius:50%;background:#4a4845"></i><i style="width:14px;height:14px;border-radius:50%;background:#4a4845"></i><span style="margin-left:14px;color:#8f8b85;font:400 18px 'Crooli Sans'">Terminal</span></div>
        <pre style="padding:34px 38px 40px;font:400 27px/1.85 ui-monospace,'SF Mono',Menlo,monospace;color:#d6d3cd"><span style="color:#fff">curl</span> <span style="color:#9cc8f5">-fsSL https://mail.crooli.com/install.sh | bash</span>

<span style="color:#8f8b85">→ Downloading Crooli Mail for Apple Silicon and Intel</span>
<span style="color:#8f8b85">→ Installing into /Applications</span>
<span style="color:#8fd8a0">✓ Opened Crooli Mail.app</span>  <span style="color:#8f8b85">no “damaged app” prompt</span></pre></div></div>`),
  },
  {
    id: "08-privacy", p: "sky", light: true, wait: 800,
    html: page("sky", `<div style="position:absolute;left:80px;right:80px;top:150px;z-index:3"><h1 style="font-size:92px">No Crooli account.<br><span class="dim" style="color:#8b8b86;opacity:1">No Crooli servers.</span></h1></div>
      <div style="position:absolute;left:80px;right:80px;top:470px;display:grid;grid-template-columns:repeat(4,1fr);gap:18px">
        ${[["Your mail stays yours", "Messages go between your Mac and your provider, and nowhere else."], ["Your AI, run locally", "Mail talks to the Claude Code or Codex already on your Mac. No API key."], ["Nothing behind your back", "The AI only runs when you press a button. Sending and deleting always wait for you."], ["Passwords in the Keychain", "App passwords live in the macOS Keychain, never in plain text."]]
          .map(([h, t]) => `<div style="background:#fff;border:1px solid #e4e4e0;border-radius:22px;padding:34px 32px;height:300px"><div style="font-size:30px;font-weight:600;letter-spacing:-.03em;line-height:1.12">${h}</div><div style="margin-top:16px;font-size:22px;line-height:1.45;color:#4a4a47">${t}</div></div>`).join("")}
      </div>`, { light: true, css: ".brand,.tag{color:#161616}" }),
  },
  {
    id: "09-keyboard", p: "clay", wait: 800,
    html: page("clay", head("Keyboard first.", "Everything within reach.") + `<div style="position:absolute;left:80px;right:80px;top:420px;display:grid;grid-template-columns:repeat(3,1fr);gap:18px">
        ${[[["J", "K"], "Move through your mail"], [["E"], "Archive"], [["F"], "Forward"], [["C"], "Compose"], [["S"], "Star"], [["⌘", "Return"], "Send"]]
          .map(([k, t]) => `<div style="display:flex;align-items:center;gap:22px;background:rgba(255,255,255,.14);backdrop-filter:blur(14px);border-radius:22px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.25);padding:0 32px;height:150px"><span style="display:flex;gap:8px">${keys(k)}</span><span style="font-size:30px;letter-spacing:-.02em">${t}</span></div>`).join("")}
      </div>`, { css: "kbd{display:inline-grid;place-items:center;min-width:64px;height:64px;padding:0 18px;border-radius:14px;background:#fff;color:#161616;font:600 30px 'Crooli Sans';box-shadow:0 5px 0 rgba(0,0,0,.18)}" }),
  },
  {
    id: "10-launch", p: "ink", wait: 800,
    html: page("ink", `<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center">
      <div style="color:#fff">${MARK.replace('width="34" height="34"', 'width="150" height="150"')}</div>
      <h1 style="font-size:150px;margin-top:10px">Mail</h1>
      <p style="font-size:38px;opacity:.78;margin-top:10px;letter-spacing:-.02em">An email client with your AI in it.</p>
      <div class="mono" style="margin-top:56px;padding:22px 34px;border-radius:999px;background:rgba(255,255,255,.1);box-shadow:inset 0 0 0 1px rgba(255,255,255,.2);font:400 26px ui-monospace,'SF Mono',Menlo,monospace;color:#cfe3fb">curl -fsSL https://mail.crooli.com/install.sh | bash</div>
      <p style="font-size:22px;opacity:.55;margin-top:34px">By Crooli · macOS 13 or later · free</p></div>`, { tag: false, css: ".brand{display:none}" }),
  },
];

/* ---- Chrome ---- */
const only = process.argv.slice(2);
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", ["--headless=new", "--hide-scrollbars", "--remote-debugging-port=9340", `--user-data-dir=${mkdtempSync(join(tmpdir(), "social-"))}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws;
for (let i = 0; i < 60; i++) {
  try {
    const p = (await (await fetch("http://127.0.0.1:9340/json")).json()).find((t) => t.type === "page");
    if (p) { ws = new WebSocket(p.webSocketDebuggerUrl); break; }
  } catch {}
  await sleep(200);
}
await new Promise((r) => (ws.onopen = r));
let n = 0; const pend = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d.result); pend.delete(d.id); } };
const send = (method, params = {}) => new Promise((r) => { const i = ++n; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send("Emulation.setDeviceMetricsOverride", { width: 1600, height: 900, deviceScaleFactor: 1.5, mobile: false });

for (const img of images) {
  if (only.length && !only.some((o) => img.id.startsWith(o))) continue;
  const file = join(BUILD, `${img.id}.html`);
  writeFileSync(file, img.html);
  await send("Page.navigate", { url: pathToFileURL(file).href });
  await sleep(img.wait + 1500);
  const shot = await send("Page.captureScreenshot", { format: "jpeg", quality: 93 });
  writeFileSync(join(OUT, `${img.id}.jpg`), Buffer.from(shot.data, "base64"));
  console.log("rendered", img.id);
}
ws.close();
chrome.kill();
