import { Link, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useBranding } from "@/contexts/BrandingContext";
import { useAuth } from "@/contexts/AuthContext";
import MentorApplicationForm from "@/components/MentorApplicationForm";

const MentorLanding = () => {
  const branding = useBranding();
  const { session, loading } = useAuth();

  // Already signed in? Send them to the dashboard.
  if (!loading && session) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b bg-card/50 backdrop-blur">
        <div className="container mx-auto flex items-center justify-between py-4 px-4">
          <Link to="/" className="flex items-center gap-2">
            {branding.logo_url ? (
              <img src={branding.logo_url} alt={branding.app_name} className="h-8 w-8 rounded" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded bg-primary text-primary-foreground font-bold">
                M
              </div>
            )}
            <span className="font-semibold">{branding.app_name}</span>
          </Link>
          <Link to="/login">
            <Button variant="ghost">Sign in</Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-10 sm:py-14">
        <div className="mx-auto max-w-2xl">
          <div className="text-center space-y-2 mb-8">
            <h1 className="font-serif text-2xl tracking-tight">Become a mentor</h1>
            <p className="text-muted-foreground">
              Start your mentor application and inspire learners with your knowledge, experience, and guidance.
            </p>
          </div>

          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <MentorApplicationForm />
          </div>
        </div>
      </main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} {branding.app_name}
      </footer>
    </div>
  );
};

export default MentorLanding;
