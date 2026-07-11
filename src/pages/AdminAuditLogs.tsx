import { formatISTDateTime } from "@/lib/datetime";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
type AuditLog = Database["public"]["Tables"]["audit_logs"]["Row"];

const AdminAuditLogs = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      const { data } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      setLogs(data || []);
      setLoading(false);
    };
    fetchLogs();
  }, []);

  const filtered = logs.filter(
    (l) =>
      l.action.toLowerCase().includes(search.toLowerCase()) ||
      l.entity_type.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Audit Logs</h1>
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Filter by action or entity…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Entity ID</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No logs found</TableCell></TableRow>
                ) : (
                  filtered.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell><Badge variant="outline">{l.action}</Badge></TableCell>
                      <TableCell>{l.entity_type}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{l.entity_id?.slice(0, 8) || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{formatISTDateTime(l.created_at)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default AdminAuditLogs;
