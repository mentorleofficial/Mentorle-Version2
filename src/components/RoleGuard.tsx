import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: AppRole[];
}

const RoleGuard = ({ children, allowedRoles }: RoleGuardProps) => {
  const { profile, loading } = useAuth();

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

  return <>{children}</>;
};

export default RoleGuard;
