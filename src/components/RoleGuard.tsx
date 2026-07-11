import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: AppRole[];
  requireActiveMentor?: boolean;
}

const RoleGuard = ({ children, allowedRoles, requireActiveMentor }: RoleGuardProps) => {
  const { profile, loading, mentorActive, isApproved, profileCompleteness } = useAuth();
  const { toast } = useToast();

  const blockedInactive = !!profile && profile.role === "mentor" && requireActiveMentor && !mentorActive;

  useEffect(() => {
    if (blockedInactive) {
      if (!isApproved) {
        toast({
          variant: "destructive",
          title: "Account Pending Activation",
          description: "Your mentor account is approved but pending admin finalization.",
        });
      } else if (profileCompleteness < 100) {
        toast({
          variant: "destructive",
          title: "Profile Incomplete",
          description: "Please complete your profile to 100% to unlock this feature.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Account Inactive",
          description: "This area unlocks once your mentor account is activated.",
        });
      }
    }
  }, [blockedInactive, isApproved, profileCompleteness, toast]);

  // Optimistic render: if we have a cached profile, trust it while session refreshes.
  if (loading && !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!profile) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(profile.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  if (blockedInactive) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default RoleGuard;
