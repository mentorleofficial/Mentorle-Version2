import { useState } from "react";
import { formatISTDate, formatIST } from "@/lib/datetime";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarRange, ChevronLeft, ChevronRight, Clock, User } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { AdminSessionRow } from "@/features/admin/hooks/useAdminSessions";

const dayLabel = (d: Date) => formatISTDate(d).split(',')[0]; // e.g. "Mon"

const WeekSchedule = ({ sessions }: { sessions: AdminSessionRow[] }) => {
  const navigate = useNavigate();
  const now = new Date();
  const [weekStart, setWeekStart] = useState<Date>(() => {
    const d = new Date(now);
    d.setDate(d.getDate() - d.getDay()); // Start from Monday (adjust if you want Sunday)
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  const buckets = days.map((d) => {
    const next = new Date(d);
    next.setDate(d.getDate() + 1);
    const list = sessions.filter((s) => {
      if (s.status !== "booked") return false;
      const t = new Date(s.scheduled_at).getTime();
      return t >= d.getTime() && t < next.getTime();
    });
    const mentors = new Set(list.map((s) => s.mentor_id)).size;
    return { count: list.length, mentors, sessions: list };
  });

  const totalWeek = buckets.reduce((a, b) => a + b.count, 0);
  const todayIndex = days.findIndex(d =>
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );

  const selectedBucket = selectedDate
    ? buckets[days.findIndex(d =>
      d.getDate() === selectedDate.getDate() &&
      d.getMonth() === selectedDate.getMonth() &&
      d.getFullYear() === selectedDate.getFullYear()
    )]
    : null;

  const goToPreviousWeek = () => {
    setWeekStart(prev => {
      const newDate = new Date(prev);
      newDate.setDate(prev.getDate() - 7);
      return newDate;
    });
    setSelectedDate(null);
  };

  const goToNextWeek = () => {
    setWeekStart(prev => {
      const newDate = new Date(prev);
      newDate.setDate(prev.getDate() + 7);
      return newDate;
    });
    setSelectedDate(null);
  };

  const goToCurrentWeek = () => {
    const d = new Date(now);
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    setWeekStart(d);
    setSelectedDate(null);
  };

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <CalendarRange className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Schedule</CardTitle>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
            <Link to="/admin/sessions">View all</Link>
          </Button>
          <Button variant="outline" size="icon" onClick={goToPreviousWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Button variant="ghost" size="sm" onClick={goToCurrentWeek} className="text-xs font-medium">
            This Week
          </Button>

          <Button variant="outline" size="icon" onClick={goToNextWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Week Grid */}
        <div className="grid grid-cols-7 gap-2">
          {days.map((d, i) => {
            const b = buckets[i];
            const isToday = i === todayIndex;
            const isSelected = selectedDate &&
              d.getDate() === selectedDate.getDate() &&
              d.getMonth() === selectedDate.getMonth() &&
              d.getFullYear() === selectedDate.getFullYear();

            return (
              <div
                key={i}
                onClick={() => setSelectedDate(d)}
                className={`
                  rounded-md border p-3 text-center cursor-pointer transition-all hover:border-primary/50 hover:bg-primary/5 active:scale-[0.985]
                  ${isToday ? "border-primary/60 bg-primary/5" : "border-border bg-card/50"}
                  ${isSelected ? "border-primary bg-primary/10 ring-1 ring-primary/30" : ""}
                `}
              >
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {dayLabel(d)}
                </div>
                <div className="text-xl font-semibold mt-0.5">{d.getDate()}</div>

                <div className="mt-2 text-sm font-semibold text-primary">
                  {b.count > 0 ? `${b.count} sessions` : "—"}
                </div>

                {b.mentors > 0 && (
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {b.mentors} mentor{b.mentors > 1 ? "s" : ""}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Selected Day Sessions */}
        {selectedDate && selectedBucket && (
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">
                Sessions on {formatISTDate(selectedDate)}
              </h3>
              <Badge variant="outline">{selectedBucket.count} Booked</Badge>
            </div>

            {selectedBucket.count === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No sessions booked on this day.
              </p>
            ) : (
              <div className="space-y-3">
                {selectedBucket.sessions.map((session) => (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => navigate("/admin/sessions")}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg border p-4 text-left transition-colors",
                      "hover:border-primary/40 hover:bg-muted/50 cursor-pointer"
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{session.mentee?.full_name || "Mentee"}</p>
                        <p className="text-sm text-muted-foreground">
                          with {session.mentor?.full_name || "Mentor"}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="flex items-center gap-1.5 justify-end text-sm">
                        <Clock className="h-4 w-4" />
                        {formatIST(new Date(session.scheduled_at), "h:mm a")}
                      </div>
                      {session.duration_minutes && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {session.duration_minutes} min
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {!selectedDate && (
          <div className="text-center text-xs text-muted-foreground py-4">
            Click on any day to view session details
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WeekSchedule;