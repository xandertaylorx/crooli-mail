import { useState } from "react";
import { CloseIcon } from "../icons";
import { mailApi, PROVIDERS, providerFor, type Account, type ProviderKey } from "../lib/mail";
import { LIVE, useStore } from "../store";

function ProviderGlyph({ k }: { k: ProviderKey }) {
  const common = "flex size-[28px] shrink-0 items-center justify-center rounded-[8px] text-[13px] font-bold";
  switch (k) {
    case "gmail":
      return <span className={common + " bg-[#fdecea] text-[#d93025]"}>G</span>;
    case "icloud":
      return <span className={common + " bg-[#e6f0fe] text-[#0a6cf0]"}>i</span>;
    case "outlook":
      return <span className={common + " bg-[#e5f1fb] text-[#0f6cbd]"}>O</span>;
    case "yahoo":
      return <span className={common + " bg-[#f1e8ff] text-[#6001d2]"}>Y</span>;
    case "fastmail":
      return <span className={common + " bg-[#e3f3f5] text-[#0e6a7a]"}>F</span>;
    default:
      return <span className={common + " bg-pill text-ink-muted"}>@</span>;
  }
}

const input =
  "h-[36px] w-full rounded-[9px] border border-line bg-surface px-[11px] text-[13.5px] text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-[var(--ink-faint)] focus-visible:outline-none";
const label = "mb-[5px] block text-[12px] font-medium text-ink-muted";

export function ConnectPanel() {
  const accountAdded = useStore((s) => s.accountAdded);
  const setPanel = useStore((s) => s.setPanel);
  const hasAccounts = useStore((s) => s.accounts.length > 0);
  const [key, setKey] = useState<ProviderKey>("gmail");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [server, setServer] = useState({ imapHost: "", imapPort: 993, smtpHost: "", smtpPort: 465, smtpStarttls: false, username: "" });

  const p = PROVIDERS.find((x) => x.key === key)!;

  const onEmail = (v: string) => {
    setEmail(v);
    const guess = providerFor(v);
    if (guess && guess !== key) setKey(guess);
    if (key === "imap" && v.includes("@") && !server.imapHost) {
      const d = v.split("@")[1];
      if (d && d.includes(".")) setServer((s) => ({ ...s, imapHost: `imap.${d}`, smtpHost: `smtp.${d}` }));
    }
  };

  const valid = email.includes("@") && pass.trim().length > 0 && (key !== "imap" || (server.imapHost && server.smtpHost)) && !p.unsupported;

  const connect = async () => {
    if (!valid || busy) return;
    if (!LIVE) {
      setError("This is the website demo. Install Mail to connect your own account.");
      return;
    }
    setBusy(true);
    setError(null);
    const servers = p.servers ?? { imapHost: server.imapHost.trim(), imapPort: Number(server.imapPort), smtpHost: server.smtpHost.trim(), smtpPort: Number(server.smtpPort), smtpStarttls: server.smtpStarttls };
    const account: Account = {
      email: email.trim(),
      name: name.trim() || email.split("@")[0],
      provider: key,
      ...servers,
      username: key === "imap" && server.username.trim() ? server.username.trim() : null,
    };
    try {
      const saved = await mailApi.connect(account, pass);
      accountAdded(saved);
      useStore.getState().showToast(`Connected ${saved.email}`);
    } catch (e) {
      setError(typeof e === "string" ? e : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-[52px] shrink-0 items-center gap-[10px] border-b border-line-soft px-[20px]">
        <span className="text-[15px] font-semibold tracking-[-0.01em] text-ink">Connect your mail</span>
        {hasAccounts && (
          <button type="button" onClick={() => setPanel(null)} className="ml-auto flex size-[30px] items-center justify-center rounded-[8px] text-ink-muted hover:bg-pill hover:text-ink" aria-label="Close">
            <CloseIcon size={15} />
          </button>
        )}
      </div>

      <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto px-[24px] py-[20px]">
        <p className="max-w-[560px] text-[13.5px] leading-[1.55] text-ink-2">
          Mail talks to your provider directly. Nothing goes through Crooli, and there’s no Crooli account. Your password is kept in the macOS Keychain.
        </p>

        <div className="mt-[18px] grid max-w-[620px] grid-cols-3 gap-[8px]" role="radiogroup" aria-label="Provider">
          {PROVIDERS.map((x) => (
            <button
              key={x.key}
              type="button"
              role="radio"
              aria-checked={x.key === key}
              onClick={() => {
                setKey(x.key);
                setError(null);
              }}
              className={
                "flex h-[46px] items-center gap-[10px] rounded-[11px] border px-[10px] text-left text-[13.5px] font-medium transition-colors " +
                (x.key === key ? "border-[var(--ink)] bg-surface text-ink" : "border-line text-ink-2 hover:border-[var(--checkbox)]")
              }
            >
              <ProviderGlyph k={x.key} />
              {x.name}
            </button>
          ))}
        </div>

        {p.unsupported ? (
          <div className="mt-[20px] max-w-[620px] rounded-[12px] bg-canvas p-[16px] text-[13.5px] leading-[1.55] text-ink-2">
            <p className="font-medium text-ink">{p.name} can’t be connected yet</p>
            <p className="mt-[6px]">{p.unsupported}</p>
            <p className="mt-[6px] text-ink-muted">
              Until then, you can turn on forwarding in Outlook to a Gmail, iCloud or Fastmail address and connect that instead.
            </p>
          </div>
        ) : (
          <>
            <ol className="mt-[22px] max-w-[620px] space-y-[12px]">
              {p.steps.map((s, i) => (
                <li key={i} className="flex gap-[12px]">
                  <span className="tabular mt-[1px] flex size-[22px] shrink-0 items-center justify-center rounded-full bg-pill text-[12px] font-semibold text-ink-2">{i + 1}</span>
                  <div className="min-w-0 text-[13.5px] leading-[1.55] text-ink-2">
                    {s.text}
                    {s.link && (
                      <div className="mt-[6px]">
                        <button
                          type="button"
                          onClick={() => (LIVE ? mailApi.openUrl(s.link!.url) : window.open(s.link!.url, "_blank", "noopener"))}
                          className="inline-flex h-[28px] items-center gap-[6px] rounded-[8px] border border-line bg-surface px-[10px] text-[12.5px] font-medium text-ink transition-colors hover:bg-pill"
                        >
                          {s.link.label}
                          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
                            <path d="M4 2h6v6M10 2 3 9" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
            {p.note && <p className="mt-[14px] max-w-[620px] text-[12.5px] leading-[1.5] text-ink-muted">{p.note}</p>}

            <form
              className="mt-[22px] grid max-w-[620px] gap-[12px]"
              onSubmit={(e) => {
                e.preventDefault();
                connect();
              }}
            >
              <div className="grid grid-cols-2 gap-[12px]">
                <label>
                  <span className={label}>Your name</span>
                  <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="How people see you" autoComplete="name" />
                </label>
                <label>
                  <span className={label}>Email address</span>
                  <input
                    className={input}
                    value={email}
                    onChange={(e) => onEmail(e.target.value)}
                    placeholder={key === "icloud" ? "you@icloud.com" : key === "gmail" ? "you@gmail.com" : "you@example.com"}
                    autoComplete="email"
                    inputMode="email"
                    autoFocus={LIVE}
                  />
                </label>
              </div>
              <label>
                <span className={label}>{p.passwordLabel}</span>
                <div className="relative">
                  <input
                    className={input + " pr-[60px] font-mono tracking-[0.02em]"}
                    type={show ? "text" : "password"}
                    value={pass}
                    onChange={(e) => setPass(e.target.value)}
                    placeholder={p.passwordHint}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button type="button" onClick={() => setShow(!show)} className="absolute right-[6px] top-[5px] h-[26px] rounded-[7px] px-[8px] text-[12px] font-medium text-ink-muted hover:bg-pill">
                    {show ? "Hide" : "Show"}
                  </button>
                </div>
              </label>

              {key === "imap" && (
                <div className="grid gap-[12px] rounded-[12px] bg-canvas p-[14px]">
                  <div className="grid grid-cols-[1fr_90px] gap-[10px]">
                    <label>
                      <span className={label}>Incoming (IMAP) server</span>
                      <input className={input} value={server.imapHost} onChange={(e) => setServer({ ...server, imapHost: e.target.value })} placeholder="imap.example.com" />
                    </label>
                    <label>
                      <span className={label}>Port</span>
                      <input className={input} value={server.imapPort} onChange={(e) => setServer({ ...server, imapPort: Number(e.target.value) || 993 })} inputMode="numeric" />
                    </label>
                  </div>
                  <div className="grid grid-cols-[1fr_90px] gap-[10px]">
                    <label>
                      <span className={label}>Outgoing (SMTP) server</span>
                      <input className={input} value={server.smtpHost} onChange={(e) => setServer({ ...server, smtpHost: e.target.value })} placeholder="smtp.example.com" />
                    </label>
                    <label>
                      <span className={label}>Port</span>
                      <input
                        className={input}
                        value={server.smtpPort}
                        onChange={(e) => {
                          const port = Number(e.target.value) || 465;
                          setServer({ ...server, smtpPort: port, smtpStarttls: port === 587 });
                        }}
                        inputMode="numeric"
                      />
                    </label>
                  </div>
                  <div className="flex items-center gap-[14px] text-[12.5px] text-ink-2">
                    <span className="text-ink-muted">Sending security</span>
                    <label className="flex items-center gap-[6px]">
                      <input type="radio" checked={!server.smtpStarttls} onChange={() => setServer({ ...server, smtpStarttls: false, smtpPort: 465 })} /> TLS (465)
                    </label>
                    <label className="flex items-center gap-[6px]">
                      <input type="radio" checked={server.smtpStarttls} onChange={() => setServer({ ...server, smtpStarttls: true, smtpPort: 587 })} /> STARTTLS (587)
                    </label>
                  </div>
                  <label>
                    <span className={label}>Username, if it isn’t your email address</span>
                    <input className={input} value={server.username} onChange={(e) => setServer({ ...server, username: e.target.value })} placeholder="Optional" />
                  </label>
                </div>
              )}

              {error && <p className="rounded-[10px] bg-[#fdecea] px-[12px] py-[9px] text-[13px] leading-[1.45] text-[#a4241a] dark:bg-[#2a1210] dark:text-[#ff8a7e]">{error}</p>}

              <div className="flex items-center gap-[12px] pt-[4px]">
                <button type="submit" disabled={!valid || busy} className="btn-continue h-[36px] rounded-full px-[18px] text-[13.5px] font-medium disabled:opacity-40">
                  {busy ? `Checking with ${p.name === "Other" ? "your server" : p.name}…` : "Connect"}
                </button>
                <span className="text-[12px] text-ink-faint">We check the details work before saving anything.</span>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
