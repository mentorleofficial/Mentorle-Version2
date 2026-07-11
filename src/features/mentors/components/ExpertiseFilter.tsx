import { useMemo, useState } from "react";
import { Check, ChevronDown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

interface Props {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}

const ExpertiseFilter = ({ options, selected, onChange }: Props) => {
  const [open, setOpen] = useState(false);
  const sorted = useMemo(() => [...options].sort((a, b) => a.localeCompare(b)), [options]);

  const toggle = (tag: string) => {
    if (selected.includes(tag)) onChange(selected.filter((t) => t !== tag));
    else onChange([...selected, tag]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-10 gap-2">
          <Sparkles className="h-4 w-4" />
          Expertise
          {selected.length > 0 && (
            <span className="ml-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold px-1.5 py-0.5">
              {selected.length}
            </span>
          )}
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search skills…" />
          <CommandList>
            <CommandEmpty>No skills found.</CommandEmpty>
            <CommandGroup>
              {sorted.map((tag) => {
                const isSelected = selected.includes(tag);
                return (
                  <CommandItem key={tag} onSelect={() => toggle(tag)} className="cursor-pointer">
                    <div
                      className={cn(
                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                        isSelected ? "bg-primary text-primary-foreground" : "opacity-60"
                      )}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                    {tag}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default ExpertiseFilter;
