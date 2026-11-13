import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

const base = (size = 24): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  "aria-hidden": true,
});

/* ---------- Crooli mark (design/brand/logos) ---------- */
export function CrooliMark({ size = 24, ...p }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden {...p}>
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

/* ---------- Rail icons ----------
   One set, drawn on a 20px grid: 1.6px round strokes, generous counters, and a
   filled variant for the active item so the current place reads at a glance. */
type R = P & { active?: boolean };
const rail = (size = 20): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: "0 0 20 20",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
});
const fillIf = (on?: boolean) => (on ? "currentColor" : "none");
const knock = "var(--surface)";

export function IcoCompose({ size, active, ...p }: R) {
  return (
    <svg {...rail(size)} {...p}>
      <path d="M9 3.5H5.5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V11" />
      <path d="m14.6 2.9 2.5 2.5-6.6 6.6-3.2.7.7-3.2 6.6-6.6Z" fill={fillIf(active)} />
    </svg>
  );
}
export function IcoInbox({ size, active, ...p }: R) {
  return (
    <svg {...rail(size)} {...p}>
      <path d="M2.8 11.5 4.6 4.8A2 2 0 0 1 6.5 3.3h7a2 2 0 0 1 1.9 1.5l1.8 6.7v3.2a2 2 0 0 1-2 2H4.8a2 2 0 0 1-2-2v-3.2Z" fill={fillIf(active)} />
      <path d="M2.8 11.5h3.9l1 1.8h4.6l1-1.8h3.9" stroke={active ? knock : "currentColor"} />
    </svg>
  );
}
export function IcoStar({ size, active, ...p }: R) {
  return (
    <svg {...rail(size)} {...p}>
      <path d="m10 2.8 2.2 4.5 5 .7-3.6 3.5.9 4.9-4.5-2.4-4.5 2.4.9-4.9L2.8 8l5-.7L10 2.8Z" fill={fillIf(active)} />
    </svg>
  );
}
export function IcoSent({ size, active, ...p }: R) {
  return (
    <svg {...rail(size)} {...p}>
      <path d="M17.2 2.8 2.9 8.3l5.9 2.9 2.9 5.9 5.5-14.3Z" fill={fillIf(active)} />
      <path d="m8.8 11.2 3.6-3.6" stroke={active ? knock : "currentColor"} />
    </svg>
  );
}
export function IcoDrafts({ size, active, ...p }: R) {
  return (
    <svg {...rail(size)} {...p}>
      <path d="M11.5 2.8H6a2 2 0 0 0-2 2v10.4a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7.3l-4.5-4.5Z" fill={fillIf(active)} />
      <path d="M11.5 2.8v4.5H16M7.3 11h5.4M7.3 14h3.4" stroke={active ? knock : "currentColor"} />
    </svg>
  );
}
export function IcoArchive({ size, active, ...p }: R) {
  return (
    <svg {...rail(size)} {...p}>
      <rect x="2.8" y="3.3" width="14.4" height="4" rx="1.2" fill={fillIf(active)} />
      <path d="M4.3 7.3v7.4a2 2 0 0 0 2 2h7.4a2 2 0 0 0 2-2V7.3" fill={fillIf(active)} />
      <path d="M8.3 10.8h3.4" stroke={active ? knock : "currentColor"} />
    </svg>
  );
}
export function IcoTrash({ size, active, ...p }: R) {
  return (
    <svg {...rail(size)} {...p}>
      <path d="M3.3 5.5h13.4M8 5.5V3.8c0-.5.4-1 1-1h2c.6 0 1 .5 1 1v1.7" />
      <path d="m4.8 5.5.8 10a1.8 1.8 0 0 0 1.8 1.7h5.2a1.8 1.8 0 0 0 1.8-1.7l.8-10" fill={fillIf(active)} />
      <path d="M8.3 9v4.6M11.7 9v4.6" stroke={active ? knock : "currentColor"} />
    </svg>
  );
}
export function IcoSettings({ size, active, ...p }: R) {
  return (
    <svg {...rail(size)} {...p}>
      <path d="M3 6h7.5M14.5 6H17M3 14h2.5M9.5 14H17" />
      <circle cx="12.5" cy="6" r="2" fill={fillIf(active)} />
      <circle cx="7.5" cy="14" r="2" fill={fillIf(active)} />
    </svg>
  );
}

/* ---------- Outline icons ---------- */
export function MailPlus({ size = 24, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <path
        d="M13 4.5H6a3 3 0 0 0-3 3v9a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path d="m6.5 9 5.5 3.6L15 10.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 2.5v6M16 5.5h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function TrayIcon({ size = 24, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <rect x="3.5" y="4" width="17" height="16" rx="4" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M3.5 13.5h4.2c.5 0 .9.3 1.1.8.4 1.1 1.6 1.9 3.2 1.9s2.8-.8 3.2-1.9c.2-.5.6-.8 1.1-.8h4.2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SendIcon({ size = 24, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <path
        d="M20.6 3.4 3.9 9.6c-.8.3-.8 1.4 0 1.7l6.6 2.6 2.6 6.6c.3.8 1.4.8 1.7 0l6.2-16.7c.1-.3-.1-.5-.4-.4Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="m10.5 13.5 4.5-4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function FilterLines({ size = 24, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M3 6.5h18M6.5 12h11M10 17.5h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function SearchIcon({ size = 18, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function SparkleIcon({ size = 18, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <path
        d="M12 3c.6 3.9 2.1 5.4 6 6-3.9.6-5.4 2.1-6 6-.6-3.9-2.1-5.4-6-6 3.9-.6 5.4-2.1 6-6Z"
        fill="currentColor"
      />
      <path d="M19 15c.3 1.6.9 2.2 2.5 2.5-1.6.3-2.2.9-2.5 2.5-.3-1.6-.9-2.2-2.5-2.5 1.6-.3 2.2-.9 2.5-2.5Z" fill="currentColor" />
    </svg>
  );
}

export function CloseIcon({ size = 18, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function ArchiveIcon({ size = 18, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <rect x="3" y="4" width="18" height="5" rx="1.6" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5 9v8a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3V9M10 13h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function StarIcon({ size = 18, filled, ...p }: P & { filled?: boolean }) {
  return (
    <svg {...base(size)} {...p}>
      <path
        d="m12 3.6 2.5 5.1 5.6.8-4 3.9 1 5.6-5.1-2.7-5 2.7.9-5.6-4-3.9 5.6-.8L12 3.6Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        fill={filled ? "currentColor" : "none"}
      />
    </svg>
  );
}

export function ReplyIcon({ size = 18, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M9.5 6 4 11.5 9.5 17M4.5 11.5H14a6 6 0 0 1 6 6v.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ForwardIcon({ size = 18, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M14.5 6 20 11.5 14.5 17M19.5 11.5H10a6 6 0 0 0-6 6v.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TrashIcon({ size = 18, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M4 7h16M9.5 7V5.2c0-.7.5-1.2 1.2-1.2h2.6c.7 0 1.2.5 1.2 1.2V7M6.5 7l.8 11.2A2 2 0 0 0 9.3 20h5.4a2 2 0 0 0 2-1.8L17.5 7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function DraftIcon({ size = 24, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="m13.5 6.5 4 4" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

/* ---------- Provider marks ---------- */
/** Claude starburst, drawn as radiating round-capped strokes. */
export function ClaudeMark({ size = 36 }: { size?: number }) {
  const rays = [
    [0, 15.5], [27, 13], [55, 15], [86, 13.5], [113, 15.5], [142, 12.5],
    [171, 15], [200, 13.5], [228, 15.5], [258, 12.5], [287, 15], [316, 13.5], [343, 14],
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" aria-label="Claude">
      {rays.map(([deg, len], i) => {
        const a = (deg * Math.PI) / 180;
        const x1 = 18 + Math.cos(a) * 3;
        const y1 = 18 + Math.sin(a) * 3;
        const x2 = 18 + Math.cos(a) * len;
        const y2 = 18 + Math.sin(a) * len;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--claude)" strokeWidth={2.6} strokeLinecap="round" />;
      })}
      <circle cx="18" cy="18" r="3.4" fill="var(--claude)" />
    </svg>
  );
}
