import { useState, useRef, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { PhoneInput } from "@/components/ui/phone-input";
import { phoneSchemaRequired } from "@/features/mentor-profile/schema";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2,
  Loader2,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
} from "lucide-react";

const schema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, "Required")
    .max(100)
    .refine(
      (v) => !["admin", "mentor", "mentee"].includes(v.toLowerCase()),
      "Please enter your real name"
    ),
  email: z.string().trim().email("Invalid email").max(255),
  phone: phoneSchemaRequired,
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72),
});

type FormValues = z.infer<typeof schema>;
type Stage = "form" | "otp" | "done";

const MenteeSignupForm = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();

  const [stage, setStage] = useState<Stage>("form");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [otp, setOtp] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [pendingEmail, setPendingEmail] = useState("");
  const [pendingValues, setPendingValues] = useState<FormValues | null>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    defaultValues: {
      full_name: "",
      email: "",
      phone: "",
      password: "",
    },
  });

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  useEffect(() => {
    const t = setTimeout(() => firstFieldRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [stage]);

  const handleSubmit = async () => {
    const valid = await form.trigger();
    if (!valid) return;

    const values = form.getValues();
    setSubmitting(true);

    try {
      const { data: exists, error: checkErr } = await supabase.rpc(
        "check_email_exists",
        { email_to_check: values.email }
      );
      if (checkErr) throw checkErr;
      if (exists) {
        form.setError("email", {
          type: "manual",
          message: "This email is already registered. Please log in.",
        });
        return;
      }

      const { error: signUpErr } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: { full_name: values.full_name, role: "mentee" },
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });

      if (signUpErr) {
        const msg = signUpErr.message?.toLowerCase() ?? "";
        if (
          msg.includes("already") ||
          msg.includes("registered") ||
          msg.includes("exists")
        ) {
          form.setError("email", {
            type: "manual",
            message:
              "This email is already registered. Please log in.",
          });
          return;
        }
        throw signUpErr;
      }

      setPendingEmail(values.email);
      setPendingValues(values);
      setStage("otp");
      setResendIn(60);
      toast({
        title: "Check your email",
        description: `We sent a verification code to ${values.email}`,
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Signup failed",
        description: err.message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const verifyOtp = async () => {
    if (!pendingValues || otp.length !== 8) return;
    setVerifying(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: pendingEmail,
        token: otp,
        type: "signup",
      });
      if (error) throw error;
      const userId = data.user?.id;
      if (!userId) throw new Error("Verification failed — no user returned");

      const { error: profErr } = await supabase
        .from("mentee_profiles")
        .upsert(
          {
            user_id: userId,
            phone: pendingValues.phone || "",
          },
          { onConflict: "user_id" }
        );
      if (profErr) console.error("mentee_profile upsert failed", profErr);

      await refreshProfile();

      setStage("done");
      toast({
        title: "Email verified!",
        description: "Redirecting to your dashboard…",
      });
      setTimeout(() => navigate("/dashboard"), 1200);
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Invalid code",
        description: err.message,
      });
    } finally {
      setVerifying(false);
    }
  };

  const resendOtp = async () => {
    if (!pendingEmail || resendIn > 0) return;
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: pendingEmail,
    });
    if (error) {
      toast({
        variant: "destructive",
        title: "Could not resend",
        description: error.message,
      });
      return;
    }
    setResendIn(60);
    toast({
      title: "Code resent",
      description: `New code sent to ${pendingEmail}`,
    });
  };

  const errs = form.formState.errors;

  if (stage === "done") {
    return (
      <div className="py-12 text-center space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle2 className="h-8 w-8 text-primary" />
        </div>
        <h2 className="font-serif text-3xl">You're in!</h2>
        <p className="text-muted-foreground">Redirecting to your dashboard…</p>
      </div>
    );
  }

  if (stage === "otp") {
    return (
      <div className="px-6 py-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-7 w-7 text-primary" />
          </div>
          <h3 className="font-serif text-2xl">Verify your email</h3>
          <p className="text-sm text-muted-foreground">
            Enter the 8-digit code we sent to{" "}
            <span className="font-medium text-foreground">{pendingEmail}</span>
          </p>
        </div>

        <div className="flex justify-center">
          <InputOTP maxLength={8} value={otp} onChange={setOtp}>
            <InputOTPGroup>
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <InputOTPSlot
                  key={i}
                  index={i}
                  className="h-11 w-11 text-lg"
                />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>

        <div className="flex justify-center">
          <Button
            onClick={verifyOtp}
            disabled={otp.length !== 8 || verifying}
            size="lg"
          >
            {verifying ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Verifying…
              </>
            ) : (
              "Verify & continue"
            )}
          </Button>
        </div>

        <div className="text-center text-sm text-muted-foreground">
          Didn't receive it?{" "}
          <button
            type="button"
            onClick={resendOtp}
            disabled={resendIn > 0}
            className="text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
          >
            {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
          </button>
          {" · "}
          <button
            type="button"
            onClick={() => {
              setStage("form");
              setOtp("");
            }}
            className="text-primary hover:underline"
          >
            Edit email
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-6 space-y-5">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>
            Full name <span className="text-destructive">*</span>
          </Label>
          <Input
            placeholder="Jane Doe"
            {...form.register("full_name")}
            ref={(el) => {
              form.register("full_name").ref(el);
              (firstFieldRef as any).current = el;
            }}
          />
          {errs.full_name && (
            <p className="text-xs text-destructive">
              {errs.full_name.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>
            Email <span className="text-destructive">*</span>
          </Label>
          <Input
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            {...form.register("email")}
          />
          {errs.email && (
            <p className="text-xs text-destructive">{errs.email.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>
            Phone <span className="text-destructive">*</span>
          </Label>
          <Controller
            control={form.control}
            name="phone"
            render={({ field }) => (
              <PhoneInput
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          {errs.phone && (
            <p className="text-xs text-destructive">{errs.phone.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>
            Password <span className="text-destructive">*</span>{" "}
            <span className="text-xs font-normal text-muted-foreground">
              (min 8 chars)
            </span>
          </Label>
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              className="pr-10"
              {...form.register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          {errs.password && (
            <p className="text-xs text-destructive">
              {errs.password.message}
            </p>
          )}
        </div>
      </div>

      <Button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full"
        size="lg"
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Creating account…
          </>
        ) : (
          <>
            Create account
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link to="/login" className="text-primary underline">
          Sign in
        </Link>
      </p>
    </div>
  );
};

export default MenteeSignupForm;
