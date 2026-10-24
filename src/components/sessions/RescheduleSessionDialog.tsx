import { useEffect, useState } from "react";
import { fromZonedTime } from "date-fns-tz";
import { Loader2 } from "lucide-react";
import { APP_TZ, formatIST, formatISTDateTime } from "@/lib/datetime";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useRescheduleOpenTimes, useRescheduleSession } from "@/features/sessions/useRescheduleSession";

export interface RescheduleTarget {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  offering_id: string | null;
  /** The other person, for the description ("with Asha Verma"). */
  withName?: string | null;
}

interface Props {
  session: RescheduleTarget | null;
  onOpenChange: (open: boolean) => void;
}

// Mentor or admin picks a new date and time (IST). The mentor's open times for that day are offered as quick
// picks; any other time can be typed. reschedule_session() refuses clashes, past times and non-booked sessions.
export default function RescheduleSessionDialog({ session, onOpenChange }: Props) {
  const { toast } = useToast();
  const reschedule = useRescheduleSession();
  const [day, setDay] = useState("");
  const [time, setTime] = useState("");

  useEffect(() => {
    if (!session) return;
    setDay(formatIST(session.scheduled_at, "yyyy-MM-dd"));
    setTime("");
  }, [session]);

  const openTimes = useRescheduleOpenTimes(session?.offering_id, day, session?.id ?? "", !!session);
  const today = formatIST(new Date(), "yyyy-MM-dd");
  const newStart = day && time ? fromZonedTime(`${day}T${time}:00`, APP_TZ) : null;
  const unchanged = !!session && !!newStart && newStart.getTime() === new Date(session.scheduled_at).getTime();

  const submit = () => {
    if (!session || !newStart) return;
    reschedule.mutate(
      { sessionId: session.id, scheduledAt: newStart },
      {
        onSuccess: () => {
          toast({ title: "Session rescheduled", description: `Moved to ${formatISTDateTime(newStart)}. We've emailed both of you.` });
          onOpenChange(false);
        },
        onError: (err: { message?: string; code?: string }) => {
          const friendly =
            err?.code === "23P01" || err?.message?.includes("overlapping")
              ? "That time clashes with another booked session. Pick another."
              : err?.message ?? "Couldn't reschedule this session.";
          toast({ variant: "destructive", title: "Couldn't reschedule", description: friendly });
        },
      }
    );
  };

  return (
    <Dialog open={!!session} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reschedule session</DialogTitle>
          <DialogDescription>
            {session && (
              <>
                Now {formatISTDateTime(session.scheduled_at)} · {session.duration_minutes} min
                {session.withName ? ` with ${session.withName}` : ""}. Both of you get an email with the new time; the
                meeting link stays the same.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="reschedule-day" className="text-sm font-semibold">New date</Label>
            <Input id="reschedule-day" type="date" min={today} value={day} onChange={(e) => { setDay(e.target.value); setTime(""); }} />
          </div>

          {session?.offering_id && day && (
            <div className="space-y-1.5">
              <p className="text-sm font-semibold">Open times that day</p>
              {openTimes.isPending ? (
                <p className="text-xs text-muted-foreground">Loading…</p>
              ) : (openTimes.data ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">No open times in the weekly hours that day. You can still enter a time below.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(openTimes.data ?? []).map((iso) => {
                    const value = formatIST(iso, "HH:mm");
                    return (
                      <Button
                        key={iso}
                        type="button"
                        size="sm"
                        variant={time === value ? "default" : "outline"}
                        onClick={() => setTime(value)}
                      >
                        {formatIST(iso, "h:mm a")}
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="reschedule-time" className="text-sm font-semibold">Start time (IST)</Label>
            <Input id="reschedule-time" type="time" step={300} value={time} onChange={(e) => setTime(e.target.value)} />
            {unchanged && <p className="text-xs text-muted-foreground">That's the current time.</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={reschedule.isPending}>
            Keep current time
          </Button>
          <Button onClick={submit} disabled={!newStart || unchanged || reschedule.isPending} className={cn(reschedule.isPending && "gap-2")}>
            {reschedule.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Moving…</> : "Reschedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
