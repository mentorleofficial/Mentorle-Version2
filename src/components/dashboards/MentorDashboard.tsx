import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderKanban, Award, AlertCircle, Star } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import MentorProfileCompletionModal from "@/features/mentor-profile/components/MentorProfileCompletionModal";
import { Link } from "react-router-dom";
import InactiveMentorBanner from "@/components/InactiveMentorBanner";
import { useMyPrograms } from "@/features/programs/hooks/useMyPrograms";
import { useMentorBadges } from "@/features/badges/api";
import BadgeChip from "@/components/badges/BadgeChip";
import { TooltipProvider } from "@/components/ui/tooltip";
import ProgramBadge from "@/components/programs/ProgramBadge";
import { useMentorDashboardData } from "@/features/mentor-dashboard/useMentorDashboardData";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import NextSessionCard from "./mentor/NextSessionCard";
import MentorStatsRow from "./mentor/MentorStatsRow";
import WeeklySchedule from "./mentor/WeeklySchedule";
import MentorInsightsPanel from "./mentor/MentorInsightsPanel";
import MyMenteesPanel from "./mentor/MyMenteesPanel";
import RecentFeedbackPanel from "./mentor/RecentFeedbackPanel";
import RecentActivityFeed from "./mentor/RecentActivityFeed";

const MentorDashboard = () => {
  const { user, profile, isApproved, profileCompleteness } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useMentorDashboardData(user?.id);
  const { data: programs = [] } = useMyPrograms();
  const { data: badges = [] } = useMentorBadges(user?.id);

  const [dismissedSessionId, setDismissedSessionId] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [privateNote, setPrivateNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const pendingRatingSession = useMemo(() => {
    if (!data?.sessions || !data?.feedback || !user) return null;
    const completed = data.sessions.filter((s) => s.status === "completed");
    const ratedSessionIds = new Set(
      data.feedback
        .filter((f) => f.submitted_by === user.id && f.audience === "mentee")
        .map((f) => f.session_id)
    );
    return completed.find((s) => !ratedSessionIds.has(s.id)) ?? null;
  }, [data?.sessions, data?.feedback, user]);

  const showFeedbackModal = !!pendingRatingSession && pendingRatingSession.id !== dismissedSessionId;

  const handleSubmitFeedback = async () => {
    if (!pendingRatingSession || rating === 0 || !user) return;
    setSubmitting(true);
    const rows: Array<{
      session_id: string;
      submitted_by: string;
      rating: number;
      comment: string | null;
      audience: "mentee" | "admin_private";
    }> = [
      {
        session_id: pendingRatingSession.id,
        submitted_by: user.id,
        rating,
        comment: comment.trim() || null,
        audience: "mentee",
      },
    ];
    if (privateNote.trim()) {
      rows.push({
        session_id: pendingRatingSession.id,
        submitted_by: user.id,
        rating,
        comment: privateNote.trim(),
        audience: "admin_private",
      });
    }

    try {
      const { error } = await supabase.from("feedback").insert(rows);
      if (error) throw error;

      toast({
        title: "Feedback submitted",
        description: "Thank you for rating your session!",
      });

      setRating(0);
      setComment("");
      setPrivateNote("");
      setDismissedSessionId(pendingRatingSession.id);
      qc.invalidateQueries({ queryKey: ["mentor", "dashboard", user.id] });
      qc.invalidateQueries({ queryKey: ["mentor", "sessions", user.id] });
      qc.invalidateQueries({ queryKey: ["mentor", "rated-sessions", user.id] });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Error submitting feedback",
        description: (e as Error).message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const computed = useMemo(() => {
    const sessions = data?.sessions ?? [];
    const now = Date.now();
    const upcoming = sessions.filter(
      (s) => s.status === "booked" && new Date(s.scheduled_at).getTime() >= now
    );
    const completed = sessions.filter((s) => s.status === "completed");
    const hours = completed.reduce((sum, s) => sum + (s.duration_minutes || 0), 0) / 60;
    const ratings = (data?.feedback ?? []).map((f) => f.rating);
    const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
    const next = upcoming.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))[0] ?? null;
    const mentees = new Set(sessions.map((s) => s.mentee_id)).size;
    return {
      upcomingCount: upcoming.length,
      completedCount: completed.length,
      hours,
      avg,
      next,
      mentees,
    };
  }, [data]);

  const firstName = profile?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "there";

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        {!isApproved && <InactiveMentorBanner />}
        <Skeleton className="h-32 w-full" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  return (
    <TooltipProvider>
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-serif)" }}>
          Welcome back, {firstName}!
        </h2>
        <p className="text-sm text-muted-foreground">
          Here's what's happening with your content and sessions
        </p>
      </div>

      {data?.profile && (
        <MentorProfileCompletionModal
          profileData={data.profile}
          isApproved={isApproved}
        />
      )}

      {!isApproved && <InactiveMentorBanner />}
      {isApproved && profileCompleteness < 100 && (
        <Alert className="border-amber-500/30 bg-amber-500/5">
          <AlertCircle className="h-4 w-4 text-amber-500" />
          <AlertTitle className="text-amber-700 font-semibold">Profile Incomplete</AlertTitle>
          <AlertDescription className="text-muted-foreground">
            Your account is approved, but you must complete your profile to 100% to unlock your availability calendar, program modules, bookings, and active features.
            <Button asChild variant="link" className="h-auto p-0 ml-1.5 text-xs text-primary font-bold">
              <Link to="/mentor/profile">Complete Profile Now</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <NextSessionCard session={computed.next} />

      {badges.length > 0 && (
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Your badges</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {badges.map((mb) => <BadgeChip key={mb.id} badge={mb.badge} />)}
          </CardContent>
        </Card>
      )}

      <MentorStatsRow
        upcoming={computed.upcomingCount}
        completed={computed.completedCount}
        hours={computed.hours}
        avgRating={computed.avg}
        mentees={computed.mentees}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 min-w-0">
          <WeeklySchedule sessions={data.sessions} />
        </div>
        <div className="min-w-0">
          <MentorInsightsPanel
            sessions={data.sessions}
            feedback={data.feedback}
            profile={data.profile}
            availabilityCount={data.availabilityCount}
            userId={user?.id}
          />
        </div>
      </div>

      <MyMenteesPanel sessions={data.sessions} />

      {programs.length > 0 && (
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderKanban className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">My Programs ({programs.length})</CardTitle>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/mentor/programs">View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {programs.slice(0, 6).map((p) => (
              <ProgramBadge key={p.id} name={p.name} color={p.color} to={`/mentor/programs/${p.slug}`} />
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <RecentFeedbackPanel feedback={data.feedback} />
        <RecentActivityFeed sessions={data.sessions} />
      </div>

      <Dialog 
        open={showFeedbackModal} 
        onOpenChange={(open) => {
          if (!open && pendingRatingSession) {
            setDismissedSessionId(pendingRatingSession.id);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>How was your session?</DialogTitle>
            <DialogDescription>
              Please rate your session with{" "}
              <strong>{pendingRatingSession?.mentee?.full_name || "your mentee"}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Rating</Label>
              <div className="flex gap-1.5 justify-center py-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(star)}
                    className="transition-transform hover:scale-110 focus:outline-none"
                  >
                    <Star
                      className={`h-8 w-8 ${
                        star <= (hoverRating || rating)
                          ? "fill-yellow-500 text-yellow-500"
                          : "text-muted-foreground/30"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="feedback-comment">Comments (optional)</Label>
              <Textarea
                id="feedback-comment"
                placeholder="How did the mentee engage?"
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="feedback-private">Private note for admins (optional)</Label>
              <Textarea
                id="feedback-private"
                placeholder="Anything the team should know — not visible to the mentee."
                rows={2}
                value={privateNote}
                onChange={(e) => setPrivateNote(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 border-t pt-4 mt-2">
            <Button
              variant="ghost"
              onClick={() => {
                if (pendingRatingSession) {
                  setDismissedSessionId(pendingRatingSession.id);
                }
              }}
              disabled={submitting}
            >
              Remind me later
            </Button>
            <Button
              onClick={handleSubmitFeedback}
              disabled={rating === 0 || submitting}
            >
              {submitting ? "Submitting…" : "Submit Feedback"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  );
};

export default MentorDashboard;
