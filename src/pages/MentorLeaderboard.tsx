import { useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, RefreshCw, Star } from "lucide-react";
import { useLeaderboard, useRefreshEngagement } from "@/features/badges/api";
import { useAuth } from "@/contexts/AuthContext";
import { useBranding } from "@/contexts/BrandingContext";
import { Navigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const initials = (name: string) =>
  name.split(" ").map((n) => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "M";

const MentorLeaderboard = () => {
  const { user, profile } = useAuth();
  const branding = useBranding();
  const { toast } = useToast();
  const { data: rows = [], isLoading } = useLeaderboard();
  const refresh = useRefreshEngagement();

  useEffect(() => {
    if (isLoading || refresh.isPending || profile?.role !== "admin") return;

    if (rows.length === 0) {
      // Leaderboard is empty, trigger initial calculation
      refresh.mutate(undefined, {
        onSuccess: (data: any) => {
          toast({
            title: "Leaderboard initialized",
            description: `Recalculation complete. Successfully updated ${data.mentors || 0} mentors.`,
          });
        },
      });
      return;
    }

    const computedAt = rows[0]?.computed_at;
    if (!computedAt) return;

    const lastComputedTime = new Date(computedAt).getTime();
    const refreshIntervalMs = (branding.leaderboard_refresh_hours ?? 24) * 60 * 60 * 1000;
    const isExpired = Date.now() > lastComputedTime + refreshIntervalMs;

    if (isExpired) {
      console.log("Leaderboard stats expired. Auto-refreshing...");
      refresh.mutate(undefined, {
        onSuccess: (data: any) => {
          toast({
            title: "Leaderboard updated",
            description: `Auto-refresh complete. Successfully updated ${data.mentors || 0} mentors.`,
          });
        },
      });
    }
  }, [rows, isLoading, branding.leaderboard_refresh_hours, profile?.role]);

  if (!branding.leaderboard_enabled && profile?.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  const myRank = rows.findIndex((r) => r.mentor_id === user?.id);

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-2xl flex items-center gap-2">
              <Trophy className="h-7 w-7 text-primary" /> Mentor Leaderboard
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Top mentors by completed sessions, ratings, and mentee reach over the last 30 days.
            </p>
          </div>
          {profile?.role === "admin" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                refresh.mutate(undefined, {
                  onSuccess: (data: any) => {
                    toast({
                      title: "Recalculation complete",
                      description: `Successfully updated ${data.mentors || 0} mentors.`,
                    });
                  },
                  onError: (err) => {
                    toast({
                      variant: "destructive",
                      title: "Recalculation failed",
                      description: err instanceof Error ? err.message : String(err),
                    });
                  },
                })
              }
              disabled={refresh.isPending}
            >
              <RefreshCw className={cn("h-4 w-4", refresh.isPending && "animate-spin")} />
              Recalculate
            </Button>
          )}
        </div>

        {profile?.role === "mentor" && myRank >= 0 && (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="py-4 flex items-center justify-between">
              <span className="text-sm">Your current rank</span>
              <span className="text-2xl font-bold text-primary">#{myRank + 1}</span>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top mentors</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No leaderboard data yet. {profile?.role === "admin" && "Click Recalculate to compute stats."}
              </p>
            ) : (
              rows.map((row, idx) => {
                const isMe = row.mentor_id === user?.id;
                return (
                  <div
                    key={row.mentor_id}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border p-3 transition",
                      isMe ? "border-primary/40 bg-primary/5" : "border-border"
                    )}
                  >
                    <div
                      className={cn(
                        "h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0",
                        idx === 0 && "bg-yellow-500/20 text-yellow-600",
                        idx === 1 && "bg-slate-400/20 text-slate-500",
                        idx === 2 && "bg-amber-700/20 text-amber-700",
                        idx > 2 && "bg-muted text-muted-foreground"
                      )}
                    >
                      {idx + 1}
                    </div>
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={row.mentor?.avatar_url ?? undefined} />
                      <AvatarFallback className="text-xs">
                        {initials(row.mentor?.full_name ?? "?")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {row.mentor?.full_name ?? "Unknown mentor"}
                        {isMe && <span className="ml-2 text-xs text-primary">(you)</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {row.completed_sessions_30d} sessions · {row.mentee_count_30d} mentees
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-sm">
                      <Star className="h-3.5 w-3.5 fill-primary text-primary" />
                      <span className="font-medium">{row.avg_rating_30d || "—"}</span>
                    </div>
                    <div className="text-right text-xs text-muted-foreground w-16">
                      <div className="font-semibold text-foreground">{row.score}</div>
                      <div>score</div>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default MentorLeaderboard;
