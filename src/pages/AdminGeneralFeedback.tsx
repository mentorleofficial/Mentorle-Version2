import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { formatISTDateTime } from "@/lib/datetime";
import { toast } from "sonner";

type Category = "feedback" | "concern" | "suggestion" | "review";

interface Row {
  id: string;
  category: Category;
  message: string;
  resolved: boolean;
  created_at: string;
  user_id: string;
  user: { full_name: string; email: string } | null;
}

const categoryColors: Record<Category, string> = {
  feedback: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  concern: "bg-red-500/10 text-red-700 dark:text-red-300",
  suggestion: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  review: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
};

const AdminGeneralFeedback = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<"all" | Category>("all");
  const [status, setStatus] = useState<"all" | "open" | "resolved">("all");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("general_feedback")
        .select("id, category, message, resolved, created_at, user_id, user:users!general_feedback_user_id_fkey(full_name, email)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) toast.error(error.message);
      setRows((data as any) || []);
      setLoading(false);
    })();
  }, []);

  const toggleResolved = async (id: string, value: boolean) => {
    const prev = rows;
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, resolved: value } : r)));
    const { error } = await supabase.from("general_feedback").update({ resolved: value }).eq("id", id);
    if (error) {
      setRows(prev);
      toast.error(error.message);
    }
  };

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (category !== "all" && r.category !== category) return false;
      if (status === "open" && r.resolved) return false;
      if (status === "resolved" && !r.resolved) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = [r.user?.full_name, r.user?.email, r.message].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, category, status, search]);

  const stats = useMemo(() => ({
    total: rows.length,
    open: rows.filter((r) => !r.resolved).length,
    concerns: rows.filter((r) => r.category === "concern").length,
  }), [rows]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Platform Feedback</h1>
          <p className="text-muted-foreground text-sm">General feedback, suggestions, concerns, and reviews from users.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total</CardTitle></CardHeader><CardContent><span className="text-3xl font-bold">{stats.total}</span></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Open</CardTitle></CardHeader><CardContent><span className="text-3xl font-bold">{stats.open}</span></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Concerns</CardTitle></CardHeader><CardContent><span className="text-3xl font-bold text-destructive">{stats.concerns}</span></CardContent></Card>
        </div>

        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <Input placeholder="Search by user or message…" value={search} onChange={(e) => setSearch(e.target.value)} className="sm:max-w-xs" />
              <Select value={category} onValueChange={(v) => setCategory(v as any)}>
                <SelectTrigger className="sm:max-w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  <SelectItem value="feedback">Feedback</SelectItem>
                  <SelectItem value="concern">Concern</SelectItem>
                  <SelectItem value="suggestion">Suggestion</SelectItem>
                  <SelectItem value="review">Review</SelectItem>
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={(v) => setStatus(v as any)}>
                <SelectTrigger className="sm:max-w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead className="text-right">Resolved</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No feedback yet</TableCell></TableRow>
                ) : filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatISTDateTime(r.created_at)}</TableCell>
                    <TableCell className="text-sm">
                      <div>{r.user?.full_name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{r.user?.email}</div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className={`text-xs capitalize ${categoryColors[r.category]}`}>{r.category}</Badge></TableCell>
                    <TableCell className="max-w-md text-sm whitespace-pre-wrap">{r.message}</TableCell>
                    <TableCell className="text-right"><Switch checked={r.resolved} onCheckedChange={(v) => toggleResolved(r.id, v)} /></TableCell>
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

export default AdminGeneralFeedback;
