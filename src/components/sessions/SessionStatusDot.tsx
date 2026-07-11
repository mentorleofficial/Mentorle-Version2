import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SessionStatus } from "@/features/mentor-sessions/useMentorSessions";

type EffectiveStatus = SessionStatus | "pending_review";

const STATUS_META: Record<EffectiveStatus, { label: string; dot: string; tone: string }> = {
  booked: {
    label: "Upcoming",
    dot: "bg-primary",
    tone: "border-primary/30 bg-primary/5 text-primary",
  },
  pending_review: {
    label: "Pending",
    dot: "bg-amber-500",
    tone: "border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400",
  },
  completed: {
    label: "Completed",
    dot: "bg-emerald-500",
    tone: "border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400",
  },
  cancelled: {
    label: "Cancelled",
    dot: "bg-destructive",
    tone: "border-destructive/30 bg-destructive/5 text-destructive",
  },
  no_show: {
    label: "No-show",
    dot: "bg-amber-500",
    tone: "border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400",
  },
};

interface Props {
  status: SessionStatus;
  /** When true the session is in the future; false = past but still booked → shows "Pending". */
  isUpcoming?: boolean;
  className?: string;
}

export default function SessionStatusDot({ status, isUpcoming, className }: Props) {
  const effectiveStatus: EffectiveStatus =
    status === "booked" && isUpcoming === false ? "pending_review" : status;
  const meta = STATUS_META[effectiveStatus] ?? STATUS_META.booked;
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
        meta.tone,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} aria-hidden />
      {meta.label}
    </Badge>
  );
}
