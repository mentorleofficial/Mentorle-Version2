import { useMemo, useRef, useState } from "react";
import { formatISTDate, formatISTDateTime, formatIST } from "@/lib/datetime";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarRange, ChevronLeft, ChevronRight, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MentorDashSession } from "@/features/mentor-dashboard/useMentorDashboardData";

const WEEKS_TO_SHOW = 12;

const dayLabel = (d: Date) => formatIST(d, "EEE");

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const WeeklySchedule = ({ sessions }: { sessions: MentorDashSession[] }) => {
  const today = useMemo(() => startOfDay(new Date()), []);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selectedDate, setSelectedDate] = useState(today);
  const [visibleWeekIndex, setVisibleWeekIndex] = useState(0);

  const weeks = useMemo(
    () =>
      Array.from({ length: WEEKS_TO_SHOW }, (_, weekIdx) =>
        Array.from({ length: 7 }, (_, dayIdx) => {
          const d = new Date(today);
          d.setDate(today.getDate() + weekIdx * 7 + dayIdx);
          return d;
        })
      ),
    [today]
  );

  const sessionsByDate = useMemo(() => {
    const map = new Map<string, MentorDashSession[]>();
    sessions
      .filter((s) => s.status === "booked")
      .forEach((s) => {
        const key = startOfDay(new Date(s.scheduled_at)).toISOString();
        const list = map.get(key) ?? [];
        list.push(s);
        map.set(key, list);
      });
    map.forEach((list) => list.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)));
    return map;
  }, [sessions]);

  const selectedDaySessions = useMemo(() => {
    const key = startOfDay(selectedDate).toISOString();
    return sessionsByDate.get(key) ?? [];
  }, [sessionsByDate, selectedDate]);

  const visibleWeek = weeks[visibleWeekIndex];
  const weekRangeLabel =
    visibleWeek &&
    `${formatISTDate(visibleWeek[0])} – ${formatISTDate(visibleWeek[6])}`;

  const scrollToWeek = (index: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const next = Math.max(0, Math.min(index, weeks.length - 1));
    const width = el.clientWidth;
    el.scrollTo({ left: next * width, behavior: "smooth" });
    setVisibleWeekIndex(next);
  };

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el || el.clientWidth === 0) return;
    const index = Math.round(el.scrollLeft / el.clientWidth);
    if (index !== visibleWeekIndex) setVisibleWeekIndex(index);
  };

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <CalendarRange className="h-5 w-5 text-primary shrink-0" />
          <div className="min-w-0">
            <CardTitle className="text-lg">Next 7 Days</CardTitle>
            {weekRangeLabel && (
              <p className="text-xs text-muted-foreground truncate">{weekRangeLabel}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={visibleWeekIndex === 0}
            onClick={() => scrollToWeek(visibleWeekIndex - 1)}
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={visibleWeekIndex >= weeks.length - 1}
            onClick={() => scrollToWeek(visibleWeekIndex + 1)}
            aria-label="Next week"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth scrollbar-none -mx-1 px-1"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {weeks.map((weekDays, weekIdx) => (
            <div
              key={weekIdx}
              className="min-w-full shrink-0 snap-center"
            >
              <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {weekDays.map((d) => {
                  const key = startOfDay(d).toISOString();
                  const items = sessionsByDate.get(key) ?? [];
                  const isToday = isSameDay(d, today);
                  const isSelected = isSameDay(d, selectedDate);

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedDate(d)}
                      className={cn(
                        "rounded-md border p-1 sm:p-2 text-center transition-all hover:border-primary/50 active:scale-[0.98] min-w-0 flex flex-col items-center justify-center",
                        isSelected
                          ? "border-primary bg-primary/10 shadow-sm"
                          : isToday
                            ? "border-primary/50 bg-primary/5"
                            : "bg-card/50 hover:bg-card"
                      )}
                    >
                      <div className="text-[9px] sm:text-[10px] uppercase tracking-wide text-muted-foreground truncate w-full">
                        {dayLabel(d)}
                      </div>
                      <div className="text-sm sm:text-lg font-semibold">{d.getDate()}</div>
                      <div className="mt-0.5 sm:mt-1 text-[8px] sm:text-xs font-medium text-primary truncate w-full">
                        {items.length > 0
                          ? `${items.length} s`
                          : "—"}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          Swipe or use arrows to browse upcoming weeks
        </p>

        {/* Selected Day Sessions */}
        <div className="mt-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">
              Sessions on {formatISTDate(selectedDate)}
            </h3>
            <span className="text-xs text-muted-foreground">
              {selectedDaySessions.length} session{selectedDaySessions.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="space-y-3">
            {selectedDaySessions.length > 0 ? (
              selectedDaySessions.map((s) => {
                const start = new Date(s.scheduled_at);
                const isUpcoming = start.getTime() > Date.now();

                return (
                  <div
                    key={s.id}
                    className="group rounded-xl border bg-card p-3.5 hover:border-primary/60 hover:shadow-sm transition-all duration-200"
                  >
                    <div className="flex gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="font-semibold text-sm truncate">
                            {s.mentee?.full_name || "Mentee"}
                          </div>
                          {(s.title || s.topic) && (
                            <>
                              <span className="text-muted-foreground">•</span>
                              <div className="text-sm font-semibold text-primary mt-1 truncate">
                                {s.title || s.topic}
                              </div>
                            </>
                          )}
                        </div>
                        <div className="mt-2.5 flex items-center gap-2">
                          <div className="font-semibold text-base tracking-tight text-foreground">
                            {formatISTDateTime(start)}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end justify-between py-0.5 gap-2">
                        {isUpcoming && s.meeting_url && (
                          <a
                            href={s.meeting_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors whitespace-nowrap"
                          >
                            <Video className="h-3.5 w-3.5" />
                            Join
                          </a>
                        )}
                        <div className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground">
                          {s.status}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground py-10 text-center border rounded-lg bg-card/50">
                No sessions booked on this day.
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default WeeklySchedule;
