import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Plan {
  id: string;
  name: string;
  slug: string;
  interval: "month" | "year";
  price: number;
  currency: string;
  monthly_quota: number;
  benefits: string[];
  is_active: boolean;
}

export interface Membership {
  id: string;
  plan_id: string | null;
  status: string;
  current_period_end: string | null;
  auto_renew: boolean;
  cancel_at_period_end: boolean;
}

export function useActivePlans() {
  return useQuery<Plan[]>({
    queryKey: ["plus", "active-plans"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_active_plans");
      if (error) throw error;
      return ((data as unknown[]) ?? []).map((r) => {
        const row = r as Record<string, unknown>;
        return {
          id: row.id as string,
          name: row.name as string,
          slug: row.slug as string,
          interval: row.interval as "month" | "year",
          price: Number(row.price),
          currency: row.currency as string,
          monthly_quota: row.monthly_quota as number,
          benefits: Array.isArray(row.benefits) ? (row.benefits as string[]) : [],
          is_active: row.is_active as boolean,
        };
      });
    },
  });
}

export const myMembershipKey = (userId?: string) => ["plus", "membership", userId] as const;

export function useMyMembership(userId?: string, poll = false) {
  return useQuery<Membership | null>({
    queryKey: myMembershipKey(userId),
    enabled: !!userId,
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      if (s === "active" || s === "cancelled" || s === "expired") return false;
      // Auto-poll while pending (e.g. just returned from mandate approval) or during an explicit subscribe.
      return poll || s === "pending" ? 3000 : false;
    },
    queryFn: async () => {
      const { data, error } = await supabase
        .from("memberships")
        .select("id, plan_id, status, current_period_end, auto_renew, cancel_at_period_end")
        .eq("user_id", userId!)
        .in("status", ["pending", "active", "past_due"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as Membership) ?? null;
    },
  });
}

export interface CreateSubscriptionResult {
  membership_id: string;
  subscription_id: string;
  subscription_session_id: string;
  cashfree_mode: "sandbox" | "production";
}

export function useCreateSubscription() {
  return useMutation<CreateSubscriptionResult, Error, { planId: string }>({
    mutationFn: async ({ planId }) => {
      const { data, error } = await supabase.functions.invoke("cashfree-create-subscription", {
        body: { plan_id: planId, return_url: `${window.location.origin}/mentee/plus` },
      });
      if (error) {
        let msg = error.message;
        try {
          const ctx = (error as { context?: { json?: () => Promise<{ error?: string }> } }).context;
          const body = await ctx?.json?.();
          if (body?.error) msg = body.error;
        } catch {
          // keep generic message
        }
        throw new Error(msg);
      }
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      return data as CreateSubscriptionResult;
    },
  });
}

export function useCancelSubscription() {
  const qc = useQueryClient();
  return useMutation<{ ok: boolean }, Error, { atPeriodEnd: boolean }>({
    mutationFn: async ({ atPeriodEnd }) => {
      const { data, error } = await supabase.functions.invoke("cashfree-cancel-subscription", {
        body: { at_period_end: atPeriodEnd },
      });
      if (error) {
        let msg = error.message;
        try {
          const ctx = (error as { context?: { json?: () => Promise<{ error?: string }> } }).context;
          const body = await ctx?.json?.();
          if (body?.error) msg = body.error;
        } catch {
          // keep generic message
        }
        throw new Error(msg);
      }
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      return data as { ok: boolean };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plus", "membership"] });
    },
  });
}
