import { useEffect, useMemo, useState } from "react";
import { fromZonedTime } from "date-fns-tz";
import { APP_TZ, formatIST, formatISTDateTime } from "@/lib/datetime";
import { useAuth } from "@/contexts/AuthContext";
import { useMyPrograms } from "@/features/programs/hooks/useMyPrograms";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, ChevronLeft, ChevronRight, Clock, Globe, Info, Video, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getMonthMatrix,
  getRangesForDate,
  getOverrideKind,
  sliceIntoSlots,
  formatSlotLabel,
  hasAnyAvailability,
  isSameDay,
} from "@/features/availability/previewUtils";
import {
  useBookSessionStatic,
  useBookedTimes,
  useBookSession,
  type BookingOffering,
} from "@/features/mentee-booking/useBookSessionData";
import AddToCalendarMenu from "@/components/AddToCalendarMenu";
import { markdownToHtml } from "@/components/ui/markdown-editor";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DOW_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const MAX_DAYS_AHEAD = 90;

const stripMarkdown = (md: string) =>
  markdownToHtml(md || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

export interface BookingModalProps {
  mentorId: string;
  offeringId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rescheduleSessionId?: string | null;
  lockOffering?: boolean;
}

export default function BookingModal({ mentorId, offeringId, open, onOpenChange, rescheduleSessionId, lockOffering }: BookingModalProps) {

  const { user } = useAuth();
  const { toast } = useToast();
  const { data: staticData, isPending } = useBookSessionStatic(open ? mentorId : undefined);
  const { data: bookedTimes = [] } = useBookedTimes(open ? mentorId : undefined, rescheduleSessionId ?? undefined);
  const bookMutation = useBookSession();
  const { data: menteePrograms = [] } = useMyPrograms();
  const [mentorProgramIds, setMentorProgramIds] = useState<string[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);

  useEffect(() => {
    if (!mentorId || !open) return;
    supabase
      .from("program_mentors")
      .select("program_id")
      .eq("mentor_id", mentorId)
      .then(({ data }) => {
        if (data) setMentorProgramIds(data.map((r) => r.program_id));
      });
  }, [mentorId, open]);

  const sharedPrograms = useMemo(() => {
    const mentorSet = new Set(mentorProgramIds);
    return menteePrograms.filter((p) => mentorSet.has(p.id));
  }, [menteePrograms, mentorProgramIds]);

  useEffect(() => {
    if (sharedPrograms.length === 1) setSelectedProgramId(sharedPrograms[0].id);
    else if (sharedPrograms.length > 1 && !selectedProgramId) setSelectedProgramId(sharedPrograms[0].id);
  }, [sharedPrograms]);

  const mentor = staticData?.mentor ?? null;
  const slots = staticData?.slots ?? [];
  const overrides = staticData?.overrides ?? [];
  const mentorInitials = mentor?.full_name?.split(" ").map((n: string) => n[0]).join("").toUpperCase() || "M";

  const [selectedOffering, setSelectedOffering] = useState<BookingOffering | null>(null);

  useEffect(() => {
    if (!staticData?.offerings || staticData.offerings.length === 0) return;
    if (offeringId) {
      const found = staticData.offerings.find((o) => o.id === offeringId);
      if (found) { setSelectedOffering(found); return; }
    }
    setSelectedOffering(staticData.offerings[0]);
  }, [staticData?.offerings, offeringId]);

  useEffect(() => {
    if (!open) {
      setSelectedDate(null);
      setSelectedTime(null);
      setNotes("");
      setBookedSession(null);
    }
  }, [open]);

  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);
  const maxDate = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + MAX_DAYS_AHEAD);
    return d;
  }, [today]);

  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [bookedSession, setBookedSession] = useState<{ scheduledAt: Date; meetingUrl: string } | null>(null);

  const matrix = useMemo(
    () => getMonthMatrix(cursor.getFullYear(), cursor.getMonth()),
    [cursor]
  );

  const toISTDate = (date: Date, hhmm: string): Date => {
    const y = date.getFullYear();
    const mo = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return fromZonedTime(`${y}-${mo}-${d}T${hhmm}:00`, APP_TZ);
  };

  const getSlotTimes = (date: Date, hhmm: string) => {
    const startMs = toISTDate(date, hhmm).getTime();
    const duration = selectedOffering?.duration_minutes ?? 30;
    const endMs = startMs + duration * 60 * 1000;
    const buffer = staticData?.mentorProfile?.buffer_time_minutes ?? 0;
    return { startMs, endMs, blockedEndMs: endMs + buffer * 60 * 1000 };
  };

  const isPastSlot = (date: Date, hhmm: string) => {
    const { startMs } = getSlotTimes(date, hhmm);
    const minNoticeHours = staticData?.mentorProfile?.minimum_notice_hours ?? 0;
    return startMs < Date.now() + Math.max(minNoticeHours * 60 * 60 * 1000, 5 * 60 * 1000);
  };

  const isSlotTaken = (date: Date, hhmm: string) => {
    const { startMs, blockedEndMs } = getSlotTimes(date, hhmm);
    const buffer = staticData?.mentorProfile?.buffer_time_minutes ?? 0;
    return bookedTimes.some((booking) => {
      const bStartMs = new Date(booking.scheduled_at).getTime();
      const bBlockedEndMs = bStartMs + (booking.duration_minutes + buffer) * 60 * 1000;
      return Math.max(startMs, bStartMs) < Math.min(blockedEndMs, bBlockedEndMs);
    });
  };

  const isDayFullyBooked = (date: Date) => {
    const ranges = getRangesForDate(date, slots, overrides);
    const list = sliceIntoSlots(ranges, selectedOffering?.duration_minutes ?? 30).filter((t) => !isPastSlot(date, t));
    if (list.length === 0) return false;
    return list.every((t) => isSlotTaken(date, t));
  };

  const goPrev = () => {
    const next = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1);
    if (next < new Date(today.getFullYear(), today.getMonth(), 1)) return;
    setCursor(next);
  };
  const goNext = () => {
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    if (next > maxDate) return;
    setCursor(next);
  };

  const dayRanges = useMemo(
    () => (selectedDate ? getRangesForDate(selectedDate, slots, overrides) : []),
    [selectedDate, slots, overrides]
  );

  // Only show non-booked, non-past slots (hide taken slots entirely)
  const daySlotList = useMemo(
    () =>
      sliceIntoSlots(dayRanges, selectedOffering?.duration_minutes ?? 30).filter(
        (t) => !(selectedDate && isPastSlot(selectedDate, t)) && !(selectedDate && isSlotTaken(selectedDate, t))
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dayRanges, selectedDate, selectedOffering, bookedTimes]
  );

  const selectedKind = useMemo(
    () => (selectedDate ? getOverrideKind(selectedDate, overrides) : null),
    [selectedDate, overrides]
  );

  const slotEndForSelected = useMemo(() => {
    if (!selectedDate || !selectedTime) return null;
    const [h, m] = selectedTime.split(":").map(Number);
    const total = h * 60 + m + (selectedOffering?.duration_minutes ?? 30);
    const eh = Math.floor(total / 60);
    const em = total % 60;
    return `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
  }, [selectedDate, selectedTime, selectedOffering]);

  const booking = bookMutation.isPending;

  const handleBook = async () => {
    if (!selectedDate || !selectedTime || !user || !mentorId) return;
    const scheduledAt = toISTDate(selectedDate, selectedTime);
    const duration = selectedOffering?.duration_minutes ?? 30;

    try {
      const { meetingUrl } = await bookMutation.mutateAsync({
        mentorId,
        menteeId: user.id,
        scheduledAt,
        durationMinutes: duration,
        notes,
        title: selectedOffering?.title || `Session with ${mentor?.full_name ?? "mentor"}`,
        topic: "",
        rescheduleId: rescheduleSessionId ?? null,
        offeringId: selectedOffering?.id || null,
        programId: selectedProgramId,
      });

      if (mentor?.email && user.email) {
        supabase.functions.invoke("send-booking-email", {
          body: {
            mentorEmail: mentor.email,
            mentorName: mentor.full_name || "your mentor",
            menteeEmail: user.email,
            menteeName: (user.user_metadata as Record<string, unknown>)?.full_name || user.email,
            scheduledAtISO: scheduledAt.toISOString(),
            durationMinutes: duration,
            meetingUrl,
            menteeNotes: notes || undefined,
          },
        }).catch(() => {});
      }

      toast({ title: "Session booked!", description: `Scheduled for ${formatISTDateTime(scheduledAt)}` });
      setBookedSession({ scheduledAt, meetingUrl });
    } catch (e) {
      const err = e as { message?: string; code?: string };
      const friendly =
        err?.message?.includes("already been rescheduled")
          ? "This session has already been rescheduled once."
          : err?.message?.includes("overlap") || err?.code === "23P01" || err?.code === "23505"
          ? "That slot was just taken — please pick another."
          : err?.message ?? "Booking failed";
      toast({ variant: "destructive", title: "Booking failed", description: friendly });

    }
  };

  const mentorSubtitle =
    mentor?.current_role && mentor?.current_organization
      ? `${mentor.current_role} at ${mentor.current_organization}`
      : mentor?.current_role || mentor?.headline || null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden p-0 gap-0 flex flex-col">
        {bookedSession ? (
          <div className="p-6 space-y-4 overflow-y-auto">
            <DialogHeader>
              <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-primary" />
              </div>
              <DialogTitle className="text-center text-xl">Session booked!</DialogTitle>
            </DialogHeader>
            <p className="text-center text-sm text-muted-foreground">
              with <strong>{mentor?.full_name}</strong> on{" "}
              {formatISTDateTime(bookedSession.scheduledAt)}
            </p>
            <a href={bookedSession.meetingUrl} target="_blank" rel="noopener noreferrer" className="block">
              <Button size="lg" className="w-full">
                <Video className="mr-2 h-4 w-4" /> Join meeting
              </Button>
            </a>
            <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs">
              <span className="truncate flex-1 font-mono text-muted-foreground">{bookedSession.meetingUrl}</span>
              <Button
                variant="ghost" size="sm" className="h-7 px-2"
                onClick={() => { navigator.clipboard.writeText(bookedSession.meetingUrl); toast({ title: "Link copied" }); }}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex justify-center">
              <AddToCalendarMenu
                event={{
                  title: `Mentorship session with ${mentor?.full_name}`,
                  description: `Meeting link: ${bookedSession.meetingUrl}`,
                  location: bookedSession.meetingUrl,
                  startISO: bookedSession.scheduledAt.toISOString(),
                  durationMinutes: selectedOffering?.duration_minutes ?? 30,
                }}
                filename={`mentorle-session-${formatIST(bookedSession.scheduledAt, "yyyy-MM-dd-HHmm")}.ics`}
              />
            </div>
            <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="shrink-0 border-b bg-muted/30 px-5 py-4 pr-14">
              <DialogHeader className="space-y-3 text-left">
                <div className="flex items-start gap-3.5 min-w-0">
                  <Avatar className="h-12 w-12 shrink-0 border-2 border-background shadow-sm">
                    <AvatarImage src={mentor?.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">{mentorInitials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      {rescheduleSessionId ? "Reschedule session" : "Book a session"}
                    </p>
                    <DialogTitle className="text-lg font-bold leading-tight mt-0.5 truncate">
                      {mentor?.full_name ?? "Loading mentor…"}
                    </DialogTitle>
                    {mentorSubtitle && (
                      <p className="text-sm text-muted-foreground mt-0.5 truncate">{mentorSubtitle}</p>
                    )}
                  </div>
                </div>

                {selectedOffering && (
                  <div className="rounded-lg border bg-background px-3 py-2.5 flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{selectedOffering.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {selectedOffering.duration_minutes} min
                        </span>
                        <span>·</span>
                        <span>{selectedOffering.price === 0 ? "Free" : `₹${selectedOffering.price}`}</span>
                      </p>
                    </div>
                    <Badge variant="secondary" className="shrink-0 text-[10px] font-medium">
                      {selectedOffering.category || "Session"}
                    </Badge>
                  </div>
                )}

                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 shrink-0" />
                  All times shown in <span className="font-medium text-foreground">India Standard Time (IST)</span>
                </p>
              </DialogHeader>
            </div>

            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
              {isPending && (
                <p className="text-sm text-muted-foreground text-center py-8">Loading availability…</p>
              )}

              {!isPending && staticData && (
                <>
                  {/* Offering selector — only shown when no specific offering was pre-selected */}
                  {!offeringId && !lockOffering && staticData.offerings.length > 1 && (
                    <div>
                      <p className="text-sm font-medium mb-2">Choose an offering</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {staticData.offerings.map((o) => {
                          const isSelected = selectedOffering?.id === o.id;
                          return (
                            <button
                              key={o.id}
                              type="button"
                              onClick={() => { setSelectedOffering(o); setSelectedDate(null); setSelectedTime(null); }}
                              className={cn(
                                "text-left rounded-xl border p-3 transition-all",
                                isSelected
                                  ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                                  : "border-border hover:border-primary/40"
                              )}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span className="text-sm font-semibold">{o.title}</span>
                                <Badge variant={isSelected ? "default" : "secondary"} className="shrink-0 text-xs">
                                  {o.price === 0 ? "Free" : `₹${o.price}`}
                                </Badge>
                              </div>
                              {o.description && (
                                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                                  {stripMarkdown(o.description)}
                                </p>
                              )}
                              <p className="mt-2 text-xs text-muted-foreground">{o.duration_minutes} min</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Calendar + Slots grid */}
                  {selectedOffering && (
                    <div className="grid gap-4 sm:grid-cols-[1fr_220px]">
                      {/* Calendar */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goPrev} aria-label="Previous month">
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <span className="text-sm font-semibold">
                            {MONTH_NAMES[cursor.getMonth()]} {cursor.getFullYear()}
                          </span>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goNext} aria-label="Next month">
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-7 gap-0.5 text-[10px] uppercase tracking-wide text-muted-foreground text-center">
                          {DOW_LABELS.map((d, i) => <div key={i}>{d}</div>)}
                        </div>

                        <div className="grid grid-cols-7 gap-0.5">
                          {matrix.flat().map((date, i) => {
                            const inMonth = date.getMonth() === cursor.getMonth();
                            const isPast = date < today;
                            const tooFar = date > maxDate;
                            const kind = getOverrideKind(date, overrides);
                            const hasAvail = hasAnyAvailability(date, slots, overrides);
                            const fullyBooked = hasAvail && isDayFullyBooked(date);
                            const isSelected = selectedDate && isSameDay(date, selectedDate);
                            const isToday = isSameDay(date, today);
                            const isBlocked = kind === "blocked";
                            const isCustom = kind === "custom";
                            const clickable = inMonth && !isPast && !tooFar && hasAvail && !fullyBooked && !isBlocked;

                            return (
                              <button
                                key={i}
                                type="button"
                                disabled={!clickable}
                                onClick={() => { if (!clickable) return; setSelectedDate(date); setSelectedTime(null); }}
                                className={cn(
                                  "relative aspect-square rounded-md text-xs flex items-center justify-center transition-colors",
                                  !inMonth && "text-muted-foreground/30",
                                  inMonth && (isPast || tooFar) && "text-muted-foreground/30 cursor-not-allowed",
                                  inMonth && !isPast && !tooFar && !hasAvail && "text-muted-foreground/50 cursor-not-allowed",
                                  clickable && !isCustom && !isSelected && "bg-primary/10 text-primary font-medium hover:bg-primary/20",
                                  clickable && isCustom && !isSelected && "bg-amber-500/10 text-amber-700 dark:text-amber-400 font-medium ring-1 ring-amber-500/50 hover:bg-amber-500/20",
                                  fullyBooked && !isSelected && "bg-muted text-muted-foreground line-through cursor-not-allowed",
                                  isBlocked && !isSelected && "text-muted-foreground line-through",
                                  isSelected && "bg-primary text-primary-foreground font-semibold",
                                  isToday && !isSelected && "ring-1 ring-primary/40"
                                )}
                              >
                                {date.getDate()}
                                {fullyBooked && <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-muted-foreground" />}
                              </button>
                            );
                          })}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground pt-1 border-t">
                          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-primary/30" /> Available</span>
                          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded ring-1 ring-amber-500/50" /> Custom hours</span>
                          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-muted" /> Fully booked</span>
                        </div>
                      </div>

                      {/* Slot panel */}
                      <div className="space-y-3">
                        <p className="text-sm font-medium">
                          {selectedDate ? formatIST(selectedDate, "EEE, d MMM") : "Select a date"}
                        </p>

                        {selectedKind === "blocked" && (
                          <Badge variant="destructive" className="text-[10px]">Blocked</Badge>
                        )}

                        {!selectedDate && (
                          <p className="text-xs text-muted-foreground py-4 text-center">
                            Pick an available date to see time slots.
                          </p>
                        )}

                        {selectedDate && daySlotList.length === 0 && (
                          <p className="text-xs text-muted-foreground py-4 text-center">
                            No available slots on this day.
                          </p>
                        )}

                        {selectedDate && daySlotList.length > 0 && (
                          <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                            {daySlotList.map((t) => {
                              const isSel = selectedTime === t;
                              return (
                                <button
                                  key={t}
                                  type="button"
                                  onClick={() => setSelectedTime(t)}
                                  className={cn(
                                    "text-xs py-2 px-1 rounded-md border transition-colors flex items-center justify-center gap-1",
                                    !isSel && "border-primary/30 text-primary hover:bg-primary/10",
                                    isSel && "border-primary bg-primary text-primary-foreground"
                                  )}
                                >
                                  {formatSlotLabel(t)}
                                  {isSel && <CheckCircle className="h-3 w-3" />}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {selectedTime && (
                          <div className="space-y-2 border-t pt-3 mt-2">
                            <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-2">
                              <span className="font-medium text-foreground">{formatSlotLabel(selectedTime)}</span>
                              {slotEndForSelected && <> – {formatSlotLabel(slotEndForSelected)}</>}
                              {" "}· {selectedOffering.duration_minutes} min
                              {selectedOffering.price > 0 && <> · ₹{selectedOffering.price}</>}
                            </div>

                            {sharedPrograms.length > 1 && (
                              <div className="space-y-1">
                                <Label className="text-xs">Program</Label>
                                <select
                                  value={selectedProgramId || ""}
                                  onChange={(e) => setSelectedProgramId(e.target.value || null)}
                                  className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                >
                                  {sharedPrograms.map((p) => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                  ))}
                                </select>
                              </div>
                            )}

                            <div className="space-y-1">
                              <Label className="text-xs flex items-center gap-1.5">
                                <Info className="h-3 w-3" /> What would you like to discuss? (optional)
                              </Label>
                              <Textarea
                                rows={2}
                                className="text-xs resize-none"
                                placeholder="Share goals, questions, or topics…"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                              />
                            </div>

                            <Button
                              className="w-full"
                              size="sm"
                              onClick={handleBook}
                              disabled={booking}
                            >
                              {booking ? "Booking…" : "Confirm Booking"}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
