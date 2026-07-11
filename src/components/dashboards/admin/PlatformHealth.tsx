import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, ShieldCheck, ShieldAlert, TrendingUp, TrendingDown } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import type {
  AdminFeedbackRow,
  AdminSessionRow,
} from "@/features/admin-dashboard/useAdminDashboardData";

const DAY = 86400000;

interface Props {
  jwtEnabled: boolean;
  feedback60: AdminFeedbackRow[];
  sessions30: AdminSessionRow[];
}

const PlatformHealth = ({ jwtEnabled, feedback60, sessions30 }: Props) => {
  const now = Date.now();
  const cutoff30 = now - 30 * DAY;
  const cutoff60 = now - 60 * DAY;

  const last30 = feedback60.filter((f) => new Date(f.created_at).getTime() >= cutoff30);
  const prev30 = feedback60.filter((f) => {
    const t = new Date(f.created_at).getTime();
    return t < cutoff30 && t >= cutoff60;
  });
  const avg = (list: AdminFeedbackRow[]) =>
    list.length ? list.reduce((s, r) => s + r.rating, 0) / list.length : null;
  const a = avg(last30);
  const b = avg(prev30);
  const delta = a !== null && b !== null ? a - b : null;

  const cancelled = sessions30.filter((s) => s.status === "cancelled").length;
  const completed = sessions30.filter((s) => s.status === "completed").length;
  const denom = cancelled + completed;
  const cancelRate = denom > 0 ? (cancelled / denom) * 100 : 0;

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <Activity className="h-5 w-5 text-primary" />
        <CardTitle className="text-lg">Platform Health</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Link
          to="/admin/settings"
          className={cn(
            "flex items-center justify-between rounded-md border bg-card/40 p-3 text-sm transition-colors",
            "hover:border-primary/40 hover:bg-card"
          )}
        >
          <div className="flex items-center gap-2">
            {jwtEnabled ? (
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
            ) : (
              <ShieldAlert className="h-4 w-4 text-amber-500" />
            )}
            <span>JWT mentee auth</span>
          </div>
          <span className="text-xs font-semibold">{jwtEnabled ? "Enabled" : "Disabled"}</span>
        </Link>

        <Link
          to="/admin/feedback"
          className={cn(
            "block rounded-md border bg-card/40 p-3 text-sm transition-colors",
            "hover:border-primary/40 hover:bg-card"
          )}
        >
          <div className="flex items-center justify-between">
            <span>Avg rating · 30d</span>
            <span className="font-semibold">{a === null ? "—" : `${a.toFixed(2)} ★`}</span>
          </div>
          {delta !== null && (
            <div
              className={
                "mt-1 flex items-center gap-1 text-xs " +
                (delta >= 0 ? "text-emerald-500" : "text-destructive")
              }
            >
              {delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              <span>
                {delta >= 0 ? "+" : ""}
                {delta.toFixed(2)} vs prior 30d
              </span>
            </div>
          )}
        </Link>

        <Link
          to="/admin/sessions"
          className={cn(
            "block rounded-md border bg-card/40 p-3 text-sm transition-colors",
            "hover:border-primary/40 hover:bg-card"
          )}
        >
          <div className="flex items-center justify-between">
            <span>Cancellation rate · 30d</span>
            <span
              className={
                "font-semibold " + (cancelRate > 20 ? "text-destructive" : "text-foreground")
              }
            >
              {cancelRate.toFixed(0)}%
            </span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {cancelled} cancelled · {completed} completed
          </div>
        </Link>
      </CardContent>
    </Card>
  );
};

export default PlatformHealth;
