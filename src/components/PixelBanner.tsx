import { useEffect, useRef } from "react";

// A small pixel-art scene drawn in code: sky, drifting clouds, hills, a house with a
// Crooli-orange roof and envelopes flying like birds. Night version in dark mode.
// 1 art pixel = 3 CSS pixels; it animates gently at 8fps and stops for reduced motion.

const PX = 3;
const H = 30;

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

type Pal = {
  sky: string[];
  sun: string;
  sunRing: string;
  cloud: string;
  cloudShade: string;
  far: string;
  near: string;
  nearLight: string;
  wall: string;
  roof: string;
  window: string;
  door: string;
  leaf: string;
  leafLight: string;
  trunk: string;
  env: string;
  envLine: string;
  star?: string;
};

const DAY: Pal = {
  sky: ["#86bff0", "#a8d2f6", "#c9e4fa", "#e6f3fd"],
  sun: "#fff6cf",
  sunRing: "#ffe48f",
  cloud: "#ffffff",
  cloudShade: "#dceaf7",
  far: "#a7d69a",
  near: "#79bb6c",
  nearLight: "#93cd84",
  wall: "#f6f4ee",
  roof: "#dc7355",
  window: "#6aa3e0",
  door: "#8a5a3c",
  leaf: "#3f8a4a",
  leafLight: "#5aa65d",
  trunk: "#7a5230",
  env: "#ffffff",
  envLine: "#8fb0d3",
};

const NIGHT: Pal = {
  sky: ["#0b1530", "#122247", "#1a3160", "#25427a"],
  sun: "#f3efd8",
  sunRing: "#c9c4a8",
  cloud: "#33507f",
  cloudShade: "#28406b",
  far: "#1f3d2c",
  near: "#173022",
  nearLight: "#1f3d2c",
  wall: "#b9bcc8",
  roof: "#a8553f",
  window: "#ffd56b",
  door: "#4a3426",
  leaf: "#1d4a2a",
  leafLight: "#265a34",
  trunk: "#3d2a1a",
  env: "#dfe7f5",
  envLine: "#7d93b8",
  star: "#ffffff",
};

function isDark() {
  const t = document.documentElement.dataset.theme;
  if (t === "dark") return true;
  if (t === "light") return false;
  return matchMedia("(prefers-color-scheme: dark)").matches;
}

function hash(n: number) {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

function draw(ctx: CanvasRenderingContext2D, W: number, t: number, p: Pal) {
  const dot = (x: number, y: number, c: string) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
  };
  const rect = (x: number, y: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x), Math.round(y), w, h);
  };

  // Sky: four bands, ordered-dithered into each other.
  for (let y = 0; y < H; y++) {
    const f = (y / (H - 1)) * (p.sky.length - 1);
    const i = Math.min(p.sky.length - 2, Math.floor(f));
    const frac = f - i;
    for (let x = 0; x < W; x++) dot(x, y, frac * 16 > BAYER[y % 4][x % 4] ? p.sky[i + 1] : p.sky[i]);
  }

  // Stars (night only), twinkling slowly.
  if (p.star) {
    for (let i = 0; i < W / 5; i++) {
      const x = Math.floor(hash(i) * W);
      const y = Math.floor(hash(i + 99) * 16);
      if (Math.sin(t * 1.3 + i) > -0.3) dot(x, y, hash(i + 7) > 0.7 ? p.star : p.sky[2]);
    }
  }

  // Sun or moon.
  const sx = W - 22;
  const sy = 7;
  for (let y = -4; y <= 4; y++)
    for (let x = -4; x <= 4; x++) {
      const d = Math.hypot(x, y);
      if (d <= 2.6) dot(sx + x, sy + y, p.sun);
      else if (d <= 3.6) dot(sx + x, sy + y, p.sunRing);
    }

  // Clouds drifting right, wrapping round.
  const clouds = [
    { x: 8, y: 6, s: 1 },
    { x: 46, y: 3, s: 0.8 },
    { x: 92, y: 9, s: 1.1 },
    { x: 140, y: 5, s: 0.9 },
  ];
  for (const c of clouds) {
    const span = W + 30;
    const cx = ((((c.x + t * 1.2 * c.s) % span) + span) % span) - 15;
    const blobs = [
      [0, 2, 3],
      [4, 0, 4],
      [9, 2, 3],
      [12, 3, 2],
    ];
    for (const [bx, by, r] of blobs)
      for (let y = -r; y <= r; y++)
        for (let x = -r; x <= r; x++)
          if (x * x + y * y <= r * r + 1) dot(cx + bx + x, c.y + by + y, y > r - 2 ? p.cloudShade : p.cloud);
  }

  // Envelopes flying like birds.
  for (let i = 0; i < 3; i++) {
    const span = W + 20;
    const ex = ((t * (5 + i * 1.3) + i * 47) % span) - 10;
    const ey = 12 + i * 3 + Math.round(Math.sin(t * 2 + i * 2) * 1.2);
    rect(ex, ey, 6, 4, p.envLine);
    rect(ex + 1, ey + 1, 4, 2, p.env);
    dot(ex + 1, ey + 1, p.envLine);
    dot(ex + 4, ey + 1, p.envLine);
    dot(ex + 2, ey + 2, p.envLine);
    dot(ex + 3, ey + 2, p.envLine);
  }

  // Far hills.
  for (let x = 0; x < W; x++) {
    const h = 20 + Math.round(Math.sin(x * 0.07) * 2 + Math.sin(x * 0.023 + 1) * 2);
    for (let y = h; y < H; y++) dot(x, y, p.far);
  }

  // House on the right, with a tree.
  const hx = W - 44;
  const hy = 16;
  rect(hx, hy + 3, 12, 8, p.wall);
  for (let i = 0; i < 7; i++) rect(hx - 1 + i, hy + 3 - i, 14 - i * 2, 1, p.roof);
  rect(hx + 2, hy + 5, 3, 3, p.window);
  rect(hx + 7, hy + 6, 3, 5, p.door);
  rect(hx + 16, hy + 5, 1, 6, p.trunk);
  for (let y = -4; y <= 3; y++)
    for (let x = -4; x <= 4; x++) if (x * x + y * y <= 14) dot(hx + 16 + x, hy + 2 + y, (x + y) < -2 ? p.leafLight : p.leaf);

  // Near hills, with a dithered lighter top edge.
  for (let x = 0; x < W; x++) {
    const h = 25 + Math.round(Math.sin(x * 0.05 + 2) * 1.6 + Math.sin(x * 0.11) * 0.8);
    for (let y = h; y < H; y++) dot(x, y, y === h && BAYER[y % 4][x % 4] > 6 ? p.nearLight : p.near);
  }
}

export function PixelBanner() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    let pal = isDark() ? NIGHT : DAY;
    let W = 0;
    const fit = () => {
      W = Math.max(40, Math.ceil(el.clientWidth / PX));
      if (el.width !== W) {
        el.width = W;
        el.height = H;
      }
    };
    fit();
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let last = 0;
    const start = performance.now();
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (now - last < 125) return;
      last = now;
      draw(ctx, W, (now - start) / 1000, pal);
    };
    draw(ctx, W, 0, pal);
    if (!reduce) raf = requestAnimationFrame(frame);

    const ro = new ResizeObserver(() => {
      fit();
      draw(ctx, W, (performance.now() - start) / 1000, pal);
    });
    ro.observe(el);
    const retheme = () => {
      pal = isDark() ? NIGHT : DAY;
      draw(ctx, W, (performance.now() - start) / 1000, pal);
    };
    const mo = new MutationObserver(retheme);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const mq = matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", retheme);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      mo.disconnect();
      mq.removeEventListener("change", retheme);
    };
  }, []);

  return <canvas ref={ref} aria-hidden className="absolute inset-0 size-full [image-rendering:pixelated]" />;
}
