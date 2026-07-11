import { formatISTDateTime } from "@/lib/datetime";
import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAllDsrs, useUpdateDsr, DsrStatus } from "@/features/privacy/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

const STATUS_VARIANT: Record<string, "secondary" | "default" | "outline" | "destructive"> = {
  pending: "secondary",
  in_review: "default",
  completed: "outline",
  rejected: "destructive",
};

const AdminPrivacyRequests = () => {
  const { user } = useAuth();
  const { data: dsrs, isLoading } = useAllDsrs();
  const update = useUpdateDsr();
  const [editing, setEditing] = useState<{ id: string; status: DsrStatus; notes: string } | null>(null);

  const save = async () => {
    if (!editing) return;
    await update.mutateAsync({
      id: editing.id,
      status: editing.status,
      admin_notes: editing.notes,
      handled_by: user?.id,
    });
    setEditing(null);
    toast({ title: "Request updated" });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-serif text-2xl">Privacy Requests</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Action data exports, corrections, deletions, and consent withdrawals.
          </p>
        </div>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : !dsrs?.length ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No privacy requests
                    </TableCell>
                  </TableRow>
                ) : (
                  dsrs.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="text-sm font-medium">{r.user_name || "—"}</div>
                        <div className="text-xs text-muted-foreground">{r.user_email}</div>
                      </TableCell>
                      <TableCell className="capitalize text-sm">{r.kind}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatISTDateTime(r.created_at)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[r.status] ?? "secondary"}>{r.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setEditing({ id: r.id, status: r.status, notes: r.admin_notes ?? "" })
                          }
                        >
                          Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review request</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Status</label>
                <Select
                  value={editing.status}
                  onValueChange={(v) => setEditing({ ...editing, status: v as DsrStatus })}
                >
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_review">In review</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Notes for the user</label>
                <Textarea
                  className="mt-1"
                  rows={4}
                  value={editing.notes}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} disabled={update.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default AdminPrivacyRequests;
