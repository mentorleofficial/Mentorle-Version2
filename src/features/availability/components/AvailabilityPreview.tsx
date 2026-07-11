import { formatIST } from "@/lib/datetime";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Globe, Eye, Video } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { WeeklySlot, DateOverride, CalendarEvent } from "../api/availability";
import {
  getMonthMatrix,
  getRangesForDate,
  getOverrideKind,
  formatTimeRange,
  getAvailableRangesWithNotice,
  hasAnyAvailability,
  hasAnyAvailabilityWithNotice,
  isSameDay,
  ymd,
} from "../previewUtils";

interface Props {
  slots: WeeklySlot[];
  overrides: DateOverride[];
  timezone: string;
  minNoticeHours?: number;
  bufferTimeMinutes?: number;
  events?: CalendarEvent[];
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DOW_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

export function AvailabilityPreview({
  slots,
  overrides,
  timezone,
  minNoticeHours = 0,
  bufferTimeMinutes = 0,
  events = []
}: Props) {
  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<Date | null>(null);

  // Auto-jump to a newly added override so the change is visible without reloading.
  const seenOverrideIds = useRef<Set<string>>(new Set());
  const initializedOverrides = useRef(false);
  useEffect(() => {
    if (!initializedOverrides.current) {
      initializedOverrides.current = true;
      seenOverrideIds.current = new Set(overrides.map((o) => o.id));
      return;
    }
    const newOnes = overrides.filter((o) => !seenOverrideIds.current.has(o.id));
    if (newOnes.length > 0) {
      const latest = newOnes[newOnes.length - 1];
      const [y, m, d] = latest.date.split("-").map(Number);
      const target = new Date(y, m - 1, d);
      setCursor(new Date(y, m - 1, 1));
      setSelected(target);
    }
    seenOverrideIds.current = new Set(overrides.map((o) => o.id));
  }, [overrides]);

  const matrix = useMemo(
    () => getMonthMatrix(cursor.getFullYear(), cursor.getMonth()),
    [cursor]
  );

  const ranges = selected ? getAvailableRangesWithNotice(selected, slots, overrides, minNoticeHours) : [];
  const timeRanges = formatTimeRange(ranges);
  const selectedKind = selected ? getOverrideKind(selected, overrides) : null;

  const goPrev = () => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
  const goNext = () => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));

  // Helper to fetch events scheduled on a specific date
  const getEventsOnDate = (date: Date) => {
    const key = ymd(date);
    return events.filter((evt) => {
      const hasSessions = evt.sessions && evt.sessions.length > 0;
      if (hasSessions) {
        return evt.sessions.some((s: any) => s.date === key);
      } else {
        const startIST = formatIST(new Date(evt.start_date), "yyyy-MM-dd");
        return startIST === key;
      }
    });
  };

  const selectedEvents = selected ? getEventsOnDate(selected) : [];

  return (
    <Card className="sticky top-20 lg:top-6 z-10">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Preview</CardTitle>
        </div>
        <CardDescription className="flex items-center gap-1.5 text-xs">
          <Globe className="h-3 w-3" />
          How mentees see your calendar · {timezone}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Month nav */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goPrev} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-sm font-medium">
            {MONTH_NAMES[cursor.getMonth()]} {cursor.getFullYear()}
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goNext} aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Day labels */}
        <div className="grid grid-cols-7 gap-1 text-[10px] uppercase tracking-wide text-muted-foreground text-center">
          {DOW_LABELS.map((d, i) => (
            <div key={i}>{d}</div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7 gap-1">
          {matrix.flat().map((date, i) => {
            const inMonth = date.getMonth() === cursor.getMonth();
            const isPast = date < today;
            const kind = getOverrideKind(date, overrides);
            const available = !isPast && hasAnyAvailabilityWithNotice(date, slots, overrides, minNoticeHours);
            const isSelected = selected && isSameDay(date, selected);
            const isToday = isSameDay(date, today);
            const isBlocked = kind === "blocked";
            const isCustom = kind === "custom";
            const dayEvents = getEventsOnDate(date);
            const hasGroupEvent = dayEvents.some((evt) => evt.event_type !== "session");
            const hasSession = dayEvents.some((evt) => evt.event_type === "session");
            const hasEvent = dayEvents.length > 0;
            const clickable = available || isBlocked || hasEvent;

            return (
              <button
                key={i}
                type="button"
                disabled={!clickable && !inMonth}
                onClick={() => clickable && setSelected(date)}
                className={cn(
                  "relative aspect-square rounded-full text-xs flex items-center justify-center transition-colors",
                  !inMonth && "text-muted-foreground/40",
                  inMonth && !available && !isBlocked && !hasEvent && "text-muted-foreground/60 cursor-not-allowed",
                  available && !isCustom && !isSelected && "bg-primary/10 text-primary font-medium hover:bg-primary/20",
                  isCustom && !isSelected && "bg-amber-500/10 text-amber-700 dark:text-amber-400 font-medium ring-2 ring-amber-500/60 hover:bg-amber-500/20",
                  isBlocked && !isSelected && "text-muted-foreground line-through",
                  isSelected && "bg-primary text-primary-foreground font-semibold",
                  isToday && !isSelected && "ring-1 ring-primary/40"
                )}
              >
                {date.getDate()}
                <div className="absolute bottom-0.5 left-0 right-0 flex justify-center gap-0.5">
                  {isBlocked && (
                    <span className="h-1 w-1 rounded-full bg-destructive" />
                  )}
                  {hasGroupEvent && (
                    <span className="h-1 w-1 rounded-full bg-purple-600" />
                  )}
                  {hasSession && (
                    <span className="h-1 w-1 rounded-full bg-blue-600" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-primary/40" /> Available
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full ring-2 ring-amber-500/60" /> Custom
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-destructive" /> Blocked
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-purple-600" /> Event
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-blue-600" /> Session
          </span>
        </div>

        {/* Slot list */}
        <div className="border-t pt-3">
          {!selected && (
            <p className="text-xs text-muted-foreground text-center py-4">
              Select a highlighted date to see available times.
            </p>
          )}
          {selected && (
            <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
              <div className="text-xs font-medium">
                {formatIST(selected, "EEEE, MMM d")}
              </div>
              {selectedKind === "blocked" && (
                <Badge variant="destructive" className="text-[10px]">Blocked</Badge>
              )}
              {selectedKind === "custom" && (
                <Badge className="text-[10px] bg-amber-500 hover:bg-amber-500 text-white">Custom hours</Badge>
              )}
            </div>
          )}
          {selected && timeRanges.length === 0 && selectedEvents.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">
              {selectedKind === "blocked"
                ? "Marked unavailable on this date."
                : minNoticeHours > 0 && isSameDay(selected, new Date())
                  ? `No available slots (minimum ${minNoticeHours}h notice required).`
                  : "No availability on this day."}
            </p>
          )}
          {selected && timeRanges.length > 0 && (
            <div className="space-y-2">
              {timeRanges.map((range, idx) => (
                <div
                  key={idx}
                  className="text-sm text-center py-2.5 rounded border border-primary/30 text-primary bg-primary/5 hover:bg-primary/10 transition-colors font-medium"
                >
                  {range}
                </div>
              ))}
            </div>
          )}

          {/* Events on this day list */}
          {selected && selectedEvents.length > 0 && (
            <div className="mt-4 border-t pt-4 space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Events on this day
              </h4>
              <div className="space-y-2">
                {selectedEvents.map((evt) => {
                  const isMulti = evt.sessions && evt.sessions.length > 0;
                  const session = isMulti ? evt.sessions.find((s: any) => s.date === ymd(selected)) : null;
                  const formatTime12Hour = (timeStr: string) => {
                    if (!timeStr) return "";
                    const [h, m] = timeStr.split(":");
                    const hr = parseInt(h, 10);
                    const pm = hr >= 12 ? "PM" : "AM";
                    return `${hr % 12 || 12}:${m} ${pm}`;
                  };
                  const timeLabel = isMulti && session
                    ? `${formatTime12Hour(session.start_time)} - ${formatTime12Hour(session.end_time)}`
                    : `${formatIST(new Date(evt.start_date), "h:mm a")} - ${formatIST(new Date(evt.end_date), "h:mm a")}`;

                  const isSession = evt.event_type === "session";

                  return (
                    <div
                      key={evt.id}
                      className={cn(
                        "p-3 rounded-lg border text-sm space-y-1",
                        isSession
                          ? "border-blue-100 bg-blue-500/5 text-blue-950 dark:bg-blue-950/20 dark:border-blue-900/50"
                          : "border-purple-100 bg-purple-500/5 text-purple-950 dark:bg-purple-950/20 dark:border-purple-900/50"
                      )}
                    >
                      <div
                        className={cn(
                          "font-semibold flex items-center gap-1.5",
                          isSession ? "text-blue-900 dark:text-blue-300" : "text-purple-900 dark:text-purple-300"
                        )}
                      >
                        <Video className={cn("h-3.5 w-3.5 shrink-0", isSession ? "text-blue-600" : "text-purple-600")} />
                        <span className="truncate">{evt.title}</span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1">{evt.description}</p>
                      <div
                        className={cn(
                          "text-[10px] font-semibold flex items-center justify-between pt-1",
                          isSession ? "text-blue-700 dark:text-blue-400" : "text-purple-700 dark:text-purple-400"
                        )}
                      >
                        <span>{timeLabel}</span>
                        <span
                          className={cn(
                            "uppercase tracking-wider px-1.5 py-0.5 rounded text-[8px]",
                            isSession
                              ? "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400"
                              : "bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-400"
                          )}
                        >
                          {evt.event_type?.replace("_", " ")}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
