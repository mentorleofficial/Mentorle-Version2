import { useState } from "react";
import { Navigate, useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useBranding } from "@/contexts/BrandingContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, session, profile, loading } = useAuth();
  const branding = useBranding();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/dashboard";

  const safeRedirect = redirectTo.startsWith("/") ? redirectTo : "/dashboard";

  // Only redirect once we have BOTH a session AND a resolved profile.
  // If we have a session but no profile (e.g. RLS 403 or missing users row),
  // staying on /login avoids an infinite loop with RoleGuard.
  if (session && profile) {
    return <Navigate to={safeRedirect} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await signIn(email, password);
      navigate(safeRedirect);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Login failed",
        description: error.message || "Invalid credentials",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-muted/30 px-4"
      style={
        branding.login_bg_url
          ? { backgroundImage: `url(${branding.login_bg_url})`, backgroundSize: "cover", backgroundPosition: "center" }
          : undefined
      }
    >
      <Card className="w-full max-w-md shadow-xl border-0">
        <CardHeader className="text-center space-y-3 pb-2">
          {branding.logo_url ? (
            <img src={branding.logo_url} alt={branding.app_name} className="h-12 w-12 mx-auto rounded-lg" />
          ) : (
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-xl">
              M
            </div>
          )}
          <CardTitle className="text-2xl">{branding.app_name}</CardTitle>
          <CardDescription>Sign in to continue guiding learner journeys.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  to="/forgot-password"
                  className="text-xs text-primary hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Signing in…" : "Sign In"}
            </Button>
          </form>
          {/* <p className="mt-6 text-center text-sm text-muted-foreground">
            Mentees sign in through{" "}
            <span className="font-medium text-primary">EduBridge</span>
          </p> */}
          <p className="mt-2 text-center text-sm text-muted-foreground">
            New here?{" "}
            <a href="/signup" className="font-medium text-primary hover:underline">
              Create an account
            </a>
          </p>
          <p className="mt-1 text-center text-sm text-muted-foreground">
            Want to mentor?{" "}
            <a href="/become-a-mentor" className="font-medium text-primary hover:underline">
              Apply here
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
