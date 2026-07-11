import { useEffect, useState, useCallback } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Clock, AlertTriangle, AlertCircle, RefreshCw, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import MentorApplicationDialog from "@/components/MentorApplicationDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const InactiveMentorBanner = () => {
  const { user } = useAuth();
  const [app, setApp] = useState<any>(null);
  const [cooldownDays, setCooldownDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [popupOpen, setPopupOpen] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!user?.email) return;
    try {
      const [appRes, brandingRes] = await Promise.all([
        supabase
          .from("mentor_applications")
          .select("*")
          .ilike("email", user.email)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("branding")
          .select("rejection_cooldown_days")
          .limit(1)
          .maybeSingle()
      ]);

      if (appRes.data) {
        setApp(appRes.data);
      }
      if (brandingRes.data) {
        setCooldownDays(brandingRes.data.rejection_cooldown_days);
      }
    } catch (err) {
      console.error("Error loading application status:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.email]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (app?.status === "changes_requested") {
      const dismissedAt = localStorage.getItem("mentor_changes_requested_dismissed_at");
      if (dismissedAt) {
        const diff = Date.now() - parseInt(dismissedAt, 10);
        const oneDayMs = 24 * 60 * 60 * 1000;
        if (diff < oneDayMs) {
          return; // Suppress popup for 1 day
        }
      }
      setPopupOpen(true);
    } else {
      setPopupOpen(false);
    }
  }, [app]);

  const handleDismissPopup = () => {
    localStorage.setItem("mentor_changes_requested_dismissed_at", Date.now().toString());
    setPopupOpen(false);
  };

  const handleReapply = () => {
    setPopupOpen(false);
    setShowFormDialog(true);
  };


  if (loading) {
    return <div className="h-10 w-full animate-pulse bg-muted rounded-md" />;
  }

  // 1. Pending status
  if (app?.status === "pending") {
    return (
      <Alert className="border-sky-500/30 bg-sky-500/5">
        <Clock className="h-4 w-4 text-sky-600 dark:text-sky-400" />
        <AlertTitle className="text-sky-800 dark:text-sky-300 font-semibold">Application Pending Review</AlertTitle>
        <AlertDescription className="text-muted-foreground text-sm mt-1">
          Your mentor application is currently being reviewed by our admin team. You can still customize your profile setup, but availability settings and session features will unlock once approved. We'll notify you via email as soon as a decision is made.
        </AlertDescription>
      </Alert>
    );
  }

  // 2. Changes Requested status
  if (app?.status === "changes_requested") {
    return (
      <>
        <Alert className="border-amber-500/30 bg-amber-500/5">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertTitle className="text-amber-800 dark:text-amber-300 font-semibold">Action Required: Changes Requested</AlertTitle>
          <AlertDescription className="text-muted-foreground text-sm mt-1 space-y-3">
            <div>
              The admin reviewed your application and requested some adjustments before approval.
            </div>
            {app.changes_feedback && (
              <div className="bg-amber-100/60 dark:bg-amber-950/20 p-3 rounded-md border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 font-mono text-xs whitespace-pre-wrap">
                <strong>Admin Feedback:</strong><br />
                {app.changes_feedback}
              </div>
            )}
            <div>
              <Button size="sm" onClick={() => setShowFormDialog(true)} className="bg-amber-600 hover:bg-amber-700 text-white font-medium">
                <RefreshCw className="mr-2 h-3.5 w-3.5" /> Update & Resubmit Application
              </Button>
            </div>
          </AlertDescription>
        </Alert>

        <Dialog open={popupOpen} onOpenChange={(val) => {
          if (!val) handleDismissPopup();
        }}>
          <DialogContent className="max-w-md sm:max-w-lg border border-amber-500/20 bg-background/95 backdrop-blur shadow-2xl p-6 rounded-xl animate-in fade-in duration-300">
            <DialogHeader className="space-y-2">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 mb-2">
                <AlertTriangle className="h-6 w-6 text-amber-600 animate-pulse" />
              </div>
              <DialogTitle className="text-2xl font-serif text-center font-bold text-amber-800 dark:text-amber-300">
                Action Required: Changes Requested
              </DialogTitle>
              <DialogDescription className="text-center text-sm text-muted-foreground pt-1">
                The admin reviewed your mentor application and requested some adjustments before your account can be approved.
              </DialogDescription>
            </DialogHeader>

            {app.changes_feedback && (
              <div className="my-4 space-y-2 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/10 p-4">
                <span className="text-xs font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wider block">
                  Admin Feedback & Instructions
                </span>
                <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap font-sans">
                  {app.changes_feedback}
                </div>
              </div>
            )}

            <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 mt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={handleDismissPopup}
                className="w-full sm:w-auto"
              >
                Remind me later
              </Button>
              <Button
                type="button"
                onClick={handleReapply}
                className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white font-semibold flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/10 transition-all hover:scale-[1.02]"
              >
                <RefreshCw className="h-4 w-4" />
                Update & Resubmit
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <MentorApplicationDialog
          open={showFormDialog}
          onOpenChange={(open) => {
            setShowFormDialog(open);
            if (!open) fetchStatus();
          }}
        />
      </>
    );
  }


  // 3. Rejected status
  if (app?.status === "rejected") {
    const reviewedDate = app.reviewed_at ? new Date(app.reviewed_at) : new Date();
    const cooldownMs = cooldownDays * 24 * 60 * 60 * 1000;
    const diffMs = Date.now() - reviewedDate.getTime();
    const isCooldownActive = diffMs < cooldownMs && cooldownDays > 0;
    const remainingDays = Math.ceil((cooldownMs - diffMs) / (24 * 60 * 60 * 1000));

    return (
      <>
        <Alert className="border-red-500/30 bg-red-50/50 dark:bg-red-950/5">
          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
          <AlertTitle className="text-red-800 dark:text-red-300 font-semibold">Application Rejected</AlertTitle>
          <AlertDescription className="text-muted-foreground text-sm mt-1 space-y-3">
            <div>
              We regret to inform you that your application was not approved at this time.
            </div>
            {app.rejection_reason && (
              <div className="bg-red-50 dark:bg-red-950/20 p-3 rounded-md border border-red-200 dark:border-red-900 text-red-800 dark:text-red-300 font-mono text-xs whitespace-pre-wrap">
                <strong>Reason:</strong><br />
                {app.rejection_reason}
              </div>
            )}
            {isCooldownActive ? (
              <div className="text-xs font-semibold text-red-700 dark:text-red-400">
                You will be eligible to reapply in {remainingDays} day(s) (after the {cooldownDays}-day cooldown period ends).
              </div>
            ) : (
              <div>
                <Button size="sm" onClick={() => setShowFormDialog(true)} variant="outline" className="border-red-200 text-red-700 bg-red-50 hover:bg-red-100 dark:border-red-900/40 dark:text-red-400 dark:bg-red-950/10 dark:hover:bg-red-950/30">
                  <RefreshCw className="mr-2 h-3.5 w-3.5" /> Reapply Now
                </Button>
              </div>
            )}
          </AlertDescription>
        </Alert>

        <MentorApplicationDialog
          open={showFormDialog}
          onOpenChange={(open) => {
            setShowFormDialog(open);
            if (!open) fetchStatus();
          }}
        />
      </>
    );
  }

  // 4. Default / Legacy fallback (Approved but inactive)
  return (
    <Alert className="border-accent bg-accent/10">
      <Clock className="h-4 w-4" />
      <AlertTitle>Account Pending Activation</AlertTitle>
      <AlertDescription className="text-muted-foreground text-sm mt-1 space-y-3">
        <div>
          Your mentor account is approved but not yet active. You can complete your profile while an admin
          finalizes activation. Availability and session features will unlock once you're activated.
        </div>
        <div>
          <Button size="sm" onClick={() => setShowFormDialog(true)} className="bg-primary text-primary-foreground font-medium">
            <FileText className="mr-2 h-3.5 w-3.5" /> Complete Profile Details
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
};

export default InactiveMentorBanner;
