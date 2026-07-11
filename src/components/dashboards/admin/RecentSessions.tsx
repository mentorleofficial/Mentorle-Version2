import { formatISTDateTime } from "@/lib/datetime";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
interface Row {
  id: string;
  scheduled_at: string;
  status: string;
  mentor: { full_name: string } | null;
  mentee: { full_name: string } | null;
}

const statusVariant = (s: string): "default" | "secondary" | "destructive" =>
  s === "booked" ? "default" : s === "completed" ? "secondary" : "destructive";

const RecentSessions = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    supabase
      .from("sessions")
      .select(
        "id, scheduled_at, status, mentor:users!sessions_mentor_id_fkey(full_name), mentee:users!sessions_mentee_id_fkey(full_name)"
      )
      .order("scheduled_at", { ascending: false })
      .limit(6)
      .then(({ data }) => setRows((data as unknown as Row[]) || []));
  }, []);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-lg">Recent Sessions</CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/admin/sessions">
            View all <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {rows === null ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sessions yet.</p>
        ) : (
          <div className="divide-y">
            {rows.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => navigate("/admin/sessions")}
                className={cn(
                  "flex w-full items-center justify-between py-3 text-sm text-left transition-colors",
                  "hover:bg-muted/40 cursor-pointer px-1 -mx-1 rounded-md"
                )}
              >
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium">
                    {s.mentor?.full_name || "—"} → {s.mentee?.full_name || "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatISTDateTime(s.scheduled_at)}
                  </p>
                </div>
                <Badge variant={statusVariant(s.status)}>{s.status}</Badge>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RecentSessions;
