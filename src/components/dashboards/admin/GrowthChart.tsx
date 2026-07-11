import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  AdminSessionRow,
  AdminUserRow,
} from "@/features/admin-dashboard/useAdminDashboardData";

const DAY = 86400000;

interface Props {
  sessions: AdminSessionRow[];
  users: AdminUserRow[];
}

const GrowthChart = ({ sessions, users }: Props) => {
  const [mode, setMode] = useState<"sessions" | "signups">("sessions");

  const data = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Array.from({ length: 30 }).map((_, i) => {
      const d = new Date(today.getTime() - (29 - i) * DAY);
      return { d, key: d.toISOString().slice(0, 10), label: `${d.getMonth() + 1}/${d.getDate()}` };
    });
    const bucket: Record<string, { sessions: number; signups: number }> = {};
    days.forEach((x) => (bucket[x.key] = { sessions: 0, signups: 0 }));
    sessions.forEach((s) => {
      const k = s.created_at.slice(0, 10);
      if (bucket[k]) bucket[k].sessions += 1;
    });
    users.forEach((u) => {
      const k = u.created_at.slice(0, 10);
      if (bucket[k]) bucket[k].signups += 1;
    });
    return days.map((x) => ({
      date: x.label,
      sessions: bucket[x.key].sessions,
      signups: bucket[x.key].signups,
    }));
  }, [sessions, users]);

  const color = mode === "sessions" ? "hsl(var(--primary))" : "hsl(var(--accent-foreground))";

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Growth · last 30 days</CardTitle>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={mode === "sessions" ? "default" : "outline"}
            onClick={() => setMode("sessions")}
          >
            Sessions
          </Button>
          <Button
            size="sm"
            variant={mode === "signups" ? "default" : "outline"}
            onClick={() => setMode("signups")}
          >
            Signups
          </Button>
          <Button variant="ghost" size="sm" asChild className="ml-1 hidden sm:inline-flex">
            <Link to={mode === "sessions" ? "/admin/sessions" : "/admin/users"}>
              View all
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 6,
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey={mode}
                stroke={color}
                fill="url(#gFill)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default GrowthChart;
