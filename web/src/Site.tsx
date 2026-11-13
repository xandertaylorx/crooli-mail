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

function Brand() {
  return (
    <a className="brand" href="#top" aria-label="Crooli Mail home">
      <Mark size={36} />
      <span className="logo-word">Crooli</span>
      <span className="brand-product">Mail</span>
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
          src={`/demo/${scene ? `?${scene}` : ""}`}
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
        <b>{claude ? "Opus 4.8" : "GPT 5.5"}</b>
        <small>{claude ? "Max (20x)" : "Pro (20x)"}</small>
      </span>
      <Meter left={claude ? 0.96 : 0.82} color={claude ? "#dc7355" : "var(--ink)"} />
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

function Section({ id, className, children }: { id?: string; className: string; children: ReactNode }) {
  return (
    <section id={id} className={"frame " + className}>
      {children}
    </section>
  );
}

/* ---------------------------------------------------------------- page */

export function Site() {
  const version = useLatestVersion();
  const [theme, setTheme] = useState<"light" | "dark">(() => (document.documentElement.dataset.theme === "dark" ? "dark" : "light"));
  const [docked, setDocked] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("crooli-mail.theme", theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  useEffect(() => {
    const on = () => setDocked(scrollY > innerHeight * 0.7);
    on();
    addEventListener("scroll", on, { passive: true });
    return () => removeEventListener("scroll", on);
  }, []);

  const toggle = (
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
  );

  return (
    <>
      <div className={"dock" + (docked ? " on" : "")} inert={!docked}>
        <Brand />
        <nav aria-label="Sections">
          <a href="#tour">Tour</a>
          <a href="#ai">AI</a>
          <a href="#privacy">Privacy</a>
        </nav>
        {toggle}
        <a className="btn dark small" href="#download">
          Download
        </a>
      </div>

      <main id="top">
        {/* 1. Split hero */}
        <Section className="hero">
          <div className="hero-copy">
            <header className="hero-bar">
              <Brand />
              <nav className="pillnav" aria-label="Main">
                <a href="#tour">Tour</a>
                <a href="#ai">AI</a>
                <a href={`https://github.com/${REPO}`} rel="noopener">
                  GitHub
                </a>
                {toggle}
              </nav>
            </header>
            <div className="hero-main">
              <h1 className="display">
                An email client
                <br />
                <span className="dim">with your AI in it.</span>
              </h1>
              <p className="lede">
                A fast, calm Mac app for Gmail, iCloud, Outlook and any IMAP inbox. It uses the Claude Code or Codex already on your Mac to
                summarise, draft and work through your mail. No accounts, no servers, nothing sent without your say-so.
              </p>
              <div className="cta">
                <a className="btn dark" href="#download">
                  Download for macOS
                </a>
                <a className="ulink" href="#tour">
                  See it working
                </a>
              </div>
            </div>
            <dl className="routes">
              <div>
                <dt>claude</dt>
                <dd>Your Claude plan</dd>
              </div>
              <div>
                <dt>codex</dt>
                <dd>Your ChatGPT plan</dd>
              </div>
              <div>
                <dt>imap</dt>
                <dd>Any mailbox</dd>
              </div>
              <div>
                <dt>⌘K</dt>
                <dd>Everything, from the keyboard</dd>
              </div>
            </dl>
          </div>
          <div className="hero-art panel">
            <Shader mode="fluted" palette="sky" />
            <Terminal version={version} />
          </div>
        </Section>

        {/* 2. The live app */}
        <Section id="tour" className="stage panel deep">
          <Shader palette="deep" />
          <div className="stage-head">
            <p className="kicker">The app · live demo</p>
            <h2 className="h2 light">
              Your whole inbox, one calm view.
              <br />
              <span className="dim-light">Click around. It’s the real thing.</span>
            </h2>
          </div>
          <AppFrame key={theme} scene={`theme=${theme}`} title="Crooli Mail, running live on demo data" interactive eager />
        </Section>

        {/* 3. Bento */}
        <Section id="ai" className="bento">
          <article className="tile hero-tile panel">
            <Shader palette="lapis" />
            <h2 className="display light">
              Your AI, your mailbox,
              <br />
              your Mac.
            </h2>
            <a className="btn white" href="#download">
              Get Crooli Mail
            </a>
          </article>

          <article className="tile card agents">
            <h3>Bring your own agent</h3>
            <p>Crooli finds Claude Code or Codex on your Mac and uses the plan you already pay for. The meter shows what’s left.</p>
            <div className="agent-stack">
              <AgentChip kind="claude" />
              <AgentChip kind="codex" />
            </div>
          </article>

          <article className="tile media panel">
            <Shader mode="fluted" palette="garden" />
            <span className="tile-label">Any mailbox</span>
            <ul className="chips on-panel">
              <li>Gmail</li>
              <li>iCloud</li>
              <li>Outlook</li>
              <li>Fastmail</li>
              <li>Yahoo</li>
              <li>IMAP</li>
            </ul>
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
                <kbd>S</kbd> Star
              </li>
              <li>
                <kbd>C</kbd> Compose
              </li>
              <li>
                <kbd>⌘</kbd>
                <kbd>K</kbd> Search and commands
              </li>
            </ul>
          </article>

          <article className="tile code">
            <pre>
              <span className="m">$</span> which claude{"\n"}
              <span className="m">~/.local/bin/claude</span>
              {"\n\n"}
              <span className="m">crooli</span> found Claude Code{"\n"}
              {"  "}model <span className="v">Opus 4.8</span>
              {"\n"}
              {"  "}plan{"  "}
              <span className="v">Max (20x)</span>
              {"\n"}
              {"  "}left{"  "}
              <span className="n">96%</span> of this window
            </pre>
          </article>

          <article className="tile media panel">
            <Shader palette="clay" />
            <span className="tile-label">
              14.171 emails.
              <br />
              Still instant.
            </span>
          </article>

          <article className="tile card toolbox">
            <h3>Also in the box</h3>
            <ul className="cols">
              <li>One-line summaries</li>
              <li>Drafts in your voice</li>
              <li>Light and dark</li>
              <li>Local search</li>
              <li>Remote images off</li>
              <li>Keychain for passwords</li>
            </ul>
          </article>
        </Section>

        {/* 4. Continue */}
        <Section className="split">
          <div className="split-art panel">
            <Shader palette="dawn" />
            <AppFrame scene="scene=continue&banner=off" title="Continue: the agent working through the inbox" />
          </div>
          <div className="split-copy">
            <p className="kicker dark">Continue</p>
            <h2 className="h2">
              One button.
              <br />
              <span className="dim">Your inbox, worked through.</span>
            </h2>
            <p className="lede">
              Press Continue and your agent reads what came in, sorts it into what needs you, what’s just for your information and what can go,
              and drafts the replies. You look it over, then approve.
            </p>
            <Typing
              lines={[
                "Needs you",
                "• Rico wants 20 minutes for UX feedback. Reply drafted: Thursday 10.00.",
                "For your information",
                "• Deel: £2,450.00 is on its way, 1–3 working days.",
                "Suggested",
                "• Archive 41 newsletters older than 30 days.",
              ]}
            />
          </div>
        </Section>

        {/* 5. Draft */}
        <Section className="split flip">
          <div className="split-copy">
            <p className="kicker dark">Draft with AI</p>
            <h2 className="h2">
              Replies that sound like you.
              <br />
              <span className="dim">Not like a robot.</span>
            </h2>
            <p className="lede">
              Open an email, press Draft with AI and watch the reply write itself into the box. Short, warm and plain. Edit it, redraft it or send
              it. Summarise does the same for long threads, in a sentence or two.
            </p>
          </div>
          <div className="split-art panel">
            <Shader mode="fluted" palette="garden" />
            <AppFrame scene="scene=draft&banner=off" title="Draft with AI writing a reply to Rico" />
          </div>
        </Section>

        {/* 6. Dark + Codex */}
        <Section className="stage panel ink">
          <Shader palette="ink" />
          <div className="stage-head">
            <p className="kicker">Light or dark · Claude or Codex</p>
            <h2 className="h2 light">
              Made to be looked at all day.
              <br />
              <span className="dim-light">Set in Crooli Sans, our own typeface.</span>
            </h2>
          </div>
          <AppFrame scene="theme=dark&provider=codex&select=2&banner=off" title="Crooli Mail in dark mode, using Codex" />
        </Section>

        {/* 7. Privacy */}
        <Section id="privacy" className="facts">
          <div className="facts-head">
            <p className="kicker dark">Privacy</p>
            <h2 className="h2">
              No Crooli account.
              <br />
              <span className="dim">No Crooli servers.</span>
            </h2>
          </div>
          <div className="facts-grid">
            <div>
              <h3>Your mail stays yours</h3>
              <p>Messages go between your Mac and your mail provider, and nowhere else. The cache lives on your disk.</p>
            </div>
            <div>
              <h3>Your AI, run locally</h3>
              <p>Crooli talks to the Claude Code or Codex on your Mac. It never sees an API key, because it never needs one.</p>
            </div>
            <div>
              <h3>Nothing behind your back</h3>
              <p>The agent suggests. Sending, archiving and deleting always wait for you.</p>
            </div>
            <div>
              <h3>Passwords in the Keychain</h3>
              <p>App passwords and sign-ins are stored in the macOS Keychain, never in plain text.</p>
            </div>
          </div>
        </Section>

        {/* 8. Download */}
        <Section id="download" className="download panel">
          <Shader mode="fluted" palette="sky" />
          <div className="download-copy">
            <h2 className="display light">
              Install in one line.
              <br />
              <span className="dim-light">No warnings to click through.</span>
            </h2>
            <p className="lede light">
              Paste this into Terminal. It downloads the latest Crooli Mail from GitHub, puts it in Applications and opens it. Because it’s
              fetched with curl, macOS doesn’t flag it, so there’s no “damaged app” prompt.
            </p>
            <ul className="reqs">
              <li>macOS 13 or later</li>
              <li>Apple Silicon or Intel</li>
              <li>Claude Code or Codex for the AI features</li>
            </ul>
            <p className="script-link">
              <a href="/install.sh">Read the install script</a>
              <span>·</span>
              <a href={`https://github.com/${REPO}/releases`}>All releases</a>
            </p>
          </div>
          <Terminal version={version} />
        </Section>
      </main>

      <footer className="footer frame">
        <div>
          <Brand />
          <p>Made by Crooli. Windows is on the way.</p>
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
