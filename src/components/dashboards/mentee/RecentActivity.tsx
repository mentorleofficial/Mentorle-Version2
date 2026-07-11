import { formatISTDate } from "@/lib/datetime";
import { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, CalendarPlus, CheckCircle2, XCircle, Star } from "lucide-react";
import type { DashSession, DashFeedback } from "@/features/mentee-dashboard/useMenteeDashboardData";
interface Props {
  sessions: DashSession[];
  feedback: DashFeedback[];
}

type Event = {
  ts: number;
  icon: typeof Activity;
  text: string;
  tone: "default" | "good" | "bad" | "info";
};

const relTime = (ms: number) => {
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${Math.max(1, m)}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return formatISTDate(ms);
};

const RecentActivity = ({ sessions, feedback }: Props) => {
  const events: Event[] = [];
  sessions.forEach((s) => {
    const name = s.mentor?.full_name || "mentor";
    if (s.status === "cancelled" && s.cancelled_at) {
      events.push({
        ts: new Date(s.cancelled_at).getTime(),
        icon: XCircle,
        text: `Cancelled session with ${name}`,
        tone: "bad",
      });
    } else if (s.status === "completed") {
      events.push({
        ts: new Date(s.scheduled_at).getTime() + s.duration_minutes * 60000,
        icon: CheckCircle2,
        text: `Completed session with ${name}`,
        tone: "good",
      });
    } else if (s.status === "booked") {
      events.push({
        ts: new Date(s.scheduled_at).getTime(),
        icon: CalendarPlus,
        text: `Booked session with ${name}`,
        tone: "info",
      });
    }
  });
  feedback.forEach((f) => {
    events.push({
      ts: new Date(f.created_at).getTime(),
      icon: Star,
      text: `You rated a session ${f.rating}★`,
      tone: "default",
    });
  });

  const recent = events.sort((a, b) => b.ts - a.ts).slice(0, 6);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <Activity className="h-5 w-5 text-primary" />
        <CardTitle className="text-lg">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <ul className="space-y-3">
            {recent.map((e, i) => (
              <li key={i} className="flex items-center gap-3 text-sm">
                <e.icon
                  className={
                    "h-4 w-4 " +
                    (e.tone === "good"
                      ? "text-emerald-500"
                      : e.tone === "bad"
                      ? "text-destructive"
                      : "text-primary")
                  }
                />
                <span className="flex-1 truncate">{e.text}</span>
                <span className="text-xs text-muted-foreground">{relTime(e.ts)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export default /* @__PURE__ */ memo(RecentActivity);
