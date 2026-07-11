import { useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useBookingDetail } from "@/features/mentor-bookings/useBookingDetail";
import {
  useUpdateSessionStatus,
  useUpdateSessionDetails,
  type SessionStatus,
} from "@/features/mentor-sessions/useMentorSessions";
import { MenteeDetailsDialog } from "@/features/mentor-mentees/components/MenteeDetailsDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Loader2,
  CheckCircle2,
  X,
  UserX,
  ExternalLink,
  Save,
  User,
  Star,
  MessageSquare,
  Tag,
  Video,
} from "lucide-react";

const initialsOf = (name: string) =>
  (name || "M")
    .split(" ")
    .map((s) => s.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();

const StatusBadge = ({ status }: { status: SessionStatus }) => {
  switch (status) {
    case "completed":
      return (
        <Badge className="bg-blue-500/15 hover:bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/35">
          Completed
        </Badge>
      );
    case "cancelled":
      return (
        <Badge className="bg-destructive/15 hover:bg-destructive/15 text-destructive border border-destructive/35">
          Cancelled
        </Badge>
      );
    case "no_show":
      return <Badge variant="secondary">No-show</Badge>;
    default:
      return (
        <Badge className="bg-emerald-500/15 hover:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/35">
          Booked
        </Badge>
      );
  }
};

const StarRating = ({ rating }: { rating: number }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((n) => (
      <Star
        key={n}
        className={`h-4 w-4 ${n <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`}
      />
    ))}
    <span className="ml-1.5 text-sm font-medium">{rating}/5</span>
  </div>
);

const BookingDetail = () => {
  const { offeringId, bookingId, sessionId } = useParams<{ offeringId?: string; bookingId?: string; sessionId?: string }>();
  const sessionIdToLoad = bookingId ?? sessionId;
  const fromSessions = !bookingId && !!sessionId;
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const { data: booking, isLoading, error } = useBookingDetail(sessionIdToLoad);
  const updateStatus = useUpdateSessionStatus(user?.id);
  const updateDetails = useUpdateSessionDetails(user?.id);

  const [meetingUrl, setMeetingUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [savingDetails, setSavingDetails] = useState(false);

  const [menteeDialogOpen, setMenteeDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const displayMeetingUrl = meetingUrl !== null ? meetingUrl : (booking?.meeting_url ?? "");
  const displayNotes = notes !== null ? notes : (booking?.notes ?? "");

  const meetingUrlDirty = meetingUrl !== null && meetingUrl !== (booking?.meeting_url ?? "");
  const notesDirty = notes !== null && notes !== (booking?.notes ?? "");
  const detailsDirty = meetingUrlDirty || notesDirty;

  const handleSaveDetails = async () => {
    if (!booking) return;
    setSavingDetails(true);
    try {
      await updateDetails.mutateAsync({
        id: booking.id,
        notes: displayNotes,
        meeting_url: displayMeetingUrl,
      });
      setMeetingUrl(null);
      setNotes(null);
      toast({ title: "Saved", description: "Session details updated." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Save failed", description: err.message });
    } finally {
      setSavingDetails(false);
    }
  };

  const handleMarkCompleted = () => {
    if (!booking) return;
    updateStatus.mutate(
      { id: booking.id, status: "completed" },
      {
        onSuccess: () => toast({ title: "Session marked as completed" }),
        onError: (err: any) => toast({ variant: "destructive", title: "Error", description: err.message }),
      }
    );
  };

  const handleMarkNoShow = () => {
    if (!booking) return;
    updateStatus.mutate(
      { id: booking.id, status: "no_show" },
      {
        onSuccess: () => toast({ title: "Session marked as no-show" }),
        onError: (err: any) => toast({ variant: "destructive", title: "Error", description: err.message }),
      }
    );
  };

  const handleCancel = () => {
    if (!booking) return;
    updateStatus.mutate(
      { id: booking.id, status: "cancelled", reason: cancelReason || "Cancelled by mentor" },
      {
        onSuccess: () => {
          toast({ title: "Booking cancelled" });
          setCancelDialogOpen(false);
          setCancelReason("");
        },
        onError: (err: any) => toast({ variant: "destructive", title: "Error", description: err.message }),
      }
    );
  };

  const cleanComment = (comment: string | null) => {
    if (!comment) return "";
    const delimiter = "---\nSurvey Responses:\n";
    const delimiterIndex = comment.indexOf(delimiter);
    if (delimiterIndex !== -1) {
      return comment.substring(0, delimiterIndex).trim();
    }
    if (comment.startsWith("Survey Responses:\n")) {
      return "";
    }
    return comment;
  };

  const menteeFeedback = booking?.feedback?.find((f) => f.audience === "mentor") ?? null;
  const mentorFeedback = booking?.feedback?.find((f) => f.audience === "mentee") ?? null;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-20 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading booking…
        </div>
      </AppLayout>
    );
  }

  const backHref = fromSessions
    ? "/mentor/sessions"
    : `/mentor/offerings/${offeringId}/bookings`;
  const backLabel = fromSessions ? "Back to sessions" : "Back to bookings";

  if (error || !booking) {
    return (
      <AppLayout>
        <div className="max-w-3xl">
          <Link
            to={backHref}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="h-4 w-4" /> {backLabel}
          </Link>
          <p className="text-destructive text-sm">Failed to load booking details.</p>
        </div>
      </AppLayout>
    );
  }

  const menteeName = booking.mentee?.full_name || "Mentee";

  return (
    <AppLayout>
      <div className="max-w-5xl space-y-6 pb-6">
        {/* Header */}
        <div>
          <Link
            to={backHref}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3"
          >
            <ArrowLeft className="h-4 w-4" /> {backLabel}
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold">Booking Details</h1>
            <StatusBadge status={booking.status} />
          </div>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column */}
          <div className="space-y-6">
            {/* Session Info Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" /> Session info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {booking.offering?.title && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Offering</p>
                    <p className="font-medium">{booking.offering.title}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Date</p>
                    <p className="font-medium">{format(new Date(booking.scheduled_at), "EEEE, MMM d, yyyy")}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Time</p>
                    <p className="font-medium flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      {format(new Date(booking.scheduled_at), "h:mm a")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Duration</p>
                    <p className="font-medium">{booking.duration_minutes} minutes</p>
                  </div>
                  {booking.offering && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Price</p>
                      <p className="font-medium">
                        {booking.offering.price === 0
                          ? "Free"
                          : `${booking.offering.currency ?? "INR"} ${booking.offering.price}`}
                      </p>
                    </div>
                  )}
                </div>

                {booking.offering?.category && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Tag className="h-3.5 w-3.5" />
                    <span>{booking.offering.category}</span>
                  </div>
                )}

                {booking.program && (
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: booking.program.color || "#888" }}
                    />
                    <span className="text-xs text-muted-foreground">{booking.program.name}</span>
                  </div>
                )}

                {booking.title && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Session title</p>
                    <p>{booking.title}</p>
                  </div>
                )}

                {booking.topic && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Topic</p>
                    <p>{booking.topic}</p>
                  </div>
                )}

                {booking.status === "cancelled" && booking.cancellation_reason && (
                  <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
                    <p className="text-xs font-medium text-destructive mb-0.5">Cancellation reason</p>
                    <p className="text-xs text-destructive/90">{booking.cancellation_reason}</p>
                    {booking.cancelled_at && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(booking.cancelled_at), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Meeting link card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Video className="h-4 w-4 text-primary" /> Meeting link
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Meeting URL</Label>
                  <Input
                    type="url"
                    placeholder="https://meet.google.com/..."
                    value={displayMeetingUrl}
                    onChange={(e) => setMeetingUrl(e.target.value)}
                  />
                </div>
                {displayMeetingUrl && (
                  <a
                    href={displayMeetingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Open meeting
                  </a>
                )}
              </CardContent>
            </Card>

            {/* Private notes */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" /> Private notes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  placeholder="Notes about this session (only visible to you)…"
                  rows={5}
                  value={displayNotes}
                  onChange={(e) => setNotes(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Only you can see these notes.</p>
              </CardContent>
            </Card>
          </div>

          {/* Right column */}
          <div className="space-y-6">
            {/* Mentee card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" /> Mentee
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={booking.mentee?.avatar_url ?? undefined} />
                    <AvatarFallback>{initialsOf(menteeName)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{menteeName}</p>
                    {booking.mentee?.email && (
                      <a
                        href={`mailto:${booking.mentee.email}`}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors truncate block"
                      >
                        {booking.mentee.email}
                      </a>
                    )}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setMenteeDialogOpen(true)}
                >
                  <User className="h-3.5 w-3.5 mr-1.5" /> View full mentee profile
                </Button>

                {booking.mentee_notes && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-xs text-muted-foreground mb-1.5">Mentee's notes</p>
                      <div className="rounded-lg bg-muted/40 p-3 text-sm">
                        {booking.mentee_notes}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Feedback card — only for completed sessions */}
            {booking.status === "completed" && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Star className="h-4 w-4 text-primary" /> Session Feedback
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Mentee feedback about mentor */}
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Mentee Feedback on Session
                    </h4>
                    {menteeFeedback ? (
                      <div className="space-y-3">
                        <StarRating rating={menteeFeedback.rating} />
                        {cleanComment(menteeFeedback.comment) && (
                          <div className="rounded-lg bg-muted/40 p-3 text-sm italic text-muted-foreground">
                            "{cleanComment(menteeFeedback.comment)}"
                          </div>
                        )}
                        {menteeFeedback.response && (
                          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
                            <div className="text-xs font-semibold text-primary mb-1">Your response</div>
                            <div className="whitespace-pre-wrap text-foreground font-medium">{menteeFeedback.response}</div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">
                        No feedback submitted by mentee yet.
                      </p>
                    )}
                  </div>

                  {/* Mentor feedback about mentee */}
                  {mentorFeedback && (
                    <div className="border-t pt-4">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        Your Feedback to Mentee
                      </h4>
                      <div className="space-y-3">
                        <StarRating rating={mentorFeedback.rating} />
                        {mentorFeedback.comment && (
                          <div className="rounded-lg bg-muted/40 p-3 text-sm italic text-muted-foreground">
                            "{mentorFeedback.comment}"
                          </div>
                        )}
                        {mentorFeedback.response && (
                          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
                            <div className="text-xs font-semibold text-primary mb-1">Mentee's response</div>
                            <div className="whitespace-pre-wrap text-foreground font-medium">{mentorFeedback.response}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Sticky bottom bar */}
      <div className="sticky bottom-0 z-20 border-t bg-background/95 backdrop-blur shadow-lg -mx-3 -mb-3 sm:-mx-4 sm:-mb-4 md:-mx-6 md:-mb-6 px-3 sm:px-4 md:px-6 py-3 mt-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Save details */}
          <Button
            variant="outline"
            size="sm"
            disabled={!detailsDirty || savingDetails}
            onClick={handleSaveDetails}
            className="sm:w-auto"
          >
            {savingDetails ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5 mr-1.5" />
            )}
            Save changes
          </Button>

          {/* Status actions — only for booked */}
          {booking.status === "booked" && (
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white flex-1 sm:flex-none"
                disabled={updateStatus.isPending}
                onClick={handleMarkCompleted}
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Mark completed
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 sm:flex-none"
                disabled={updateStatus.isPending}
                onClick={handleMarkNoShow}
              >
                <UserX className="h-3.5 w-3.5 mr-1.5" /> No-show
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive flex-1 sm:flex-none"
                disabled={updateStatus.isPending}
                onClick={() => setCancelDialogOpen(true)}
              >
                <X className="h-3.5 w-3.5 mr-1.5" /> Cancel
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Mentee details dialog */}
      <MenteeDetailsDialog
        menteeId={booking.mentee_id}
        open={menteeDialogOpen}
        onOpenChange={setMenteeDialogOpen}
      />

      {/* Cancel confirm dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the session as cancelled. The mentee will be notified.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label className="text-xs text-muted-foreground">Reason (optional)</Label>
            <Textarea
              className="mt-1.5"
              rows={3}
              placeholder="Let the mentee know why…"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep booking</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleCancel}
              disabled={updateStatus.isPending}
            >
              {updateStatus.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cancel booking"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default BookingDetail;
