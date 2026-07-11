import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { Label } from "@/components/ui/label";
import { 
  FileText, 
  Calendar, 
  Layers, 
  Settings, 
  ChevronDown, 
  ChevronUp, 
  Users, 
  User,
  Plus,
  AlertCircle
} from "lucide-react";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import SessionManager from "./SessionManager";
import type { EventProgram, EventSession } from "../api/events";

// Timezone helpers
const getISTDateString = (date: Date | string) => {
  if (!date) return "";
  try {
    return formatInTimeZone(new Date(date), "Asia/Kolkata", "yyyy-MM-dd");
  } catch (e) {
    console.error("Error formatting IST date", e);
    return "";
  }
};

const extractISTTime = (date: Date | string) => {
  if (!date) return "";
  try {
    return formatInTimeZone(new Date(date), "Asia/Kolkata", "HH:mm");
  } catch (e) {
    console.error("Error extracting IST time", e);
    return "";
  }
};

const cleanUrl = (url: string) => {
  if (!url) return "";
  let clean = url.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(clean)) {
    clean = `https://${clean}`;
  }
  return clean;
};

interface EventFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: any, imageFile: File | null) => void;
  initialData: EventProgram | null;
  isSubmitting: boolean;
}

export default function EventForm({ 
  isOpen, 
  onClose, 
  onSubmit, 
  initialData = null,
  isSubmitting 
}: EventFormProps) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    event_type: "workshop",
    location: "Online",
    start_date: "",
    start_time: "",
    end_date: "",
    end_time: "",
    meeting_link: "",
    status: "upcoming",
    // Advanced settings
    max_participants: "",
    registration_deadline: "",
    registration_link: "",
    prerequisites: "",
    learning_outcomes: "",
    // Speaker details
    speaker_name: "",
    speaker_linkedin: "",
    speaker_github: "",
    speaker_image: ""
  });

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  // Multi-session state
  const [isMultiSession, setIsMultiSession] = useState(false);
  const [sessions, setSessions] = useState<EventSession[]>([]);
  
  // Advanced settings toggle
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Initialize form with existing data when editing
  useEffect(() => {
    if (initialData) {
      setFormData({
        title: initialData.title || "",
        description: initialData.description || "",
        event_type: initialData.event_type || "workshop",
        location: initialData.location || "Online",
        start_date: initialData.start_date ? getISTDateString(initialData.start_date) : "",
        start_time: initialData.start_date ? extractISTTime(initialData.start_date) : "",
        end_date: initialData.end_date ? getISTDateString(initialData.end_date) : "",
        end_time: initialData.end_date ? extractISTTime(initialData.end_date) : "",
        meeting_link: initialData.meeting_link || "",
        status: initialData.status || "upcoming",
        // Advanced settings
        max_participants: initialData.max_participants ? String(initialData.max_participants) : "",
        registration_deadline: initialData.registration_deadline ? getISTDateString(initialData.registration_deadline) : "",
        registration_link: initialData.registration_link || "",
        prerequisites: initialData.prerequisites || "",
        learning_outcomes: initialData.learning_outcomes || "",
        // Speaker details
        speaker_name: initialData.speaker_name || "",
        speaker_linkedin: initialData.speaker_linkedin || "",
        speaker_github: initialData.speaker_github || "",
        speaker_image: initialData.speaker_image || ""
      });
      setImagePreview(initialData.banner_image_url || null);
      
      // Check if event has sessions
      if (initialData.sessions && initialData.sessions.length > 0) {
        setIsMultiSession(true);
        setSessions(initialData.sessions);
      } else {
        setIsMultiSession(false);
        setSessions([]);
      }
      
      // Show advanced settings if any are filled
      if (initialData.max_participants || initialData.registration_deadline || 
          initialData.registration_link || initialData.prerequisites || 
          initialData.learning_outcomes || initialData.speaker_name) {
        setShowAdvanced(true);
      }
    } else {
      resetForm();
    }
  }, [initialData, isOpen]);

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      event_type: "workshop",
      location: "Online",
      start_date: "",
      start_time: "",
      end_date: "",
      end_time: "",
      meeting_link: "",
      status: "upcoming",
      // Advanced settings
      max_participants: "",
      registration_deadline: "",
      registration_link: "",
      prerequisites: "",
      learning_outcomes: "",
      // Speaker details
      speaker_name: "",
      speaker_linkedin: "",
      speaker_github: "",
      speaker_image: ""
    });
    setImageFile(null);
    setImagePreview(null);
    setIsMultiSession(false);
    setShowAdvanced(false);
    setSessions([]);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSessionModeToggle = (multiSession: boolean) => {
    setIsMultiSession(multiSession);
    if (!multiSession) {
      setSessions([]);
    }
  };

  // Get schedule validation error if any
  const getValidationError = () => {
    if (!formData.title) return "Title is required";
    if (!formData.description) return "Description is required";

    if (isMultiSession) {
      if (sessions.length === 0) return "At least one session is required";
      for (let i = 0; i < sessions.length; i++) {
        const s = sessions[i];
        if (!s.date || !s.start_time || !s.end_time) {
          return `Session ${i + 1} has incomplete details`;
        }
        if (s.start_time >= s.end_time) {
          return `Session ${i + 1} start time must be before end time`;
        }
        // If creating a new event, verify session date isn't in the past
        if (!initialData) {
          const sessionDate = new Date(`${s.date}T00:00:00`);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (sessionDate < today) {
            return `Session ${i + 1} cannot be scheduled in the past`;
          }
        }
      }
      if (formData.registration_deadline) {
        // Find first session date
        const sortedDates = [...sessions].map(s => s.date).sort();
        const firstSessionDate = sortedDates[0];
        if (formData.registration_deadline > firstSessionDate) {
          return "Registration deadline must be before or on the first session date";
        }
      }
    } else {
      if (!formData.start_date || !formData.start_time) return "Start date and time are required";
      if (!formData.end_date || !formData.end_time) return "End date and time are required";

      const start = new Date(`${formData.start_date}T${formData.start_time}`);
      const end = new Date(`${formData.end_date}T${formData.end_time}`);

      if (start >= end) {
        return "End date/time must be after start date/time";
      }

      // If creating a new event, start date/time must be in the future
      if (!initialData) {
        const now = new Date();
        if (start < now) {
          return "Event start time cannot be in the past";
        }
      }

      if (formData.registration_deadline) {
        const deadline = new Date(`${formData.registration_deadline}T23:59:59`);
        if (deadline > start) {
          return "Registration deadline must be before or on the event start date";
        }
      }
    }

    if (formData.meeting_link && !/^https?:\/\//i.test(formData.meeting_link)) {
      return "Meeting link must be a valid URL starting with http:// or https://";
    }
    if (formData.registration_link && !/^https?:\/\//i.test(formData.registration_link)) {
      return "External registration link must be a valid URL starting with http:// or https://";
    }
    if (formData.speaker_image && !/^https?:\/\//i.test(formData.speaker_image)) {
      return "Speaker Image URL must be a valid URL starting with http:// or https://";
    }
    if (formData.speaker_linkedin) {
      const cleaned = cleanUrl(formData.speaker_linkedin);
      if (!/linkedin\.com\/(in|pub)\//i.test(cleaned)) {
        return "Speaker LinkedIn link must be a valid linkedin.com/in/... or /pub/... URL";
      }
    }
    if (formData.speaker_github) {
      const cleaned = cleanUrl(formData.speaker_github);
      if (!/github\.com\//i.test(cleaned)) {
        return "Speaker GitHub link must be a valid github.com/... URL";
      }
    }

    return null;
  };

  // Check if form is valid for submission
  const isFormValid = () => {
    return getValidationError() === null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isFormValid()) {
      return;
    }
    
    const validSessions = isMultiSession 
      ? sessions.filter(s => s.date && s.start_time && s.end_time)
      : [];
    
    const submitData = {
      ...formData,
      speaker_linkedin: formData.speaker_linkedin ? cleanUrl(formData.speaker_linkedin) : "",
      speaker_github: formData.speaker_github ? cleanUrl(formData.speaker_github) : "",
      sessions: validSessions
    };
    
    onSubmit(submitData, imageFile);
  };

  const selectStyle = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 mt-1.5";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {initialData ? "Edit Event" : "Create New Event"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Step 1: Event Basics */}
          <div className="bg-muted/30 border rounded-lg p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Event Basics
            </h3>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Event Title *</Label>
                <Input
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="e.g., Introduction to React Workshop"
                  required
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="description">Description *</Label>
                <div className="mt-1.5">
                  <MarkdownEditor
                    value={formData.description}
                    onChange={(value) => setFormData(prev => ({ ...prev, description: value }))}
                    placeholder="Describe what attendees will learn..."
                    rows={5}
                  />
                  <p className="text-xs text-right text-muted-foreground mt-1">{formData.description.length} chars</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="event_type">Event Type *</Label>
                  <select
                    id="event_type"
                    name="event_type"
                    value={formData.event_type}
                    onChange={handleInputChange}
                    className={selectStyle}
                    required
                  >
                    <option value="workshop">Workshop</option>
                    <option value="bootcamp">Bootcamp</option>
                    <option value="guest_session">Guest Session</option>
                    <option value="event">Event</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="status">Status *</Label>
                  <select
                    id="status"
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className={selectStyle}
                    required
                  >
                    <option value="upcoming">Upcoming</option>
                    <option value="ongoing">Ongoing</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              {/* Featured Image */}
              <div>
                <Label htmlFor="banner_image">Featured Image</Label>
                <Input
                  id="banner_image"
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="mt-1.5 cursor-pointer file:text-primary file:font-semibold"
                />
                {imagePreview && (
                  <div className="mt-3">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full h-36 object-cover rounded-lg border shadow-sm"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Session Mode Toggle */}
          <div className="bg-muted/30 border rounded-lg p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Layers className="h-4 w-4 text-muted-foreground" />
              Session Type
            </h3>
            
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => handleSessionModeToggle(false)}
                className={`flex-1 p-4 rounded-lg border-2 text-left transition-all ${
                  !isMultiSession 
                    ? 'border-primary bg-primary/5 text-primary' 
                    : 'border-border bg-card hover:border-muted-foreground/30 text-card-foreground'
                }`}
              >
                <div className="font-semibold text-sm">Single Session</div>
                <div className="text-xs text-muted-foreground mt-1">
                  One-time event with fixed date and time
                </div>
              </button>
              
              <button
                type="button"
                onClick={() => handleSessionModeToggle(true)}
                className={`flex-1 p-4 rounded-lg border-2 text-left transition-all ${
                  isMultiSession 
                    ? 'border-primary bg-primary/5 text-primary' 
                    : 'border-border bg-card hover:border-muted-foreground/30 text-card-foreground'
                }`}
              >
                <div className="font-semibold text-sm">Multiple Sessions</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Event series spanning multiple dates
                </div>
              </button>
            </div>
          </div>

          {/* Schedule - Single Session */}
          {!isMultiSession && (
            <div className="bg-muted/30 border rounded-lg p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                Schedule (IST)
              </h3>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="start_date">Start Date *</Label>
                    <Input
                      id="start_date"
                      name="start_date"
                      type="date"
                      min={!initialData ? getISTDateString(new Date()) : undefined}
                      value={formData.start_date}
                      onChange={handleInputChange}
                      required={!isMultiSession}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="start_time">Start Time *</Label>
                    <Input
                      id="start_time"
                      name="start_time"
                      type="time"
                      value={formData.start_time}
                      onChange={handleInputChange}
                      required={!isMultiSession}
                      className="mt-1.5"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="end_date">End Date *</Label>
                    <Input
                      id="end_date"
                      name="end_date"
                      type="date"
                      min={formData.start_date || (!initialData ? getISTDateString(new Date()) : undefined)}
                      value={formData.end_date}
                      onChange={handleInputChange}
                      required={!isMultiSession}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="end_time">End Time *</Label>
                    <Input
                      id="end_time"
                      name="end_time"
                      type="time"
                      value={formData.end_time}
                      onChange={handleInputChange}
                      required={!isMultiSession}
                      className="mt-1.5"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="location">Location (Optional)</Label>
                  <Input
                    id="location"
                    name="location"
                    value={formData.location}
                    onChange={handleInputChange}
                    placeholder="e.g., Online, Zoom, or venue address"
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <Label htmlFor="meeting_link">Meeting Link</Label>
                  <Input
                    id="meeting_link"
                    name="meeting_link"
                    type="url"
                    value={formData.meeting_link}
                    onChange={handleInputChange}
                    placeholder="https://zoom.us/j/... or Google Meet link"
                    className="mt-1.5"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Schedule - Multiple Sessions */}
          {isMultiSession && (
            <div className="bg-muted/30 border rounded-lg p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                Sessions (IST)
              </h3>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="location">Location (applies to all sessions)</Label>
                  <Input
                    id="location"
                    name="location"
                    value={formData.location}
                    onChange={handleInputChange}
                    placeholder="e.g., Online or venue address"
                    className="mt-1.5"
                  />
                </div>
                
                <SessionManager 
                  sessions={sessions} 
                  onChange={setSessions} 
                />
                
                {sessions.length === 0 && (
                  <p className="text-sm text-yellow-600 bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-lg">
                    Add at least one session to create a multi-session event.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Advanced Settings (Collapsible) */}
          <div className="border rounded-lg bg-card">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors rounded-lg"
            >
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">Advanced Settings</span>
                <span className="text-xs text-muted-foreground">(Optional)</span>
              </div>
              {showAdvanced ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            
            {showAdvanced && (
              <div className="p-5 pt-0 space-y-6 border-t border-border">
                {/* Registration Settings */}
                <div className="space-y-4 pt-4">
                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    Registration Settings
                  </h4>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="max_participants">Max Participants</Label>
                      <Input
                        id="max_participants"
                        name="max_participants"
                        type="number"
                        min="1"
                        value={formData.max_participants}
                        onChange={handleInputChange}
                        placeholder="e.g., 50"
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label htmlFor="registration_deadline">Registration Deadline</Label>
                      <Input
                        id="registration_deadline"
                        name="registration_deadline"
                        type="date"
                        max={formData.start_date || undefined}
                        value={formData.registration_deadline}
                        onChange={handleInputChange}
                        className="mt-1.5"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="registration_link">External Registration Link</Label>
                    <Input
                      id="registration_link"
                      name="registration_link"
                      type="url"
                      value={formData.registration_link}
                      onChange={handleInputChange}
                      placeholder="https://forms.google.com/..."
                      className="mt-1.5"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Optional: Link to external registration form</p>
                  </div>
                </div>

                {/* Content Details */}
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    Content Details
                  </h4>
                  
                  <div>
                    <Label htmlFor="prerequisites">Prerequisites</Label>
                    <Textarea
                      id="prerequisites"
                      name="prerequisites"
                      value={formData.prerequisites}
                      onChange={handleInputChange}
                      placeholder="What should attendees know beforehand?"
                      className="mt-1.5"
                      rows={2}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="learning_outcomes">Learning Outcomes</Label>
                    <Textarea
                      id="learning_outcomes"
                      name="learning_outcomes"
                      value={formData.learning_outcomes}
                      onChange={handleInputChange}
                      placeholder="What will attendees learn from this event?"
                      className="mt-1.5"
                      rows={2}
                    />
                  </div>
                </div>

                {/* Speaker Details */}
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    Speaker Details
                  </h4>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="speaker_name">Speaker Name</Label>
                      <Input
                        id="speaker_name"
                        name="speaker_name"
                        value={formData.speaker_name}
                        onChange={handleInputChange}
                        placeholder="John Doe"
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label htmlFor="speaker_image">Speaker Image URL</Label>
                      <Input
                        id="speaker_image"
                        name="speaker_image"
                        type="url"
                        value={formData.speaker_image}
                        onChange={handleInputChange}
                        placeholder="https://..."
                        className="mt-1.5"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="speaker_linkedin">Speaker LinkedIn</Label>
                      <Input
                        id="speaker_linkedin"
                        name="speaker_linkedin"
                        type="text"
                        value={formData.speaker_linkedin}
                        onChange={handleInputChange}
                        placeholder="https://linkedin.com/in/..."
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label htmlFor="speaker_github">Speaker GitHub</Label>
                      <Input
                        id="speaker_github"
                        name="speaker_github"
                        type="text"
                        value={formData.speaker_github}
                        onChange={handleInputChange}
                        placeholder="https://github.com/..."
                        className="mt-1.5"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          {getValidationError() && (
            <div className="text-sm text-destructive font-medium bg-destructive/10 border border-destructive/20 p-3 rounded-lg flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {getValidationError()}
            </div>
          )}

          <DialogFooter className="gap-2 pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || !isFormValid()}
            >
              {isSubmitting ? "Saving..." : initialData ? "Update Event" : "Create Event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
