import { Calendar, MapPin, Edit, Trash2, Users, Video, ExternalLink, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatISTDateTime, formatIST } from "@/lib/datetime";
import type { EventProgram } from "../api/events";

interface EventCardProps {
  event: EventProgram;
  onEdit: (event: EventProgram) => void;
  onDelete: (event: EventProgram) => void;
  onViewParticipants: (event: EventProgram) => void;
}

export default function EventCard({ event, onEdit, onDelete, onViewParticipants }: EventCardProps) {
  const getStatusVariant = (status: string) => {
    switch (status) {
      case "upcoming": return "secondary";
      case "ongoing": return "default";
      case "completed": return "outline";
      case "cancelled": return "destructive";
      default: return "secondary";
    }
  };

  const getStatusLabel = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const formatEventType = (type: string) => {
    return type?.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase()) || "Event";
  };

  const hasMultipleSessions = event.sessions && event.sessions.length > 0;
  const sessionCount = hasMultipleSessions ? event.sessions.length : 1;

  const formatSessionDate = (dateStr: string) => {
    if (!dateStr) return "";
    try {
      return formatIST(new Date(dateStr), "d MMM");
    } catch {
      return dateStr;
    }
  };

  const getDateRange = () => {
    if (!hasMultipleSessions) return null;
    
    const sortedSessions = [...event.sessions].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    const firstDate = formatSessionDate(sortedSessions[0]?.date);
    const lastDate = formatSessionDate(sortedSessions[sortedSessions.length - 1]?.date);
    
    if (firstDate === lastDate) return firstDate;
    return `${firstDate} - ${lastDate}`;
  };

  return (
    <Card className="overflow-hidden hover:shadow-md transition-all duration-200 border border-border bg-card">
      {/* Banner Image / Gradient Placeholder */}
      {event.banner_image_url ? (
        <div className="h-40 overflow-hidden bg-muted relative">
          <img
            src={event.banner_image_url}
            alt={event.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
          {hasMultipleSessions && (
            <Badge className="absolute top-2 right-2 bg-background/95 hover:bg-background/90 text-foreground border shadow-sm flex items-center gap-1 py-1">
              <Layers className="h-3 w-3 text-primary" />
              {sessionCount} Sessions
            </Badge>
          )}
        </div>
      ) : (
        <div className="h-40 bg-gradient-to-br from-primary/5 to-primary/10 border-b flex items-center justify-center relative">
          <Video className="h-10 w-10 text-primary/45" />
          {hasMultipleSessions && (
            <Badge className="absolute top-2 right-2 bg-background/95 hover:bg-background/90 text-foreground border shadow-sm flex items-center gap-1 py-1">
              <Layers className="h-3 w-3 text-primary" />
              {sessionCount} Sessions
            </Badge>
          )}
        </div>
      )}

      <CardContent className="p-5">
        {/* Status and Type Badges */}
        <div className="flex flex-wrap gap-2 mb-3">
          <Badge variant={getStatusVariant(event.status)} className="font-semibold text-[10px] tracking-wide uppercase px-2 py-0.5">
            {getStatusLabel(event.status)}
          </Badge>
          <Badge variant="outline" className="font-semibold text-[10px] tracking-wide uppercase px-2 py-0.5 bg-background">
            {formatEventType(event.event_type)}
          </Badge>
          {hasMultipleSessions && (
            <Badge variant="outline" className="font-semibold text-[10px] tracking-wide uppercase px-2 py-0.5 bg-primary/5 border-primary/20 text-primary">
              Series
            </Badge>
          )}
        </div>

        {/* Title */}
        <h3 className="text-base font-bold text-foreground mb-1.5 line-clamp-2 leading-snug">
          {event.title}
        </h3>

        {/* Description */}
        <p className="text-xs text-muted-foreground mb-4 line-clamp-2">
          {event.description}
        </p>

        {/* Event Details */}
        <div className="space-y-2 mb-4 border-t pt-3 border-border/50">
          {event.location && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground/70 flex-shrink-0" />
              <span className="truncate">{event.location}</span>
            </div>
          )}

          {/* Date display - different for single vs multi-session */}
          {hasMultipleSessions ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground/70 flex-shrink-0" />
              <span className="font-medium text-foreground">{getDateRange()} <span className="text-muted-foreground font-normal">• {sessionCount} sessions</span></span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground/70 flex-shrink-0" />
              <span className="font-medium text-foreground">{formatISTDateTime(event.start_date)}</span>
            </div>
          )}

          {/* Meeting link for single session events */}
          {!hasMultipleSessions && event.meeting_link && (
            <div className="flex items-center gap-2 text-xs text-primary">
              <Video className="h-3.5 w-3.5 flex-shrink-0" />
              <a 
                href={event.meeting_link} 
                target="_blank" 
                rel="noopener noreferrer"
                className="truncate hover:underline flex items-center gap-1 font-medium"
              >
                Join Meeting Link <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          {/* Show if any session has a meeting link */}
          {hasMultipleSessions && event.sessions.some(s => s.meeting_link) && (
            <div className="flex items-center gap-2 text-xs text-primary">
              <Video className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="font-medium">Meeting links provided</span>
            </div>
          )}

          {/* Participant Count */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5 text-muted-foreground/70 flex-shrink-0" />
            <span className="font-semibold text-foreground">{event.participant_count || 0} Registered</span>
          </div>
        </div>

        {/* Session Preview for multi-session events */}
        {hasMultipleSessions && event.sessions.length > 0 && (
          <div className="mb-4 p-2.5 bg-muted/30 border rounded-lg">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Sessions Schedule:</p>
            <div className="space-y-1.5">
              {event.sessions.slice(0, 3).map((session, idx) => (
                <div key={session.id || idx} className="text-xs text-foreground flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-[9px] font-bold">
                    {idx + 1}
                  </span>
                  <span className="truncate flex-1 font-medium">{session.title || `Session ${idx + 1}`}</span>
                  <span className="text-[10px] text-muted-foreground bg-background px-1.5 py-0.5 rounded border border-border">
                    {formatSessionDate(session.date)}
                  </span>
                </div>
              ))}
              {event.sessions.length > 3 && (
                <p className="text-[10px] text-muted-foreground font-semibold ml-6 pt-1">
                  + {event.sessions.length - 3} more sessions
                </p>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-3 border-t border-border/50">
          <Button
            onClick={() => onViewParticipants(event)}
            variant="outline"
            size="sm"
            className="flex-1 text-xs"
          >
            <Users className="h-3.5 w-3.5 mr-1.5" />
            Participants
          </Button>
          <Button
            onClick={() => onEdit(event)}
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0 border-border"
          >
            <Edit className="h-3.5 w-3.5" />
          </Button>
          <Button
            onClick={() => onDelete(event)}
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10 border-border"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
