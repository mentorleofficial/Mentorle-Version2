import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Plus, X } from "lucide-react";
import { TimeSelect } from "./TimeSelect";
import { CopyTimesPopover } from "./CopyTimesPopover";
import { DAYS_SHORT, normalizeHHMM, rangesOverlap, toMinutes } from "../timeUtils";
import type { WeeklySlot } from "../api/availability";

interface Props {
  dayOfWeek: number;
  slots: WeeklySlot[];
  onAdd: (start: string, end: string) => void;
  onUpdate: (id: string, patch: { start_time?: string; end_time?: string }) => void;
  onRemove: (id: string) => void;
  onToggleDay: (enabled: boolean) => void;
  onCopy: (targetDays: number[]) => void;
}

export function DayRow({
  dayOfWeek,
  slots,
  onAdd,
  onUpdate,
  onRemove,
  onToggleDay,
  onCopy,
}: Props) {
  const enabled = slots.length > 0;

  const error = useMemo(() => {
    for (const s of slots) {
      if (toMinutes(normalizeHHMM(s.end_time)) <= toMinutes(normalizeHHMM(s.start_time))) {
        return "End time must be after start time";
      }
    }
    if (rangesOverlap(slots)) return "Time ranges overlap";
    return null;
  }, [slots]);

  const handleAddRange = () => {
    if (slots.length === 0) {
      onAdd("09:00", "17:00");
      return;
    }
    // suggest a slot starting after the latest end
    const latestEnd = slots
      .map((s) => toMinutes(normalizeHHMM(s.end_time)))
      .reduce((a, b) => Math.max(a, b), 0);
    const startMin = Math.min(latestEnd + 60, 22 * 60);
    const endMin = Math.min(startMin + 60, 23 * 60 + 45);
    const fmt = (m: number) =>
      `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    onAdd(fmt(startMin), fmt(endMin));
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-3 py-4 border-b last:border-b-0">
      {/* Day label + toggle */}
      <div className="flex items-center gap-3 sm:w-32 shrink-0 pt-1">
        <Switch
          checked={enabled}
          onCheckedChange={onToggleDay}
          aria-label={`Toggle ${DAYS_SHORT[dayOfWeek]}`}
        />
        <span className="font-semibold text-sm tracking-wide">{DAYS_SHORT[dayOfWeek]}</span>
      </div>

      {/* Ranges */}
      <div className="flex-1 space-y-2">
        {!enabled ? (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground italic">Unavailable</span>
            <CopyTimesPopover sourceDay={dayOfWeek} onApply={onCopy} />
          </div>
        ) : (
          <>
            {slots.map((slot, idx) => (
              <div key={slot.id} className="flex items-center gap-2 flex-wrap">
                <TimeSelect
                  value={slot.start_time}
                  onChange={(v) => onUpdate(slot.id, { start_time: v })}
                />
                <span className="text-muted-foreground">–</span>
                <TimeSelect
                  value={slot.end_time}
                  onChange={(v) => onUpdate(slot.id, { end_time: v })}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => onRemove(slot.id)}
                  aria-label="Remove range"
                  title="Remove range"
                >
                  <X className="h-4 w-4" />
                </Button>
                {idx === 0 && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      onClick={handleAddRange}
                      aria-label="Add range"
                      title="Add range"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    <CopyTimesPopover sourceDay={dayOfWeek} onApply={onCopy} />
                  </>
                )}
              </div>
            ))}
            {error && <p className="text-xs text-destructive">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}
