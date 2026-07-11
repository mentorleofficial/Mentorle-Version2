// Lightweight IST-aware relative time labels for session lists.
// Anchors on calendar day (in IST) for "Today / Tomorrow / Yesterday",
// uses hours/minutes when close, otherwise falls back to "in N days".
import { APP_TZ, formatIST, formatISTISODate } from "./datetime";

type DateInput = Date | string | number;

const toDate = (d: DateInput): Date => (d instanceof Date ? d : new Date(d));

/** "in 2 hours" / "tomorrow at 6:30 PM IST" / "yesterday" / "3 days ago" */
export function relativeIST(d: DateInput, ref: Date = new Date()): string {
  const date = toDate(d);
  const diffMs = date.getTime() - ref.getTime();
  const absMin = Math.abs(diffMs) / 60_000;
  const future = diffMs >= 0;

  if (absMin < 1) return "just now";
  if (absMin < 60) {
    const m = Math.round(absMin);
    return future ? `in ${m} min` : `${m} min ago`;
  }
  if (absMin < 60 * 6) {
    const h = Math.round(absMin / 60);
    return future ? `in ${h} hour${h === 1 ? "" : "s"}` : `${h} hour${h === 1 ? "" : "s"} ago`;
  }

  const today = formatISTISODate(ref);
  const target = formatISTISODate(date);
  if (today === target) return future ? "today" : "earlier today";

  // Compute day diff using IST calendar dates
  const toDays = (iso: string) => {
    const [y, m, dd] = iso.split("-").map(Number);
    return Date.UTC(y, m - 1, dd) / 86_400_000;
  };
  const dayDiff = toDays(target) - toDays(today);
  if (dayDiff === 1) return "tomorrow";
  if (dayDiff === -1) return "yesterday";
  if (dayDiff > 1 && dayDiff < 7) return `in ${dayDiff} days`;
  if (dayDiff < -1 && dayDiff > -7) return `${-dayDiff} days ago`;

  return formatIST(date, "d MMM");
}

/** Group key for an upcoming session: today / week / later. */
export function upcomingGroup(d: DateInput, ref: Date = new Date()): "today" | "week" | "later" {
  const today = formatISTISODate(ref);
  const target = formatISTISODate(toDate(d));
  if (today === target) return "today";
  const toDays = (iso: string) => {
    const [y, m, dd] = iso.split("-").map(Number);
    return Date.UTC(y, m - 1, dd) / 86_400_000;
  };
  const diff = toDays(target) - toDays(today);
  if (diff > 0 && diff <= 7) return "week";
  return "later";
}

/** Month-year key for past session grouping, e.g. "May 2026". */
export function monthYearIST(d: DateInput): string {
  return formatIST(toDate(d), "LLLL yyyy");
}

export { APP_TZ };
