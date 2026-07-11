import { useState, useEffect } from "react";
import { formatISTDate } from "@/lib/datetime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Trash2,
  ListTodo,
  Paperclip,
  X,
  FileText,
  Image as ImageIcon,
  FolderArchive,
  Code2,
  File,
  Download,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useSessionActionItems,
  useCreateActionItem,
  useUpdateActionItem,
  useDeleteActionItem,
  useToggleActionItem,
  type ActionItem,
} from "@/features/action-items/useActionItems";
import { useMentorProfile } from "@/features/mentor-profile";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Props {
  sessionId: string;
  mentorId: string;
  menteeId: string;
  currentUserId: string;
  role: "mentor" | "mentee";
}

export default function SessionActionItemsPanel({
  sessionId,
  mentorId,
  menteeId,
  currentUserId,
  role,
}: Props) {
  const { toast } = useToast();
  const { data: items = [], isLoading, refetch } = useSessionActionItems(sessionId);
  const createMut = useCreateActionItem();
  const updateMut = useUpdateActionItem();
  const deleteMut = useDeleteActionItem();
  const toggle = useToggleActionItem();

  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newDue, setNewDue] = useState("");
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState<string | null>(null);

  const { data: mentorProfile, refetch: refetchProfile } = useMentorProfile(mentorId);
  const allowMenteeAttachments = mentorProfile?.allow_mentee_attachments ?? false;

  // Refresh data every time the panel opens (sessionId changes = new dialog open).
  useEffect(() => {
    refetch();
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    refetchProfile();
  }, [refetchProfile]);

  const canEdit = role === "mentor";

  // Dynamic file type icon selector
  const getFileIcon = (fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase();
    if (["jpg", "jpeg", "png", "gif", "svg", "webp"].includes(ext || "")) {
      return <ImageIcon className="h-3.5 w-3.5 text-blue-500" />;
    }
    if (["pdf"].includes(ext || "")) {
      return <FileText className="h-3.5 w-3.5 text-red-500" />;
    }
    if (["zip", "rar", "tar", "gz", "7z"].includes(ext || "")) {
      return <FolderArchive className="h-3.5 w-3.5 text-amber-500" />;
    }
    if (["js", "ts", "jsx", "tsx", "html", "css", "json", "py", "go", "cpp", "c", "sh"].includes(ext || "")) {
      return <Code2 className="h-3.5 w-3.5 text-emerald-500" />;
    }
    return <File className="h-3.5 w-3.5 text-muted-foreground" />;
  };

  const handleAdd = async () => {
    const t = newTitle.trim();
    if (!t) return;
    try {
      let uploadedAttachments: { name: string; url: string }[] = [];
      if (newFiles.length > 0) {
        uploadedAttachments = await Promise.all(
          newFiles.map(async (file) => {
            const ext = file.name.split(".").pop();
            // Path includes currentUserId folder for RLS policy alignment
            const filePath = `${sessionId}/${currentUserId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
            const { error: uploadError } = await supabase.storage
              .from("session-attachments")
              .upload(filePath, file);
            if (uploadError) throw uploadError;
            
            const { data } = supabase.storage
              .from("session-attachments")
              .getPublicUrl(filePath);
            return { name: file.name, url: data.publicUrl };
          })
        );
      }

      await createMut.mutateAsync({
        session_id: sessionId,
        mentor_id: mentorId,
        mentee_id: menteeId,
        title: t,
        description: newDesc.trim(),
        due_date: newDue || null,
        created_by: currentUserId,
        mentor_attachments: uploadedAttachments,
      });

      setNewTitle("");
      setNewDesc("");
      setNewDue("");
      setNewFiles([]);
    } catch (e) {
      toast({ variant: "destructive", title: "Couldn't add task", description: (e as Error).message });
    }
  };

  const handleToggle = async (item: ActionItem) => {
    try {
      await toggle(item);
    } catch (e) {
      toast({ variant: "destructive", title: "Update failed", description: (e as Error).message });
    }
  };

  const handleDelete = async (item: ActionItem) => {
    try {
      // Delete attachments from storage first if any (non-blocking)
      const allAttachments = [
        ...(item.mentor_attachments || []),
        ...(item.mentee_attachments || [])
      ];
      if (allAttachments.length > 0) {
        const paths = allAttachments
          .map((att) => att.url.split("/session-attachments/")[1])
          .filter(Boolean);
        if (paths.length > 0) {
          try {
            await supabase.storage.from("session-attachments").remove(paths);
          } catch (storageErr) {
            console.warn("Storage cleanup warning during task deletion:", storageErr);
          }
        }
      }

      await deleteMut.mutateAsync({
        id: item.id,
        session_id: item.session_id,
        mentor_id: item.mentor_id,
        mentee_id: item.mentee_id,
      });
    } catch (e) {
      toast({ variant: "destructive", title: "Delete failed", description: (e as Error).message });
    }
  };

  const handleInlineEdit = async (item: ActionItem, patch: Partial<ActionItem>) => {
    try {
      await updateMut.mutateAsync({
        id: item.id,
        session_id: item.session_id,
        patch,
      });
    } catch (e) {
      toast({ variant: "destructive", title: "Save failed", description: (e as Error).message });
    }
  };

  const handleUploadAttachment = async (
    item: ActionItem,
    type: "mentor" | "mentee",
    files: FileList | null
  ) => {
    if (!files || files.length === 0) return;
    setIsUploading(item.id);
    try {
      // Pre-flight check for mentees to handle race condition when mentor toggles it off
      if (type === "mentee") {
        const { data: latestProfile, error: fetchErr } = await supabase
          .from("mentor_profiles")
          .select("allow_mentee_attachments")
          .eq("user_id", mentorId)
          .single();
        
        if (fetchErr) throw fetchErr;
        if (!latestProfile?.allow_mentee_attachments) {
          toast({
            variant: "destructive",
            title: "Upload disabled",
            description: "The mentor has disabled reply attachments for this session.",
          });
          // Refresh local profile state to update UI
          refetchProfile();
          return;
        }
      }

      const file = files[0];
      const ext = file.name.split(".").pop();
      // Scoped path includes currentUserId
      const filePath = `${sessionId}/${currentUserId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("session-attachments")
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("session-attachments")
        .getPublicUrl(filePath);

      const newAttachment = { name: file.name, url: data.publicUrl };
      const currentList = type === "mentor" ? item.mentor_attachments || [] : item.mentee_attachments || [];
      const updatedList = [...currentList, newAttachment];

      await updateMut.mutateAsync({
        id: item.id,
        session_id: item.session_id,
        patch: {
          [type === "mentor" ? "mentor_attachments" : "mentee_attachments"]: updatedList,
        },
      });
      toast({ title: "File attached successfully" });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: (e as Error).message,
      });
    } finally {
      setIsUploading(null);
    }
  };

  const handleDeleteAttachment = async (
    item: ActionItem,
    type: "mentor" | "mentee",
    indexToDelete: number
  ) => {
    try {
      const currentList = type === "mentor" ? item.mentor_attachments || [] : item.mentee_attachments || [];
      const attachment = currentList[indexToDelete];
      if (attachment?.url) {
        const pathPart = attachment.url.split("/session-attachments/")[1];
        if (pathPart) {
          // Wrapped storage delete so missing/already-deleted files do not block the DB sync
          try {
            const { error: storageError } = await supabase.storage
              .from("session-attachments")
              .remove([pathPart]);
            if (storageError) {
              console.warn("Storage deletion warning:", storageError.message);
            }
          } catch (storageErr) {
            console.warn("Non-blocking storage deletion error:", storageErr);
          }
        }
      }

      const updatedList = currentList.filter((_, i) => i !== indexToDelete);

      await updateMut.mutateAsync({
        id: item.id,
        session_id: item.session_id,
        patch: {
          [type === "mentor" ? "mentor_attachments" : "mentee_attachments"]: updatedList,
        },
      });
      toast({ title: "Attachment removed" });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: (e as Error).message,
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ListTodo className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-sm">Action Items</h3>
        <Badge variant="secondary" className="text-[10px]">
          {items.filter((i) => i.status === "open").length} open
        </Badge>
      </div>

      {isLoading && <p className="text-xs text-muted-foreground">Loading…</p>}

      {!isLoading && items.length === 0 && !canEdit && (
        <p className="text-xs text-muted-foreground">No tasks assigned for this session.</p>
      )}

      <ul className="space-y-3">
        {items.map((item) => (
          <li
            key={item.id}
            className={cn(
              "flex items-start gap-3 rounded-xl border p-4 text-sm bg-card shadow-sm transition-all duration-200 hover:shadow-md",
              item.status === "done" && "bg-muted/40 border-muted"
            )}
          >
            <Checkbox
              checked={item.status === "done"}
              onCheckedChange={() => handleToggle(item)}
              className="mt-1"
              aria-label="Mark complete"
            />
            <div className="flex-1 min-w-0 space-y-3">
              <div className="space-y-1">
                {canEdit ? (
                  <Input
                    defaultValue={item.title}
                    onBlur={(e) => {
                      if (e.target.value !== item.title) handleInlineEdit(item, { title: e.target.value });
                    }}
                    className={cn(
                      "h-8 border-0 px-0 focus-visible:ring-0 font-medium bg-transparent text-sm",
                      item.status === "done" && "line-through text-muted-foreground"
                    )}
                  />
                ) : (
                  <p className={cn("font-medium text-sm", item.status === "done" && "line-through text-muted-foreground")}>
                    {item.title}
                  </p>
                )}
                {canEdit ? (
                  <Textarea
                    defaultValue={item.description}
                    onBlur={(e) => {
                      if (e.target.value !== item.description) handleInlineEdit(item, { description: e.target.value });
                    }}
                    rows={1}
                    placeholder="Add details…"
                    className="text-xs border-0 px-0 focus-visible:ring-0 resize-none min-h-0 bg-transparent text-muted-foreground"
                  />
                ) : (
                  item.description && <p className="text-xs text-muted-foreground">{item.description}</p>
                )}
                <div className="flex items-center gap-2 text-xs text-muted-foreground pt-0.5">
                  {canEdit ? (
                    <Input
                      type="date"
                      defaultValue={item.due_date ?? ""}
                      onBlur={(e) => {
                        const next = e.target.value || null;
                        if (next !== item.due_date) handleInlineEdit(item, { due_date: next });
                      }}
                      className="h-7 w-[125px] text-xs bg-transparent px-1.5 py-0.5 border rounded-md focus-visible:ring-1"
                    />
                  ) : item.due_date ? (
                    <span>Due {formatISTDate(item.due_date)}</span>
                  ) : null}
                  {item.status === "done" && item.completed_at && (
                    <span>· Done {formatISTDate(item.completed_at)}</span>
                  )}
                </div>
              </div>

              {/* Attachments Section */}
              <div className="space-y-3 pt-3 border-t border-muted/50">
                {/* Mentor Attachments */}
                {item.mentor_attachments && item.mentor_attachments.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase">Mentor Attachments</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {item.mentor_attachments.map((att, i) => (
                        <div key={i} className="group relative flex items-center justify-between gap-3 rounded-lg border bg-muted/30 hover:bg-muted/50 p-2 text-xs transition-all duration-200 shadow-sm border-muted/60 hover:border-muted-foreground/30">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-background border shadow-xs">
                              {getFileIcon(att.name)}
                            </div>
                            <a href={att.url} target="_blank" rel="noreferrer" className="font-medium hover:underline text-foreground truncate flex-1 min-w-0 max-w-[130px] sm:max-w-[170px]" title={att.name}>
                              {att.name}
                            </a>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <a
                              href={att.url}
                              download
                              target="_blank"
                              rel="noreferrer"
                              className="flex h-6 w-6 items-center justify-center rounded hover:bg-background text-muted-foreground hover:text-foreground transition-colors border shadow-xs"
                              title="Download file"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </a>
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => handleDeleteAttachment(item, "mentor", i)}
                                className="flex h-6 w-6 items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors border shadow-xs"
                                title="Delete file"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Mentee Attachments */}
                {item.mentee_attachments && item.mentee_attachments.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase">Mentee Attachments</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {item.mentee_attachments.map((att, i) => (
                        <div key={i} className="group relative flex items-center justify-between gap-3 rounded-lg border bg-muted/30 hover:bg-muted/50 p-2 text-xs transition-all duration-200 shadow-sm border-muted/60 hover:border-muted-foreground/30">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-background border shadow-xs">
                              {getFileIcon(att.name)}
                            </div>
                            <a href={att.url} target="_blank" rel="noreferrer" className="font-medium hover:underline text-foreground truncate flex-1 min-w-0 max-w-[130px] sm:max-w-[170px]" title={att.name}>
                              {att.name}
                            </a>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <a
                              href={att.url}
                              download
                              target="_blank"
                              rel="noreferrer"
                              className="flex h-6 w-6 items-center justify-center rounded hover:bg-background text-muted-foreground hover:text-foreground transition-colors border shadow-xs"
                              title="Download file"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </a>
                            {!canEdit && (
                              <button
                                type="button"
                                onClick={() => handleDeleteAttachment(item, "mentee", i)}
                                className="flex h-6 w-6 items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors border shadow-xs"
                                title="Delete file"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* File Upload Controls */}
                <div className="flex items-center gap-2 pt-1">
                  {canEdit ? (
                    <>
                      <input
                        type="file"
                        id={`upload-mentor-${item.id}`}
                        className="hidden"
                        onChange={(e) => handleUploadAttachment(item, "mentor", e.target.files)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted gap-1.5 transition-all duration-200 rounded-lg"
                        onClick={() => document.getElementById(`upload-mentor-${item.id}`)?.click()}
                        disabled={isUploading === item.id}
                      >
                        <Paperclip className="h-3.5 w-3.5" />
                        <span>{isUploading === item.id ? "Uploading..." : "Attach File"}</span>
                      </Button>
                    </>
                  ) : (
                    allowMenteeAttachments && (
                      <>
                        <input
                          type="file"
                          id={`upload-mentee-${item.id}`}
                          className="hidden"
                          onChange={(e) => handleUploadAttachment(item, "mentee", e.target.files)}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted gap-1.5 transition-all duration-200 rounded-lg"
                          onClick={() => document.getElementById(`upload-mentee-${item.id}`)?.click()}
                          disabled={isUploading === item.id}
                        >
                          <Paperclip className="h-3.5 w-3.5" />
                          <span>{isUploading === item.id ? "Uploading..." : "Attach Reply File"}</span>
                        </Button>
                      </>
                    )
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0 mt-0.5">
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => handleToggle(item)}
                  title="Click to toggle status"
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer",
                    item.status === "done"
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                      : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20"
                  )}
                >
                  {item.status === "done"
                    ? <CheckCircle2 className="h-3 w-3" />
                    : <Clock className="h-3 w-3" />}
                  {item.status === "done" ? "Completed" : "Pending"}
                </button>
              ) : (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                    item.status === "done"
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  )}
                >
                  {item.status === "done"
                    ? <CheckCircle2 className="h-3 w-3" />
                    : <Clock className="h-3 w-3" />}
                  {item.status === "done" ? "Completed" : "Pending"}
                </span>
              )}
              {canEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                  onClick={() => handleDelete(item)}
                  aria-label="Delete task"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {canEdit && (
        <div className="rounded-xl border border-dashed p-4 space-y-3 bg-muted/10 shadow-inner">
          <Label className="text-xs font-semibold text-muted-foreground">Add a follow-up task</Label>
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="e.g. Send portfolio draft"
            className="h-9 rounded-lg"
          />
          <Textarea
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Optional details…"
            rows={2}
            className="rounded-lg"
          />
          
          {/* New files attached representation */}
          {newFiles.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase">Files to attach:</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {newFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2 rounded-lg border bg-muted/40 p-2 text-xs border-muted shadow-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      {getFileIcon(file.name)}
                      <span className="truncate max-w-[130px] sm:max-w-[180px] font-medium">{file.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setNewFiles((prev) => prev.filter((_, i) => i !== idx))}
                      className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 pt-1">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Input
                type="date"
                value={newDue}
                onChange={(e) => setNewDue(e.target.value)}
                className="h-9 flex-1 sm:w-[130px] rounded-lg text-xs"
              />
              
              <input
                type="file"
                id="new-task-files"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) {
                    setNewFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 flex-1 sm:flex-none rounded-lg gap-1.5 text-xs"
                onClick={() => document.getElementById("new-task-files")?.click()}
              >
                <Paperclip className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Attach files</span>
              </Button>
            </div>

            <Button
              size="sm"
              onClick={handleAdd}
              disabled={createMut.isPending || !newTitle.trim()}
              className="w-full sm:w-auto sm:ml-auto h-9 rounded-lg"
            >
              <Plus className="mr-1 h-3.5 w-3.5 shrink-0" />
              <span>{createMut.isPending ? "Adding…" : "Add task"}</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
