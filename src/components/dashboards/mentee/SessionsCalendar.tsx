import { formatISTDate, formatISTTime } from "@/lib/datetime";
import { memo, useMemo, useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays } from "lucide-react";
import type { DashSession } from "@/features/mentee-dashboard/useMenteeDashboardData";
import { cn } from "@/lib/utils";
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const SessionsCalendar = ({ sessions }: { sessions: DashSession[] }) => {
  const [selected, setSelected] = useState<Date | undefined>(new Date());

  const sessionDays = useMemo(
    () => sessions.filter((s) => s.status !== "cancelled").map((s) => new Date(s.scheduled_at)),
    [sessions]
  );

  const daysSessions = useMemo(() => {
    if (!selected) return [];
    return sessions
      .filter((s) => s.status !== "cancelled" && sameDay(new Date(s.scheduled_at), selected))
      .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  }, [sessions, selected]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <CalendarDays className="h-5 w-5 text-primary" />
        <CardTitle className="text-lg">Your Calendar</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 lg:flex-row">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={setSelected}
          modifiers={{ hasSession: sessionDays }}
          modifiersClassNames={{
            hasSession:
              "relative after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-primary",
          }}
          className={cn("p-3 pointer-events-auto rounded-md border")}
        />
        <div className="flex-1 min-w-0">
          <div className="mb-2 text-sm font-medium">
            {selected
              ? formatISTDate(selected)
              : "Pick a day"}
          </div>
          {daysSessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sessions on this day.</p>
          ) : (
            <ul className="space-y-2">
              {daysSessions.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between rounded-md border bg-card/50 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {s.mentor?.full_name || "Mentor"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatISTTime(s.scheduled_at)}{" "}
                      · {s.duration_minutes}m
                    </div>
                  </div>
                  <Badge variant={s.status === "booked" ? "default" : "secondary"}>
                    {s.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default /* @__PURE__ */ memo(SessionsCalendar);
