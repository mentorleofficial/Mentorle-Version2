import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { paymentReturnUrl } from "@/features/payments/returnUrl";

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

export interface MembershipPlan {
  interval: "month" | "year";
  name: string;
  benefits: string[];
  price: number;
}

export interface Membership {
  id: string;
  plan_id: string | null;
  status: string;
  current_period_end: string | null;
  auto_renew: boolean;
  cancel_at_period_end: boolean;
  plan: MembershipPlan | null;
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
        .select(
          "id, plan_id, status, current_period_end, auto_renew, cancel_at_period_end, subscription_plans(interval, name, benefits, price)",
        )
        .eq("user_id", userId!)
        .in("status", ["pending", "active", "past_due"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const row = data as Record<string, unknown>;
      const rawPlan = row.subscription_plans as Record<string, unknown> | null;
      return {
        id: row.id as string,
        plan_id: (row.plan_id as string) ?? null,
        status: row.status as string,
        current_period_end: (row.current_period_end as string) ?? null,
        auto_renew: !!row.auto_renew,
        cancel_at_period_end: !!row.cancel_at_period_end,
        plan: rawPlan
          ? {
              interval: rawPlan.interval as "month" | "year",
              name: rawPlan.name as string,
              benefits: Array.isArray(rawPlan.benefits) ? (rawPlan.benefits as string[]) : [],
              price: Number(rawPlan.price ?? 0),
            }
          : null,
      } satisfies Membership;
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
        body: { plan_id: planId, return_url: paymentReturnUrl("/mentee/plus") },
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

export interface PlusQuota {
  has_membership: boolean;
  quota_total: number;
  quota_used: number;
  quota_remaining: number;
  discount_percent: number;
}

export function usePlusQuota(enabled = true) {
  return useQuery<PlusQuota>({
    queryKey: ["plus", "quota"],
    enabled,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await supabase.rpc("plus_quota_status" as any);
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row = (Array.isArray(data) ? data[0] : data) as any;
      return {
        has_membership: !!row?.has_membership,
        quota_total: Number(row?.quota_total ?? 0),
        quota_used: Number(row?.quota_used ?? 0),
        quota_remaining: Number(row?.quota_remaining ?? 0),
        discount_percent: Number(row?.discount_percent ?? 0),
      };
    },
  });
}

export interface PlusBookResult {
  session_id: string;
  meeting_url: string;
}

export function useBookPlusSession() {
  const qc = useQueryClient();
  return useMutation<
    PlusBookResult,
    Error,
    { offeringId: string; scheduledAt: string; durationMinutes: number; title: string; notes?: string }
  >({
    mutationFn: async (input) => {
      const { data, error } = await supabase.functions.invoke("book-plus-session", {
        body: {
          kind: "session",
          offering_id: input.offeringId,
          scheduled_at: input.scheduledAt,
          duration_minutes: input.durationMinutes,
          title: input.title,
          notes: input.notes ?? "",
        },
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
      return data as PlusBookResult;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plus", "quota"] });
    },
  });
}

export function useBookPlusEvent() {
  const qc = useQueryClient();
  return useMutation<{ registration_id: string }, Error, { eventId: string }>({
    mutationFn: async ({ eventId }) => {
      const { data, error } = await supabase.functions.invoke("book-plus-session", {
        body: { kind: "event", event_id: eventId },
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
      return data as { registration_id: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plus", "quota"] });
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

async function invokeErrorMessage(error: { message: string; context?: { json?: () => Promise<{ error?: string }> } }) {
  let msg = error.message;
  try {
    const body = await error.context?.json?.();
    if (body?.error) msg = body.error;
  } catch {
    // keep generic message
  }
  return msg;
}

export function useUpgradeToYearly() {
  const qc = useQueryClient();
  return useMutation<CreateSubscriptionResult, Error, { planId: string }>({
    mutationFn: async ({ planId }) => {
      const { data, error } = await supabase.functions.invoke("cashfree-upgrade-subscription", {
        body: { plan_id: planId, return_url: paymentReturnUrl("/mentee/plus") },
      });
      if (error) throw new Error(await invokeErrorMessage(error));
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      return data as CreateSubscriptionResult;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plus", "membership"] });
      qc.invalidateQueries({ queryKey: ["plus", "quota"] });
    },
  });
}

export function useMenteeIsPlusMember(menteeId?: string | null) {
  return useQuery<boolean>({
    queryKey: ["plus", "mentee-is-member", menteeId],
    enabled: !!menteeId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("mentee_is_plus_member", {
        p_mentee_id: menteeId!,
      });
      if (error) throw error;
      return !!data;
    },
  });
}
