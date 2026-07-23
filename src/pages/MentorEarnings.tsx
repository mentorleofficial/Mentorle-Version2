import { useEffect, useState } from "react";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import AppLayout from "@/components/AppLayout";
import RefreshButton from "@/components/RefreshButton";
import TablePagination from "@/components/TablePagination";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Wallet, Loader2 } from "lucide-react";
import {
  useMentorEarnings,
  useMyWithdrawals,
  useMyPayoutAccount,
  useSavePayoutAccount,
  useRequestWithdrawal,
  earningsKey,
  withdrawalsKey,
  payoutAccountKey,
} from "@/features/payouts/usePayouts";

const SOURCE_LABEL: Record<string, string> = {
  paid_session: "Paid session",
  plus_session: "Plus session",
  paid_event: "Paid event",
  plus_event: "Plus event",
  adjustment: "Adjustment",
};

const inr = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const EARN_PER_PAGE = 10;
const WD_PER_PAGE = 5;

const MentorEarnings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const refreshing = useIsFetching({ queryKey: ["payouts"] }) > 0;
  const { data: earnings = [] } = useMentorEarnings(user?.id);
  const { data: withdrawals = [] } = useMyWithdrawals(user?.id);
  const { data: account } = useMyPayoutAccount(user?.id);
  const saveAccount = useSavePayoutAccount(user?.id);
  const requestWithdrawal = useRequestWithdrawal(user?.id);

  const handleRefresh = () => {
    qc.invalidateQueries({ queryKey: earningsKey(user?.id) });
    qc.invalidateQueries({ queryKey: withdrawalsKey(user?.id) });
    qc.invalidateQueries({ queryKey: payoutAccountKey(user?.id) });
  };

  const [method, setMethod] = useState<"upi" | "bank">("upi");
  const [upiId, setUpiId] = useState("");
  const [accountNo, setAccountNo] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [holder, setHolder] = useState("");

  useEffect(() => {
    if (!account) return;
    setMethod(account.method);
    setUpiId(account.details?.upi_id ?? "");
    setAccountNo(account.details?.account_no ?? "");
    setIfsc(account.details?.ifsc ?? "");
    setHolder(account.details?.holder_name ?? "");
  }, [account]);

  const available = earnings.filter((e) => e.status === "accrued").reduce((s, e) => s + e.net_amount, 0);
  const pending = withdrawals
    .filter((w) => w.status === "requested" || w.status === "approved")
    .reduce((s, w) => s + w.amount, 0);
  const paidOut = withdrawals.filter((w) => w.status === "paid").reduce((s, w) => s + w.amount, 0);

  const [earnPage, setEarnPage] = useState(0);
  const [wdPage, setWdPage] = useState(0);
  const earnTotalPages = Math.max(1, Math.ceil(earnings.length / EARN_PER_PAGE));
  const wdTotalPages = Math.max(1, Math.ceil(withdrawals.length / WD_PER_PAGE));
  const safeEarnPage = Math.min(earnPage, earnTotalPages - 1);
  const safeWdPage = Math.min(wdPage, wdTotalPages - 1);
  const pagedEarnings = earnings.slice(safeEarnPage * EARN_PER_PAGE, safeEarnPage * EARN_PER_PAGE + EARN_PER_PAGE);
  const pagedWithdrawals = withdrawals.slice(safeWdPage * WD_PER_PAGE, safeWdPage * WD_PER_PAGE + WD_PER_PAGE);

  const hasAccount = !!account;

  const handleSaveAccount = async () => {
    const details =
      method === "upi" ? { upi_id: upiId.trim() } : { account_no: accountNo.trim(), ifsc: ifsc.trim(), holder_name: holder.trim() };
    if (method === "upi" && !details.upi_id) return toast({ variant: "destructive", title: "Enter your UPI ID" });
    if (method === "bank" && (!details.account_no || !details.ifsc || !details.holder_name)) {
      return toast({ variant: "destructive", title: "Fill all bank details" });
    }
    try {
      await saveAccount.mutateAsync({ method, details });
      toast({ title: "Payout account saved" });
    } catch (e) {
      toast({ variant: "destructive", title: "Couldn't save", description: e instanceof Error ? e.message : "Try again" });
    }
  };

  const handleWithdraw = async () => {
    try {
      await requestWithdrawal.mutateAsync();
      toast({ title: "Withdrawal requested", description: "The admin will process your payout." });
    } catch (e) {
      toast({ variant: "destructive", title: "Couldn't request withdrawal", description: e instanceof Error ? e.message : "Try again" });
    }
  };

  const statusVariant = (s: string): "default" | "secondary" | "destructive" | "outline" =>
    s === "paid" ? "default" : s === "rejected" ? "destructive" : "secondary";

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Wallet className="h-6 w-6 text-primary" /> Earnings & Payouts
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Your earnings from paid sessions, Plus sessions, and events. Withdraw to your payout account.
            </p>
          </div>
          <RefreshButton onClick={handleRefresh} spinning={refreshing} />
        </div>

        {/* Balance summary */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2"><CardDescription>Available to withdraw</CardDescription></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{inr(available)}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardDescription>Pending payout</CardDescription></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{inr(pending)}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardDescription>Paid out</CardDescription></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{inr(paidOut)}</p></CardContent>
          </Card>
        </div>

        {/* Payout account */}
        <Card>
          <CardHeader>
            <CardTitle>Payout account</CardTitle>
            <CardDescription>Where the admin sends your payouts. Kept private.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Method</Label>
                <Select value={method} onValueChange={(v) => setMethod(v as "upi" | "bank")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="bank">Bank account</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {method === "upi" ? (
                <div className="space-y-1.5">
                  <Label>UPI ID</Label>
                  <Input value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="name@bank" />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label>Account holder name</Label>
                  <Input value={holder} onChange={(e) => setHolder(e.target.value)} placeholder="As per bank" />
                </div>
              )}
            </div>
            {method === "bank" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Account number</Label>
                  <Input value={accountNo} onChange={(e) => setAccountNo(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>IFSC</Label>
                  <Input value={ifsc} onChange={(e) => setIfsc(e.target.value.toUpperCase())} />
                </div>
              </div>
            )}
            <div className="flex justify-end">
              <Button onClick={handleSaveAccount} disabled={saveAccount.isPending}>
                {saveAccount.isPending ? "Saving…" : "Save account"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Withdraw */}
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div>
              <p className="font-medium">{inr(available)} available</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {hasAccount ? "Request a payout of your full balance." : "Add a payout account to withdraw."}
              </p>
            </div>
            <Button onClick={handleWithdraw} disabled={available <= 0 || !hasAccount || requestWithdrawal.isPending}>
              {requestWithdrawal.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Requesting…</>
              ) : (
                "Request withdrawal"
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Earnings ledger */}
        <Card>
          <CardHeader><CardTitle>Earnings</CardTitle></CardHeader>
          <CardContent>
            {earnings.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No earnings yet.</p>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead className="text-right">Gross</TableHead>
                        <TableHead className="text-right">Fee</TableHead>
                        <TableHead className="text-right">Net</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagedEarnings.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell>{format(new Date(e.created_at), "d MMM yyyy")}</TableCell>
                          <TableCell>{SOURCE_LABEL[e.source] ?? e.source}</TableCell>
                          <TableCell className="text-right">{inr(e.gross_amount)}</TableCell>
                          <TableCell className="text-right text-muted-foreground">−{inr(e.fee_amount)}</TableCell>
                          <TableCell className="text-right font-medium">{inr(e.net_amount)}</TableCell>
                          <TableCell><Badge variant="secondary" className="capitalize">{e.status}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <TablePagination page={safeEarnPage} totalPages={earnTotalPages} onPageChange={setEarnPage} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Withdrawal history */}
        <Card>
          <CardHeader><CardTitle>Withdrawals</CardTitle></CardHeader>
          <CardContent>
            {withdrawals.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No withdrawals yet.</p>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Requested</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagedWithdrawals.map((w) => (
                        <TableRow key={w.id}>
                          <TableCell>{format(new Date(w.requested_at), "d MMM yyyy")}</TableCell>
                          <TableCell className="text-right font-medium">{inr(w.amount)}</TableCell>
                          <TableCell><Badge variant={statusVariant(w.status)} className="capitalize">{w.status}</Badge></TableCell>
                          <TableCell className="text-muted-foreground">{w.payment_reference || "—"}</TableCell>
                          <TableCell className="text-muted-foreground">{w.admin_note || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <TablePagination page={safeWdPage} totalPages={wdTotalPages} onPageChange={setWdPage} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default MentorEarnings;
