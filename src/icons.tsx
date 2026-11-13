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

/* ---------- Rail icons: filled glyphs with knocked-out detail ---------- */
export function RailCompose({ size = 24, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <rect x="2" y="4" width="18" height="15" rx="3.5" fill="currentColor" />
      <path d="M5.5 8.5 11 12l5.5-3.5" stroke="var(--window)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M18.5 13.2c.35 1.55 1.05 2.25 2.6 2.6-1.55.35-2.25 1.05-2.6 2.6-.35-1.55-1.05-2.25-2.6-2.6 1.55-.35 2.25-1.05 2.6-2.6Z"
        fill="currentColor"
        stroke="var(--window)"
        strokeWidth="2.2"
        strokeLinejoin="round"
        paintOrder="stroke"
      />
    </svg>
  );
}

export function RailStarred({ size = 24, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <rect x="7" y="2.5" width="14.5" height="14.5" rx="3.5" fill="currentColor" opacity="0.55" />
      <rect x="2.5" y="7" width="14.5" height="14.5" rx="3.5" fill="currentColor" stroke="var(--window)" strokeWidth="1.6" />
      <path
        d="m9.75 10.6 1.05 2.1 2.3.33-1.67 1.62.4 2.3-2.08-1.09-2.07 1.09.4-2.3-1.68-1.62 2.31-.33 1.04-2.1Z"
        fill="var(--window)"
      />
    </svg>
  );
}

export function RailInbox({ size = 24, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M2.5 11.2 12 4l9.5 7.2V18a3 3 0 0 1-3 3h-13a3 3 0 0 1-3-3v-6.8Z" fill="currentColor" />
      <rect x="6" y="7" width="12" height="9" rx="1.6" fill="var(--surface)" />
      <path d="M8.5 10h7M8.5 12.6h4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M2.5 11.5 12 17l9.5-5.5V18a3 3 0 0 1-3 3h-13a3 3 0 0 1-3-3v-6.5Z" fill="currentColor" />
    </svg>
  );
}

export function RailFolder({ size = 24, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <path
        d="M2.5 7a3 3 0 0 1 3-3h3.6c.8 0 1.56.32 2.12.88L12.6 6.3h5.9a3 3 0 0 1 3 3V17a3 3 0 0 1-3 3h-13a3 3 0 0 1-3-3V7Z"
        fill="currentColor"
      />
      <path d="M2.5 9.5h19" stroke="var(--window)" strokeWidth="1.5" />
    </svg>
  );
}

export function RailRules({ size = 24, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <rect x="8.5" y="2.5" width="7" height="6" rx="1.8" fill="currentColor" />
      <rect x="2.5" y="15.5" width="7" height="6" rx="1.8" fill="currentColor" />
      <rect x="14.5" y="15.5" width="7" height="6" rx="1.8" fill="currentColor" />
      <path d="M12 8.5v3.5M6 15.5v-1.5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function RailTasks({ size = 24, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <rect x="4" y="3.5" width="16" height="18" rx="3.2" fill="currentColor" />
      <rect x="8.5" y="2" width="7" height="4" rx="1.4" fill="currentColor" stroke="var(--window)" strokeWidth="1.5" />
      <path d="M8 11h8M8 14.5h8M8 18h5" stroke="var(--window)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function RailDocs({ size = 24, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M5 5.2A2.7 2.7 0 0 1 7.7 2.5h6.1L19.5 8v11.3a2.7 2.7 0 0 1-2.7 2.7H7.7A2.7 2.7 0 0 1 5 19.3V5.2Z" fill="currentColor" />
      <path d="M13.8 2.5V6.4c0 .9.7 1.6 1.6 1.6h4.1" fill="var(--window)" opacity="0.6" />
      <path d="M8.5 12h7M8.5 15.2h7M8.5 18.4h4" stroke="var(--window)" strokeWidth="1.6" strokeLinecap="round" />
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

export function VerifiedBadge({ size = 20, ...p }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-label="Verified sender" {...p}>
      <path
        d="M10 1.2c.9 0 1.6.8 2.4 1.1.8.3 1.9.1 2.6.6.7.6.6 1.6 1 2.4.4.8 1.3 1.4 1.4 2.3.1.9-.7 1.6-.9 2.4-.2.8.1 1.9-.4 2.6-.6.7-1.6.6-2.4 1-.8.4-1.4 1.3-2.3 1.4-.9.1-1.6-.7-2.4-.9H9.9c-.8.2-1.6 1-2.5.9-.9-.1-1.4-1-2.3-1.4-.8-.4-1.8-.3-2.4-1-.5-.7-.2-1.8-.4-2.6-.2-.8-1-1.5-.9-2.4.1-.9 1-1.5 1.4-2.3.4-.8.3-1.8 1-2.4.7-.5 1.8-.3 2.6-.6.8-.3 1.5-1.1 2.4-1.1Z"
        fill="var(--verified)"
      />
      <path d="m6.6 10.2 2.3 2.3 4.6-4.8" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
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
