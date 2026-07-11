import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Users, Mail, Calendar } from "lucide-react";
import { useEventParticipants } from "../useMentorEvents";
import { formatISTDate } from "@/lib/datetime";
import type { EventProgram } from "../api/events";

interface ParticipantsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  event: EventProgram | null;
}

export default function ParticipantsDialog({ isOpen, onClose, event }: ParticipantsDialogProps) {
  const { data: participants = [], isLoading } = useEventParticipants(event?.id);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Participants - {event?.title}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : participants.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-muted-foreground/35 mx-auto mb-4" />
              <p className="text-sm font-semibold text-foreground">No participants yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Share your event details to get registrations.
              </p>
            </div>
          ) : (
            <div className="space-y-3 pr-1">
              <p className="text-xs font-semibold text-muted-foreground mb-4 uppercase tracking-wider">
                {participants.length} participant{participants.length !== 1 ? 's' : ''} registered
              </p>
              
              {participants.map((participant) => (
                <div 
                  key={participant.id}
                  className="flex items-center justify-between p-3 border rounded-lg bg-card hover:bg-muted/10 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-accent text-accent-foreground flex items-center justify-center font-bold text-xs shrink-0 border">
                      {participant.user_profiles?.full_name?.[0]?.toUpperCase() || "?"}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {participant.user_profiles?.full_name || "Unknown User"}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5 truncate">
                        <Mail className="h-3 w-3 text-muted-foreground/75" />
                        {participant.user_profiles?.email || "No email"}
                      </p>
                    </div>
                  </div>
                  <div className="text-[10px] text-muted-foreground flex items-center gap-1 shrink-0 font-medium bg-muted px-2 py-0.5 rounded border border-border/50">
                    <Calendar className="h-3 w-3" />
                    {formatISTDate(participant.registered_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pt-4 border-t flex justify-end">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
