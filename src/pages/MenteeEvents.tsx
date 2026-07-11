import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Calendar,
  Clock,
  MapPin,
  Search,
  Video,
  Layers,
  ArrowRight,
  User,
  GraduationCap,
  Sparkles,
  Award,
  VideoOff,
  CalendarDays,
  ExternalLink,
  BookOpen,
  CheckCircle,
  HelpCircle,
  AlertCircle,
  Trophy,
} from "lucide-react";
import { formatISTDateTime, formatIST } from "@/lib/datetime";
import { markdownToHtml } from "@/components/ui/markdown-editor";

const stripMarkdown = (md: string) =>
  markdownToHtml(md).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

const formatTime12Hour = (timeStr: string) => {
  if (!timeStr) return "";
  try {
    const [hours, minutes] = timeStr.split(":");
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  } catch {
    return timeStr;
  }
};

import {
  useAllEvents,
  useMenteeRegistrations,
  useRegisterForEvent,
  useUnregisterFromEvent,
} from "@/features/mentor-events/useMentorEvents";
import type { EventProgram } from "@/features/mentor-events/api/events";

export default function MenteeEvents() {
  const { user } = useAuth();
  
  // Queries
  const { data: events = [], isLoading: eventsLoading } = useAllEvents();
  const { data: registrations = [], isLoading: regsLoading } = useMenteeRegistrations(user?.id);
  
  // Mutations
  const registerMutation = useRegisterForEvent(user?.id);
  const unregisterMutation = useUnregisterFromEvent(user?.id);

  // States
  const [activeTab, setActiveTab] = useState<"explore" | "my-events">("explore");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [selectedEvent, setSelectedEvent] = useState<EventProgram | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const isLoading = eventsLoading || regsLoading;

  // Helper: check if user is registered for an event
  const isUserRegistered = (eventId: string) => {
    return registrations.some((reg: any) => reg.event_id === eventId);
  };

  // Helper: check if event is in the past
  const isEventPast = (event: EventProgram) => {
    const now = new Date();
    const eventEndDate = new Date(event.end_date);
    return eventEndDate < now;
  };

  // Helper: check if registration deadline is passed
  const isDeadlinePassed = (event: EventProgram) => {
    if (!event.registration_deadline) return false;
    return new Date(event.registration_deadline) < new Date();
  };

  // Helper: check if event is full
  const isEventFull = (event: EventProgram) => {
    if (!event.max_participants) return false;
    return (event.participant_count || 0) >= event.max_participants;
  };

  // Helper: Format Event Type
  const formatEventType = (type: string) => {
    return type?.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase()) || "Event";
  };

  // Helper: Get Event Status Label & Variant for Mentees
  const getEventStatusBadge = (event: EventProgram) => {
    if (event.status === "cancelled") {
      return <Badge variant="destructive">Cancelled</Badge>;
    }
    const past = isEventPast(event);
    if (past) {
      return <Badge variant="outline" className="bg-muted text-muted-foreground border-muted-foreground/25">Completed</Badge>;
    }
    
    const now = new Date();
    const startDate = new Date(event.start_date);
    const isOngoing = startDate <= now && !past;
    
    if (isOngoing) {
      return (
        <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
          Live Now
        </Badge>
      );
    }
    
    return <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-0">Upcoming</Badge>;
  };

  // Filter Events
  const filteredEvents = events.filter((event) => {
    // Only show active / non-cancelled events for Mentees unless they are already registered
    if (event.status === "cancelled" && !isUserRegistered(event.id)) {
      return false;
    }

    const matchesSearch =
      event.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.college_name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = filterType === "all" || event.event_type === filterType;

    if (activeTab === "explore") {
      // Mentees see upcoming and ongoing events to register
      return matchesSearch && matchesType && !isEventPast(event);
    } else {
      // Mentees see events they registered for
      return matchesSearch && matchesType && isUserRegistered(event.id);
    }
  });

  const handleRegister = async (event: EventProgram, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!user?.id) return;
    
    try {
      await registerMutation.mutateAsync(event.id);
      if (event.registration_link) {
        window.open(event.registration_link, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUnregister = async (eventId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!user?.id || !window.confirm("Are you sure you want to unregister from this event?")) return;
    
    try {
      await unregisterMutation.mutateAsync(eventId);
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenDetails = (event: EventProgram) => {
    setSelectedEvent(event);
    setDetailOpen(true);
  };

  const handleJoinSession = (event: EventProgram, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const link = event.meeting_link || event.registration_link;
    if (link) {
      window.open(link, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <CalendarDays className="h-8 w-8 text-primary" />
              Events & Programs
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5">
              Discover and participate in live workshops, bootcamps, and webinars hosted by industry mentors
            </p>
          </div>

          {/* Tab Selection */}
          <div className="bg-muted p-1 rounded-lg flex items-center self-start gap-1">
            <Button
              variant={activeTab === "explore" ? "default" : "ghost"}
              size="sm"
              onClick={() => {
                setActiveTab("explore");
                setSearchTerm("");
              }}
              className="text-xs font-semibold"
            >
              Explore Events
            </Button>
            <Button
              variant={activeTab === "my-events" ? "default" : "ghost"}
              size="sm"
              onClick={() => {
                setActiveTab("my-events");
                setSearchTerm("");
              }}
              className="text-xs font-semibold relative"
            >
              My Registrations
              {registrations.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[9px] h-4 w-4 flex items-center justify-center rounded-full font-bold shadow-sm">
                  {registrations.length}
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* Search and Category Filter Row */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by title, description or host..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-10 w-full"
            />
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            {["all", "workshop", "bootcamp", "guest_session", "event"].map((type) => (
              <Button
                key={type}
                variant={filterType === type ? "secondary" : "outline"}
                size="sm"
                onClick={() => setFilterType(type)}
                className="text-xs capitalize h-9 px-3 flex-1 sm:flex-initial"
              >
                {type === "all" ? "All Types" : type.replace("_", " ")}
              </Button>
            ))}
          </div>
        </div>

        {/* List Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div key={n} className="border rounded-xl h-80 animate-pulse bg-muted/20" />
            ))}
          </div>
        ) : filteredEvents.length === 0 ? (
          <Card className="border border-dashed py-16 text-center">
            <CardContent className="flex flex-col items-center justify-center space-y-4">
              <Calendar className="h-12 w-12 text-muted-foreground/35" />
              <div className="space-y-1.5 max-w-sm">
                <h3 className="text-base font-semibold text-foreground">
                  {activeTab === "explore" ? "No events available" : "No registered events"}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {activeTab === "explore"
                    ? "Check back later! Mentors will post upcoming workshops and bootcamps soon."
                    : "You haven't registered for any events yet. Explore the available events to register."}
                </p>
              </div>
              {activeTab === "my-events" && (
                <Button size="sm" onClick={() => setActiveTab("explore")}>
                  Browse Events
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEvents.map((event) => {
              const registered = isUserRegistered(event.id);
              const past = isEventPast(event);
              const deadlinePassed = isDeadlinePassed(event);
              const ongoing = !past && new Date(event.start_date) <= new Date();

              const hasSessions = event.sessions && event.sessions.length > 0;
              const sessionCount = hasSessions ? event.sessions.length : 1;

              return (
                <Card 
                  key={event.id}
                  onClick={() => handleOpenDetails(event)}
                  className="overflow-hidden hover:shadow-lg transition-all duration-300 border border-border bg-card cursor-pointer group flex flex-col h-full"
                >
                  {/* Banner image or gradient placeholder */}
                  {event.banner_image_url ? (
                    <div className="h-44 overflow-hidden relative bg-muted shrink-0">
                      <img
                        src={event.banner_image_url}
                        alt={event.title}
                        className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                      {hasSessions && (
                        <Badge className="absolute top-2 right-2 bg-background/95 hover:bg-background/90 text-foreground border shadow-sm flex items-center gap-1 py-1">
                          <Layers className="h-3 w-3 text-primary" />
                          {sessionCount} Sessions
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <div className="h-44 bg-gradient-to-br from-primary/5 to-primary/10 border-b flex items-center justify-center relative shrink-0">
                      <Video className="h-10 w-10 text-primary/40" />
                      {hasSessions && (
                        <Badge className="absolute top-2 right-2 bg-background/95 hover:bg-background/90 text-foreground border shadow-sm flex items-center gap-1 py-1">
                          <Layers className="h-3 w-3 text-primary" />
                          {sessionCount} Sessions
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* Body Content */}
                  <CardContent className="p-5 flex-1 flex flex-col justify-between">
                    <div className="space-y-3">
                      {/* Badges row */}
                      <div className="flex flex-wrap gap-2 items-center">
                        {getEventStatusBadge(event)}
                        <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                          {formatEventType(event.event_type)}
                        </Badge>
                      </div>

                      {/* Title & Host */}
                      <div>
                        <h3 className="text-base font-bold text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                          {event.title}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 font-medium">
                          <GraduationCap className="h-3.5 w-3.5 text-primary/70" />
                          Hosted by {event.college_name || "Online"}
                        </p>
                      </div>

                      {/* Description */}
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {stripMarkdown(event.description)}
                      </p>

                      {/* Quick Specs */}
                      <div className="space-y-1.5 border-t pt-3 border-border/50 text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5 shrink-0" />
                          <span>{formatISTDateTime(event.start_date)}</span>
                        </div>
                        {event.location && (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{event.location}</span>
                          </div>
                        )}
                        {event.max_participants && (
                          <div className="flex items-center gap-2">
                            <Layers className="h-3.5 w-3.5 shrink-0" />
                            <span>
                              Capacity: {event.participant_count || 0} / {event.max_participants} registered
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions footer */}
                    <div className="pt-4 mt-4 border-t border-border/50 flex gap-2 items-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs font-semibold px-2 group/btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenDetails(event);
                        }}
                      >
                        Details
                        <ArrowRight className="h-3 w-3 ml-1 group-hover/btn:translate-x-0.5 transition-transform" />
                      </Button>

                      <div className="ml-auto flex gap-2">
                        {registered ? (
                          <>
                            {ongoing && (event.meeting_link || event.registration_link) ? (
                              <Button
                                size="sm"
                                variant="default"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8"
                                onClick={(e) => handleJoinSession(event, e)}
                              >
                                <Video className="h-3.5 w-3.5 mr-1" />
                                Join Now
                              </Button>
                            ) : (
                              <Badge className="bg-primary/15 text-primary hover:bg-primary/20 border-0 h-8 flex items-center justify-center px-3 text-xs font-semibold">
                                Registered ✓
                              </Badge>
                            )}

                            {!past && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-destructive hover:bg-destructive/10 border-border text-xs h-8 px-2"
                                onClick={(e) => handleUnregister(event.id, e)}
                                disabled={unregisterMutation.isPending}
                              >
                                Cancel
                              </Button>
                            )}
                          </>
                        ) : (
                          <>
                            {event.status === "cancelled" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs h-8 text-destructive border-destructive/20 bg-destructive/5"
                                disabled
                              >
                                Cancelled
                              </Button>
                            ) : !past && !deadlinePassed ? (
                              isEventFull(event) ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs h-8 text-muted-foreground bg-muted"
                                  disabled
                                >
                                  Event Full
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="text-xs h-8"
                                  onClick={(e) => handleRegister(event, e)}
                                  disabled={registerMutation.isPending}
                                >
                                  {event.registration_link ? (
                                    <>
                                      Register
                                      <ExternalLink className="h-3 w-3 ml-1" />
                                    </>
                                  ) : (
                                    "Register"
                                  )}
                                </Button>
                              )
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs h-8"
                                disabled
                              >
                                {deadlinePassed ? "Deadline Passed" : "Registration Closed"}
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Detailed Event Dialog */}
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col p-0 bg-background border rounded-xl shadow-2xl">
            {selectedEvent && (
              <>
                <DialogHeader className="p-6 pb-4 border-b shrink-0 bg-muted/20">
                  <div className="flex flex-wrap gap-2 items-center mb-2">
                    {getEventStatusBadge(selectedEvent)}
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                      {formatEventType(selectedEvent.event_type)}
                    </Badge>
                  </div>
                  <DialogTitle className="text-xl sm:text-2xl font-bold tracking-tight text-foreground leading-tight">
                    {selectedEvent.title}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1 font-medium">
                    <GraduationCap className="h-3.5 w-3.5 text-primary" />
                    Hosted by {selectedEvent.college_name || "Online"}
                  </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {/* Banner Image inside Detail Modal */}
                  {selectedEvent.banner_image_url && (
                    <div className="aspect-[21/9] w-full overflow-hidden rounded-lg bg-muted border">
                      <img
                        src={selectedEvent.banner_image_url}
                        alt={selectedEvent.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  {/* Quick Metadata Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-start gap-3 p-3.5 border rounded-lg bg-card/60 shadow-sm">
                      <Calendar className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Date & Time</p>
                        <p className="text-sm font-semibold text-foreground mt-0.5 leading-snug">
                          {formatISTDateTime(selectedEvent.start_date)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3.5 border rounded-lg bg-card/60 shadow-sm">
                      <MapPin className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Location</p>
                        <p className="text-sm font-semibold text-foreground mt-0.5 leading-snug">
                          {selectedEvent.location || "Online"}
                        </p>
                      </div>
                    </div>

                    {selectedEvent.registration_deadline && (
                      <div className="flex items-start gap-3 p-3.5 border rounded-lg bg-card/60 shadow-sm">
                        <Clock className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                        <div>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Registration Deadline</p>
                          <p className="text-sm font-semibold mt-0.5 text-orange-600 dark:text-orange-400">
                            {formatISTDateTime(selectedEvent.registration_deadline)}
                          </p>
                        </div>
                      </div>
                    )}

                    {selectedEvent.max_participants && (
                      <div className="flex items-start gap-3 p-3.5 border rounded-lg bg-card/60 shadow-sm">
                        <Layers className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                        <div>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Capacity</p>
                          <p className="text-sm font-semibold text-foreground mt-0.5">
                            {selectedEvent.participant_count || 0} / {selectedEvent.max_participants} registered
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Description Section */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                      <BookOpen className="h-4 w-4 text-primary" />
                      About this Event
                    </h4>
                    <div
                      className="text-sm text-muted-foreground leading-relaxed [&_h1]:text-base [&_h1]:font-bold [&_h2]:text-sm [&_h2]:font-semibold [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 space-y-2"
                      dangerouslySetInnerHTML={{ __html: markdownToHtml(selectedEvent.description) }}
                    />
                  </div>

                  {/* Prerequisites Section */}
                  {selectedEvent.prerequisites && (
                    <div className="p-4 rounded-lg bg-amber-500/5 border border-amber-500/10 space-y-1.5">
                      <h4 className="text-sm font-bold text-amber-800 dark:text-amber-400 flex items-center gap-1.5">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        Prerequisites
                      </h4>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {selectedEvent.prerequisites}
                      </p>
                    </div>
                  )}

                  {/* Learning Outcomes Section */}
                  {selectedEvent.learning_outcomes && (
                    <div className="p-4 rounded-lg bg-primary/5 border border-primary/10 space-y-1.5">
                      <h4 className="text-sm font-bold text-primary flex items-center gap-1.5">
                        <Award className="h-4 w-4 shrink-0" />
                        What You'll Learn
                      </h4>
                      <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                        {selectedEvent.learning_outcomes}
                      </p>
                    </div>
                  )}

                  {/* Syllabus / Schedule Sessions Section */}
                  {selectedEvent.sessions && selectedEvent.sessions.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                        <Layers className="h-4 w-4 text-primary" />
                        Sessions Schedule ({selectedEvent.sessions.length})
                      </h4>
                      <div className="space-y-2">
                        {selectedEvent.sessions.map((session, idx) => (
                          <div 
                            key={session.id || idx} 
                            className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-lg bg-muted/30 gap-2"
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold shrink-0">
                                {idx + 1}
                              </span>
                              <span className="text-sm font-semibold text-foreground">{session.title}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground self-start sm:self-center bg-background border px-2.5 py-1 rounded">
                              <Calendar className="h-3.5 w-3.5 shrink-0" />
                              <span>{formatIST(new Date(session.date), "d MMM yyyy")}</span>
                              <span>•</span>
                              <span>{formatTime12Hour(session.start_time)} - {formatTime12Hour(session.end_time)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Speaker Details */}
                  {selectedEvent.speaker_name && (
                    <div className="p-5 border rounded-xl bg-card space-y-4">
                      <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5 border-b pb-2">
                        <User className="h-4 w-4 text-primary" />
                        Guest Speaker
                      </h4>
                      <div className="flex items-center gap-4">
                        {selectedEvent.speaker_image ? (
                          <img
                            src={selectedEvent.speaker_image}
                            alt={selectedEvent.speaker_name}
                            className="w-12 h-12 rounded-full object-cover border"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-base border">
                            {selectedEvent.speaker_name[0]?.toUpperCase()}
                          </div>
                        )}
                        <div>
                          <h5 className="text-sm font-bold text-foreground">{selectedEvent.speaker_name}</h5>
                          <div className="flex gap-3 mt-1.5 text-xs">
                            {selectedEvent.speaker_linkedin && (
                              <a
                                href={selectedEvent.speaker_linkedin}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline flex items-center gap-0.5"
                              >
                                LinkedIn
                              </a>
                            )}
                            {selectedEvent.speaker_github && (
                              <a
                                href={selectedEvent.speaker_github}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-muted-foreground hover:text-foreground hover:underline flex items-center gap-0.5"
                              >
                                GitHub
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Dialog Footer Actions */}
                <div className="p-4 border-t shrink-0 flex items-center justify-end gap-2 bg-muted/10">
                  <Button variant="outline" size="sm" onClick={() => setDetailOpen(false)}>
                    Close
                  </Button>

                  {isUserRegistered(selectedEvent.id) ? (
                    <>
                      {(!isEventPast(selectedEvent) && (selectedEvent.meeting_link || selectedEvent.registration_link)) && (
                        <Button
                          size="sm"
                          variant="default"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => handleJoinSession(selectedEvent)}
                        >
                          <Video className="h-3.5 w-3.5 mr-1" />
                          Join Live Session
                        </Button>
                      )}
                      {!isEventPast(selectedEvent) && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            handleUnregister(selectedEvent.id);
                            setDetailOpen(false);
                          }}
                          disabled={unregisterMutation.isPending}
                        >
                          Cancel Registration
                        </Button>
                      )}
                    </>
                  ) : (
                    <>
                      {selectedEvent.status === "cancelled" ? (
                        <Button size="sm" variant="outline" className="text-destructive border-destructive/20 bg-destructive/5" disabled>
                          Event Cancelled
                        </Button>
                      ) : !isEventPast(selectedEvent) && !isDeadlinePassed(selectedEvent) ? (
                        isEventFull(selectedEvent) ? (
                          <Button size="sm" variant="outline" className="text-muted-foreground bg-muted" disabled>
                            Event Full
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => {
                              handleRegister(selectedEvent);
                              setDetailOpen(false);
                            }}
                            disabled={registerMutation.isPending}
                          >
                            {selectedEvent.registration_link ? (
                              <>
                                Register
                                <ExternalLink className="h-3 w-3 ml-1" />
                              </>
                            ) : (
                              "Register Now"
                            )}
                          </Button>
                        )
                      ) : (
                        <Button size="sm" variant="outline" disabled>
                          Registration Closed
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
