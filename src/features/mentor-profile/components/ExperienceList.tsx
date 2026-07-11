import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Briefcase, Plus, Trash2 } from "lucide-react";
import { MonthYearPicker } from "@/components/ui/month-year-picker";
import type { ExperienceValue } from "../schema";

interface Props {
  value: ExperienceValue[];
  onChange: (v: ExperienceValue[]) => void;
}

const empty: ExperienceValue = {
  company: "",
  title: "",
  location: "",
  start_date: "",
  end_date: "",
  description: "",
};

const formatRange = (e: ExperienceValue) => {
  const fmt = (d: string) => {
    if (!d) return "";
    const parts = d.split("-");
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(y) || isNaN(m)) return "";
    return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "short", year: "numeric" });
  };
  return `${fmt(e.start_date) || "—"} → ${e.end_date ? fmt(e.end_date) : "Present"}`;
};


const ExperienceList = ({ value, onChange }: Props) => {
  const update = (i: number, patch: Partial<ExperienceValue>) => {
    onChange(value.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  };
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const add = () => onChange([...value, { ...empty }]);

  return (
    <div className="space-y-4">
      {value.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <Briefcase className="mx-auto h-8 w-8 text-muted-foreground/60" />
          <p className="mt-2 text-sm text-muted-foreground">No experience added yet</p>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={add}>
            <Plus className="h-4 w-4 mr-1" /> Add your first role
          </Button>
        </div>
      )}

      {value.map((exp, i) => {
        const isPresent = !exp.end_date;
        return (
          <div key={i} className="relative rounded-lg border bg-card p-5 space-y-4">
            <div className="absolute right-3 top-3">
              <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)} aria-label="Remove">
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>

            <div className="flex items-start gap-3">
              <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10">
                <Briefcase className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Title *</Label>
                  <Input
                    value={exp.title}
                    onChange={(e) => update(i, { title: e.target.value })}
                    placeholder="Senior Product Manager"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Company *</Label>
                  <Input
                    value={exp.company}
                    onChange={(e) => update(i, { company: e.target.value })}
                    placeholder="Acme Inc."
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Location</Label>
                  <Input
                    value={exp.location || ""}
                    onChange={(e) => update(i, { location: e.target.value })}
                    placeholder="San Francisco, CA · Remote"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Start *</Label>
                  <MonthYearPicker
                    value={exp.start_date}
                    onChange={(val) => update(i, { start_date: val })}
                    placeholder="Select start date"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">End</Label>
                  <MonthYearPicker
                    value={exp.end_date || ""}
                    disabled={isPresent}
                    onChange={(val) => update(i, { end_date: val })}
                    placeholder="Select end date"
                  />
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer mt-1">
                    <Checkbox
                      checked={isPresent}
                      onCheckedChange={(c) => update(i, { end_date: c ? "" : exp.start_date })}
                    />
                    I currently work here
                  </label>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Description</Label>
                  <Textarea
                    rows={3}
                    value={exp.description || ""}
                    onChange={(e) => update(i, { description: e.target.value })}
                    placeholder="Highlights, scope, impact…"
                  />
                </div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground pl-13">{formatRange(exp)}</div>
          </div>
        );
      })}

      {value.length > 0 && (
        <Button type="button" variant="outline" onClick={add} className="w-full">
          <Plus className="h-4 w-4 mr-1" /> Add another role
        </Button>
      )}
    </div>
  );
};

export default ExperienceList;

