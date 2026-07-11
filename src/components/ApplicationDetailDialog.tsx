import { formatISTDate } from "@/lib/datetime";
import { ensureAbsoluteUrl } from "@/lib/utils";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { ExternalLink, FileText, Loader2, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
type Application = Database["public"]["Tables"]["mentor_applications"]["Row"];

interface Props {
  application: Application | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onUpdated: () => void;
}

const ApplicationDetailDialog = ({ application, open, onOpenChange, onUpdated }: Props) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedAction, setSelectedAction] = useState<"approve" | "changes" | "reject" | null>(null);
  const [inputText, setInputText] = useState("");
  const [busy, setBusy] = useState(false);
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);

  const [isLoadingResume, setIsLoadingResume] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchResume = async () => {
      if (!open || !application?.resume_url) {
        setResumeUrl(null);
        return;
      }
      setIsLoadingResume(true);
      try {
        const { data, error } = await supabase.storage
          .from("mentor-resumes")
          .createSignedUrl(application.resume_url, 600); // 10 minutes
        if (error) throw error;
        if (active && data?.signedUrl) {
          setResumeUrl(data.signedUrl);
        }
      } catch (err: any) {
        console.error("Failed to load resume signed URL:", err);
      } finally {
        if (active) setIsLoadingResume(false);
      }
    };
    fetchResume();
    return () => {
      active = false;
    };
  }, [open, application?.resume_url]);

  const handleAction = async () => {
    if (!application || !selectedAction) return;

    if (selectedAction === "reject" && !inputText.trim()) {
      toast({ variant: "destructive", title: "Reason required", description: "Please provide a reason for rejection." });
      return;
    }

    if (selectedAction === "changes" && !inputText.trim()) {
      toast({ variant: "destructive", title: "Feedback required", description: "Please provide feedback for the requested changes." });
      return;
    }

    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined;

      if (selectedAction === "approve") {
        const { data, error } = await supabase.functions.invoke("approve-mentor-application", {
          body: { application_id: application.id, admin_notes: inputText.trim() || null },
          headers,
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        toast({ title: "Application approved", description: "Mentor account activated." });
      } else if (selectedAction === "reject") {
        const { data, error } = await supabase.functions.invoke("reject-mentor-application", {
          body: { application_id: application.id, rejection_reason: inputText.trim() },
          headers,
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        toast({ title: "Application rejected" });
      } else if (selectedAction === "changes") {
        const { data, error } = await supabase.functions.invoke("request-application-changes", {
          body: { application_id: application.id, changes_feedback: inputText.trim() },
          headers,
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        toast({ title: "Changes requested from mentor" });
      }

      onUpdated();
      onOpenChange(false);
      setSelectedAction(null);
      setInputText("");
    } catch (err: any) {
      toast({ variant: "destructive", title: "Action failed", description: err.message });
    } finally {
      setBusy(false);
    }
  };

  if (!application) return null;
  const social = (application.social_links as any) || {};

  const isPendingOrChanges = application.status === "pending" || application.status === "changes_requested";

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setSelectedAction(null); setInputText(""); } }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {application.full_name}
            <Badge
              variant={
                application.status === "pending"
                  ? "secondary"
                  : application.status === "approved"
                  ? "default"
                  : application.status === "rejected"
                  ? "destructive"
                  : "outline"
              }
              className={
                application.status === "changes_requested"
                  ? "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900"
                  : ""
              }
            >
              {application.status === "changes_requested" ? "changes requested" : application.status}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            <div><span className="text-muted-foreground">Email:</span> {application.email}</div>
            <div><span className="text-muted-foreground">Phone:</span> {application.phone || "—"}</div>
            <div><span className="text-muted-foreground">Years:</span> {application.years_experience}</div>
            <div><span className="text-muted-foreground">Submitted:</span> {formatISTDate(application.created_at)}</div>
            {application.professional_status && (
              <div><span className="text-muted-foreground">Professional Status:</span> {application.professional_status}</div>
            )}
            {application.current_organization && (
              <div><span className="text-muted-foreground">Organization/Institution:</span> {application.current_organization}</div>
            )}
            {application.current_role && (
              <div><span className="text-muted-foreground">Role/Designation:</span> {application.current_role}</div>
            )}
          </div>

          <div>
            <Label className="text-xs uppercase text-muted-foreground">Bio</Label>
            <p className="text-sm mt-1 whitespace-pre-wrap">{application.bio}</p>
          </div>

          {application.expertise.length > 0 && (
            <div>
              <Label className="text-xs uppercase text-muted-foreground">Expertise</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {application.expertise.map((e) => <Badge key={e} variant="secondary">{e}</Badge>)}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs uppercase text-muted-foreground">Links</Label>
            <div className="flex flex-wrap gap-3 text-sm">
              {application.linkedin_url && <a href={ensureAbsoluteUrl(application.linkedin_url)} target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1 hover:underline">LinkedIn <ExternalLink className="h-3 w-3" /></a>}
              {application.portfolio_url && <a href={ensureAbsoluteUrl(application.portfolio_url)} target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1 hover:underline">Portfolio <ExternalLink className="h-3 w-3" /></a>}
              {social.twitter && <a href={ensureAbsoluteUrl(social.twitter)} target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1 hover:underline">Twitter <ExternalLink className="h-3 w-3" /></a>}
              {social.github && <a href={ensureAbsoluteUrl(social.github)} target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1 hover:underline">GitHub <ExternalLink className="h-3 w-3" /></a>}
            </div>
          </div>

          {application.resume_url && (
            <Button variant="outline" size="sm" asChild disabled={isLoadingResume || !resumeUrl}>
              {resumeUrl ? (
                <a href={resumeUrl} target="_blank" rel="noopener noreferrer">
                  <FileText className="mr-2 h-4 w-4" />Open Resume
                </a>
              ) : (
                <span className="flex items-center">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading Resume...
                </span>
              )}
            </Button>
          )}

          {application.status === "rejected" && application.rejection_reason && (
            <div className="rounded-lg bg-destructive/10 p-3 border border-destructive/20 text-destructive text-sm">
              <span className="font-semibold block mb-0.5">Rejection Reason:</span>
              <p className="whitespace-pre-wrap">{application.rejection_reason}</p>
            </div>
          )}

          {application.status === "changes_requested" && application.changes_feedback && (
            <div className="rounded-lg bg-amber-100/60 dark:bg-amber-950/20 p-3 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 text-sm">
              <span className="font-semibold block mb-0.5">Requested Changes Feedback:</span>
              <p className="whitespace-pre-wrap">{application.changes_feedback}</p>
            </div>
          )}

          {application.admin_notes && (
            <div>
              <Label className="text-xs uppercase text-muted-foreground">Admin notes</Label>
              <p className="text-sm mt-1 whitespace-pre-wrap">{application.admin_notes}</p>
            </div>
          )}

          {isPendingOrChanges && (
            <>
              <Separator />
              <div className="space-y-4">
                <Label className="text-sm font-semibold">Review Action</Label>
                
                {!selectedAction ? (
                  <div className="flex flex-wrap gap-2.5">
                    <Button
                      variant="outline"
                      className="border-green-200 text-green-700 bg-green-50/50 hover:bg-green-50 hover:text-green-800 dark:border-green-900/40 dark:text-green-400 dark:bg-green-950/10 dark:hover:bg-green-950/30"
                      onClick={() => setSelectedAction("approve")}
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4 text-green-600 dark:text-green-400" />
                      Approve Application
                    </Button>
                    <Button
                      variant="outline"
                      className="border-amber-200 text-amber-700 bg-amber-50/50 hover:bg-amber-50 hover:text-amber-800 dark:border-amber-900/40 dark:text-amber-400 dark:bg-amber-950/10 dark:hover:bg-amber-950/30"
                      onClick={() => setSelectedAction("changes")}
                    >
                      <RefreshCw className="mr-2 h-4 w-4 text-amber-600 dark:text-amber-400" />
                      Request Changes
                    </Button>
                    <Button
                      variant="outline"
                      className="border-red-200 text-red-700 bg-red-50/50 hover:bg-red-50 hover:text-red-800 dark:border-red-900/40 dark:text-red-400 dark:bg-red-950/10 dark:hover:bg-red-950/30"
                      onClick={() => setSelectedAction("reject")}
                    >
                      <XCircle className="mr-2 h-4 w-4 text-red-600 dark:text-red-400" />
                      Reject Application
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold flex items-center gap-2">
                        {selectedAction === "approve" && (
                          <>
                            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                            Approving Application
                          </>
                        )}
                        {selectedAction === "changes" && (
                          <>
                            <RefreshCw className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                            Requesting Changes
                          </>
                        )}
                        {selectedAction === "reject" && (
                          <>
                            <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                            Rejecting Application
                          </>
                        )}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setSelectedAction(null); setInputText(""); }}
                        className="h-8 text-xs"
                      >
                        Cancel
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="action-input" className="text-xs text-muted-foreground">
                        {selectedAction === "approve"
                          ? "Admin notes (optional)"
                          : selectedAction === "changes"
                          ? "Feedback for requested changes (required — sent to mentor)"
                          : "Reason for rejection (required — sent to mentor)"}
                      </Label>
                      <Textarea
                        id="action-input"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        rows={3}
                        placeholder={
                          selectedAction === "approve"
                            ? "Optional approval comments..."
                            : selectedAction === "changes"
                            ? "Provide specific feedback on what details need correction or update..."
                            : "Provide a detailed reason for rejecting this application..."
                        }
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <Button
                        variant={selectedAction === "reject" ? "destructive" : selectedAction === "changes" ? "secondary" : "default"}
                        className={
                          selectedAction === "changes"
                            ? "bg-amber-600 hover:bg-amber-700 text-white dark:bg-amber-700 dark:hover:bg-amber-800"
                            : selectedAction === "approve"
                            ? "bg-green-600 hover:bg-green-700 text-white dark:bg-green-700 dark:hover:bg-green-800"
                            : ""
                        }
                        onClick={handleAction}
                        disabled={busy}
                      >
                        {busy ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : selectedAction === "approve" ? (
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                        ) : selectedAction === "changes" ? (
                          <RefreshCw className="mr-2 h-4 w-4" />
                        ) : (
                          <XCircle className="mr-2 h-4 w-4" />
                        )}
                        Confirm {selectedAction === "approve" ? "Approval" : selectedAction === "changes" ? "Request Changes" : "Rejection"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ApplicationDetailDialog;
