import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface MonthYearPickerProps {
  value: string; // YYYY-MM
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

const MONTHS = [
  { label: "Jan", value: 0 },
  { label: "Feb", value: 1 },
  { label: "Mar", value: 2 },
  { label: "Apr", value: 3 },
  { label: "May", value: 4 },
  { label: "Jun", value: 5 },
  { label: "Jul", value: 6 },
  { label: "Aug", value: 7 },
  { label: "Sep", value: 8 },
  { label: "Oct", value: 9 },
  { label: "Nov", value: 10 },
  { label: "Dec", value: 11 },
];

const formatDisplay = (val: string, placeholder: string) => {
  if (!val) return placeholder;
  const parts = val.split("-");
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(y) || isNaN(m)) return placeholder;
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "short", year: "numeric" });
};

export const MonthYearPicker = ({
  value,
  onChange,
  placeholder = "Select date",
  disabled,
}: MonthYearPickerProps) => {
  const [open, setOpen] = useState(false);
  const initial = value ? new Date(value + "-02") : new Date();
  const [currentYear, setCurrentYear] = useState(initial.getFullYear());

  useEffect(() => {
    if (value) {
      const y = parseInt(value.split("-")[0], 10);
      if (!isNaN(y)) setCurrentYear(y);
    }
  }, [value, open]);

  const isSelected = (monthIndex: number) => {
    if (!value) return false;
    const parts = value.split("-");
    return parseInt(parts[0], 10) === currentYear && parseInt(parts[1], 10) === monthIndex + 1;
  };

  const isFuture = (monthIndex: number) =>
    new Date(currentYear, monthIndex, 1) > new Date();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          type="button"
          disabled={disabled}
          className={cn(
            "w-full pl-3 pr-3 text-left font-normal h-10 flex items-center justify-between border-input bg-background",
            !value && "text-muted-foreground"
          )}
        >
          {formatDisplay(value, placeholder)}
          <CalendarIcon className="h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              type="button"
              onClick={() => setCurrentYear((y) => y - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold">{currentYear}</span>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              type="button"
              disabled={currentYear >= new Date().getFullYear()}
              onClick={() => setCurrentYear((y) => y + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {MONTHS.map((m) => {
              const selected = isSelected(m.value);
              const disabledMonth = isFuture(m.value);
              return (
                <Button
                  key={m.value}
                  variant={selected ? "default" : "ghost"}
                  size="sm"
                  type="button"
                  disabled={disabledMonth}
                  className={cn(
                    "h-9 w-full text-xs font-normal",
                    selected &&
                      "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                  )}
                  onClick={() => {
                    onChange(`${currentYear}-${String(m.value + 1).padStart(2, "0")}`);
                    setOpen(false);
                  }}
                >
                  {m.label}
                </Button>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default MonthYearPicker;
