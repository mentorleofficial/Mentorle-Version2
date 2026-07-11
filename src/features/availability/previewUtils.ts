import { normalizeHHMM, toMinutes } from "./timeUtils";

export type Range = { start_time: string; end_time: string };
export type WeeklySlotLike = { day_of_week: number; start_time: string; end_time: string };
export type OverrideLike = {
  date: string; // YYYY-MM-DD
  is_unavailable: boolean;
  start_time: string | null;
  end_time: string | null;
};

export function ymd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function getMonthMatrix(year: number, month: number): Date[][] {
  // Sunday-first 6x7 grid
  const first = new Date(year, month, 1);
  const startDow = first.getDay();
  const start = new Date(year, month, 1 - startDow);
  const weeks: Date[][] = [];
  for (let w = 0; w < 6; w++) {
    const row: Date[] = [];
    for (let d = 0; d < 7; d++) {
      row.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + d));
    }
    weeks.push(row);
  }
  return weeks;
}

export type OverrideKind = "blocked" | "custom" | null;

export function getOverrideKind(date: Date, overrides: OverrideLike[]): OverrideKind {
  const key = ymd(date);
  const day = overrides.filter((o) => o.date === key);
  if (day.length === 0) return null;
  if (day.some((o) => o.is_unavailable)) return "blocked";
  return "custom";
}

export function getRangesForDate(
  date: Date,
  weekly: WeeklySlotLike[],
  overrides: OverrideLike[]
): Range[] {
  const key = ymd(date);
  const dayOverrides = overrides.filter((o) => o.date === key);
  if (dayOverrides.length > 0) {
    if (dayOverrides.some((o) => o.is_unavailable)) return [];
    return dayOverrides
      .filter((o) => o.start_time && o.end_time)
      .map((o) => ({
        start_time: normalizeHHMM(o.start_time as string),
        end_time: normalizeHHMM(o.end_time as string),
      }));
  }
  const dow = date.getDay();
  return weekly
    .filter((s) => s.day_of_week === dow)
    .map((s) => ({
      start_time: normalizeHHMM(s.start_time),
      end_time: normalizeHHMM(s.end_time),
    }));
}

export function sliceIntoSlots(ranges: Range[], stepMinutes = 30): string[] {
  const out: string[] = [];
  for (const r of ranges) {
    const start = toMinutes(r.start_time);
    const end = toMinutes(r.end_time);
    for (let t = start; t + stepMinutes <= end; t += stepMinutes) {
      const h = Math.floor(t / 60);
      const m = t % 60;
      out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return Array.from(new Set(out)).sort();
}

export function formatSlotLabel(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

export function formatTimeRange(ranges: Range[]): string[] {
  return ranges.map((r) => {
    const startLabel = formatSlotLabel(r.start_time);
    const endLabel = formatSlotLabel(r.end_time);
    return `${startLabel} – ${endLabel}`;
  });
}

export function getAvailableRangesWithNotice(
  date: Date,
  weekly: WeeklySlotLike[],
  overrides: OverrideLike[],
  minNoticeHours: number = 0,
  bufferTimeMinutes: number = 0
): Range[] {
  const ranges = getRangesForDate(date, weekly, overrides);
  if (ranges.length === 0) return [];

  // If no minimum notice, return as-is
  if (minNoticeHours === 0) return ranges;

  // Calculate the cutoff time based on minimum notice
  const now = new Date();
  const cutoffTime = new Date(now.getTime() + minNoticeHours * 60 * 60 * 1000);

  // Check if the selected date is today
  const isToday = isSameDay(date, new Date());

  if (!isToday) {
    // For future dates, all ranges are available
    return ranges;
  }

  // For today, filter out ranges that are before the cutoff time
  const cutoffMinutes = cutoffTime.getHours() * 60 + cutoffTime.getMinutes();

  return ranges.map((r) => {
    const startMinutes = toMinutes(r.start_time);
    const endMinutes = toMinutes(r.end_time);

    // If the entire range is before the cutoff, it's not available
    if (endMinutes <= cutoffMinutes) {
      return null;
    }

    // If the range starts before the cutoff, trim it
    if (startMinutes < cutoffMinutes) {
      const newStartMinutes = cutoffMinutes;
      const h = Math.floor(newStartMinutes / 60);
      const m = newStartMinutes % 60;
      return {
        start_time: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
        end_time: r.end_time,
      };
    }

    return r;
  }).filter((r) => r !== null) as Range[];
}

export function hasAnyAvailability(
  date: Date,
  weekly: WeeklySlotLike[],
  overrides: OverrideLike[]
): boolean {
  return getRangesForDate(date, weekly, overrides).length > 0;
}

export function hasAnyAvailabilityWithNotice(
  date: Date,
  weekly: WeeklySlotLike[],
  overrides: OverrideLike[],
  minNoticeHours: number = 0
): boolean {
  return getAvailableRangesWithNotice(date, weekly, overrides, minNoticeHours).length > 0;
}
