import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlusMemberBadgeProps {
  className?: string;
  /** When true, wraps in a link to /mentee/plus */
  linkToPlus?: boolean;
  label?: string;
}

const Chip = ({ className, label = "Plus" }: { className?: string; label?: string }) => (
  <span
    className={cn(
      "inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary",
      className,
    )}
  >
    <Sparkles className="h-3 w-3" />
    {label}
  </span>
);

const PlusMemberBadge = ({ className, linkToPlus = false, label = "Plus" }: PlusMemberBadgeProps) => {
  if (linkToPlus) {
    return (
      <Link to="/mentee/plus" className="inline-flex hover:opacity-90 transition-opacity" title="Mentorle Plus">
        <Chip className={className} label={label} />
      </Link>
    );
  }
  return <Chip className={className} label={label} />;
};

export default PlusMemberBadge;
