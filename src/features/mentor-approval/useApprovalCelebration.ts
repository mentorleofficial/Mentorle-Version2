import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export type ApprovalState = {
  show: boolean;
  profileUrl: string;
  expertise: string[];
  fullName: string;
  acknowledge: () => Promise<void>;
};

const buildPublicUrl = (userId: string) => {
  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "";
  return `${origin}/mentors/${userId}`;
};

export function useApprovalCelebration(): ApprovalState {
  const { user, profile, role } = useAuth();
  const [show, setShow] = useState(false);
  const [expertise, setExpertise] = useState<string[]>([]);
  const [slug, setSlug] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (!user || role !== "mentor") return;
      const { data } = await supabase
        .from("mentor_profiles")
        .select("is_active, approval_acknowledged_at, expertise, slug")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        setSlug((data as any).slug ?? null);
        if (data.is_active && !data.approval_acknowledged_at) {
          setExpertise(data.expertise ?? []);
          setShow(true);
        }
      }
    };
    check();
    return () => {
      cancelled = true;
    };
  }, [user, role]);

  const acknowledge = async () => {
    if (!user) return;
    setShow(false);
    await supabase
      .from("mentor_profiles")
      .update({ approval_acknowledged_at: new Date().toISOString() })
      .eq("user_id", user.id);
  };

  return {
    show,
    profileUrl: user ? buildPublicUrl(slug || user.id) : "",
    expertise,
    fullName: profile?.full_name ?? "",
    acknowledge,
  };
}
