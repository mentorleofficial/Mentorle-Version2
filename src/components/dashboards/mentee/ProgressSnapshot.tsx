import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, CheckCircle } from "lucide-react";

interface ProgressSnapshotProps {
  sessionsCompleted: number;
  totalSessions: number;
  eventsAttended: number;
  totalEvents: number;
}

const ProgressSnapshot = ({
  sessionsCompleted,
  totalSessions,
  eventsAttended,
  totalEvents,
}: ProgressSnapshotProps) => {
  const sessionPercentage = totalSessions > 0 ? Math.round((sessionsCompleted / totalSessions) * 100) : 0;
  const eventPercentage = totalEvents > 0 ? Math.round((eventsAttended / totalEvents) * 100) : 0;

  return (
    <Card className="border-border bg-card shadow-sm h-full">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold flex items-center gap-2" style={{ fontFamily: "var(--font-serif)" }}>
          <TrendingUp className="w-5 h-5 text-primary" />
          Progress Snapshot
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm text-muted-foreground font-medium">Sessions</span>
            <span className="text-sm font-semibold text-foreground">
              {sessionsCompleted} / {totalSessions}
            </span>
          </div>
          <div className="w-full bg-secondary rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-500"
              style={{ width: `${sessionPercentage}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm text-muted-foreground font-medium">Events Attended</span>
            <span className="text-sm font-semibold text-foreground">
              {eventsAttended} / {totalEvents}
            </span>
          </div>
          <div className="w-full bg-secondary rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-500"
              style={{ width: `${eventPercentage}%` }}
            />
          </div>
        </div>

        <div className="pt-4 border-t border-border">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span>{sessionsCompleted} sessions completed</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProgressSnapshot;
