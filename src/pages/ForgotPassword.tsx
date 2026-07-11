import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useBranding } from "@/contexts/BrandingContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, KeyRound, Mail, CheckCircle } from "lucide-react";

type Step = "request" | "verify";

export default function ForgotPassword() {
  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  
  const branding = useBranding();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);
    try {
      const { data: exists } = await supabase.rpc("check_email_exists", {
        email_to_check: email.trim(),
      });

      if (!exists) {
        toast({
          variant: "destructive",
          title: "Account not found",
          description: "No account found with this email address.",
        });
        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      toast({
        title: "Verification code sent",
        description: "Please check your email for the 8-digit recovery code.",
      });
      setStep("verify");
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Failed to send code",
        description: err.message || "An error occurred. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setIsResending(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      toast({
        title: "Code resent",
        description: "A new 8-digit code has been sent to your email.",
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Failed to resend code",
        description: err.message || "An error occurred. Please try again.",
      });
    } finally {
      setIsResending(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || !password || !confirmPassword) return;

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
      // 1. Verify the 8-digit recovery OTP code
      const { error: otpError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otp.trim(),
        type: "recovery",
      });

      if (otpError) throw otpError;

      // 2. The OTP was verified successfully and a session has been set. Update the password.
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) throw updateError;

      toast({
        title: "Password reset successfully",
        description: "Your new password has been saved. Redirecting to dashboard...",
      });

      // Brief delay to allow backend triggers to complete, then go to dashboard
      setTimeout(() => {
        navigate("/dashboard");
      }, 1500);
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Reset failed",
        description: err.message || "Verification failed. Please check the code and try again.",
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
          <CardTitle className="text-2xl">
            {step === "request" ? "Forgot Password" : "Enter Verification Code"}
          </CardTitle>
          <CardDescription>
            {step === "request"
              ? `Reset your password for ${branding.app_name}`
              : `Enter the 8-digit code sent to ${email} to reset your password`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "request" ? (
            <form onSubmit={handleRequestCode} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    className="pl-10"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Verification Code
              </Button>
              <div className="flex items-center justify-center pt-2">
                <Link to="/login" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors">
                  <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                  Back to sign in
                </Link>
              </div>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4" autoComplete="off">
              {/* Fake fields to prevent browser autofill */}
              <input type="text" name="email" style={{ display: "none" }} />
              <input type="password" name="password" style={{ display: "none" }} />

              <div className="space-y-2">
                <Label htmlFor="otp">Verification Code</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="otp"
                    type="text"
                    placeholder="12345678"
                    maxLength={8}
                    autoComplete="one-time-code"
                    className="pl-10 font-mono tracking-widest text-center text-lg"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
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
                Reset Password
              </Button>

              <div className="flex flex-col gap-2 items-center justify-center pt-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <span>Didn't receive code?</span>
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={isResending || isLoading}
                    className="font-medium text-primary hover:underline disabled:opacity-50"
                  >
                    {isResending ? "Resending..." : "Resend"}
                  </button>
                </div>
                
                <button
                  type="button"
                  onClick={() => setStep("request")}
                  className="inline-flex items-center hover:text-primary transition-colors"
                >
                  <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                  Change email address
                </button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
