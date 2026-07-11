import { formatISTDateTime } from "@/lib/datetime";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import {
  Calendar, Clock, CheckCircle2, XCircle, UserX, Star, Download, MoreHorizontal, Search,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminSessions, useAdminSessionStats, type AdminSessionFilters, type AdminSessionRow } from "@/features/admin/hooks/useAdminSessions";
import { useQuery } from "@tanstack/react-query";
import type { Database } from "@/integrations/supabase/types";

type SessionStatus = Database["public"]["Enums"]["session_status"];

const statusVariant = (s: SessionStatus): "default" | "secondary" | "destructive" =>
  s === "booked" ? "default" : s === "completed" ? "secondary" : "destructive";

const dateRanges = {
  all: { label: "All time", from: null, to: null },
  today: {
    label: "Today",
    from: new Date(new Date().setHours(0, 0, 0, 0)).toISOString(),
    to: new Date(new Date().setHours(23, 59, 59, 999)).toISOString(),
  },
  week: {
    label: "Next 7 days",
    from: new Date().toISOString(),
    to: new Date(Date.now() + 7 * 86400000).toISOString(),
  },
  month: {
    label: "Last 30 days",
    from: new Date(Date.now() - 30 * 86400000).toISOString(),
    to: new Date().toISOString(),
  },
} as const;

const AdminSessions = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [status, setStatus] = useState<SessionStatus | "all">("all");
  const [range, setRange] = useState<keyof typeof dateRanges>("all");
  const [programId, setProgramId] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<AdminSessionRow | null>(null);

  const filters: AdminSessionFilters = useMemo(() => ({
    status,
    programId: programId === "all" ? null : programId,
    from: dateRanges[range].from,
    to: dateRanges[range].to,
    search,
  }), [status, range, programId, search]);

  const { data: rows = [], isLoading } = useAdminSessions(filters);
  const { data: stats } = useAdminSessionStats();
  const programsQuery = useQuery({
    queryKey: ["all-programs"],
    queryFn: async () => {
      const { data } = await supabase.from("programs").select("id, name").order("name");
      return data || [];
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-sessions"] });
    qc.invalidateQueries({ queryKey: ["admin-session-stats"] });
  };

  const force = async (id: string, newStatus: SessionStatus) => {
    const patch: any = { status: newStatus };
    if (newStatus === "cancelled") {
      patch.cancelled_at = new Date().toISOString();
      patch.cancellation_reason = "Cancelled by admin";
    }
    const { error } = await supabase.from("sessions").update(patch).eq("id", id);
    if (error) toast({ variant: "destructive", title: "Error", description: error.message });
    else { toast({ title: `Session ${newStatus}` }); refresh(); }
  };

  const exportCsv = () => {
    const header = ["When", "Mentor", "Mentor email", "Mentee", "Mentee email", "Duration (min)", "Status", "Meeting URL"];
    const lines = rows.map((r) => [
      new Date(r.scheduled_at).toISOString(),
      r.mentor?.full_name ?? "",
      r.mentor?.email ?? "",
      r.mentee?.full_name ?? "",
      r.mentee?.email ?? "",
      r.duration_minutes,
      r.status,
      r.meeting_url ?? "",
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sessions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const StatCard = ({ icon: Icon, label, value, hint }: any) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-4 sm:pb-2 pb-2">
        <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground leading-tight">{label}</CardTitle>
        <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0 ml-1" />
      </CardHeader>
      <CardContent className="p-3 sm:p-4 pt-0 sm:pt-0">
        <div className="text-2xl sm:text-3xl font-bold">{value}</div>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-serif text-2xl">Sessions</h1>
            <p className="text-muted-foreground text-sm mt-1">Track and manage every booking across the platform.</p>
          </div>
          <Button variant="outline" onClick={exportCsv}><Download className="mr-2 h-4 w-4" />Export CSV</Button>
        </div>

        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          <StatCard icon={Clock} label="Upcoming" value={stats?.upcoming ?? "—"} />
          <StatCard icon={CheckCircle2} label="Completed (30d)" value={stats?.completed30 ?? "—"} />
          <StatCard icon={XCircle} label="Cancelled (30d)" value={stats?.cancelled30 ?? "—"} />
          <StatCard icon={UserX} label="No-shows (30d)" value={stats?.noShow30 ?? "—"} />
          <StatCard icon={Star} label="Avg rating" value={stats?.avgRating ? stats.avgRating.toFixed(1) : "—"} />
        </div>

        <Card>
          <CardContent className="p-4 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[160px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search mentor or mentee…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={status} onValueChange={(v) => setStatus(v as any)}>
              <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="booked">Booked</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="no_show">No-show</SelectItem>
              </SelectContent>
            </Select>
            <Select value={range} onValueChange={(v) => setRange(v as any)}>
              <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Date range" /></SelectTrigger>
              <SelectContent>
                {Object.entries(dateRanges).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={programId} onValueChange={setProgramId}>
              <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Program" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All programs</SelectItem>
                {(programsQuery.data || []).map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Mentor</TableHead>
                  <TableHead>Mentee</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
                ) : rows.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No sessions match these filters.</TableCell></TableRow>
                ) : rows.map((s) => (
                  <TableRow key={s.id} className="cursor-pointer" onClick={() => setDetail(s)}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {formatISTDateTime(s.scheduled_at)}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{s.mentor?.full_name || "—"}</TableCell>
                    <TableCell>{s.mentee?.full_name || "—"}</TableCell>
                    <TableCell>{s.duration_minutes} min</TableCell>
                    <TableCell><Badge variant={statusVariant(s.status)}>{s.status}</Badge></TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setDetail(s)}>View details</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {s.status !== "completed" && <DropdownMenuItem onClick={() => force(s.id, "completed")}>Force complete</DropdownMenuItem>}
                          {s.status !== "no_show" && <DropdownMenuItem onClick={() => force(s.id, "no_show")}>Mark no-show</DropdownMenuItem>}
                          {s.status !== "cancelled" && <DropdownMenuItem className="text-destructive" onClick={() => force(s.id, "cancelled")}>Cancel session</DropdownMenuItem>}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {detail && (
            <>
              <SheetHeader>
                <SheetTitle>Session details</SheetTitle>
                <SheetDescription>{formatISTDateTime(detail.scheduled_at)} · {detail.duration_minutes} min</SheetDescription>
              </SheetHeader>
              <div className="space-y-4 mt-6 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Mentor</p>
                    <p className="font-medium">{detail.mentor?.full_name}</p>
                    <p className="text-xs text-muted-foreground">{detail.mentor?.email}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Mentee</p>
                    <p className="font-medium">{detail.mentee?.full_name}</p>
                    <p className="text-xs text-muted-foreground">{detail.mentee?.email}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Status</p>
                  <Badge variant={statusVariant(detail.status)}>{detail.status}</Badge>
                </div>
                {detail.meeting_url && (
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Meeting link</p>
                    <a href={detail.meeting_url} target="_blank" rel="noreferrer" className="text-primary hover:underline break-all">{detail.meeting_url}</a>
                  </div>
                )}
                {detail.mentee_notes && (
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Mentee notes</p>
                    <p>{detail.mentee_notes}</p>
                  </div>
                )}
                {detail.notes && (
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Mentor notes</p>
                    <p>{detail.notes}</p>
                  </div>
                )}
                {detail.cancellation_reason && (
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Cancellation reason</p>
                    <p className="text-destructive">{detail.cancellation_reason}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
};

export default AdminSessions;
