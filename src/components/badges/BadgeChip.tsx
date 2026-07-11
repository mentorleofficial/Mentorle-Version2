import { Award } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Badge } from "@/features/badges/api";

const tierStyles: Record<Badge["tier"], string> = {
  bronze: "bg-amber-700/15 text-amber-700 border-amber-700/30",
  silver: "bg-slate-400/15 text-slate-500 border-slate-400/40",
  gold: "bg-yellow-500/15 text-yellow-600 border-yellow-500/40",
};

const BadgeChip = ({ badge, size = "md" }: { badge: Badge; size?: "sm" | "md" }) => {
  const sizes = size === "sm" ? "text-[10px] px-2 py-0.5" : "text-xs px-2.5 py-1";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border font-medium",
            sizes,
            tierStyles[badge.tier]
          )}
        >
          <Award className="h-3 w-3" />
          {badge.name}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">{badge.description}</TooltipContent>
    </Tooltip>
  );
};

export default BadgeChip;
