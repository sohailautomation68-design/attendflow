/**
 * Attendance is recorded per LOCAL calendar day. Using UTC would mark the
 * wrong day for schools after midnight UTC. The timezone comes from
 * APP_TIMEZONE (e.g. "Asia/Karachi"). Per-academy timezones are on the roadmap.
 */
const TZ = process.env.APP_TIMEZONE || "UTC";

/** Today's date in the app timezone as YYYY-MM-DD. */
export function todayISO(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
