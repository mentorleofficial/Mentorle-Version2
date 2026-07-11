import { formatISTDateTime } from "@/lib/datetime";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Video, ExternalLink, CalendarDays } from "lucide-react";
import { Link } from "react-router-dom";
import AddToCalendarMenu from "@/components/AddToCalendarMenu";
import type { DashSession } from "@/features/mentee-dashboard/useMenteeDashboardData";
import { memo, useEffect, useState } from "react";
const fmtCountdown = (ms: number) => {
  if (ms <= 0) return "Starting now";
  const m = Math.floor(ms / 60000);
  const d = Math.floor(m / (60 * 24));
  const h = Math.floor((m % (60 * 24)) / 60);
  const min = m % 60;
  if (d > 0) return `in ${d}d ${h}h`;
  if (h > 0) return `in ${h}h ${min}m`;
  return `in ${min}m`;
};

const NextSessionCard = ({ session }: { session: DashSession | null }) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(i);
  }, []);

  if (!session) {
    return (
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <CardContent className="flex flex-col gap-4 py-6">
          <h3 className="text-2xl font-semibold border-b border-primary/10 pb-3" style={{ fontFamily: "var(--font-serif)" }}>
            Upcoming Session
          </h3>
          <div className="flex flex-col items-start gap-3 md:flex-row md:items-center md:justify-between pt-1">
            <div>
              <h3 className="text-lg font-semibold" style={{ fontFamily: "var(--font-serif)" }}>
                No upcoming session
              </h3>
              <p className="text-sm text-muted-foreground">Browse mentors and book your next conversation.</p>
            </div>
            <Button asChild>
              <Link to="/mentors">Find a Mentor</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const start = new Date(session.scheduled_at);
  const initials = (session.mentor?.full_name || "M")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/10 via-background to-accent/5">
      <CardContent className="flex flex-col gap-4 py-6">
        <h3 className="text-2xl font-semibold border-b border-primary/10 pb-3" style={{ fontFamily: "var(--font-serif)" }}>
          Upcoming Session
        </h3>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between pt-1">
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14">
              <AvatarImage src={session.mentor?.avatar_url ?? undefined} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div>
              <div className="text-xs uppercase tracking-wide text-primary">{session.title}</div>
              <h3 className="text-xl font-semibold" style={{ fontFamily: "var(--font-serif)" }}>
                {session.mentor?.full_name || "Your mentor"}
              </h3>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <CalendarDays className="h-4 w-4" />
                <span>{formatISTDateTime(start)}</span>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  {fmtCountdown(start.getTime() - now)}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {session.meeting_url ? (
              <Button asChild>
                <a href={session.meeting_url} target="_blank" rel="noreferrer">
                  <Video className="mr-2 h-4 w-4" /> Join
                </a>
              </Button>
            ) : (
              <Button variant="outline" disabled>
                <Video className="mr-2 h-4 w-4" /> Link pending
              </Button>
            )}
            <AddToCalendarMenu
              event={{
                title: `Mentorship with ${session.mentor?.full_name || "mentor"}`,
                startISO: session.scheduled_at,
                durationMinutes: session.duration_minutes,
                description: session.meeting_url ? `Join: ${session.meeting_url}` : "",
              }}
            />
            <Button variant="ghost" size="sm" asChild>
              <Link to="/mentee/sessions">
                <ExternalLink className="mr-1 h-3 w-3" /> All sessions
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default /* @__PURE__ */ memo(NextSessionCard);
