import { formatISTDateTime } from "@/lib/datetime";
// Helpers for "Add to Calendar" — universal .ics download and Google Calendar quick-add link.
export interface CalendarEventInput {
  title: string;
  description?: string;
  location?: string;
  startISO: string; // ISO 8601 UTC timestamp
  durationMinutes: number;
}

const toCalDate = (iso: string) => {
  // YYYYMMDDTHHMMSSZ (UTC)
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
};

const addMinutes = (iso: string, minutes: number) =>
  new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();

const escapeIcs = (s: string) =>
  s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");

export function buildIcsContent(e: CalendarEventInput): string {
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}@mentorle`;
  const dtStart = toCalDate(e.startISO);
  const dtEnd = toCalDate(addMinutes(e.startISO, e.durationMinutes));
  const dtStamp = toCalDate(new Date().toISOString());
  const istLine = `Scheduled: ${formatISTDateTime(e.startISO)}`;
  const fullDescription = e.description ? `${istLine}\n\n${e.description}` : istLine;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Mentorle//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeIcs(e.title)}`,
    `DESCRIPTION:${escapeIcs(fullDescription)}`,
    e.location ? `LOCATION:${escapeIcs(e.location)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return lines.join("\r\n");
}

export function downloadIcs(e: CalendarEventInput, filename = "session.ics") {
  const blob = new Blob([buildIcsContent(e)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function buildGoogleCalendarUrl(e: CalendarEventInput): string {
  const istLine = `Scheduled: ${formatISTDateTime(e.startISO)}`;
  const details = e.description ? `${istLine}\n\n${e.description}` : istLine;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${toCalDate(e.startISO)}/${toCalDate(addMinutes(e.startISO, e.durationMinutes))}`,
    details,
  });
  if (e.location) params.set("location", e.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
