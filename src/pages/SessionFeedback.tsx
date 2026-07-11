import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Star, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import MenteeFeedbackSurvey from "@/components/feedback/MenteeFeedbackSurvey";

type Role = "mentor" | "mentee";

interface SessionInfo {
  id: string;
  scheduled_at: string;
  mentor_id: string;
  mentee_id: string;
  mentor: { full_name: string } | null;
  mentee: { full_name: string } | null;
}

const SessionFeedback = () => {
  const { id: sessionId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [session, setSession] = useState<SessionInfo | null>(null);
  const [viewerRole, setViewerRole] = useState<Role | null>(null);
  const [existing, setExisting] = useState<{ rating: number; comment: string | null } | null>(null);
  const [loading, setLoading] = useState(true);

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [privateNote, setPrivateNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!sessionId || !user) return;
      const { data: s } = await supabase
        .from("sessions")
        .select("id, scheduled_at, mentor_id, mentee_id, mentor:users!sessions_mentor_id_fkey(full_name), mentee:users!sessions_mentee_id_fkey(full_name)")
        .eq("id", sessionId)
        .maybeSingle();
      if (!s) { setLoading(false); return; }
      setSession(s as any);
      const role: Role | null = s.mentor_id === user.id ? "mentor" : s.mentee_id === user.id ? "mentee" : null;
      setViewerRole(role);

      if (role) {
        const audience = role === "mentee" ? "mentor" : "mentee";
        const { data: fb } = await supabase
          .from("feedback")
          .select("rating, comment")
          .eq("session_id", sessionId)
          .eq("submitted_by", user.id)
          .eq("audience", audience)
          .maybeSingle();
        if (fb) setExisting(fb);
      }
      setLoading(false);
    };
    load();
  }, [sessionId, user]);

  const handleSubmit = async () => {
    if (!sessionId || !user || !viewerRole) return;
    if (rating === 0) return;

    setSubmitting(true);
    const audience = "mentee";
    const rows: any[] = [
      { session_id: sessionId, submitted_by: user.id, rating, comment: comment.trim() || null, audience },
    ];
    if (privateNote.trim()) {
      rows.push({ session_id: sessionId, submitted_by: user.id, rating, comment: privateNote.trim(), audience: "admin_private" });
    }
    const { error } = await supabase.from("feedback").insert(rows);
    setSubmitting(false);
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      toast({ title: "Thank you!", description: "Your feedback has been submitted." });
      navigate("/mentor/sessions");
    }
  };

  if (loading) {
    return <AppLayout><div className="max-w-lg mx-auto"><Skeleton className="h-64 w-full" /></div></AppLayout>;
  }

  if (!session || !viewerRole) {
    return (
      <AppLayout>
        <div className="max-w-lg mx-auto">
          <Card><CardHeader><CardTitle>Session not found</CardTitle>
          <CardDescription>You don't have access to leave feedback on this session.</CardDescription>
          </CardHeader></Card>
        </div>
      </AppLayout>
    );
  }

  const counterpartName = viewerRole === "mentee" ? session.mentor?.full_name : session.mentee?.full_name;
  const titleWord = viewerRole === "mentee" ? "your mentor" : "your mentee";

  if (existing) {
    return (
      <AppLayout>
        <div className="max-w-lg mx-auto space-y-6">
          <h1 className="text-2xl font-bold">Session Feedback</h1>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" /> Already submitted
              </CardTitle>
              <CardDescription>Thanks for rating your session with {counterpartName || titleWord}.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-1">
                {[1,2,3,4,5].map((s) => (
                  <Star key={s} className={`h-6 w-6 ${s <= existing.rating ? "fill-yellow-500 text-yellow-500" : "text-border"}`} />
                ))}
              </div>
              {existing.comment && <p className="text-sm text-muted-foreground italic whitespace-pre-line">"{existing.comment}"</p>}
              <Button variant="outline" onClick={() => navigate(-1)}>Back</Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto space-y-6">
        <h1 className="text-2xl font-bold">Session Feedback</h1>
        <Card>
          <CardHeader>
            <CardTitle>Rate your session{counterpartName ? ` with ${counterpartName}` : ""}</CardTitle>
            <CardDescription>
              {viewerRole === "mentee"
                ? "Your rating helps mentors improve and helps us measure overall program success and impact."
                : "Share how the session went. Your rating is private to admins; the mentee sees your stars."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {viewerRole === "mentee" ? (
              <MenteeFeedbackSurvey
                sessionId={sessionId!}
                userId={user!.id}
                onComplete={() => navigate("/mentee/sessions")}
              />
            ) : (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label>Rating</Label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        onClick={() => setRating(star)}
                        className="transition-transform hover:scale-110"
                      >
                        <Star
                          className={`h-8 w-8 ${star <= (hoverRating || rating) ? "fill-yellow-500 text-yellow-500" : "text-border"}`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Comment (optional)</Label>
                  <Textarea
                    rows={4}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    maxLength={1000}
                    placeholder="How did the mentee engage?"
                  />
                </div>
                {viewerRole === "mentor" && (
                  <div className="space-y-2">
                    <Label>Private note for admins (optional)</Label>
                    <Textarea
                      rows={3}
                      value={privateNote}
                      onChange={(e) => setPrivateNote(e.target.value)}
                      maxLength={1000}
                      placeholder="Anything the team should know — not visible to the mentee."
                    />
                  </div>
                )}
                <Button onClick={handleSubmit} disabled={rating === 0 || submitting} className="w-full">
                  {submitting ? "Submitting…" : "Submit Feedback"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default SessionFeedback;
