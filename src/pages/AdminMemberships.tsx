import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface MembershipRow {
  id: string;
  status: string;
  current_period_end: string | null;
  auto_renew: boolean;
  created_at: string;
  users: { email: string | null; full_name: string | null } | null;
  subscription_plans: { name: string; interval: string } | null;
}

const statusVariant = (s: string): "default" | "destructive" | "secondary" =>
  s === "active" ? "default" : s === "past_due" ? "destructive" : "secondary";

const AdminMemberships = () => {
  const { data: rows = [], isLoading } = useQuery<MembershipRow[]>({
    queryKey: ["admin", "memberships"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("memberships")
        .select(
          "id, status, current_period_end, auto_renew, created_at, users(email, full_name), subscription_plans(name, interval)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as MembershipRow[]) ?? [];
    },
  });

  const activeCount = rows.filter((r) => r.status === "active").length;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-serif text-2xl">Memberships</h1>
          <p className="mt-1 text-sm text-muted-foreground">Mentorle Plus subscribers and their status.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Plus members</CardTitle>
            <CardDescription>{activeCount} active · {rows.length} total</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
            ) : rows.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No memberships yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Renews / Ends</TableHead>
                      <TableHead>Auto-renew</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div className="font-medium">{r.users?.full_name || "—"}</div>
                          <div className="text-xs text-muted-foreground">{r.users?.email}</div>
                        </TableCell>
                        <TableCell>{r.subscription_plans?.name || "—"}</TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(r.status)} className="capitalize">
                            {r.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {r.current_period_end ? format(new Date(r.current_period_end), "d MMM yyyy") : "—"}
                        </TableCell>
                        <TableCell>{r.auto_renew ? "Yes" : "No"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default AdminMemberships;
