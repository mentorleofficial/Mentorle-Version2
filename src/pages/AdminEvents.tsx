import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Plus, Calendar, Clock, History, LayoutGrid, Loader2 } from "lucide-react";
import { fromZonedTime } from "date-fns-tz";

// State & API
import { useAllEvents, useMentorEventsMutations } from "@/features/mentor-events/useMentorEvents";
import { uploadEventBanner, deleteEventBanner, type EventProgram } from "@/features/mentor-events/api/events";

// Components
import EventFilters from "@/features/mentor-events/components/EventFilters";
import EventCard from "@/features/mentor-events/components/EventCard";
import EventForm from "@/features/mentor-events/components/EventForm";
import DeleteDialog from "@/features/mentor-events/components/DeleteDialog";
import ParticipantsDialog from "@/features/mentor-events/components/ParticipantsDialog";

// Timezone converter
const toUTC = (dateString: string, timeString: string = "00:00") => {
  if (!dateString) return "";
  try {
    return fromZonedTime(`${dateString}T${timeString}:00`, "Asia/Kolkata").toISOString();
  } catch (e) {
    console.error("Error converting to UTC", e);
    return "";
  }
};

export default function AdminEvents() {
  const { user } = useAuth();
  
  // Queries - fetch ALL events for admin
  const { data: events = [], isLoading } = useAllEvents();
  const { createEvent, updateEvent, deleteEvent } = useMentorEventsMutations(user?.id, true);

  // Filter & Tab States
  const [activeTab, setActiveTab] = useState<"upcoming" | "past" | "all">("upcoming");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  // Dialog States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isParticipantsDialogOpen, setIsParticipantsDialogOpen] = useState(false);
  const [currentEvent, setCurrentEvent] = useState<EventProgram | null>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Check if event is in the past
  const isEventPast = (event: EventProgram) => {
    const now = new Date();
    const eventEndDate = new Date(event.end_date);
    return eventEndDate < now;
  };

  // Filter logic
  const filteredEvents = events.filter((event) => {
    const matchesTab = (() => {
      if (activeTab === "all") return true;
      if (activeTab === "upcoming") return !isEventPast(event);
      if (activeTab === "past") return isEventPast(event);
      return true;
    })();

    const matchesSearch = 
      event.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = filterType === "all" || event.event_type === filterType;
    const matchesStatus = filterStatus === "all" || event.status === filterStatus;

    return matchesTab && matchesSearch && matchesType && matchesStatus;
  });

  const upcomingCount = events.filter(e => !isEventPast(e)).length;
  const pastCount = events.filter(e => isEventPast(e)).length;

  // Handlers
  const handleOpenCreate = () => {
    setCurrentEvent(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (event: EventProgram) => {
    setCurrentEvent(event);
    setIsFormOpen(true);
  };

  const handleOpenDelete = (event: EventProgram) => {
    setCurrentEvent(event);
    setIsDeleteDialogOpen(true);
  };

  const handleOpenParticipants = (event: EventProgram) => {
    setCurrentEvent(event);
    setIsParticipantsDialogOpen(true);
  };

  const handleFormSubmit = async (formData: any, imageFile: File | null) => {
    if (!user?.id) return;
    setIsSubmitting(true);

    try {
      const hasMultipleSessions = formData.sessions && formData.sessions.length > 0;
      let startDate: string;
      let endDate: string;

      if (hasMultipleSessions) {
        const sorted = [...formData.sessions].sort((a, b) => 
          new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        const first = sorted[0];
        const last = sorted[sorted.length - 1];
        startDate = toUTC(first.date, first.start_time || "00:00");
        endDate = toUTC(last.date, last.end_time || "23:59");
      } else {
        startDate = toUTC(formData.start_date, formData.start_time);
        endDate = toUTC(formData.end_date, formData.end_time);
      }

      if (!startDate || !endDate) {
        throw new Error("Invalid start or end dates provided.");
      }

      const eventPayload: any = {
        title: formData.title,
        description: formData.description,
        event_type: formData.event_type,
        college_name: "Online",
        location: formData.location || "Online",
        start_date: startDate,
        end_date: endDate,
        start_time: startDate,
        meeting_link: hasMultipleSessions ? null : (formData.meeting_link || null),
        status: formData.status,
        sessions: hasMultipleSessions ? formData.sessions : [],
        max_participants: formData.max_participants ? parseInt(formData.max_participants, 10) : null,
        registration_deadline: formData.registration_deadline ? toUTC(formData.registration_deadline, "23:59") : null,
        registration_link: formData.registration_link || null,
        prerequisites: formData.prerequisites || null,
        learning_outcomes: formData.learning_outcomes || null,
        speaker_name: formData.speaker_name || null,
        speaker_linkedin: formData.speaker_linkedin || null,
        speaker_github: formData.speaker_github || null,
        speaker_image: formData.speaker_image || null,
      };

      if (currentEvent) {
        // Edit flow
        let bannerUrl = currentEvent.banner_image_url;
        if (imageFile) {
          // Delete old one if exists
          if (currentEvent.banner_image_url) {
            await deleteEventBanner(currentEvent.banner_image_url);
          }
          bannerUrl = await uploadEventBanner(imageFile, currentEvent.id);
        }
        
        await updateEvent.mutateAsync({
          id: currentEvent.id,
          data: { ...eventPayload, banner_image_url: bannerUrl }
        });
      } else {
        // Create flow
        const newEvent = await createEvent.mutateAsync(eventPayload);
        if (imageFile && newEvent?.id) {
          const bannerUrl = await uploadEventBanner(imageFile, newEvent.id);
          await updateEvent.mutateAsync({
            id: newEvent.id,
            data: { banner_image_url: bannerUrl }
          });
        }
      }

      setIsFormOpen(false);
      setCurrentEvent(null);
    } catch (error: any) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!currentEvent) return;
    setIsDeleting(true);

    try {
      if (currentEvent.banner_image_url) {
        await deleteEventBanner(currentEvent.banner_image_url);
      }
      await deleteEvent.mutateAsync(currentEvent.id);
      setIsDeleteDialogOpen(false);
      setCurrentEvent(null);
    } catch (error) {
      console.error(error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Calendar className="h-8 w-8 text-primary" />
              Events Management
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5">
              Manage workshops, bootcamps, and guest speaking sessions across the platform
            </p>
          </div>
          <Button onClick={handleOpenCreate} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Create Event
          </Button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 border-b border-border/60 pb-3">
          <Button
            variant={activeTab === "upcoming" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("upcoming")}
            className="flex items-center gap-1.5 text-xs font-semibold"
          >
            <Clock className="h-3.5 w-3.5" />
            Upcoming
            {upcomingCount > 0 && (
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${
                activeTab === "upcoming" ? "bg-background text-foreground" : "bg-muted text-muted-foreground"
              }`}>
                {upcomingCount}
              </span>
            )}
          </Button>
          
          <Button
            variant={activeTab === "past" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("past")}
            className="flex items-center gap-1.5 text-xs font-semibold"
          >
            <History className="h-3.5 w-3.5" />
            Past
            {pastCount > 0 && (
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${
                activeTab === "past" ? "bg-background text-foreground" : "bg-muted text-muted-foreground"
              }`}>
                {pastCount}
              </span>
            )}
          </Button>
          
          <Button
            variant={activeTab === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("all")}
            className="flex items-center gap-1.5 text-xs font-semibold"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            All
            <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${
              activeTab === "all" ? "bg-background text-foreground" : "bg-muted text-muted-foreground"
            }`}>
              {events.length}
            </span>
          </Button>
        </div>

        {/* Filters */}
        <EventFilters
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          filterType={filterType}
          setFilterType={setFilterType}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
        />

        {/* Events Grid */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-card border rounded-lg">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
            <p className="mt-4 text-sm text-muted-foreground">Loading all events...</p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-16 bg-card border rounded-lg">
            <Calendar className="h-12 w-12 text-muted-foreground/35 mx-auto mb-4" />
            <h3 className="text-base font-semibold text-foreground mb-1">
              {events.length === 0 
                ? "No events created yet" 
                : activeTab === "upcoming" 
                  ? "No upcoming events"
                  : activeTab === "past"
                    ? "No past events"
                    : "No matching events found"
              }
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto mb-6">
              {events.length === 0 
                ? "Click Create Event above to start hosting workshops and sessions."
                : activeTab === "upcoming"
                  ? "Try creating a new event."
                  : activeTab === "past"
                    ? "Past completed sessions will appear here."
                    : "Try adjusting search or status filters."
              }
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onEdit={handleOpenEdit}
                onDelete={handleOpenDelete}
                onViewParticipants={handleOpenParticipants}
              />
            ))}
          </div>
        )}

        {/* Event Form Dialog */}
        <EventForm
          isOpen={isFormOpen}
          onClose={() => {
            setIsFormOpen(false);
            setCurrentEvent(null);
          }}
          onSubmit={handleFormSubmit}
          initialData={currentEvent}
          isSubmitting={isSubmitting}
        />

        {/* Delete Confirmation Dialog */}
        <DeleteDialog
          isOpen={isDeleteDialogOpen}
          onClose={() => {
            setIsDeleteDialogOpen(false);
            setCurrentEvent(null);
          }}
          onConfirm={handleDelete}
          eventTitle={currentEvent?.title}
          isDeleting={isDeleting}
        />

        {/* Participants Dialog */}
        {currentEvent && (
          <ParticipantsDialog
            isOpen={isParticipantsDialogOpen}
            onClose={() => {
              setIsParticipantsDialogOpen(false);
              setCurrentEvent(null);
            }}
            event={currentEvent}
          />
        )}
      </div>
    </AppLayout>
  );
}
