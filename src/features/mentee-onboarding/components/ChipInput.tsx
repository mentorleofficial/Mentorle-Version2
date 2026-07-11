import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
}

const ChipInput = ({ value, onChange, placeholder, suggestions = [] }: Props) => {
  const [draft, setDraft] = useState("");

  const add = (raw: string) => {
    const v = raw.trim();
    if (!v) return;
    if (value.some((x) => x.toLowerCase() === v.toLowerCase())) return;
    onChange([...value, v]);
    setDraft("");
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(draft);
            } else if (e.key === "Backspace" && !draft && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          placeholder={placeholder}
        />
        <Button type="button" variant="outline" onClick={() => add(draft)}>
          Add
        </Button>
      </div>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((v) => (
            <Badge key={v} variant="secondary" className="gap-1">
              {v}
              <button type="button" onClick={() => onChange(value.filter((x) => x !== v))}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          <span className="text-xs text-muted-foreground self-center mr-1">Suggestions:</span>
          {suggestions
            .filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()))
            .slice(0, 8)
            .map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => add(s)}
                className="text-xs rounded-full border border-dashed px-2 py-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                + {s}
              </button>
            ))}
        </div>
      )}
    </div>
  );
};

export default ChipInput;
