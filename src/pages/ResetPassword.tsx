import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useBranding } from "@/contexts/BrandingContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const branding = useBranding();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    let checked = false;
    let isSubscribed = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && isSubscribed) {
        setIsCheckingSession(false);
        checked = true;
      }
    });

    const initializeSession = async () => {
      // Check if we already have an active session
      const { data: { session: existingSession } } = await supabase.auth.getSession();
      if (existingSession) {
        if (isSubscribed) {
          setIsCheckingSession(false);
          checked = true;
        }
        return;
      }

      // Parse implicit flow tokens from the hash fragment
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const access_token = hashParams.get("access_token");
      const refresh_token = hashParams.get("refresh_token");

      if (access_token && refresh_token) {
        try {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (error) throw error;
          if (isSubscribed) {
            setIsCheckingSession(false);
            checked = true;
          }
        } catch (error: any) {
          console.error("Error setting session from hash:", error);
          if (isSubscribed) {
            toast({
              variant: "destructive",
              title: "Verification failed",
              description: error.message || "Failed to parse session tokens from verification email.",
            });
            navigate("/login");
          }
          return;
        }
      } else {
        // Parse PKCE code from the query parameters
        const searchParams = new URLSearchParams(window.location.search);
        const code = searchParams.get("code");
        if (code) {
          try {
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            if (error) throw error;
            if (isSubscribed) {
              setIsCheckingSession(false);
              checked = true;
            }
          } catch (error: any) {
            console.error("Error exchanging code for session:", error);
            if (isSubscribed) {
              toast({
                variant: "destructive",
                title: "Verification failed",
                description: error.message || "Failed to exchange verification code for a session.",
              });
              navigate("/login");
            }
            return;
          }
        }
      }

      // Check for an active session (whether just set or already existing)
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        if (isSubscribed) {
          setIsCheckingSession(false);
          checked = true;
        }
      } else {
        const hasHashToken = (
          window.location.hash && (
            window.location.hash.includes("access_token=") ||
            window.location.hash.includes("type=recovery") ||
            window.location.hash.includes("type=invite")
          )
        ) || (
          window.location.search && window.location.search.includes("code=")
        );
        if (!hasHashToken) {
          if (isSubscribed) {
            toast({
              variant: "destructive",
              title: "Session expired (Direct check)",
              description: `No session. Hash: ${window.location.hash || "none"}, Search: ${window.location.search || "none"}`,
            });
            navigate("/login");
          }
        }
      }
    };

    initializeSession();

    const timeout = setTimeout(() => {
      if (!checked) {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (!session) {
            if (isSubscribed) {
              toast({
                variant: "destructive",
                title: "Session expired (Timeout)",
                description: `Verification failed. Hash: ${window.location.hash || "none"}, Search: ${window.location.search || "none"}`,
              });
              navigate("/login");
            }
          }
        });
      }
    }, 5000);

    return () => {
      isSubscribed = false;
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [navigate, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast({
        variant: "destructive",
        title: "Validation error",
        description: "Password must be at least 8 characters long.",
      });
      return;
    }
    if (password !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Validation error",
        description: "Passwords do not match.",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      toast({
        title: "Password set successfully",
        description: "Your password has been saved. Redirecting to your dashboard…",
      });

      // Brief delay to allow profile trigger to finish
      setTimeout(() => {
        navigate("/dashboard");
      }, 1500);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error setting password",
        description: error.message || "Something went wrong. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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
          <CardTitle className="text-2xl">Set Password</CardTitle>
          <CardDescription>
            Enter a secure password for your new account on {branding.app_name}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
            {/* Fake fields to prevent browser autofill */}
            <input type="text" name="email" style={{ display: "none" }} />
            <input type="password" name="password" style={{ display: "none" }} />

            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Set Password & Continue
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;
