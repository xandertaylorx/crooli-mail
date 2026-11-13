import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import openaiMark from "@app/assets/openai-mark.png";
import { attachShader, type Palette } from "./shader";

const REPO = "xandertaylorx/crooli-mail";
const INSTALL = "curl -fsSL https://mail.crooli.com/install.sh | bash";

/* ---------------------------------------------------------------- bits */

function Mark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <path
        d="M8 16a8 8 0 0 1 8-8c2.5 0 4.5 1 6 2.5m2 5.5a8 8 0 0 1-8 8c-2.5 0-4.5-1-6-2.5"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="16" cy="16" r="3" fill="currentColor" />
    </svg>
  );
}

/** Nav brand: just the product, "Mail". */
function Brand() {
  return (
    <a className="brand" href="#top" aria-label="Mail, by Crooli. Back to top">
      <Mark size={36} />
      <span className="brand-product">Mail</span>
    </a>
  );
}

/** The Crooli wordmark: the mark plus "Crooli" in Plus Jakarta Sans ExtraBold. Footer only. */
function Wordmark() {
  return (
    <a className="brand wordmark" href="https://crooli.com" aria-label="Crooli">
      <Mark size={36} />
      <span className="logo-word">Crooli</span>
    </a>
  );
}

function ClaudeMark({ size = 32 }: { size?: number }) {
  const rays = [
    [0, 15.5], [27, 13], [55, 15], [86, 13.5], [113, 15.5], [142, 12.5],
    [171, 15], [200, 13.5], [228, 15.5], [258, 12.5], [287, 15], [316, 13.5], [343, 14],
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" aria-label="Claude">
      {rays.map(([deg, len], i) => {
        const a = (deg * Math.PI) / 180;
        return (
          <line
            key={i}
            x1={18 + Math.cos(a) * 3}
            y1={18 + Math.sin(a) * 3}
            x2={18 + Math.cos(a) * len}
            y2={18 + Math.sin(a) * len}
            stroke="#dc7355"
            strokeWidth={2.6}
            strokeLinecap="round"
          />
        );
      })}
      <circle cx="18" cy="18" r="3.4" fill="#dc7355" />
    </svg>
  );
}

function Shader({ mode = "silk", palette }: { mode?: "fluted" | "silk"; palette: Palette }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => (ref.current ? attachShader(ref.current, mode, palette) : undefined), [mode, palette]);
  return <canvas ref={ref} className="shader" aria-hidden data-palette={palette} />;
}

function Copy({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="copy"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1600);
        } catch {
          /* clipboard blocked */
        }
      }}
    >
      {done ? "Copied" : label}
    </button>
  );
}

function useLatestVersion() {
  const [v, setV] = useState<string | null>(null);
  useEffect(() => {
    const key = "crooli-mail.release";
    try {
      const c = JSON.parse(sessionStorage.getItem(key) || "null");
      if (c && Date.now() - c.at < 600_000) return setV(c.v);
    } catch {
      /* ignore */
    }
    fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { accept: "application/vnd.github+json" } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.tag_name) return;
        setV(d.tag_name);
        try {
          sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), v: d.tag_name }));
        } catch {
          /* ignore */
        }
      })
      .catch(() => {});
  }, []);
  return v;
}

function Terminal({ version }: { version: string | null }) {
  return (
    <div className="term" role="group" aria-label="Install with Terminal">
      <div className="term-bar">
        <i />
        <i />
        <i />
        <span>Terminal</span>
        <Copy text={INSTALL} />
      </div>
      <pre className="term-body">
        <span className="k">curl</span> <span className="cmd">-fsSL https://mail.crooli.com/install.sh | bash</span>
        {"\n\n"}
        <span className="c">
          → Downloading Crooli Mail <span className="ver">{version ?? "latest"}</span> for Apple Silicon and Intel
        </span>
        {"\n"}
        <span className="c">→ Installing into /Applications</span>
        {"\n"}
        <span className="ok">✓ Opened Crooli Mail.app</span>
        <span className="c">  no “damaged app” prompt</span>
      </pre>
    </div>
  );
}

/** The real app, running on demo data in a frame, scaled to fit. */
function AppFrame({
  scene = "",
  title,
  w = 1440,
  h = 920,
  interactive = false,
  eager = false,
  crop,
}: {
  scene?: string;
  title: string;
  w?: number;
  h?: number;
  interactive?: boolean;
  eager?: boolean;
  crop?: number; // show only the top N px of the window
}) {
  const host = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useLayoutEffect(() => {
    const el = host.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / w));
    ro.observe(el);
    setScale(el.clientWidth / w);
    return () => ro.disconnect();
  }, [w]);
  const visibleH = crop ?? h;
  return (
    <figure className={"window" + (interactive ? " live" : "")} ref={host} style={{ height: scale ? visibleH * scale : undefined, aspectRatio: scale ? undefined : `${w} / ${visibleH}` }}>
      <div className="lights" style={{ transform: `scale(${Math.max(scale, 0.5)})` }} aria-hidden>
        <i />
        <i />
        <i />
      </div>
      {scale > 0 && (
        <iframe
          src={`/demo${scene ? `?${scene}` : ""}`}
          title={title}
          loading={eager ? "eager" : "lazy"}
          tabIndex={interactive ? 0 : -1}
          scrolling="no"
          style={{ width: w, height: h, transform: `scale(${scale})`, pointerEvents: interactive ? "auto" : "none" }}
        />
      )}
    </figure>
  );
}

function Meter({ left, color }: { left: number; color: string }) {
  return (
    <span className="meter" aria-hidden>
      {Array.from({ length: 22 }, (_, i) => (
        <i key={i} style={{ background: i < Math.round(left * 22) ? color : undefined }} />
      ))}
    </span>
  );
}

function AgentChip({ kind }: { kind: "claude" | "codex" }) {
  const claude = kind === "claude";
  return (
    <div className="agent">
      <span className="agent-logo">
        {claude ? (
          <ClaudeMark size={30} />
        ) : (
          <span className="openai" aria-label="OpenAI" style={{ WebkitMaskImage: `url(${openaiMark})`, maskImage: `url(${openaiMark})` }} />
        )}
      </span>
      <span className="agent-text">
        <b>
          {claude ? "Claude Code" : "Codex"} <em>{claude ? "Haiku" : "Luna"}</em>
        </b>
        <small>{claude ? "92% of your 5-hour limit left" : "Low effort, lightest model"}</small>
      </span>
      {claude && <Meter left={0.92} color="#dc7355" />}
    </div>
  );
}

function Typing({ lines }: { lines: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [n, setN] = useState(0);
  const full = lines.join("\n");
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let id = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting || id) return;
      id = window.setInterval(() => setN((x) => (x >= full.length ? (window.clearInterval(id), x) : x + 3)), 22);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      window.clearInterval(id);
    };
  }, [full]);
  return (
    <div ref={ref} className={"typing" + (n < full.length ? " caret" : "")}>
      {full.slice(0, n)}
    </div>
  );
}

function InstallLine() {
  return (
    <div className="install-line">
      <span className="prompt">$</span>
      <code>{INSTALL}</code>
      <Copy text={INSTALL} />
    </div>
  );
}

function Showcase({
  id,
  kicker,
  title,
  dim,
  lede,
  palette,
  mode = "silk",
  scene,
  frameTitle,
  children,
}: {
  id?: string;
  kicker: string;
  title: string;
  dim: string;
  lede: string;
  palette: Palette;
  mode?: "fluted" | "silk";
  scene: string;
  frameTitle: string;
  children?: ReactNode;
}) {
  return (
    <section id={id} className="showcase">
      <div className="center-head">
        <p className="kicker dark">{kicker}</p>
        <h2 className="h2">
          {title}
          <br />
          <span className="dim">{dim}</span>
        </h2>
        <p className="lede">{lede}</p>
        {children}
      </div>
      <div className="stage-panel panel">
        <Shader mode={mode} palette={palette} />
        <AppFrame scene={scene} title={frameTitle} />
      </div>
    </section>
  );
}

export function Site() {
  const version = useLatestVersion();
  const [theme, setTheme] = useState<"light" | "dark">(() => (document.documentElement.dataset.theme === "dark" ? "dark" : "light"));
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("crooli-mail.theme", theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  useEffect(() => {
    const on = () => setScrolled(scrollY > 12);
    on();
    addEventListener("scroll", on, { passive: true });
    return () => removeEventListener("scroll", on);
  }, []);

  return (
    <>
      <header className={"topbar" + (scrolled ? " scrolled" : "")}>
        <div className="topbar-inner">
          <Brand />
          <nav className="pillnav" aria-label="Main">
            <a href="#tour">Tour</a>
            <a href="#features">Features</a>
            <a href="#connect">Connect</a>
            <a href="#privacy">Privacy</a>
          </nav>
          <div className="topbar-end">
            <button
              type="button"
              className="theme-toggle"
              aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
                  <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
                </svg>
              )}
            </button>
            <a className="btn dark small" href="#download">
              Download
            </a>
          </div>
        </div>
      </header>

      <main id="top">
        {/* 1. Centred hero */}
        <section className="hero-c">
          <a className="badge" href={`https://github.com/${REPO}/releases`}>
            <span className="dot" /> {version ? `${version} for macOS` : "New for macOS"} · free, no account
          </a>
          <h1 className="display">
            An email client
            <br />
            <span className="dim">with your AI in it.</span>
          </h1>
          <p className="lede">
            A fast, calm Mac app for Gmail, iCloud, Yahoo, Fastmail and any IMAP inbox. It uses the Claude Code or Codex already on your Mac to
            summarise, draft and sort your mail. Nothing is sent without your say-so.
          </p>
          <div className="cta">
            <InstallLine />
          </div>
          <p className="fine">
            Paste into Terminal · Apple Silicon and Intel · macOS 13 or later ·{" "}
            <a className="ulink" href="#tour">
              see it working
            </a>
          </p>
        </section>

        {/* 2. The live app, centred on a wide panel */}
        <section id="tour" className="hero-stage">
          <div className="stage-panel panel tall">
            <Shader mode="fluted" palette="sky" />
            <AppFrame key={theme} scene={`theme=${theme}`} title="Mail, running live on demo data" interactive eager />
            <p className="stage-note">This is the real app on demo mail. Click around.</p>
          </div>
          <ul className="works-with" aria-label="Works with">
            <li>Gmail</li>
            <li>iCloud</li>
            <li>Yahoo</li>
            <li>Fastmail</li>
            <li>Any IMAP</li>
            <li className="sep" aria-hidden />
            <li>Claude Code</li>
            <li>Codex</li>
          </ul>
        </section>

        {/* 3. Feature cards */}
        <section id="features" className="features">
          <div className="center-head">
            <p className="kicker dark">Features</p>
            <h2 className="h2">
              Everything you need.
              <br />
              <span className="dim">Nothing you don’t.</span>
            </h2>
          </div>
          <div className="bento">
            <article className="tile hero-tile panel">
              <Shader palette="lapis" />
              <h2 className="display light">
                Your AI, your mailbox,
                <br />
                your Mac.
              </h2>
              <a className="btn white" href="#download">
                Get Mail
              </a>
            </article>

            <article className="tile card agents">
              <h3>Bring your own agent</h3>
              <p>Mail finds Claude Code or Codex on your Mac and uses the plan you already pay for. It picks the lightest model and shows how much of your limit is left.</p>
              <div className="agent-stack">
                <AgentChip kind="claude" />
                <AgentChip kind="codex" />
              </div>
            </article>

            <article className="tile media panel">
              <Shader mode="fluted" palette="garden" />
              <span className="tile-label">
                Faces and logos,
                <br />
                not just letters
              </span>
              <p className="tile-sub">Gravatar photos and company logos from the sender’s own site.</p>
            </article>

            <article className="tile card keys">
              <h3>Keyboard first</h3>
              <ul className="keylist">
                <li>
                  <kbd>J</kbd>
                  <kbd>K</kbd> Move
                </li>
                <li>
                  <kbd>E</kbd> Archive
                </li>
                <li>
                  <kbd>F</kbd> Forward
                </li>
                <li>
                  <kbd>C</kbd> Compose
                </li>
                <li>
                  <kbd>⌘</kbd>
                  <kbd>↩</kbd> Send
                </li>
              </ul>
            </article>

            <article className="tile code">
              <pre>
                <span className="m">$</span> which claude{"\n"}
                <span className="m">~/.local/bin/claude</span>
                {"\n\n"}
                <span className="m">mail</span> found Claude Code{"\n"}
                {"  "}model <span className="v">haiku</span>
                {"\n"}
                {"  "}left{"  "}
                <span className="n">92%</span> of the 5-hour limit
              </pre>
            </article>

            <article className="tile media panel">
              <Shader palette="clay" />
              <span className="tile-label">
                Instant,
                <br />
                even offline
              </span>
              <p className="tile-sub">Folders are cached on your Mac and only new mail is fetched.</p>
            </article>

            <article className="tile card toolbox">
              <h3>Also in the box</h3>
              <ul className="cols">
                <li>One-line summaries</li>
                <li>Drafts in your voice</li>
                <li>People suggestions</li>
                <li>Drafts saved as you go</li>
                <li>Remote images off by default</li>
                <li>Passwords in the Keychain</li>
              </ul>
            </article>
          </div>
        </section>

        {/* 4. Showcases, stacked and centred */}
        <Showcase
          kicker="Continue"
          title="One button."
          dim="Your inbox, sorted."
          lede="Press Continue and your AI reads what came in and sorts it into what needs you, what’s just for your information and what can go. Suggestions only: you decide."
          palette="dawn"
          scene="scene=continue&banner=off"
          frameTitle="Continue sorting the inbox"
        >
          <Typing
            lines={[
              "Needs you",
              "• Rico wants 20 minutes for UX feedback. Suggest Thursday 10.00.",
              "For your information",
              "• Deel: £2,450.00 is on its way, 1–3 working days.",
            ]}
          />
        </Showcase>

        <Showcase
          kicker="Draft with AI"
          title="Replies that sound like you."
          dim="Not like a robot."
          lede="Open an email, press Draft with AI and the reply writes itself into the box. Edit it, redraft it, send it with ⌘↩. Leave halfway and it’s saved to Drafts."
          palette="garden"
          mode="fluted"
          scene="scene=draft&banner=off"
          frameTitle="Draft with AI writing a reply"
        />

        <Showcase
          id="connect"
          kicker="Connect"
          title="Your mail in two minutes."
          dim="Step by step, for your provider."
          lede="Pick Gmail, iCloud, Yahoo, Fastmail or any IMAP server and Mail tells you exactly what to click to make an app password. It checks everything works before saving."
          palette="sky"
          scene="scene=connect&banner=off"
          frameTitle="Connecting a Gmail account, step by step"
        />

        <Showcase
          kicker="Light or dark · Claude or Codex"
          title="Made to look at all day."
          dim="Set in Crooli Sans."
          lede="A tight, quiet layout with a proper dark mode. Switch between Claude Code and Codex any time."
          palette="ink"
          scene="theme=dark&provider=codex&select=2&banner=off"
          frameTitle="Mail in dark mode, using Codex"
        />

        {/* 5. Privacy */}
        <section id="privacy" className="facts">
          <div className="center-head">
            <p className="kicker dark">Privacy</p>
            <h2 className="h2">
              No Crooli account.
              <br />
              <span className="dim">No Crooli servers.</span>
            </h2>
          </div>
          <div className="facts-grid">
            <div className="fact">
              <h3>Your mail stays yours</h3>
              <p>Messages go between your Mac and your provider, and nowhere else. The cache lives on your disk.</p>
            </div>
            <div className="fact">
              <h3>Your AI, run locally</h3>
              <p>Mail talks to the Claude Code or Codex on your Mac. It never needs an API key.</p>
            </div>
            <div className="fact">
              <h3>Nothing behind your back</h3>
              <p>The AI only runs when you press a button. Sending, archiving and deleting always wait for you.</p>
            </div>
            <div className="fact">
              <h3>Passwords in the Keychain</h3>
              <p>App passwords are stored in the macOS Keychain, never in plain text.</p>
            </div>
          </div>
        </section>

        {/* 6. Download */}
        <section id="download" className="download-c">
          <div className="stage-panel panel">
            <Shader mode="fluted" palette="sky" />
            <div className="download-inner">
              <h2 className="display light">
                Install in one line.
                <br />
                <span className="dim-light">No warnings to click through.</span>
              </h2>
              <p className="lede light">
                It downloads the latest Mail from GitHub, puts it in Applications and opens it. Because it’s fetched with curl, macOS doesn’t show
                a “damaged app” prompt.
              </p>
              <Terminal version={version} />
              <p className="script-link">
                <a href="/install.sh">Read the install script</a>
                <span>·</span>
                <a href={`https://github.com/${REPO}/releases`}>All releases</a>
                <span>·</span>
                <a href={`https://github.com/${REPO}`}>Source on GitHub</a>
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div>
          <Wordmark />
          <p>Mail is made by Crooli. Windows is on the way.</p>
        </div>
        <nav>
          <a href="https://crooli.com">crooli.com</a>
          <a href={`https://github.com/${REPO}`}>GitHub</a>
          <a href="/install.sh">install.sh</a>
        </nav>
        <p className="copyright">© {new Date().getFullYear()} Crooli</p>
      </footer>
    </>
  );
}
