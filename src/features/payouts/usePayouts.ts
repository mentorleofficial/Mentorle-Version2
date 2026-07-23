import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Earning {
  id: string;
  source: string;
  gross_amount: number;
  fee_amount: number;
  net_amount: number;
  status: string;
  created_at: string;
}

export interface Withdrawal {
  id: string;
  amount: number;
  status: string;
  payment_reference: string | null;
  admin_note: string | null;
  requested_at: string;
  processed_at: string | null;
}

export interface PayoutAccount {
  id: string;
  method: "upi" | "bank";
  details: Record<string, string>;
}

const num = (v: unknown) => Number(v ?? 0);

export const earningsKey = (mentorId?: string) => ["payouts", "earnings", mentorId] as const;
export const withdrawalsKey = (mentorId?: string) => ["payouts", "withdrawals", mentorId] as const;
export const payoutAccountKey = (mentorId?: string) => ["payouts", "account", mentorId] as const;

export function useMentorEarnings(mentorId?: string) {
  return useQuery<Earning[]>({
    queryKey: earningsKey(mentorId),
    enabled: !!mentorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mentor_earnings")
        .select("id, source, gross_amount, fee_amount, net_amount, status, created_at")
        .eq("mentor_id", mentorId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data as Earning[]) ?? []).map((e) => ({
        ...e,
        gross_amount: num(e.gross_amount),
        fee_amount: num(e.fee_amount),
        net_amount: num(e.net_amount),
      }));
    },
  });
}

export function useMyWithdrawals(mentorId?: string) {
  return useQuery<Withdrawal[]>({
    queryKey: withdrawalsKey(mentorId),
    enabled: !!mentorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("withdrawal_requests")
        .select("id, amount, status, payment_reference, admin_note, requested_at, processed_at")
        .eq("mentor_id", mentorId!)
        .order("requested_at", { ascending: false });
      if (error) throw error;
      return ((data as Withdrawal[]) ?? []).map((w) => ({ ...w, amount: num(w.amount) }));
    },
  });
}

export function useMyPayoutAccount(mentorId?: string) {
  return useQuery<PayoutAccount | null>({
    queryKey: payoutAccountKey(mentorId),
    enabled: !!mentorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mentor_payout_accounts")
        .select("id, method, details")
        .eq("mentor_id", mentorId!)
        .maybeSingle();
      if (error) throw error;
      return (data as PayoutAccount) ?? null;
    },
  });
}

export function useSavePayoutAccount(mentorId?: string) {
  const qc = useQueryClient();
  return useMutation<void, Error, { method: "upi" | "bank"; details: Record<string, string> }>({
    mutationFn: async ({ method, details }) => {
      const { error } = await supabase
        .from("mentor_payout_accounts")
        .upsert(
          { mentor_id: mentorId!, method, details, updated_at: new Date().toISOString() },
          { onConflict: "mentor_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: payoutAccountKey(mentorId) }),
  });
}

export function useRequestWithdrawal(mentorId?: string) {
  const qc = useQueryClient();
  return useMutation<void, Error, void>({
    mutationFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase.rpc("request_withdrawal" as any);
      if (error) throw new Error(friendlyRpcError(error.message));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: earningsKey(mentorId) });
      qc.invalidateQueries({ queryKey: withdrawalsKey(mentorId) });
    },
  });
}

function friendlyRpcError(msg: string): string {
  if (msg.includes("NO_BALANCE")) return "You have no balance to withdraw.";
  if (msg.includes("NO_PAYOUT_ACCOUNT")) return "Add a payout account first.";
  return msg;
}

// ---- Admin ----

export interface AdminWithdrawal extends Withdrawal {
  mentor_id: string | null;
  payout_account_snapshot: Record<string, string> | null;
  mentor: { full_name: string | null; email: string | null } | null;
}

export function useAllWithdrawals() {
  return useQuery<AdminWithdrawal[]>({
    queryKey: ["admin", "withdrawals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("withdrawal_requests")
        .select(
          "id, mentor_id, amount, status, payment_reference, admin_note, payout_account_snapshot, requested_at, processed_at, mentor:users!withdrawal_requests_mentor_id_fkey(full_name, email)",
        )
        .order("requested_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as AdminWithdrawal[]) ?? [];
    },
  });
}

export function useProcessWithdrawal() {
  const qc = useQueryClient();
  return useMutation<void, Error, { requestId: string; action: "paid" | "rejected"; reference?: string; note?: string }>({
    mutationFn: async ({ requestId, action, reference, note }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase.rpc("process_withdrawal" as any, {
        _request_id: requestId,
        _action: action,
        _reference: reference ?? null,
        _note: note ?? null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "withdrawals"] }),
  });
}
