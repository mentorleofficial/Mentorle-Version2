import { useEffect, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface MentorExpertiseTagsProps {
  tags: string[];
}

export const MentorExpertiseTags = ({ tags }: MentorExpertiseTagsProps) => {
  const [isTouch, setIsTouch] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Check if the device has a touch screen / coarse pointer
    const mediaQuery = window.matchMedia("(pointer: coarse)");
    setIsTouch(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => {
      setIsTouch(e.matches);
    };

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  if (!tags || tags.length === 0) return null;

  // If there are 2 or fewer tags, display them directly without Popover/Tooltip
  if (tags.length <= 2) {
    const isSingle = tags.length === 1;
    return (
      <div className="flex items-center gap-1 mt-1.5 flex-nowrap overflow-hidden">
        {tags.map((tag) => (
          <span
            key={tag}
            className={`rounded-full bg-white/15 text-white/90 text-[9.5px] font-medium px-1.5 py-0.5 truncate shrink min-w-0 ${
              isSingle
                ? "max-w-[135px] xs:max-w-[160px] sm:max-w-[180px]"
                : "max-w-[80px] xs:max-w-[95px] sm:max-w-[110px]"
            }`}
          >
            {tag}
          </span>
        ))}
      </div>
    );
  }

  const visibleTags = tags.slice(0, 2);
  const remainingCount = tags.length - visibleTags.length;

  const tagsListTrigger = (
    <div
      onClick={(e) => {
        // Prevent click from navigating to the mentor detail page
        e.stopPropagation();
        if (isTouch) {
          setOpen(!open);
        }
      }}
      className="flex items-center gap-1 mt-1.5 flex-nowrap overflow-hidden cursor-pointer"
    >
      {visibleTags.map((tag) => (
        <span
          key={tag}
          className="rounded-full bg-white/15 text-white/90 text-[9.5px] font-medium px-1.5 py-0.5 truncate shrink min-w-0 max-w-[90px] xs:max-w-[105px] sm:max-w-[120px]"
        >
          {tag}
        </span>
      ))}
      {remainingCount > 0 && (
        <span className="rounded-full bg-white/20 text-white text-[9.5px] font-semibold px-1.5 py-0.5 whitespace-nowrap">
          +{remainingCount}
        </span>
      )}
    </div>
  );

  if (isTouch) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          {tagsListTrigger}
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="start"
          className="w-auto max-w-[220px] p-2 bg-black/95 backdrop-blur-md border border-white/10 text-white rounded-xl shadow-xl z-50"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-wrap gap-1 max-h-48 overflow-y-auto">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-white/15 text-white/95 text-[10px] px-2 py-0.5 whitespace-nowrap"
              >
                {tag}
              </span>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {tagsListTrigger}
      </TooltipTrigger>
      <TooltipContent
        side="top"
        align="start"
        className="w-auto max-w-[240px] p-2 bg-black/95 backdrop-blur-md border border-white/10 text-white rounded-lg shadow-xl"
      >
        <div className="flex flex-wrap gap-1">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-white/15 text-white/95 text-[10px] px-1.5 py-0.5 whitespace-nowrap"
            >
              {tag}
            </span>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  );
};

export default MentorExpertiseTags;
