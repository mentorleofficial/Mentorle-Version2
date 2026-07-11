import { formatISTDate, formatISTDateTime } from "@/lib/datetime";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Star } from "lucide-react";
type Audience = "mentor" | "mentee" | "admin_private";

interface FeedbackRow {
  id: string;
  rating: number;
  comment: string | null;
  audience: Audience;
  created_at: string;
  submitted_by: string;
  response: string | null;
  responded_at: string | null;
  session: {
    id: string;
    scheduled_at: string;
    mentor: { full_name: string } | null;
    mentee: { full_name: string } | null;
  } | null;
  submitter: { full_name: string } | null;
}

const Stars = ({ n }: { n: number }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map((s) => (
      <Star key={s} className={`h-3.5 w-3.5 ${s <= n ? "fill-yellow-500 text-yellow-500" : "text-border"}`} />
    ))}
  </div>
);

const audienceLabel: Record<Audience, string> = {
  mentor: "About mentor",
  mentee: "About mentee",
  admin_private: "Private (admin)",
};

const AdminFeedback = () => {
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [audience, setAudience] = useState<"all" | Audience>("all");
  const [ratingFilter, setRatingFilter] = useState<"all" | "low" | "high">("all");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("feedback")
        .select(
          "id, rating, comment, audience, created_at, submitted_by, response, responded_at, session:sessions!feedback_session_id_fkey(id, scheduled_at, mentor:users!sessions_mentor_id_fkey(full_name), mentee:users!sessions_mentee_id_fkey(full_name)), submitter:users!feedback_submitted_by_fkey(full_name)"
        )
        .order("created_at", { ascending: false })
        .limit(500);
      setRows((data as any) || []);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (audience !== "all" && r.audience !== audience) return false;
      if (ratingFilter === "low" && r.rating > 2) return false;
      if (ratingFilter === "high" && r.rating < 4) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = [
          r.session?.mentor?.full_name,
          r.session?.mentee?.full_name,
          r.submitter?.full_name,
          r.comment,
        ].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, audience, ratingFilter, search]);

  const stats = useMemo(() => {
    if (rows.length === 0) return { avg: 0, count: 0, low: 0 };
    const avg = rows.reduce((s, r) => s + r.rating, 0) / rows.length;
    const low = rows.filter((r) => r.rating <= 2).length;
    return { avg: Math.round(avg * 10) / 10, count: rows.length, low };
  }, [rows]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Feedback</h1>
          <p className="text-muted-foreground text-sm">All session ratings submitted by mentors and mentees.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Average rating</CardTitle></CardHeader>
            <CardContent><div className="flex items-center gap-2"><span className="text-3xl font-bold">{stats.avg || "—"}</span><Stars n={Math.round(stats.avg)} /></div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total responses</CardTitle></CardHeader>
            <CardContent><span className="text-3xl font-bold">{stats.count}</span></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Low ratings (≤2)</CardTitle></CardHeader>
            <CardContent><span className="text-3xl font-bold text-destructive">{stats.low}</span></CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <Input placeholder="Search by name or comment…" value={search} onChange={(e) => setSearch(e.target.value)} className="sm:max-w-xs" />
              <Select value={audience} onValueChange={(v) => setAudience(v as any)}>
                <SelectTrigger className="sm:max-w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All audiences</SelectItem>
                  <SelectItem value="mentor">About mentor</SelectItem>
                  <SelectItem value="mentee">About mentee</SelectItem>
                  <SelectItem value="admin_private">Private (admin)</SelectItem>
                </SelectContent>
              </Select>
              <Select value={ratingFilter} onValueChange={(v) => setRatingFilter(v as any)}>
                <SelectTrigger className="sm:max-w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All ratings</SelectItem>
                  <SelectItem value="low">Low (1–2)</SelectItem>
                  <SelectItem value="high">High (4–5)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Session</TableHead>
                  <TableHead>Submitter</TableHead>
                  <TableHead>Audience</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Comment</TableHead>
                  <TableHead>Response</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No feedback yet</TableCell></TableRow>
                ) : filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs text-muted-foreground">{formatISTDate(r.created_at)}</TableCell>
                    <TableCell className="text-sm">
                      <div>{r.session?.mentor?.full_name || "—"} ↔ {r.session?.mentee?.full_name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{r.session ? formatISTDateTime(r.session.scheduled_at) : ""}</div>
                    </TableCell>
                    <TableCell className="text-sm">{r.submitter?.full_name || "—"}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{audienceLabel[r.audience]}</Badge></TableCell>
                    <TableCell><Stars n={r.rating} /></TableCell>
                    <TableCell className="max-w-md text-sm text-muted-foreground">{r.comment || "—"}</TableCell>
                    <TableCell className="max-w-md text-sm">
                      {r.response ? (
                        <div>
                          <div className="whitespace-pre-wrap">{r.response}</div>
                          {r.responded_at && (
                            <div className="text-xs text-muted-foreground mt-1">{formatISTDate(r.responded_at)}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default AdminFeedback;
