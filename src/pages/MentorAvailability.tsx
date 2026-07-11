import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, Globe } from "lucide-react";
import type { WeeklySlot, DateOverride } from "@/features/availability/api/availability";
import { DAYS_FULL, normalizeHHMM } from "@/features/availability/timeUtils";
import { DayRow } from "@/features/availability/components/DayRow";
import { OverrideList } from "@/features/availability/components/OverrideList";
import { AvailabilityPreview } from "@/features/availability/components/AvailabilityPreview";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useMentorAvailability,
  useAvailabilityMutations,
} from "@/features/mentor-availability/useMentorAvailability";

const MentorAvailability = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data, isLoading, isFetching } = useMentorAvailability(user?.id);
  const slots = data?.slots ?? [];
  const overrides = data?.overrides ?? [];
  const events = data?.events ?? [];
  const timezone = "Asia/Kolkata";

  const m = useAvailabilityMutations(user?.id);

  const anyPending =
    m.addSlot.isPending ||
    m.updateSlot.isPending ||
    m.deleteSlot.isPending ||
    m.deleteSlotsForDay.isPending ||
    m.copySlotsToDays.isPending ||
    m.addOverride.isPending ||
    m.deleteOverride.isPending ||
    m.updateSettings.isPending;

  const bufferTime = data?.buffer_time_minutes ?? 0;
  const minNotice = data?.minimum_notice_hours ?? 0;

  const showSaving = anyPending || (isFetching && !isLoading);
  const showSaved = !anyPending && !isFetching && !isLoading;

  const handleError = (e: unknown) => {
    const message = e instanceof Error ? e.message : "Something went wrong";
    toast({ variant: "destructive", title: "Save failed", description: message });
  };

  const slotsByDay = useMemo(() => {
    const map: Record<number, WeeklySlot[]> = {};
    for (let i = 0; i < 7; i++) map[i] = [];
    for (const s of slots) map[s.day_of_week].push(s);
    for (const k of Object.keys(map)) {
      map[Number(k)].sort((a, b) =>
        normalizeHHMM(a.start_time).localeCompare(normalizeHHMM(b.start_time))
      );
    }
    return map;
  }, [slots]);

  const onAdd = (day: number, start: string, end: string) =>
    m.addSlot.mutate(
      { day_of_week: day, start_time: start, end_time: end },
      { onError: handleError }
    );

  const onUpdate = (id: string, patch: { start_time?: string; end_time?: string }) =>
    m.updateSlot.mutate({ id, patch }, { onError: handleError });

  const onRemove = (id: string) => m.deleteSlot.mutate(id, { onError: handleError });

  const onToggleDay = (day: number, enabled: boolean) => {
    if (enabled) {
      m.addSlot.mutate(
        { day_of_week: day, start_time: "09:00", end_time: "17:00" },
        { onError: handleError }
      );
    } else {
      m.deleteSlotsForDay.mutate(day, { onError: handleError });
    }
  };

  const onCopy = (sourceDay: number, targetDays: number[]) => {
    const source = slotsByDay[sourceDay].map((s) => ({
      start_time: normalizeHHMM(s.start_time),
      end_time: normalizeHHMM(s.end_time),
    }));
    if (source.length === 0) return;
    m.copySlotsToDays.mutate({ sourceSlots: source, targetDays }, { onError: handleError });
  };

  const onAddOverride = (input: Omit<DateOverride, "id" | "mentor_id">) =>
    m.addOverride.mutate(input, { onError: handleError });

  const onRemoveOverride = (id: string) => m.deleteOverride.mutate(id, { onError: handleError });

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Availability</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Set the hours mentees can book sessions with you, just like Calendly.
            </p>
          </div>
          <div className="h-6 flex items-center text-xs text-muted-foreground">
            {showSaving && (
              <span className="flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Saving…
              </span>
            )}
            {!showSaving && showSaved && slots.length + overrides.length > 0 && (
              <span className="flex items-center gap-1 text-primary">
                <CheckCircle2 className="h-3 w-3" /> Saved
              </span>
            )}
          </div>
        </div>

        <div className="grid gap-6 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6 min-w-0">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">Timezone</CardTitle>
                </div>
                <CardDescription>
                  All times are shown and stored in India Standard Time (IST). Mentees see your slots in IST too.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="inline-flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm font-medium">
                  Asia/Kolkata · IST (UTC+5:30)
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold">Booking Settings</CardTitle>
                <CardDescription>
                  Configure buffers and booking notice requirements.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="buffer-time" className="font-semibold text-sm">Buffer time (after session)</Label>
                  <Select
                    value={String(bufferTime)}
                    onValueChange={(val) =>
                      m.updateSettings.mutate(
                        { buffer_time_minutes: Number(val) },
                        { onError: handleError }
                      )
                    }
                  >
                    <SelectTrigger id="buffer-time">
                      <SelectValue placeholder="Select buffer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">No buffer</SelectItem>
                      <SelectItem value="15">15 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="45">45 minutes</SelectItem>
                      <SelectItem value="60">60 minutes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="min-notice" className="font-semibold text-sm">Minimum booking notice</Label>
                  <Select
                    value={String(minNotice)}
                    onValueChange={(val) =>
                      m.updateSettings.mutate(
                        { minimum_notice_hours: Number(val) },
                        { onError: handleError }
                      )
                    }
                  >
                    <SelectTrigger id="min-notice">
                      <SelectValue placeholder="Select notice window" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">No notice</SelectItem>
                      <SelectItem value="1">1 hour</SelectItem>
                      <SelectItem value="2">2 hours</SelectItem>
                      <SelectItem value="4">4 hours</SelectItem>
                      <SelectItem value="8">8 hours</SelectItem>
                      <SelectItem value="12">12 hours</SelectItem>
                      <SelectItem value="24">24 hours (1 day)</SelectItem>
                      <SelectItem value="48">48 hours (2 days)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Weekly hours</CardTitle>
                <CardDescription>
                  Set when you're regularly available for sessions.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm py-6">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                  </div>
                ) : (
                  <div className="divide-y">
                    {DAYS_FULL.map((_, day) => (
                      <DayRow
                        key={day}
                        dayOfWeek={day}
                        slots={slotsByDay[day]}
                        onAdd={(s, e) => onAdd(day, s, e)}
                        onUpdate={onUpdate}
                        onRemove={onRemove}
                        onToggleDay={(enabled) => onToggleDay(day, enabled)}
                        onCopy={(targets) => onCopy(day, targets)}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Date-specific availability</CardTitle>
                <CardDescription>
                  Adjust your regular schedule for a specific date.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <OverrideList
                  overrides={overrides}
                  onAdd={onAddOverride}
                  onRemove={onRemoveOverride}
                />
              </CardContent>
            </Card>
          </div>

          <div className="self-start h-fit">
            <AvailabilityPreview
              slots={slots}
              overrides={overrides}
              timezone={timezone}
              minNoticeHours={minNotice}
              bufferTimeMinutes={bufferTime}
              events={events}
            />
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default MentorAvailability;
