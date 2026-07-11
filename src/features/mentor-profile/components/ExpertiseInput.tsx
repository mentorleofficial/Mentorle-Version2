import { useState, KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  value: string[];
  onChange: (v: string[]) => void;
  max?: number;
  placeholder?: string;
  error?: string;
}

const ExpertiseInput = ({ value, onChange, max = 15, placeholder = "Type a skill and press Tab or Enter", error }: Props) => {
  const [input, setInput] = useState("");

  const add = (raw: string) => {
    const t = raw.trim().replace(/,$/, "");
    if (!t) return;
    if (value.length >= max) return;
    if (value.some((v) => v.toLowerCase() === t.toLowerCase())) return;
    onChange([...value, t]);
    setInput("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "Tab" || e.key === ",") {
      if (input.trim()) {
        e.preventDefault();
        add(input);
      }
    } else if (e.key === "Backspace" && !input && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "flex flex-wrap gap-1.5 rounded-md border border-input bg-background p-2 min-h-[44px] focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background",
          error && "border-destructive"
        )}
      >
        {value.map((tag) => (
          <Badge key={tag} variant="secondary" className="gap-1 pl-2.5 pr-1 py-1 text-xs">
            {tag}
            <button
              type="button"
              onClick={() => onChange(value.filter((v) => v !== tag))}
              className="rounded-full hover:bg-background/60 p-0.5"
              aria-label={`Remove ${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => input.trim() && add(input)}
          placeholder={value.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[140px] h-7 border-0 shadow-none focus-visible:ring-0 px-1"
        />
      </div>
      <div className="flex justify-between text-xs">
        <span className={cn("text-muted-foreground", error && "text-destructive")}>
          {error ?? "Press Tab, Enter, or comma to add. Backspace to remove."}
        </span>
        <span className="text-muted-foreground">{value.length}/{max}</span>
      </div>
    </div>
  );
};

export default ExpertiseInput;
