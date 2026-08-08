export const TZ = "Asia/Jerusalem";

export function israelToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function israelNowParts() {
  const [y, m, d] = israelToday().split("-").map(Number);
  return { year: y!, month: m!, day: d! };
}

/** ISO date string (YYYY-MM-DD) for a given y/m/d */
export function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export const HE_MONTHS = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
];

export const HE_WEEKDAYS_SHORT = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

export function formatHeDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function formatHeDateTime(ts: string | null | undefined): string {
  if (!ts) return "—";
  const dt = new Date(ts);
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(dt);
}

export function formatHeTime(ts: string | null | undefined): string {
  if (!ts) return "—";
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ts));
}

/** "08:00:00" -> "08:00" */
export function trimTime(t: string | null | undefined): string {
  if (!t) return "—";
  return t.slice(0, 5);
}

export function durationHours(start?: string | null, end?: string | null): number {
  if (!start || !end) return 0;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return ms > 0 ? ms / 3600000 : 0;
}

export function formatDuration(hours: number): string {
  const total = Math.round(hours * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} דק׳`;
  if (m === 0) return `${h} שע׳`;
  return `${h} שע׳ ${m} דק׳`;
}

export function monthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function monthRange(year: number, month: number) {
  const start = isoDate(year, month, 1);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { start, end: isoDate(year, month, lastDay), lastDay };
}

/** weekday index (0=Sunday) of the 1st of the month */
export function firstWeekday(year: number, month: number) {
  return new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
}

export function isValidIsraeliPhone(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  return /^0(5\d|[2-4]|8|9|7\d)\d{7}$/.test(digits);
}

export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "");
}
