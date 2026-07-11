import { useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  useOfferingBookings,
  type OfferingBookingRow,
} from "@/features/mentor-bookings/useOfferingBookings";
import {
  useUpdateSessionStatus,
  type SessionStatus,
} from "@/features/mentor-sessions/useMentorSessions";
import { MenteeDetailsDialog } from "@/features/mentor-mentees/components/MenteeDetailsDialog";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Loader2,
  CalendarCheck,
  CheckCircle2,
  X,
  User,
  ChevronRight,
  Filter,
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

const BookingCard = ({
  booking,
  offeringId,
  onCancel,
  onUpdateStatus,
  isUpdating,
  onViewMentee,
}: {
  booking: OfferingBookingRow;
  offeringId: string;
  onCancel: (id: string) => void;
  onUpdateStatus: (id: string, status: SessionStatus) => void;
  isUpdating: boolean;
  onViewMentee: (menteeId: string) => void;
}) => {
  const navigate = useNavigate();
  const name = booking.mentee?.full_name || "Mentee";
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-3">
              <Avatar className="h-9 w-9">
                <AvatarImage src={booking.mentee?.avatar_url ?? undefined} />
                <AvatarFallback>{initialsOf(name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{name}</p>
                {booking.title && (
                  <p className="text-xs text-muted-foreground truncate">
                    {booking.title}
                  </p>
                )}
              </div>
              <StatusBadge status={booking.status} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {format(new Date(booking.scheduled_at), "MMM d, yyyy")}
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {format(new Date(booking.scheduled_at), "h:mm a")} ·{" "}
                {booking.duration_minutes} min
              </div>
            </div>

            {booking.mentee_notes && (
              <div className="mt-3 rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground line-clamp-2">
                {booking.mentee_notes}
              </div>
            )}
            {booking.status === "cancelled" && booking.cancellation_reason && (
              <p className="mt-2 text-xs text-destructive line-clamp-1">
                {booking.cancellation_reason}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2 md:flex-col md:items-stretch md:w-44 shrink-0">
            <Button
              size="sm"
              className="font-medium"
              onClick={() => navigate(`/mentor/offerings/${offeringId}/bookings/${booking.id}`)}
            >
              <ChevronRight className="h-3.5 w-3.5 mr-1.5" /> View details
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onViewMentee(booking.mentee_id)}
            >
              <User className="h-3.5 w-3.5 mr-1.5" /> Mentee profile
            </Button>

            {booking.status === "booked" && (
              <>
                <Button
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={isUpdating}
                  onClick={() => onUpdateStatus(booking.id, "completed")}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Mark completed
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  disabled={isUpdating}
                  onClick={() => onCancel(booking.id)}
                >
                  <X className="h-3.5 w-3.5 mr-1.5" /> Cancel
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const OfferingBookings = () => {
  const { offeringId } = useParams<{ offeringId: string }>();
  const { user } = useAuth();
  const [selectedMentee, setSelectedMentee] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  // filter / sort state
  const [statusFilter, setStatusFilter] = useState<SessionStatus | "all">("all");
  const [sort, setSort] = useState<"soonest" | "latest">("soonest");

  const { data: offering } = useQuery({
    queryKey: ["mentor", "offering", offeringId],
    enabled: !!offeringId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mentorship_offerings")
        .select("id, title")
        .eq("id", offeringId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: rawBookings = [], isLoading } = useOfferingBookings(
    offeringId,
    user?.id
  );
  const updateStatus = useUpdateSessionStatus(user?.id);

  const bookings = useMemo(() => {
    let list = statusFilter === "all"
      ? rawBookings
      : rawBookings.filter((b) => b.status === statusFilter);
    list = [...list].sort((a, b) => {
      const da = new Date(a.scheduled_at).getTime();
      const db = new Date(b.scheduled_at).getTime();
      return sort === "soonest" ? da - db : db - da;
    });
    return list;
  }, [rawBookings, statusFilter, sort]);

  const handleUpdateStatus = (id: string, status: SessionStatus) => {
    updateStatus.mutate({ id, status });
  };

  const handleCancelConfirm = () => {
    if (!cancelId) return;
    updateStatus.mutate({
      id: cancelId,
      status: "cancelled",
      reason: cancelReason || "Cancelled by mentor",
    }, {
      onSuccess: () => {
        setCancelId(null);
        setCancelReason("");
      },
    });
  };

  const handleViewMentee = (menteeId: string) => {
    setSelectedMentee(menteeId);
    setDialogOpen(true);
  };

  const activeFilters = statusFilter !== "all";

  return (
    <AppLayout>
      <div className="space-y-5 max-w-5xl">
        <div>
          <Link
            to="/mentor/offerings"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3"
          >
            <ArrowLeft className="h-4 w-4" /> Back to offerings
          </Link>
          <h1 className="text-2xl font-bold">
            {offering?.title ?? "Bookings"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {rawBookings.length} {rawBookings.length === 1 ? "booking" : "bookings"} for this offering
          </p>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Filter className="h-3.5 w-3.5" />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as SessionStatus | "all")}>
            <SelectTrigger className="w-full sm:w-36 h-8 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="booked">Booked</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="no_show">No-show</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as "soonest" | "latest")}>
            <SelectTrigger className="w-full sm:w-36 h-8 text-xs">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="soonest">Soonest first</SelectItem>
              <SelectItem value="latest">Latest first</SelectItem>
            </SelectContent>
          </Select>
          {activeFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs px-2 text-muted-foreground"
              onClick={() => setStatusFilter("all")}
            >
              <X className="h-3 w-3 mr-1" /> Clear filters
            </Button>
          )}
          <span className="ml-auto text-xs text-muted-foreground">
            {bookings.length} shown
          </span>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-12">
            <Loader2 className="h-6 w-6 animate-spin" /> Loading bookings…
          </div>
        ) : rawBookings.length === 0 ? (
          <Card className="border-dashed p-12 text-center flex flex-col items-center justify-center">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <CalendarCheck className="h-6 w-6 text-primary" />
            </div>
            <p className="text-lg font-semibold">No bookings yet</p>
            <p className="text-sm text-muted-foreground max-w-md mt-1">
              When mentees book this offering, their sessions will appear here.
            </p>
          </Card>
        ) : bookings.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No bookings match the current filter.
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((b) => (
              <BookingCard
                key={b.id}
                booking={b}
                offeringId={offeringId!}
                onCancel={(id) => { setCancelId(id); setCancelReason(""); }}
                onUpdateStatus={handleUpdateStatus}
                isUpdating={updateStatus.isPending}
                onViewMentee={handleViewMentee}
              />
            ))}
          </div>
        )}
      </div>

      <MenteeDetailsDialog
        menteeId={selectedMentee}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setSelectedMentee(null);
        }}
      />

      {/* Cancel confirm dialog */}
      <AlertDialog open={!!cancelId} onOpenChange={(open) => { if (!open) { setCancelId(null); setCancelReason(""); } }}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
            <AlertDialogDescription>
              The mentee will be notified of the cancellation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label className="text-xs text-muted-foreground">Reason (optional)</Label>
            <Textarea
              className="mt-1.5"
              rows={2}
              placeholder="Let the mentee know why…"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep booking</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleCancelConfirm}
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

export default OfferingBookings;
