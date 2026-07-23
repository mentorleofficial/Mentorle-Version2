import { useState } from "react";
import { format } from "date-fns";
import AppLayout from "@/components/AppLayout";
import RefreshButton from "@/components/RefreshButton";
import TablePagination from "@/components/TablePagination";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAllWithdrawals, useProcessWithdrawal, type AdminWithdrawal } from "@/features/payouts/usePayouts";

const inr = (n: number) => `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const formatAccount = (d: Record<string, string> | null) => {
  if (!d) return "—";
  if (d.upi_id) return `UPI · ${d.upi_id}`;
  if (d.account_no) return `A/C ${d.account_no} · ${d.ifsc ?? ""}${d.holder_name ? ` · ${d.holder_name}` : ""}`;
  return "—";
};

const statusVariant = (s: string): "default" | "secondary" | "destructive" =>
  s === "paid" ? "default" : s === "rejected" ? "destructive" : "secondary";

const PER_PAGE = 25;

const AdminWithdrawals = () => {
  const { toast } = useToast();
  const { data: rows = [], isLoading, isFetching, refetch } = useAllWithdrawals();
  const process = useProcessWithdrawal();

  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const safePage = Math.min(page, totalPages - 1);
  const pagedRows = rows.slice(safePage * PER_PAGE, safePage * PER_PAGE + PER_PAGE);

  const [target, setTarget] = useState<AdminWithdrawal | null>(null);
  const [action, setAction] = useState<"paid" | "rejected">("paid");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");

  const openDialog = (row: AdminWithdrawal, act: "paid" | "rejected") => {
    setTarget(row);
    setAction(act);
    setReference("");
    setNote("");
  };

  const submit = async () => {
    if (!target) return;
    if (action === "paid" && !reference.trim()) {
      return toast({ variant: "destructive", title: "Enter a payment reference" });
    }
    try {
      await process.mutateAsync({ requestId: target.id, action, reference: reference.trim() || undefined, note: note.trim() || undefined });
      toast({ title: action === "paid" ? "Marked as paid" : "Request rejected" });
      setTarget(null);
    } catch (e) {
      toast({ variant: "destructive", title: "Couldn't update", description: e instanceof Error ? e.message : "Try again" });
    }
  };

  const pendingCount = rows.filter((r) => r.status === "requested" || r.status === "approved").length;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-2xl">Withdrawals</h1>
            <p className="mt-1 text-sm text-muted-foreground">Mentor payout requests — pay manually, then mark them here.</p>
          </div>
          <RefreshButton onClick={() => refetch()} spinning={isFetching} />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Payout requests</CardTitle>
            <CardDescription>{pendingCount} pending · {rows.length} total</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
            ) : rows.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No withdrawal requests yet.</p>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mentor</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Payout to</TableHead>
                      <TableHead>Requested</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedRows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div className="font-medium">{r.mentor?.full_name || "—"}</div>
                          <div className="text-xs text-muted-foreground">{r.mentor?.email}</div>
                        </TableCell>
                        <TableCell className="text-right font-medium">{inr(r.amount)}</TableCell>
                        <TableCell className="text-xs">{formatAccount(r.payout_account_snapshot)}</TableCell>
                        <TableCell>{format(new Date(r.requested_at), "d MMM yyyy")}</TableCell>
                        <TableCell><Badge variant={statusVariant(r.status)} className="capitalize">{r.status}</Badge></TableCell>
                        <TableCell className="text-right">
                          {r.status === "requested" || r.status === "approved" ? (
                            <div className="flex justify-end gap-2">
                              <Button size="sm" onClick={() => openDialog(r, "paid")}>Mark paid</Button>
                              <Button size="sm" variant="outline" onClick={() => openDialog(r, "rejected")}>Reject</Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">{r.payment_reference || r.admin_note || "—"}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
                <TablePagination page={safePage} totalPages={totalPages} onPageChange={setPage} />
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{action === "paid" ? "Mark payout as paid" : "Reject withdrawal"}</DialogTitle>
              <DialogDescription>
                {target && (
                  <>
                    {inr(target.amount)} to {target.mentor?.full_name || target.mentor?.email} · {formatAccount(target.payout_account_snapshot)}
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            {action === "paid" ? (
              <div className="space-y-1.5">
                <Label>Payment reference *</Label>
                <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UTR / transaction id" />
                <p className="text-xs text-muted-foreground">Enter this after you've transferred the amount.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Reason (optional)</Label>
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why it's rejected" />
                <p className="text-xs text-muted-foreground">The mentor's balance will be restored.</p>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setTarget(null)}>Cancel</Button>
              <Button
                onClick={submit}
                disabled={process.isPending}
                variant={action === "rejected" ? "destructive" : "default"}
              >
                {process.isPending ? "Saving…" : action === "paid" ? "Mark paid" : "Reject"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default AdminWithdrawals;
