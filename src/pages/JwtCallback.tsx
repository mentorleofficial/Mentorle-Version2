import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useBranding } from "@/contexts/BrandingContext";
import { useToast } from "@/hooks/use-toast";

/**
 * Receives an external JWT (from EduBridge or another IdP), exchanges it
 * via the `jwt-exchange` edge function for a real Supabase session, then
 * persists it via `setSession()` so the user stays logged in across refreshes.
 */
const JwtCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const branding = useBranding();
  const { toast } = useToast();
  const [status, setStatus] = useState<"working" | "error">("working");
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    const run = async () => {
      try {
        // Load JWT config to know which param name carries the token
        const { data: cfg } = await supabase
          .from("jwt_config")
          .select("token_param_name, enabled, login_redirect_url")
          .limit(1)
          .maybeSingle();

        if (!cfg?.enabled) {
          throw new Error("External JWT login is not enabled");
        }

        const paramName = cfg.token_param_name || "token";

        // Look in query string AND hash (some IdPs return token in hash)
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const token =
          searchParams.get(paramName) ||
          hashParams.get(paramName) ||
          searchParams.get("token") ||
          hashParams.get("token");

        if (!token) {
          throw new Error(`No "${paramName}" token found in URL`);
        }

        const { data, error } = await supabase.functions.invoke("jwt-exchange", {
          body: { token },
        });

        if (error) throw new Error(error.message || "Token exchange failed");
        if (!data?.access_token || !data?.refresh_token) {
          throw new Error(data?.error || "Invalid response from server");
        }

        const { error: setErr } = await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        });
        if (setErr) throw setErr;

        const next = searchParams.get("next") || cfg.login_redirect_url || "/dashboard";
        // Use replace so back-button doesn't re-trigger the callback
        navigate(next.startsWith("/") ? next : "/dashboard", { replace: true });
      } catch (e: any) {
        const msg = e?.message || "Sign-in failed";
        setErrorMsg(msg);
        setStatus("error");
        toast({ variant: "destructive", title: "Sign-in failed", description: msg });
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-muted/30 px-4">
      {branding.logo_url ? (
        <img src={branding.logo_url} alt={branding.app_name} className="h-12 w-12 rounded-lg" />
      ) : (
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-xl">
          {branding.app_name.charAt(0)}
        </div>
      )}

      {status === "working" ? (
        <>
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Signing you in to {branding.app_name}…</p>
        </>
      ) : (
        <div className="max-w-md text-center space-y-3">
          <h1 className="font-serif text-2xl">Sign-in failed</h1>
          <p className="text-sm text-muted-foreground">{errorMsg}</p>
          <button
            onClick={() => navigate("/login", { replace: true })}
            className="text-sm font-medium text-primary hover:underline"
          >
            Go to sign in
          </button>
        </div>
      )}
    </div>
  );
};

export default JwtCallback;
