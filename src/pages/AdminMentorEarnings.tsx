import { useEffect, useMemo, useState } from "react";
import { useIsFetching, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowLeft, ChevronRight, Search, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatISTDate } from "@/lib/datetime";
import AppLayout from "@/components/AppLayout";
import RefreshButton from "@/components/RefreshButton";
import TablePagination from "@/components/TablePagination";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  useMentorEarnings,
  useMyWithdrawals,
  useMyPayoutAccount,
  earningsKey,
  withdrawalsKey,
  payoutAccountKey,
} from "@/features/payouts/usePayouts";

interface MentorRow {
  id: string;
  full_name: string | null;
  email: string | null;
  created_at: string;
}

const SOURCE_LABEL: Record<string, string> = {
  paid_session: "Paid session",
  plus_session: "Plus session",
  paid_event: "Paid event",
  plus_event: "Plus event",
  adjustment: "Adjustment",
};

const inr = (n: number) => `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const formatAccount = (d?: Record<string, string> | null) => {
  if (!d) return "—";
  if (d.upi_id) return `UPI · ${d.upi_id}`;
  if (d.account_no) return `A/C ${d.account_no} · ${d.ifsc ?? ""}${d.holder_name ? ` · ${d.holder_name}` : ""}`;
  return "—";
};

const statusVariant = (s: string): "default" | "secondary" | "destructive" | "outline" =>
  s === "paid" ? "default" : s === "rejected" ? "destructive" : "secondary";

const LIST_PER_PAGE = 25;
const EARN_PER_PAGE = 10;
const WD_PER_PAGE = 5;

const MentorEarningsDetail = ({ mentor }: { mentor: MentorRow }) => {
  const { data: earnings = [], isLoading: le } = useMentorEarnings(mentor.id);
  const { data: withdrawals = [], isLoading: lw } = useMyWithdrawals(mentor.id);
  const { data: account } = useMyPayoutAccount(mentor.id);

  const [earnPage, setEarnPage] = useState(0);
  const [wdPage, setWdPage] = useState(0);

  const available = earnings.filter((e) => e.status === "accrued").reduce((s, e) => s + e.net_amount, 0);
  const pending = withdrawals
    .filter((w) => w.status === "requested" || w.status === "approved")
    .reduce((s, w) => s + w.amount, 0);
  const paidOut = withdrawals.filter((w) => w.status === "paid").reduce((s, w) => s + w.amount, 0);

  const earnTotalPages = Math.max(1, Math.ceil(earnings.length / EARN_PER_PAGE));
  const wdTotalPages = Math.max(1, Math.ceil(withdrawals.length / WD_PER_PAGE));
  const safeEarnPage = Math.min(earnPage, earnTotalPages - 1);
  const safeWdPage = Math.min(wdPage, wdTotalPages - 1);
  const pagedEarnings = earnings.slice(safeEarnPage * EARN_PER_PAGE, safeEarnPage * EARN_PER_PAGE + EARN_PER_PAGE);
  const pagedWithdrawals = withdrawals.slice(safeWdPage * WD_PER_PAGE, safeWdPage * WD_PER_PAGE + WD_PER_PAGE);

  return (
    <>
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

      <Card>
        <CardHeader>
          <CardTitle>Payout account</CardTitle>
          <CardDescription>Where the mentor receives payouts.</CardDescription>
        </CardHeader>
        <CardContent>
          {account ? (
            <div className="text-sm">
              <Badge variant="secondary" className="uppercase mr-2">{account.method}</Badge>
              {formatAccount(account.details)}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No payout account set.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Earnings</CardTitle></CardHeader>
        <CardContent>
          {le ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : earnings.length === 0 ? (
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

      <Card>
        <CardHeader><CardTitle>Withdrawals</CardTitle></CardHeader>
        <CardContent>
          {lw ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : withdrawals.length === 0 ? (
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
    </>
  );
};

const AdminMentorEarnings = () => {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [listPage, setListPage] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim().toLowerCase()), 200);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setListPage(0);
  }, [search]);

  const { data: mentors = [], isLoading } = useQuery<MentorRow[]>({
    queryKey: ["admin", "mentor-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, full_name, email, created_at")
        .eq("role", "mentor")
        .order("full_name", { ascending: true });
      if (error) throw error;
      return (data as MentorRow[]) ?? [];
    },
  });

  const fetchingPayouts = useIsFetching({ queryKey: ["payouts"] });
  const fetchingList = useIsFetching({ queryKey: ["admin", "mentor-list"] });
  const refreshing = fetchingPayouts + fetchingList > 0;

  const selectedMentor = useMemo(() => mentors.find((m) => m.id === selectedId), [mentors, selectedId]);

  const filtered = useMemo(() => {
    if (!search) return mentors;
    return mentors.filter(
      (m) =>
        (m.full_name ?? "").toLowerCase().includes(search) ||
        (m.email ?? "").toLowerCase().includes(search),
    );
  }, [mentors, search]);

  const listTotalPages = Math.max(1, Math.ceil(filtered.length / LIST_PER_PAGE));
  const safeListPage = Math.min(listPage, listTotalPages - 1);
  const pagedMentors = filtered.slice(safeListPage * LIST_PER_PAGE, safeListPage * LIST_PER_PAGE + LIST_PER_PAGE);

  const handleRefresh = () => {
    qc.invalidateQueries({ queryKey: ["admin", "mentor-list"] });
    if (!selectedId) return;
    qc.invalidateQueries({ queryKey: earningsKey(selectedId) });
    qc.invalidateQueries({ queryKey: withdrawalsKey(selectedId) });
    qc.invalidateQueries({ queryKey: payoutAccountKey(selectedId) });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Wallet className="h-6 w-6 text-primary" /> Mentor Earnings
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {selectedMentor
                ? "Everything this mentor sees on their earnings page."
                : "Select a mentor to view their earnings, payout account, and withdrawals."}
            </p>
          </div>
          <RefreshButton onClick={handleRefresh} spinning={refreshing} />
        </div>

        {selectedMentor ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setSelectedId(null)}>
                <ArrowLeft className="h-4 w-4" /> All mentors
              </Button>
              <div className="text-right">
                <div className="font-medium">{selectedMentor.full_name || "Unnamed mentor"}</div>
                <div className="text-xs text-muted-foreground">{selectedMentor.email}</div>
              </div>
            </div>
            <MentorEarningsDetail mentor={selectedMentor} />
          </>
        ) : (
          <>
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search by name or email…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>

            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="w-[50px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <TableRow key={`sk-${i}`}>
                          {Array.from({ length: 4 }).map((__, j) => (
                            <TableCell key={j}><Skeleton className="h-4 w-24" /></TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                          No mentors found
                        </TableCell>
                      </TableRow>
                    ) : (
                      pagedMentors.map((m) => (
                        <TableRow
                          key={m.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setSelectedId(m.id)}
                        >
                          <TableCell className="font-medium">{m.full_name || "Unnamed mentor"}</TableCell>
                          <TableCell className="text-muted-foreground">{m.email}</TableCell>
                          <TableCell className="text-muted-foreground">{formatISTDate(m.created_at)}</TableCell>
                          <TableCell>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {!isLoading && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  {filtered.length} {filtered.length === 1 ? "mentor" : "mentors"}
                </p>
                <TablePagination page={safeListPage} totalPages={listTotalPages} onPageChange={setListPage} />
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default AdminMentorEarnings;
