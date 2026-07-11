import { formatISTDate } from "@/lib/datetime";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { AdminFeedbackRow } from "@/features/admin-dashboard/useAdminDashboardData";
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

const RecentFeedback = ({ feedback }: { feedback: AdminFeedbackRow[] }) => {
  const navigate = useNavigate();

  return (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between pb-2">
      <div className="flex items-center gap-2">
        <Star className="h-5 w-5 text-accent" />
        <CardTitle className="text-lg">Recent Feedback</CardTitle>
      </div>
      <Button variant="ghost" size="sm" asChild>
        <Link to="/admin/feedback">View all</Link>
      </Button>
    </CardHeader>
    <CardContent>
      {feedback.length === 0 ? (
        <p className="text-sm text-muted-foreground">No feedback yet.</p>
      ) : (
        <ul className="space-y-3">
          {feedback.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => navigate("/admin/feedback")}
                className={cn(
                  "w-full rounded-md border bg-card/40 p-3 text-left transition-colors",
                  "hover:border-primary/40 hover:bg-card hover:shadow-sm cursor-pointer"
                )}
              >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={
                        "h-4 w-4 " +
                        (i < f.rating ? "fill-accent text-accent" : "text-muted-foreground/30")
                      }
                    />
                  ))}
                </div>
                <span className="text-xs text-muted-foreground">
                  {relTime(new Date(f.created_at).getTime())}
                </span>
              </div>
              {f.comment && (
                <p className="mt-2 text-sm text-muted-foreground line-clamp-3">"{f.comment}"</p>
              )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </CardContent>
  </Card>
  );
};

export default RecentFeedback;
