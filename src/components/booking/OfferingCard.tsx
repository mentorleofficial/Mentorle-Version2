import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";
import { markdownToHtml } from "@/components/ui/markdown-editor";
import type { BrowseOffering } from "@/features/mentee-booking/useBrowseOfferings";

const stripMarkdown = (md: string) =>
  markdownToHtml(md || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

const initials = (name: string | null | undefined) =>
  (name ?? "M")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("") || "M";

export interface OfferingCardOffering {
  id: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  price: number;
  category: string | null;
  mentor?: BrowseOffering["mentor"];
}

interface OfferingCardProps {
  offering: OfferingCardOffering;
  onBook: () => void;
  onLearnMore?: () => void;
  hideMentor?: boolean;
}

export default function OfferingCard({
  offering: o,
  onBook,
  onLearnMore,
  hideMentor = false,
}: OfferingCardProps) {
  return (
    <div className="group bg-card border border-border rounded-[10px] overflow-hidden flex flex-col shadow-sm hover:shadow-md transition-all duration-200">
      {!hideMentor && (
        <div className="p-5 pb-3 border-b border-border/60">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12 ring-1 ring-border">
              <AvatarImage src={o.mentor?.avatar_url ?? undefined} />
              <AvatarFallback className="text-sm font-medium bg-muted">
                {initials(o.mentor?.full_name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold text-base leading-none">
                {o.mentor?.full_name ?? "Mentor"}
              </p>
              {o.mentor?.mentor_profiles?.[0]?.current_role && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  {o.mentor.mentor_profiles[0].current_role}
                </p>
              )}
            </div>
          </div>

          {o.category && (
            <Badge
              variant="secondary"
              className="mt-4 text-xs px-3 py-1 rounded-full font-medium"
            >
              {o.category}
            </Badge>
          )}
        </div>
      )}

      <div className="p-5 flex flex-col flex-1">
        {hideMentor && o.category && (
          <Badge
            variant="secondary"
            className="self-start mb-3 text-xs px-3 py-1 rounded-full font-medium"
          >
            {o.category}
          </Badge>
        )}

        <h3 className="text-xl font-semibold leading-tight tracking-tight mb-1">
          {o.title}
        </h3>

        {o.description && (
          <p className="text-muted-foreground text-[15px] line-clamp-2 mt-1 mb-4">
            {stripMarkdown(o.description)}
          </p>
        )}

        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-auto">
          <Clock className="h-4 w-4" />
          <span>{o.duration_minutes} min</span>
          {onLearnMore && o.description && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto text-xs font-medium h-8 px-3"
              onClick={onLearnMore}
            >
              Learn more
            </Button>
          )}
        </div>

        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/60">
          <div className="flex items-baseline gap-0.5">
            {o.price === 0 ? (
              <span className="text-2xl font-semibold">Free</span>
            ) : (
              <>
                <span className="text-2xl font-semibold">₹</span>
                <span className="text-2xl font-semibold">{o.price}</span>
              </>
            )}
          </div>
          <Button
            size="lg"
            className="px-8 rounded-2xl font-medium shadow-sm"
            onClick={onBook}
          >
            Book Now
          </Button>
        </div>
      </div>
    </div>
  );
}
