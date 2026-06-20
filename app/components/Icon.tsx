// Line-icon set (24x24, stroke=currentColor). Clinical + UI glyphs.
const P: Record<string, string> = {
  dashboard: "M4 13h7V4H4v9Zm0 7h7v-5H4v5Zm9 0h7v-9h-7v9Zm0-16v5h7V4h-7Z",
  emergency: "M12 3 2 20h20L12 3Zm0 6v5m0 3.5v.5",
  activity: "M3 12h4l2 7 4-14 2 7h6",
  heart: "M12 21s-7.5-4.6-10-9.5C.6 8.4 2.3 5 6 5c2 0 3.2 1 4 2 .8-1 2-2 4-2 3.7 0 5.4 3.4 4 6.5C19.5 16.4 12 21 12 21Z",
  patients: "M9 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 7a6 6 0 0 1 12 0m1.5-13.5a3 3 0 0 1 0 6M17 19a6 6 0 0 0-1.5-4",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0",
  "user-md": "M12 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 9a6 6 0 0 1 12 0M9 11.5V14a3 3 0 0 0 6 0v-1m3 3a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z",
  stethoscope: "M5 4v5a4 4 0 0 0 8 0V4M5 4H3.5M5 4h1.5M13 4h-1.5M13 4h1.5M9 17a4 4 0 0 0 8 0v-2m2 0a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2Z",
  departments: "M4 21V5l8-2v18M12 21V9l8 3v9M3 21h18M8 8v.01M8 12v.01M8 16v.01M16 13v.01M16 17v.01",
  flask: "M9 3v6L4 19a2 2 0 0 0 1.8 3h12.4A2 2 0 0 0 20 19L15 9V3M8 3h8M7.5 14h9",
  scan: "M4 7V5a1 1 0 0 1 1-1h2M4 17v2a1 1 0 0 0 1 1h2m10-16h2a1 1 0 0 1 1 1v2m-3 13h2a1 1 0 0 0 1-1v-2M8 12h8",
  pill: "M10.5 20.5a5 5 0 0 1-7-7l6-6a5 5 0 0 1 7 7l-6 6ZM7 10l7 7",
  scalpel: "M14 4 20 4 20 10 8 22 4 22 4 18 14 8M14 8 16 10",
  share: "M7 13a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm11-7a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm0 16a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM9.2 9.7l6.6-3.8M9.2 12.3l6.6 3.8",
  messages: "M21 12a8 8 0 0 1-11.5 7.2L3 21l1.8-6.5A8 8 0 1 1 21 12Z",
  receipt: "M5 21V3l2 1.5L9 3l2 1.5L13 3l2 1.5L17 3l2 1.5V21l-2-1.5L15 21l-2-1.5L11 21l-2-1.5L7 21l-2-1.5ZM8 8h8M8 12h8M8 16h5",
  calendar: "M7 3v3m10-3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z",
  bed: "M3 7v12M3 13h13a4 4 0 0 1 4 4v2M3 17h18M7 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  settings: "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm8-3.5a8 8 0 0 0-.1-1.3l2-1.6-2-3.4-2.4 1a8 8 0 0 0-2.2-1.3L13 2h-4l-.3 2.6a8 8 0 0 0-2.2 1.3l-2.4-1-2 3.4 2 1.6A8 8 0 0 0 4 12a8 8 0 0 0 .1 1.3l-2 1.6 2 3.4 2.4-1a8 8 0 0 0 2.2 1.3L9 22h4l.3-2.6a8 8 0 0 0 2.2-1.3l2.4 1 2-3.4-2-1.6A8 8 0 0 0 20 12Z",
  audit: "M5 21V3h10l4 4v14H5Zm10-18v5h5M8 13h8M8 17h5M8 9h3",
  shield: "M12 3 4 6v6c0 5 3.4 8 8 9 4.6-1 8-4 8-9V6l-8-3Zm-2 9 1.5 1.5L15 9",
  bell: "M18 9a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Zm-4 12a2 2 0 0 1-4 0",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm10 3-6-6",
  sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-14v2m0 14v2M5.6 5.6l1.4 1.4m10 10 1.4 1.4M3 12h2m14 0h2M5.6 18.4 7 17m10-10 1.4-1.4",
  moon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z",
  logout: "M15 12H3m12 0-4-4m4 4-4 4M9 4h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H9",
  plus: "M12 5v14M5 12h14",
  x: "M18 6 6 18M6 6l12 12",
  check: "m5 12 5 5L20 7",
  "arrow-right": "M5 12h14m-6-6 6 6-6 6",
  "chevron-left": "m15 6-6 6 6 6",
  "chevron-right": "m9 6 6 6-6 6",
  "chevron-down": "m6 9 6 6 6-6",
  alert: "M12 8v5m0 3v.5M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  eyeOff: "M3 3l18 18M10.6 10.6a3 3 0 0 0 4.2 4.2M9.9 5.2A9.5 9.5 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3 3.8M6 6.5A17 17 0 0 0 2 12s3.5 7 10 7a9.6 9.6 0 0 0 2.5-.3",
  phone: "M5 4h4l2 5-3 2a12 12 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z",
  mail: "M3 6h18v12H3V6Zm0 1 9 6 9-6",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v5l3 2",
  edit: "M4 20h4L18 10l-4-4L4 16v4ZM14 6l4 4",
  file: "M14 3v5h5M7 3h7l5 5v13H7V3Z",
  download: "M12 3v12m0 0 4-4m-4 4-4-4M4 21h16",
  drop: "M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z",
  lungs: "M12 4v8M8 12a4 4 0 0 0-4 4v3a2 2 0 0 0 4 0v-7m8 7a4 4 0 0 1 4 4v3a2 2 0 0 1-4 0v-7",
  baby: "M9 12h.01M15 12h.01M10 16a3 3 0 0 0 4 0M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z",
  star: "m12 3 2.6 5.4L20 9.2l-4 4 1 5.8-5-3-5 3 1-5.8-4-4 5.4-.8L12 3Z",
  vial: "M9 3h6M10 3v13a2 2 0 0 0 4 0V3M10 9h4",
};

interface IconProps { name: string; size?: number; className?: string; strokeWidth?: number; }
export function Icon({ name, size = 20, className, strokeWidth = 1.7 }: IconProps) {
  const d = P[name] ?? P.file;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
