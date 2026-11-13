import { useMemo, useRef, useState } from "react";
import { initialsAvatar } from "../lib/mail";
import { useStore } from "../store";
import { Avatar } from "./MailList";

/** A To/Cc field that suggests people from your mail as you type. Comma-separated. */
export function RecipientInput({
  value,
  onChange,
  autoFocus,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const contacts = useStore((s) => s.contacts);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLInputElement>(null);

  const cut = value.lastIndexOf(",");
  const head = cut >= 0 ? value.slice(0, cut + 1) + " " : "";
  const token = (cut >= 0 ? value.slice(cut + 1) : value).trim().toLowerCase();

  const matches = useMemo(() => {
    if (!token) return [];
    const already = new Set(value.toLowerCase().split(",").map((s) => s.trim()));
    const scored: { c: (typeof contacts)[number]; s: number }[] = [];
    for (const c of contacts) {
      if (already.has(c.address)) continue;
      const name = c.name.toLowerCase();
      const words = name.split(/\s+/);
      let s = -1;
      if (c.address.startsWith(token)) s = 3;
      else if (words.some((w) => w.startsWith(token))) s = 3;
      else if (name.includes(token)) s = 2;
      else if (c.address.includes(token)) s = 1;
      if (s > 0) scored.push({ c, s: s * 1000 + Math.min(999, c.count) });
      if (scored.length > 400) break;
    }
    return scored.sort((a, b) => b.s - a.s).slice(0, 6).map((x) => x.c);
  }, [token, contacts, value]);

  const pick = (addr: string) => {
    onChange(`${head}${addr}, `);
    setOpen(false);
    setActive(0);
    ref.current?.focus();
  };

  const show = open && matches.length > 0;
  return (
    <div className="relative min-w-0 flex-1">
      <input
        ref={ref}
        autoFocus={autoFocus}
        value={value}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (!show) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(matches.length - 1, a + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(0, a - 1));
          } else if (e.key === "Enter" || e.key === "Tab") {
            e.preventDefault();
            pick(matches[active].address);
          } else if (e.key === "Escape") {
            e.stopPropagation();
            setOpen(false);
          }
        }}
      />
      {show && (
        <ul role="listbox" className="pop-in absolute left-[-10px] right-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-[12px] border border-line bg-surface p-[4px] shadow-[0_12px_40px_rgba(0,0,0,0.14)]">
          {matches.map((c, i) => (
            <li key={c.address}>
              <button
                type="button"
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(c.address);
                }}
                className={"flex w-full items-center gap-[10px] rounded-[9px] px-[8px] py-[6px] text-left " + (i === active ? "bg-pill" : "")}
              >
                <Avatar avatar={initialsAvatar(c.name, c.address)} size={26} address={c.address} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium text-ink">{c.name || c.address}</span>
                  {c.name && <span className="block truncate text-[12px] text-ink-muted">{c.address}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
