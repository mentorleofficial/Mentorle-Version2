// Centralized IST (Asia/Kolkata) formatters.
// All user-visible dates/times across the app must go through these helpers.
import { formatInTimeZone } from "date-fns-tz";

export const APP_TZ = "Asia/Kolkata";
export const APP_TZ_LABEL = "IST";

type DateInput = Date | string | number;

const toDate = (d: DateInput): Date => (d instanceof Date ? d : new Date(d));

export function formatIST(d: DateInput, pattern: string): string {
  return formatInTimeZone(toDate(d), APP_TZ, pattern);
}

/** e.g. "16 May 2026" */
export function formatISTDate(d: DateInput): string {
  return formatIST(d, "d MMM yyyy");
}

/** e.g. "6:30 PM IST" */
export function formatISTTime(d: DateInput): string {
  return `${formatIST(d, "h:mm a")} ${APP_TZ_LABEL}`;
}

/** e.g. "16 May 2026, 6:30 PM IST" */
export function formatISTDateTime(d: DateInput): string {
  return `${formatIST(d, "d MMM yyyy, h:mm a")} ${APP_TZ_LABEL}`;
}

/** e.g. "Sat, 16 May, 6:30 PM IST" — compact for cards */
export function formatISTShort(d: DateInput): string {
  return `${formatIST(d, "EEE, d MMM, h:mm a")} ${APP_TZ_LABEL}`;
}

/** e.g. "16/05/2026" */
export function formatISTNumericDate(d: DateInput): string {
  return formatIST(d, "dd/MM/yyyy");
}

/** Day-of-week 0-6 (Sun-Sat) in IST */
export function istDayOfWeek(d: DateInput): number {
  return Number(formatIST(d, "i")) % 7; // date-fns "i" is 1-7 (Mon-Sun)
}

/** YYYY-MM-DD in IST */
export function formatISTISODate(d: DateInput): string {
  return formatIST(d, "yyyy-MM-dd");
}
