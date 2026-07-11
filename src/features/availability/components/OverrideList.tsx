import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Trash2, Plus, Clock, Ban } from "lucide-react";
import { format, parseISO } from "date-fns";
import { TimeSelect } from "./TimeSelect";
import type { DateOverride } from "../api/availability";
import { format12h } from "../timeUtils";

interface Props {
  overrides: DateOverride[];
  onAdd: (input: Omit<DateOverride, "id" | "mentor_id">) => void;
  onRemove: (id: string) => void;
}

type OverrideMode = "blocked" | "custom";

export function OverrideList({ overrides, onAdd, onRemove }: Props) {
  const [adding, setAdding] = useState(false);
  const [date, setDate] = useState("");
  const [mode, setMode] = useState<OverrideMode>("blocked");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("17:00");

  const isTimeRangeInvalid = mode === "custom" && start >= end;
  const isDuplicateDate = overrides.some((o) => o.date === date);

  const submit = () => {
    if (!date) return;
    if (isTimeRangeInvalid) return;
    if (isDuplicateDate) return;
    onAdd({
      date,
      is_unavailable: mode === "blocked",
      start_time: mode === "custom" ? start : null,
      end_time: mode === "custom" ? end : null,
    });
    setAdding(false);
    setDate("");
    setMode("blocked");
    setStart("09:00");
    setEnd("17:00");
  };

  return (
    <div className="space-y-3">
      {overrides.length === 0 && !adding && <p className="text-sm text-muted-foreground">No date overrides yet.</p>}

      {overrides.map((o) => (
        <div
          key={o.id}
          className="flex items-center justify-between rounded-lg border p-3 bg-card hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-start gap-3 flex-1">
            <div className="mt-0.5">
              {o.is_unavailable ? (
                <Ban className="h-4 w-4 text-destructive" />
              ) : (
                <Clock className="h-4 w-4 text-primary" />
              )}
            </div>
            <div>
              <p className="font-medium text-sm">{format(parseISO(o.date), "EEE, MMM d, yyyy")}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {o.is_unavailable
                  ? "Fully unavailable"
                  : `Available: ${o.start_time ? format12h(o.start_time) : ""} – ${o.end_time ? format12h(o.end_time) : ""}`}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => onRemove(o.id)} className="shrink-0">
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ))}

      {adding ? (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="override-date" className="font-semibold text-sm">
                Date
              </Label>
              <Input
                id="override-date"
                type="date"
                value={date}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label className="font-semibold text-sm">Override type</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMode("blocked")}
                  className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-colors ${
                    mode === "blocked"
                      ? "border-destructive bg-destructive/10 text-destructive"
                      : "border-border text-muted-foreground hover:border-destructive/50"
                  }`}
                >
                  <Ban className="h-4 w-4" />
                  <span className="text-sm font-medium">Block day</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode("custom")}
                  className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-colors ${
                    mode === "custom"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  <Clock className="h-4 w-4" />
                  <span className="text-sm font-medium">Custom hours</span>
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {mode === "blocked"
                  ? "Mark yourself as completely unavailable on this date."
                  : "Set specific hours when you're available on this date (overrides weekly schedule)."}
              </p>
            </div>

            {mode === "custom" && (
              <div className="space-y-2 pt-2">
                <Label className="font-semibold text-sm">Available time</Label>
                <div className="flex items-center gap-2">
                  <TimeSelect value={start} onChange={setStart} />
                  <span className="text-muted-foreground font-medium">–</span>
                  <TimeSelect value={end} onChange={setEnd} />
                </div>
              </div>
            )}

            {isTimeRangeInvalid && (
              <p className="text-xs text-destructive font-medium pt-1">Start time must be before end time.</p>
            )}

            {isDuplicateDate && (
              <p className="text-xs text-destructive font-medium pt-1">
                An override already exists for this date. Remove the existing one first.
              </p>
            )}

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setAdding(false)}>
                Cancel
              </Button>
              <Button
                onClick={submit}
                disabled={!date || isTimeRangeInvalid || isDuplicateDate}
                className={mode === "blocked" ? "bg-destructive hover:bg-destructive/90" : ""}
              >
                Add Availability
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button variant="outline" onClick={() => setAdding(true)} className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          Add availability
        </Button>
      )}
    </div>
  );
}
