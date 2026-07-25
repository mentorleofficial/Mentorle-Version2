import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CashfreeMode } from "./cashfree";
import { paymentReturnUrl } from "./returnUrl";

export interface CreateSessionOrderInput {
  offeringId: string;
  mentorId: string;
  scheduledAt: string;
  durationMinutes: number;
  title: string;
  notes?: string;
}

export interface CreateOrderResult {
  order_id: string;
  payment_session_id: string;
  cashfree_mode: CashfreeMode;
}

async function invokeErrorMessage(error: { message: string; context?: unknown }): Promise<string> {
  try {
    const ctx = (error as { context?: { json?: () => Promise<{ error?: string }> } }).context;
    const body = await ctx?.json?.();
    if (body?.error) return body.error;
  } catch {
    // fall through to the generic message
  }
  return error.message;
}

export function useCreateSessionOrder() {
  return useMutation<CreateOrderResult, Error, CreateSessionOrderInput>({
    mutationFn: async (input) => {
      const { data, error } = await supabase.functions.invoke("cashfree-create-order", {
        body: {
          kind: "session",
          offering_id: input.offeringId,
          mentor_id: input.mentorId,
          scheduled_at: input.scheduledAt,
          duration_minutes: input.durationMinutes,
          title: input.title,
          notes: input.notes ?? "",
          // Only used if the hosted-checkout fallback is taken; the modal path never leaves.
          return_url: paymentReturnUrl("/mentee/sessions"),
        },
      });
      if (error) throw new Error(await invokeErrorMessage(error));
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      return data as CreateOrderResult;
    },
  });
}

export function useCreateEventOrder() {
  return useMutation<CreateOrderResult, Error, { eventId: string }>({
    mutationFn: async ({ eventId }) => {
      const { data, error } = await supabase.functions.invoke("cashfree-create-order", {
        body: { kind: "event", event_id: eventId, return_url: paymentReturnUrl() },
      });
      if (error) throw new Error(await invokeErrorMessage(error));
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      return data as CreateOrderResult;
    },
  });
}

export interface PaymentStatus {
  status: string;
  session_id: string | null;
}

export function usePaymentStatus(orderId: string | null, enabled: boolean) {
  return useQuery<PaymentStatus | null>({
    queryKey: ["payment-status", orderId],
    enabled: enabled && !!orderId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "paid" || status === "failed" ? false : 2000;
    },
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("status, session_id")
        .eq("cashfree_order_id", orderId!)
        .maybeSingle();
      if (error) throw error;
      return (data as PaymentStatus) ?? null;
    },
  });
}
