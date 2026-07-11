import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Calendar, 
  Clock, 
  Video,
  Check,
  X
} from "lucide-react";
import type { EventSession } from "../api/events";

interface SessionManagerProps {
  sessions: EventSession[];
  onChange: (sessions: EventSession[]) => void;
}

export default function SessionManager({ sessions = [], onChange }: SessionManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<EventSession>>({});

  const generateId = () => `session-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

  const handleAddSession = () => {
    const newSession: EventSession = {
      id: generateId(),
      title: `Session ${sessions.length + 1}`,
      date: "",
      start_time: "",
      end_time: "",
      meeting_link: ""
    };
    
    onChange([...sessions, newSession]);
    setEditingId(newSession.id);
    setEditForm(newSession);
  };

  const handleStartEdit = (session: EventSession) => {
    setEditingId(session.id);
    setEditForm({ ...session });
  };

  const handleSaveEdit = () => {
    if (!editForm.date || !editForm.start_time || !editForm.end_time || !editingId) {
      return;
    }
    
    const updatedSessions = sessions.map(s => 
      s.id === editingId ? { ...(editForm as EventSession) } : s
    );
    onChange(updatedSessions);
    setEditingId(null);
    setEditForm({});
  };

  const handleCancelEdit = () => {
    if (editForm.date === "" && editForm.start_time === "" && editForm.end_time === "") {
      onChange(sessions.filter(s => s.id !== editingId));
    }
    setEditingId(null);
    setEditForm({});
  };

  const handleRemoveSession = (sessionId: string) => {
    onChange(sessions.filter(s => s.id !== sessionId));
    if (editingId === sessionId) {
      setEditingId(null);
      setEditForm({});
    }
  };

  const handleEditChange = (field: keyof EventSession, value: string) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    try {
      return new Date(dateStr).toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric"
      });
    } catch {
      return dateStr;
    }
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr) return "";
    try {
      const [hours, minutes] = timeStr.split(":");
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? "PM" : "AM";
      const hour12 = hour % 12 || 12;
      return `${hour12}:${minutes} ${ampm}`;
    } catch {
      return timeStr;
    }
  };

  return (
    <div className="space-y-4">
      {sessions.length > 0 && (
        <div className="space-y-3">
          {sessions.map((session, index) => (
            <Card 
              key={session.id} 
              className={`p-4 transition-all duration-200 ${editingId === session.id ? 'ring-2 ring-primary bg-background' : 'hover:bg-muted/30 bg-card'}`}
            >
              {editingId === session.id ? (
                // Edit Mode
                <div className="space-y-4">
                  <div>
                    <Label htmlFor={`title-${session.id}`} className="text-sm font-medium">Session Title</Label>
                    <Input
                      id={`title-${session.id}`}
                      value={editForm.title || ""}
                      onChange={(e) => handleEditChange("title", e.target.value)}
                      placeholder="e.g., Introduction to React"
                      className="mt-1.5"
                    />
                  </div>
                  
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label htmlFor={`date-${session.id}`} className="text-sm font-medium">Date *</Label>
                      <Input
                        id={`date-${session.id}`}
                        type="date"
                        value={editForm.date || ""}
                        onChange={(e) => handleEditChange("date", e.target.value)}
                        className="mt-1.5"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor={`start-${session.id}`} className="text-sm font-medium">Start *</Label>
                      <Input
                        id={`start-${session.id}`}
                        type="time"
                        value={editForm.start_time || ""}
                        onChange={(e) => handleEditChange("start_time", e.target.value)}
                        className="mt-1.5"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor={`end-${session.id}`} className="text-sm font-medium">End *</Label>
                      <Input
                        id={`end-${session.id}`}
                        type="time"
                        value={editForm.end_time || ""}
                        onChange={(e) => handleEditChange("end_time", e.target.value)}
                        className="mt-1.5"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor={`link-${session.id}`} className="text-sm font-medium">Meeting Link</Label>
                    <Input
                      id={`link-${session.id}`}
                      type="url"
                      value={editForm.meeting_link || ""}
                      onChange={(e) => handleEditChange("meeting_link", e.target.value)}
                      placeholder="https://zoom.us/j/..."
                      className="mt-1.5"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleCancelEdit}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleSaveEdit}
                      disabled={!editForm.date || !editForm.start_time || !editForm.end_time}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Save Session
                    </Button>
                  </div>
                </div>
              ) : (
                // Display Mode
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                      {index + 1}
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground">
                        {session.title || `Session ${index + 1}`}
                      </h4>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                        {session.date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground/75" />
                            {formatDate(session.date)}
                          </span>
                        )}
                        {session.start_time && session.end_time && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground/75" />
                            {formatTime(session.start_time)} - {formatTime(session.end_time)}
                          </span>
                        )}
                        {session.meeting_link && (
                          <span className="flex items-center gap-1 text-primary">
                            <Video className="h-3.5 w-3.5" />
                            Link added
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleStartEdit(session)}
                      className="h-8 w-8 p-0"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveSession(session.id)}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        onClick={handleAddSession}
        className="w-full border-dashed"
        disabled={editingId !== null}
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Session
      </Button>

      {sessions.length === 0 && (
        <p className="text-sm text-muted-foreground text-center">
          Add sessions to create a multi-part event or series
        </p>
      )}
    </div>
  );
}
