import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GraduationCap, Plus, Trash2 } from "lucide-react";
import type { QualificationValue } from "../schema";

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from(
  { length: CURRENT_YEAR + 10 - 1950 + 1 },
  (_, i) => CURRENT_YEAR + 10 - i
);

interface Props {
  value: QualificationValue[];
  onChange: (v: QualificationValue[]) => void;
}

const empty: QualificationValue = {
  institution: "",
  degree: "",
  field: "",
  start_year: new Date().getFullYear() - 4,
  end_year: new Date().getFullYear(),
};

const QualificationsList = ({ value, onChange }: Props) => {
  const update = (i: number, patch: Partial<QualificationValue>) => {
    onChange(value.map((q, idx) => (idx === i ? ({ ...q, ...patch } as QualificationValue) : q)));
  };
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const add = () => onChange([...value, { ...empty }]);

  return (
    <div className="space-y-4">
      {value.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <GraduationCap className="mx-auto h-8 w-8 text-muted-foreground/60" />
          <p className="mt-2 text-sm text-muted-foreground">No qualifications added yet</p>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={add}>
            <Plus className="h-4 w-4 mr-1" /> Add qualification
          </Button>
        </div>
      )}

      {value.map((q, i) => {
        const isPresent = q.end_year === "present";
        const endYearOptions = YEARS.filter((y) => y >= (q.start_year as number));
        return (
          <div key={i} className="relative rounded-lg border bg-card p-5">
            <div className="absolute right-3 top-3">
              <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)} aria-label="Remove">
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10">
                <GraduationCap className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Institution *</Label>
                  <Input
                    value={q.institution}
                    onChange={(e) => update(i, { institution: e.target.value })}
                    placeholder="Stanford University"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Degree *</Label>
                  <Input
                    value={q.degree}
                    onChange={(e) => update(i, { degree: e.target.value })}
                    placeholder="B.S."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Field of study</Label>
                  <Input
                    value={q.field || ""}
                    onChange={(e) => update(i, { field: e.target.value })}
                    placeholder="Computer Science"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Start year *</Label>
                  <Select
                    value={String(q.start_year)}
                    onValueChange={(v) => {
                      const newStart = Number(v);
                      const patch: Partial<QualificationValue> = { start_year: newStart };
                      if (!isPresent && (q.end_year as number) < newStart) {
                        patch.end_year = newStart;
                      }
                      update(i, patch);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px]">
                      {YEARS.map((y) => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">End year</Label>
                  <Select
                    value={isPresent ? "" : String((q.end_year as number) || "")}
                    onValueChange={(v) => update(i, { end_year: Number(v) })}
                    disabled={isPresent}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px]">
                      {endYearOptions.map((y) => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                    <Checkbox
                      checked={isPresent}
                      onCheckedChange={(c) =>
                        update(i, { end_year: c ? "present" : new Date().getFullYear() })
                      }
                    />
                    Present
                  </label>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {value.length > 0 && (
        <Button type="button" variant="outline" onClick={add} className="w-full">
          <Plus className="h-4 w-4 mr-1" /> Add another qualification
        </Button>
      )}
    </div>
  );
};

export default QualificationsList;
