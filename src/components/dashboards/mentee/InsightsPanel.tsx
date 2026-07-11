import { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sparkles, MessageSquareWarning, FolderKanban, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import type { DashSession, DashFeedback } from "@/features/mentee-dashboard/useMenteeDashboardData";

interface Props {
  sessions: DashSession[];
  feedback: DashFeedback[];
  programsCount: number;
  upcomingEvents?: any[];
}

const InsightsPanel = ({ sessions, feedback, programsCount, upcomingEvents }: Props) => {
  // Top mentor by booking count
  const counts = new Map<string, { count: number; name: string; avatar: string | null }>();
  sessions.forEach((s) => {
    if (!s.mentor) return;
    const cur = counts.get(s.mentor_id) ?? {
      count: 0,
      name: s.mentor.full_name,
      avatar: s.mentor.avatar_url,
    };
    cur.count += 1;
    counts.set(s.mentor_id, cur);
  });
  const top = Array.from(counts.values()).sort((a, b) => b.count - a.count)[0];

  // Pending feedback: completed sessions in past, no feedback
  const ratedIds = new Set(feedback.map((f) => f.session_id));
  const pendingFeedback = sessions.filter(
    (s) => s.status === "completed" && !ratedIds.has(s.id)
  ).length;

  // Gap warning
  const now = Date.now();
  const next14 = sessions.filter(
    (s) => s.status === "booked" && new Date(s.scheduled_at).getTime() > now &&
      new Date(s.scheduled_at).getTime() < now + 14 * 24 * 3600 * 1000
  ).length;

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <CardTitle className="text-lg">Highlights</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {top ? (
          <div className="rounded-md border bg-card/50 p-3">
            <Link
              to={`/book/${[...counts.entries()].find(([_, v]) => v.name === top.name)?.[0]}`}
              className="flex items-center gap-3"
            >
              <Avatar className="h-10 w-10">
                <AvatarImage src={top.avatar ?? undefined} />
                <AvatarFallback>
                  {top.name
                    .split(" ")
                    .map((p) => p[0])
                    .join("")
                    .slice(0, 2)}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Top mentor
                </div>
                <div className="truncate text-sm font-semibold">{top.name}</div>
                <div className="text-xs text-muted-foreground">
                  {top.count} session{top.count > 1 ? "s" : ""}
                </div>
              </div>
            </Link>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No mentor history yet.</p>
        )}

        {upcomingEvents && upcomingEvents.length > 0 && (
          <div className="flex items-start gap-3 rounded-md border border-primary/20 bg-primary/5 p-3">
            <Sparkles className="mt-0.5 h-4 w-4 text-primary" />
            <div className="flex-1">
              <div className="text-sm font-semibold">Registered Events ({upcomingEvents.length})</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Next event: {upcomingEvents[0].title}
              </div>
              <Button asChild variant="link" className="h-auto p-0 text-xs mt-1.5 font-bold text-primary">
                <Link to="/mentee/events">Go to my events</Link>
              </Button>
            </div>
          </div>
        )}

        {pendingFeedback > 0 && (
          <div className="flex items-start gap-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
            <MessageSquareWarning className="mt-0.5 h-4 w-4 text-amber-500" />
            <div className="flex-1">
              <div className="text-sm font-medium">{pendingFeedback} session{pendingFeedback > 1 ? "s need" : " needs"} feedback</div>
              <Button asChild variant="link" className="h-auto p-0 text-xs">
                <Link to="/mentee/sessions">Leave feedback</Link>
              </Button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between rounded-md border bg-card/50 p-3">
          <div className="flex items-center gap-2 text-sm">
            <FolderKanban className="h-4 w-4 text-primary" />
            <Link to="/mentee/programs" className="text-sm font-medium">
              Enrolled programs
            </Link>
          </div>
          <span className="text-sm font-semibold">{programsCount}</span>
        </div>

        {sessions.length > 0 && next14 === 0 && (
          <div className="flex items-start gap-3 rounded-md border bg-card/50 p-3">
            <TrendingUp className="mt-0.5 h-4 w-4 text-primary" />
            <div className="flex-1 text-sm">
              Nothing booked in the next 2 weeks.{" "}
              <Link to="/mentors" className="text-primary underline">Book a session</Link>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default /* @__PURE__ */ memo(InsightsPanel);
