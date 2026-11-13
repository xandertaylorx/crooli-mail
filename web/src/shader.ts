// Shader panels, ported from ai.crooli.com (xandertaylorx/croo, web/site.js).
// One hidden WebGL canvas paints every panel in turn and copies the frame into each
// panel's 2D canvas, so the page holds a single GL context however many panels there are.

// Palettes come from Crooli Mail itself: the sky and garden in the banner art,
// Claude's orange, the brand's lapis and the dark theme's charcoal.
export const PALETTES = {
  sky: ["#0c2a55", "#2f6fc0", "#8cc0f0", "#eef6fe"],
  deep: ["#071631", "#143a73", "#3672bf", "#94c2ef"],
  garden: ["#0f2a17", "#2f7a3e", "#8fcf7a", "#eef7e4"],
  clay: ["#3a160c", "#c4573a", "#f0a487", "#fcefe8"],
  lapis: ["#0a1f44", "#0a6cf0", "#7fb2ff", "#e6f0fe"],
  ink: ["#0d0d0d", "#1b1b1b", "#24456f", "#6aa3e0"],
  dawn: ["#26315e", "#7f8fd6", "#f2b8a2", "#fdf2ea"],
} as const;
export type Palette = keyof typeof PALETTES;
const SEEDS: Record<Palette, number> = { deep: 8.6, sky: 1.3, garden: 4.1, clay: 2.9, lapis: 7.7, ink: 6.4, dawn: 5.5 };

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }`;
const FRAG = `
precision highp float;
uniform vec2 uRes; uniform float uTime; uniform float uMode; uniform float uSeed; uniform vec3 uMouse;
uniform vec3 uC0; uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uC3;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), u.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), u.x), u.y);
}
float fbm(vec2 p){ float v = 0., a = .5; for (int i = 0; i < 5; i++){ v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= .5; } return v; }

vec3 ramp(float t){
  t = clamp(t, 0., 1.);
  vec3 c = mix(uC0, uC1, smoothstep(0.05, 0.27, t));
  c = mix(c, uC2, smoothstep(0.32, 0.72, t));
  return mix(c, uC3, smoothstep(0.66, 1.0, t));
}

float field(vec2 p, float t){
  vec2 q = vec2(fbm(p * 0.9 + vec2(uSeed, t * 0.03)), fbm(p * 0.9 + vec2(5.2 - t * 0.025, uSeed)));
  float d = dot(p, normalize(vec2(1.0, -0.8)));
  float v = 0.5 + 0.5 * sin(d * 2.2 + q.x * 3.4 + uSeed + t * 0.08);
  return mix(v, 0.5 + 0.5 * sin(d * 0.9 + q.y * 2.0 + uSeed * 0.7), 0.45);
}

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  float aspect = uRes.x / uRes.y;
  vec2 p = vec2(uv.x * aspect, uv.y) * 1.6;
  float t = uTime;
  vec3 col;
  vec2 ua = vec2(uv.x * aspect, uv.y), ma = vec2(uMouse.x * aspect, uMouse.y);
  float glow = uMouse.z * exp(-dot(ua - ma, ua - ma) * 6.0);
  p += (ua - ma) * glow * 0.9;

  if (uMode < 0.5) {
    float ribs = 9.0 + 9.0 * aspect;
    float w = pow(uv.x, 1.45) * ribs;
    float r = fract(w);
    vec2 sp = p * 1.5 + vec2((r - 0.5) * -0.32, (r - 0.5) * 0.22 + floor(w) * 0.035);
    float v = field(sp, t);
    v = clamp((v - 0.56) * 2.0 + 0.48, 0.0, 1.0);
    v = mix(v, 0.35 + uv.x * 0.55, 0.22);
    col = ramp(v);
    float edge = smoothstep(0.0, 0.06, r) * (1.0 - 0.25 * smoothstep(0.75, 1.0, r));
    float sheen = smoothstep(0.55, 0.85, r) * (1.0 - smoothstep(0.85, 1.0, r));
    col *= 0.86 + 0.14 * edge;
    col += 0.07 * sheen;
  } else {
    float v = field(p, t);
    vec2 dir = normalize(vec2(1.0, 0.42));
    vec2 rp = vec2(dot(p, dir), dot(p, vec2(-dir.y, dir.x)));
    float streak = noise(rp * vec2(2.5, 160.0) + vec2(t * 0.05, uSeed)) - 0.5;
    streak += 0.5 * (noise(rp * vec2(1.2, 420.0) + uSeed) - 0.5);
    float ribbon = pow(1.0 - abs(sin(rp.y * 2.2 + fbm(rp * 0.8 + uSeed + t * 0.02) * 1.6)), 5.0);
    v += streak * 0.06 + ribbon * 0.12;
    v = clamp((v - 0.5) * 1.35 + 0.5, 0.0, 1.0);
    v = mix(v, uv.y * 0.5 + (1.0 - uv.x) * 0.15 + 0.25, 0.2);
    col = ramp(v);
    col += ribbon * 0.05;
  }

  col += glow * 0.07;
  col += (hash(gl_FragCoord.xy + fract(t) * 91.0) - 0.5) * 0.035;
  gl_FragColor = vec4(col, 1.0);
}`;

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

type Draw = (w: number, h: number, mode: string, palette: Palette, time: number, mouse: number[]) => HTMLCanvasElement;

function makeRenderer(): Draw | null {
  const glc = document.createElement("canvas");
  const gl = glc.getContext("webgl", { preserveDrawingBuffer: true, antialias: false, premultipliedAlpha: false });
  if (!gl) return null;
  const sh = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
    return s;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const u = Object.fromEntries(
    ["uRes", "uTime", "uMode", "uSeed", "uMouse", "uC0", "uC1", "uC2", "uC3"].map((n) => [n, gl.getUniformLocation(prog, n)]),
  );
  return (w, h, mode, palette, time, mouse) => {
    if (glc.width !== w || glc.height !== h) {
      glc.width = w;
      glc.height = h;
    }
    gl.viewport(0, 0, w, h);
    gl.uniform2f(u.uRes, w, h);
    gl.uniform1f(u.uTime, time);
    gl.uniform1f(u.uMode, mode === "fluted" ? 0 : 1);
    gl.uniform1f(u.uSeed, SEEDS[palette]);
    gl.uniform3fv(u.uMouse, mouse);
    PALETTES[palette].forEach((c, i) => gl.uniform3fv(u[`uC${i}`], hex(c)));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    return glc;
  };
}

type PanelState = {
  el: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  mode: string;
  palette: Palette;
  visible: boolean;
  mouse: number[];
  aim: number[];
};

let draw: Draw | null | undefined;
const panels = new Set<PanelState>();
let started = false;
const reduceMotion = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const SCALE = 0.5;

const io =
  typeof IntersectionObserver !== "undefined"
    ? new IntersectionObserver((entries) => {
        for (const e of entries) {
          for (const pn of panels)
            if (pn.el === e.target) {
              pn.visible = e.isIntersecting;
              if (pn.visible) paint(pn, performance.now() / 1000);
            }
        }
      })
    : null;

function paint(pn: PanelState, time: number) {
  if (!draw) return;
  const r = pn.el.getBoundingClientRect();
  const dpr = Math.min(devicePixelRatio, 2);
  const w = Math.max(2, Math.round(r.width * SCALE * dpr));
  const h = Math.max(2, Math.round(r.height * SCALE * dpr));
  if (pn.el.width !== w || pn.el.height !== h) {
    pn.el.width = w;
    pn.el.height = h;
  }
  for (let i = 0; i < 3; i++) pn.mouse[i] += (pn.aim[i] - pn.mouse[i]) * 0.12;
  pn.ctx.drawImage(draw(w, h, pn.mode, pn.palette, time, pn.mouse), 0, 0);
}

function start() {
  if (started) return;
  started = true;
  if (!reduceMotion) {
    let last = 0;
    const loop = (now: number) => {
      requestAnimationFrame(loop);
      if (now - last < 1000 / 30 || document.hidden) return;
      last = now;
      for (const pn of panels) if (pn.visible) paint(pn, now / 1000);
    };
    requestAnimationFrame(loop);
  }
  addEventListener("resize", () => panels.forEach((pn) => pn.visible && paint(pn, performance.now() / 1000)));
}

/** Registers a <canvas> as a shader panel. Returns an unregister function. */
export function attachShader(el: HTMLCanvasElement, mode: "fluted" | "silk", palette: Palette) {
  if (draw === undefined) {
    try {
      draw = makeRenderer();
    } catch (e) {
      console.warn("Shader panels off:", e);
      draw = null;
    }
  }
  const ctx = el.getContext("2d");
  if (!draw || !ctx) return () => {};
  const pn: PanelState = { el, ctx, mode, palette, visible: false, mouse: [0.5, 0.5, 0], aim: [0.5, 0.5, 0] };
  panels.add(pn);
  io?.observe(el);
  paint(pn, 0);
  start();
  const host = el.parentElement;
  const move = (e: PointerEvent) => {
    const r = el.getBoundingClientRect();
    pn.aim = [(e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height, 1];
  };
  const leave = () => (pn.aim[2] = 0);
  const hover = !reduceMotion && matchMedia("(hover: hover)").matches;
  if (hover && host) {
    host.addEventListener("pointermove", move);
    host.addEventListener("pointerleave", leave);
  }
  return () => {
    panels.delete(pn);
    io?.unobserve(el);
    host?.removeEventListener("pointermove", move);
    host?.removeEventListener("pointerleave", leave);
  };
}
