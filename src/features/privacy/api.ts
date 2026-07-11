import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PolicyKind = "export" | "correction" | "deletion" | "withdrawal";
export type DsrStatus = "pending" | "in_review" | "completed" | "rejected";

export interface PrivacyPolicy {
  id: string;
  version: string;
  url: string;
  content: string;
  summary: string;
  effective_from: string;
  is_current: boolean;
}

export interface UserConsent {
  id: string;
  user_id: string;
  policy_version: string;
  accepted_at: string;
  withdrawn_at: string | null;
}

export interface DataSubjectRequest {
  id: string;
  user_id: string;
  kind: PolicyKind;
  status: DsrStatus;
  message: string;
  admin_notes: string;
  handled_by: string | null;
  handled_at: string | null;
  created_at: string;
}

export interface RetentionSettings {
  id: string;
  sessions_retention_days: number;
  audit_logs_retention_days: number;
  inactive_user_retention_days: number;
  last_sweep_at: string | null;
  updated_at: string;
}

// ─── Current policy ──────────────────────────────────────────────
export function useCurrentPolicy() {
  return useQuery({
    queryKey: ["privacy", "current-policy"],
    queryFn: async (): Promise<PrivacyPolicy | null> => {
      const { data, error } = await supabase
        .from("privacy_policy")
        .select("*")
        .eq("is_current", true)
        .maybeSingle();
      if (error) throw error;
      return data as PrivacyPolicy | null;
    },
  });
}

export function useAllPolicies() {
  return useQuery({
    queryKey: ["privacy", "all-policies"],
    queryFn: async (): Promise<PrivacyPolicy[]> => {
      const { data, error } = await supabase
        .from("privacy_policy")
        .select("*")
        .order("effective_from", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PrivacyPolicy[];
    },
  });
}

// ─── User consents ───────────────────────────────────────────────
export function useMyLatestConsent(userId: string | undefined) {
  return useQuery({
    queryKey: ["privacy", "my-consent", userId],
    enabled: !!userId,
    queryFn: async (): Promise<UserConsent | null> => {
      const { data, error } = await supabase
        .from("user_consents")
        .select("*")
        .eq("user_id", userId!)
        .order("accepted_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as UserConsent | null;
    },
  });
}

export function useAcceptPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, version }: { userId: string; version: string }) => {
      const { error } = await supabase.from("user_consents").insert({
        user_id: userId,
        policy_version: version,
        ip_address: "",
        user_agent: navigator.userAgent.slice(0, 500),
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["privacy", "my-consent"] }),
  });
}

export function useWithdrawConsent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (consentId: string) => {
      const { error } = await supabase
        .from("user_consents")
        .update({ withdrawn_at: new Date().toISOString() })
        .eq("id", consentId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["privacy"] }),
  });
}

// ─── Data subject requests ───────────────────────────────────────
export function useMyDsrs(userId: string | undefined) {
  return useQuery({
    queryKey: ["privacy", "my-dsrs", userId],
    enabled: !!userId,
    queryFn: async (): Promise<DataSubjectRequest[]> => {
      const { data, error } = await supabase
        .from("data_subject_requests")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DataSubjectRequest[];
    },
  });
}

export function useAllDsrs() {
  return useQuery({
    queryKey: ["privacy", "all-dsrs"],
    queryFn: async (): Promise<(DataSubjectRequest & { user_email?: string; user_name?: string })[]> => {
      const { data, error } = await supabase
        .from("data_subject_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as DataSubjectRequest[];
      const ids = Array.from(new Set(rows.map((r) => r.user_id)));
      if (!ids.length) return rows;
      const { data: users } = await supabase
        .from("users")
        .select("id, email, full_name")
        .in("id", ids);
      const byId = new Map((users ?? []).map((u) => [u.id, u]));
      return rows.map((r) => ({
        ...r,
        user_email: byId.get(r.user_id)?.email,
        user_name: byId.get(r.user_id)?.full_name,
      }));
    },
  });
}

export function useCreateDsr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { userId: string; kind: PolicyKind; message: string }) => {
      const { error } = await supabase.from("data_subject_requests").insert({
        user_id: input.userId,
        kind: input.kind,
        message: input.message,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["privacy"] }),
  });
}

export function useUpdateDsr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      status: DsrStatus;
      admin_notes?: string;
      handled_by?: string;
    }) => {
      const patch: {
        status: DsrStatus;
        admin_notes: string;
        handled_at?: string;
        handled_by?: string | null;
      } = {
        status: input.status,
        admin_notes: input.admin_notes ?? "",
      };
      if (input.status === "completed" || input.status === "rejected") {
        patch.handled_at = new Date().toISOString();
        patch.handled_by = input.handled_by ?? null;
      }
      const { error } = await supabase.from("data_subject_requests").update(patch).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["privacy"] }),
  });
}

// ─── Retention settings ──────────────────────────────────────────
export function useRetentionSettings() {
  return useQuery({
    queryKey: ["privacy", "retention"],
    queryFn: async (): Promise<RetentionSettings | null> => {
      const { data, error } = await supabase
        .from("data_retention_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as RetentionSettings | null;
    },
  });
}

export function useUpdateRetention() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      sessions_retention_days: number;
      audit_logs_retention_days: number;
      inactive_user_retention_days: number;
    }) => {
      const { error } = await supabase
        .from("data_retention_settings")
        .update({
          sessions_retention_days: input.sessions_retention_days,
          audit_logs_retention_days: input.audit_logs_retention_days,
          inactive_user_retention_days: input.inactive_user_retention_days,
        })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["privacy", "retention"] }),
  });
}

// ─── Policy management (admin) ───────────────────────────────────
export function useUpsertPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { version: string; content: string; summary: string; makeCurrent: boolean }) => {
      if (input.makeCurrent) {
        await supabase.from("privacy_policy").update({ is_current: false }).eq("is_current", true);
      }
      const { error } = await supabase.from("privacy_policy").upsert(
        {
          version: input.version,
          content: input.content,
          summary: input.summary,
          is_current: input.makeCurrent,
        },
        { onConflict: "version" }
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["privacy"] }),
  });
}
