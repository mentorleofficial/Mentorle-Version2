import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Copy } from "lucide-react";
import { DAYS_FULL } from "../timeUtils";

interface Props {
  sourceDay: number;
  onApply: (targetDays: number[]) => void;
}

export function CopyTimesPopover({ sourceDay, onApply }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);

  const toggle = (d: number) => {
    setSelected((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  };

  const apply = () => {
    onApply(selected);
    setSelected([]);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          aria-label="Copy times to other days"
          title="Copy times to other days"
        >
          <Copy className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56" align="end">
        <p className="text-sm font-medium mb-2">Copy times to…</p>
        <div className="space-y-2 mb-3">
          {DAYS_FULL.map((label, idx) =>
            idx === sourceDay ? null : (
              <label key={idx} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={selected.includes(idx)}
                  onCheckedChange={() => toggle(idx)}
                />
                {label}
              </label>
            )
          )}
        </div>
        <Button size="sm" className="w-full" onClick={apply} disabled={selected.length === 0}>
          Apply
        </Button>
      </PopoverContent>
    </Popover>
  );
}
