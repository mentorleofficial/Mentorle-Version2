import { useState } from "react";
import { formatISTDate } from "@/lib/datetime";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { UsersRound } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { MenteeDetailsDialog } from "@/features/mentor-mentees/components/MenteeDetailsDialog";
import type { MentorDashSession } from "@/features/mentor-dashboard/useMentorDashboardData";

const MyMenteesPanel = ({ sessions }: { sessions: MentorDashSession[] }) => {
  const [selectedMenteeId, setSelectedMenteeId] = useState<string | null>(null);

  const map = new Map<
    string,
    { id: string; name: string; avatar: string | null; count: number; last: number }
  >();
  sessions.forEach((s) => {
    if (!s.mentee) return;
    const ts = new Date(s.scheduled_at).getTime();
    const cur = map.get(s.mentee_id) ?? {
      id: s.mentee_id,
      name: s.mentee.full_name,
      avatar: s.mentee.avatar_url,
      count: 0,
      last: 0,
    };
    cur.count += 1;
    if (ts > cur.last) cur.last = ts;
    map.set(s.mentee_id, cur);
  });
  const list = Array.from(map.values()).sort((a, b) => b.last - a.last).slice(0, 6);

  return (
    <>
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <UsersRound className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">My Mentees</CardTitle>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/mentor/mentees">View all</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">No mentees yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelectedMenteeId(m.id)}
                className={cn(
                  "flex items-center gap-3 rounded-md border bg-card/40 p-3 text-left w-full",
                  "cursor-pointer transition-colors hover:border-primary/40 hover:bg-card hover:shadow-sm"
                )}
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={m.avatar ?? undefined} />
                  <AvatarFallback>
                    {m.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{m.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {m.count} session{m.count > 1 ? "s" : ""} · last{" "}
                    {formatISTDate(m.last)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>

    <MenteeDetailsDialog
      menteeId={selectedMenteeId}
      open={!!selectedMenteeId}
      onOpenChange={(open) => {
        if (!open) setSelectedMenteeId(null);
      }}
    />
    </>
  );
};

export default MyMenteesPanel;
