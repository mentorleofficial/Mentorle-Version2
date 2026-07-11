import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useMenteeProfileStatus } from "@/features/mentee-onboarding/hooks/useMenteeProfileStatus";

interface Props {
  children: React.ReactNode;
}

const Spinner = () => (
  <div className="flex min-h-screen items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
  </div>
);

/**
 * Redirects mentees to /onboarding/mentee until they finish the
 * "Complete your profile" wizard. Non-mentees pass through.
 */
const MenteeOnboardingGuard = ({ children }: Props) => {
  const { profile, user, loading: authLoading } = useAuth();
  const { loading, isComplete } = useMenteeProfileStatus(user?.id);

  if (profile?.role !== "mentee") return <>{children}</>;

  // Wait for auth to hydrate before deciding — on reload `user` is null briefly
  // even when a cached mentee profile exists, which would otherwise redirect.
  if (authLoading || !user?.id) return <Spinner />;

  if (loading) return <Spinner />;

  if (!isComplete) return <Navigate to="/onboarding/mentee" replace />;

  return <>{children}</>;
};

export default MenteeOnboardingGuard;
