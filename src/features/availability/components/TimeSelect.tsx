import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TIME_OPTIONS, normalizeHHMM, format12h } from "../timeUtils";

interface Props {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}

export function TimeSelect({ value, onChange, className }: Props) {
  return (
    <Select value={normalizeHHMM(value)} onValueChange={onChange}>
      <SelectTrigger className={className ?? "w-[110px] h-9"}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-[260px]">
        {TIME_OPTIONS.map((t) => (
          <SelectItem key={t} value={t}>
            {format12h(t)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
