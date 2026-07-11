import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CalendarPlus, Download, ExternalLink } from "lucide-react";
import {
  buildGoogleCalendarUrl,
  downloadIcs,
  type CalendarEventInput,
} from "@/lib/calendarLinks";

interface Props {
  event: CalendarEventInput;
  filename?: string;
}

const AddToCalendarMenu = ({ event, filename }: Props) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          <CalendarPlus className="mr-1 h-3 w-3" />
          Add to Calendar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={() => downloadIcs(event, filename)}>
          <Download className="mr-2 h-3.5 w-3.5" />
          Download .ics file
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a
            href={buildGoogleCalendarUrl(event)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center"
          >
            <ExternalLink className="mr-2 h-3.5 w-3.5" />
            Add to Google Calendar
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default AddToCalendarMenu;
