import type { ReactNode } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, Video } from "lucide-react";
import { Link } from "react-router-dom";
import {
  formatIST,
  formatISTTime,
} from "@/lib/datetime";
import { relativeIST } from "@/lib/relativeTime";
import SessionStatusDot from "./SessionStatusDot";
import ProgramBadge from "@/components/programs/ProgramBadge";
import type { SessionCardData } from "./SessionListCard";

interface Props {
  data: SessionCardData | null;
  counterpartyLabel: string; // "Mentor" | "Mentee"
  emptyTitle: string;
  emptyDescription: string;
  emptyCtaLabel?: string;
  emptyCtaTo?: string;
  /** Primary CTAs (Join now, Add meeting link, etc.) */
  primaryActions?: ReactNode;
  /** Calendar / secondary buttons */
  secondaryActions?: ReactNode;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

export default function SessionHeroCard({
  data,
  counterpartyLabel,
  emptyTitle,
  emptyDescription,
  emptyCtaLabel,
  emptyCtaTo,
  primaryActions,
  secondaryActions,
}: Props) {
  if (!data) {
    return (
      <div className="rounded-xl border bg-gradient-to-br from-primary/5 via-card to-card p-6">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">{emptyTitle}</h2>
            <p className="text-sm text-muted-foreground">{emptyDescription}</p>
          </div>
          {emptyCtaLabel && emptyCtaTo && (
            <Button asChild>
              <Link to={emptyCtaTo}>{emptyCtaLabel}</Link>
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-gradient-to-br from-primary/10 via-card to-card p-5 sm:p-6">
      <div className="flex flex-col gap-5 md:flex-row md:items-start">
        <div className="flex-1 space-y-3 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              Next session
            </span>
            <SessionStatusDot status={data.status} />
            {data.programs.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {data.programs.map((p) => (
                  <ProgramBadge
                    key={p.slug}
                    name={p.name}
                    color={p.color}
                    to={`${data.programLinkBase}/${p.slug}`}
                  />
                ))}
              </div>
            )}

          </div>

          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              {data.counterpartyAvatar && (
                <AvatarImage src={data.counterpartyAvatar} alt={data.counterpartyName} />
              )}
              <AvatarFallback>{initials(data.counterpartyName)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {counterpartyLabel}
              </div>
              <div className="text-lg font-semibold truncate">{data.counterpartyName}</div>
            </div>
          </div>

          <div>
            <div className="text-base font-medium">
              {data.title || <span className="italic text-muted-foreground">Untitled session</span>}
            </div>
            {data.topic && (
              <div className="text-sm text-muted-foreground">{data.topic}</div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              {formatIST(data.scheduledAt, "EEE, d MMM yyyy")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              {formatISTTime(data.scheduledAt)}
            </span>
            {data.meetingUrl && (
              <span className="inline-flex items-center gap-1.5">
                <Video className="h-4 w-4" />
                Online
              </span>
            )}
          </div>


        </div>

        <div className="flex flex-col gap-2 md:w-56 md:items-stretch">
          {primaryActions}
          {secondaryActions}
        </div>
      </div>
    </div>
  );
}
