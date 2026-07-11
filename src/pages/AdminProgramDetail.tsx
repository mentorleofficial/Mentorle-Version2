import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useDraggable, useDroppable, useSensor, useSensors,
} from "@dnd-kit/core";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, X, GripVertical, Tag, Check, CheckCircle2, Circle, UserPlus, Search, Info, MoreHorizontal, Pencil, Archive, Trash2 } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Program = Database["public"]["Tables"]["programs"]["Row"];
type UserRow = { id: string; full_name: string; email: string };
type Assignment = { id: string; mentor_id: string; mentee_id: string };
type TagRow = Database["public"]["Tables"]["program_tags"]["Row"];
type ProgramStatus = "draft" | "active" | "archived";

const initialsOf = (name: string) =>
  name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "?";

/* ---------- Mentee chip with drag + click-assign popover ---------- */
const MenteeChip = ({
  user,
  mentors,
  currentMentorId,
  onAssign,
  onUnassign,
}: {
  user: UserRow;
  mentors: UserRow[];
  currentMentorId?: string;
  onAssign: (menteeId: string, mentorId: string) => void;
  onUnassign?: (menteeId: string) => void;
}) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `mentee:${user.id}` });
  const [open, setOpen] = useState(false);

  return (
    <div
      className={`group flex items-center gap-2 rounded-md border bg-card px-2 py-1.5 text-sm hover:border-primary/50 ${isDragging ? "opacity-40" : ""}`}
    >
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        className="flex flex-1 items-center gap-2 cursor-grab active:cursor-grabbing min-w-0"
        title="Drag onto a mentor — or use the Assign button"
      >
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <Avatar className="h-6 w-6"><AvatarFallback className="text-[10px]">{initialsOf(user.full_name)}</AvatarFallback></Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium leading-tight">{user.full_name}</p>
          <p className="truncate text-[10px] text-muted-foreground leading-tight">{user.email}</p>
        </div>
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] shrink-0">
            <UserPlus className="h-3 w-3 mr-1" />Assign
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-1" align="end">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground px-2 py-1">Assign to mentor</p>
          <div className="max-h-60 overflow-y-auto">
            {mentors.length === 0 ? (
              <p className="px-2 py-3 text-xs text-muted-foreground italic">No mentors in program yet.</p>
            ) : mentors.map((m) => (
              <button
                key={m.id}
                onClick={() => { onAssign(user.id, m.id); setOpen(false); }}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted"
              >
                <Avatar className="h-5 w-5"><AvatarFallback className="text-[9px]">{initialsOf(m.full_name)}</AvatarFallback></Avatar>
                <span className="flex-1 truncate">{m.full_name}</span>
                {currentMentorId === m.id && <Check className="h-3.5 w-3.5 text-primary" />}
              </button>
            ))}
          </div>
          {currentMentorId && onUnassign && (
            <>
              <div className="my-1 h-px bg-border" />
              <button
                onClick={() => { onUnassign(user.id); setOpen(false); }}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-destructive hover:bg-destructive/10"
              >
                <X className="h-3.5 w-3.5" />Unassign
              </button>
            </>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
};

const MentorDropZone = ({
  mentor, assignedMentees, mentors, onAssign, onUnassign,
}: {
  mentor: UserRow;
  assignedMentees: UserRow[];
  mentors: UserRow[];
  onAssign: (menteeId: string, mentorId: string) => void;
  onUnassign: (menteeId: string) => void;
}) => {
  const { setNodeRef, isOver } = useDroppable({ id: `mentor:${mentor.id}` });
  return (
    <Card ref={setNodeRef} className={`transition-colors ${isOver ? "border-primary bg-primary/5 ring-2 ring-primary/30" : ""}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8"><AvatarFallback>{initialsOf(mentor.full_name)}</AvatarFallback></Avatar>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-sm leading-tight truncate">{mentor.full_name}</CardTitle>
            <p className="text-[11px] text-muted-foreground truncate">{mentor.email}</p>
          </div>
          <Badge variant="secondary" className="text-xs">{assignedMentees.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-1.5 min-h-[90px]">
        {assignedMentees.length === 0 ? (
          <div className="rounded-md border border-dashed py-4 text-center">
            <p className="text-xs text-muted-foreground italic">Drop mentees here</p>
          </div>
        ) : (
          assignedMentees.map((m) => (
            <MenteeChip
              key={m.id}
              user={m}
              mentors={mentors}
              currentMentorId={mentor.id}
              onAssign={onAssign}
              onUnassign={onUnassign}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
};

/* ---------- Setup checklist ---------- */
const ChecklistItem = ({
  done, label, count, onClick, active,
}: { done: boolean; label: string; count?: string; onClick: () => void; active?: boolean }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors ${
      active ? "border-primary bg-primary/5" : "hover:bg-muted/50"
    }`}
  >
    {done
      ? <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
      : <Circle className="h-4 w-4 text-muted-foreground shrink-0" />}
    <span className={done ? "" : "font-medium"}>{label}</span>
    {count && <Badge variant="secondary" className="ml-auto text-[10px]">{count}</Badge>}
  </button>
);

/* ---------- Page ---------- */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const AdminProgramDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [program, setProgram] = useState<Program | null>(null);
  const [tags, setTags] = useState<TagRow[]>([]);
  const [allMentors, setAllMentors] = useState<UserRow[]>([]);
  const [allMentees, setAllMentees] = useState<UserRow[]>([]);
  const [programMentors, setProgramMentors] = useState<string[]>([]);
  const [programMentees, setProgramMentees] = useState<string[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [tab, setTab] = useState<"mapping" | "members" | "tags">("members");
  const [tabTouched, setTabTouched] = useState(false);
  const [activeDrag, setActiveDrag] = useState<UserRow | null>(null);
  const [newTag, setNewTag] = useState("");
  const [mentorSearch, setMentorSearch] = useState("");
  const [menteeSearch, setMenteeSearch] = useState("");
  const [directoryLoading, setDirectoryLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<null | "archive" | "activate" | "delete">(null);
  const [savingProgram, setSavingProgram] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    status: "draft" as ProgramStatus,
    starts_on: "",
    ends_on: "",
    capacity: "",
  });


  const programId = program?.id;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const load = async () => {
    if (!slug) return;
    // Look up program by slug; if param looks like a UUID, fall back to id lookup and redirect to the slug URL.
    let p: Program | null = null;
    if (UUID_RE.test(slug)) {
      const { data } = await supabase.from("programs").select("*").eq("id", slug).maybeSingle();
      p = data ?? null;
      if (p?.slug) {
        navigate(`/admin/programs/${p.slug}`, { replace: true });
        return;
      }
    } else {
      const { data } = await supabase.from("programs").select("*").eq("slug", slug).maybeSingle();
      p = data ?? null;
    }
    setProgram(p);
    if (!p) return;

    const [{ data: t }, { data: pm }, { data: pme }, { data: ma }] = await Promise.all([
      supabase.from("program_tags").select("*").eq("program_id", p.id).order("label"),
      supabase.from("program_mentors").select("mentor_id").eq("program_id", p.id),
      supabase.from("program_mentees").select("mentee_id").eq("program_id", p.id),
      supabase.from("mentor_mentee_assignments").select("id, mentor_id, mentee_id").eq("program_id", p.id),
    ]);
    setTags(t || []);
    setProgramMentors((pm || []).map(({ mentor_id }) => mentor_id));
    setProgramMentees((pme || []).map(({ mentee_id }) => mentee_id));
    setAssignments((ma || []) as Assignment[]);
  };

  const loadDirectory = async () => {
    setDirectoryLoading(true);
    const loadRoleDirectory = async (role: "mentor" | "mentee") => {
      const { data: roleRows, error: roleErr } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", role);

      if (roleErr) {
        console.error(`Load ${role} roles failed:`, roleErr);
        return [] as UserRow[];
      }

      const userIds = Array.from(new Set((roleRows || []).map((r) => r.user_id).filter(Boolean)));
      if (userIds.length === 0) return [] as UserRow[];

      let activeUserIds = userIds;
      if (role === "mentor") {
        const { data: activeMentors, error: activeErr } = await supabase
          .from("mentor_profiles")
          .select("user_id")
          .eq("is_active", true)
          .in("user_id", userIds);
        
        if (activeErr) {
          console.error("Load active mentor profiles failed:", activeErr);
          return [] as UserRow[];
        }
        activeUserIds = (activeMentors || []).map((m) => m.user_id);
      }

      if (activeUserIds.length === 0) return [] as UserRow[];

      const { data: users, error: usersErr } = await supabase
        .from("users")
        .select("id, full_name, email")
        .in("id", activeUserIds)
        .eq("is_disabled", false)
        .order("full_name");

      if (usersErr) {
        console.error(`Load ${role} users failed:`, usersErr);
        return [] as UserRow[];
      }

      return (users || []) as UserRow[];
    };

    const [mentors, mentees] = await Promise.all([
      loadRoleDirectory("mentor"),
      loadRoleDirectory("mentee"),
    ]);
    setAllMentors(mentors);
    setAllMentees(mentees);
    setDirectoryLoading(false);
  };

  // Wait for auth-restored user before hitting RLS-protected tables.
  useEffect(() => {
    if (!user?.id) return;
    load();
    loadDirectory();
  }, [slug, user?.id]);

  const mentorsInProgram = useMemo(
    () => allMentors.filter((m) => programMentors.includes(m.id)),
    [allMentors, programMentors]
  );
  const menteesInProgram = useMemo(
    () => allMentees.filter((m) => programMentees.includes(m.id)),
    [allMentees, programMentees]
  );
  const assignedMenteeIds = new Set(assignments.map((a) => a.mentee_id));
  const unassignedMentees = menteesInProgram.filter((m) => !assignedMenteeIds.has(m.id));
  const menteesByMentor = (mentorId: string) =>
    assignments
      .filter((a) => a.mentor_id === mentorId)
      .map((a) => menteesInProgram.find((m) => m.id === a.mentee_id))
      .filter(Boolean) as UserRow[];

  // Auto-select best initial tab when data first loads
  useEffect(() => {
    if (tabTouched || !program) return;
    if (mentorsInProgram.length === 0 || menteesInProgram.length === 0) {
      setTab("members");
    } else {
      setTab("mapping");
    }
  }, [program, mentorsInProgram.length, menteesInProgram.length, tabTouched]);

  const filteredMentors = allMentors.filter((u) =>
    !mentorSearch || u.full_name.toLowerCase().includes(mentorSearch.toLowerCase()) || u.email.toLowerCase().includes(mentorSearch.toLowerCase())
  );
  const filteredMentees = allMentees.filter((u) =>
    !menteeSearch || u.full_name.toLowerCase().includes(menteeSearch.toLowerCase()) || u.email.toLowerCase().includes(menteeSearch.toLowerCase())
  );

  /* assign / move / unassign */
  const assignMentee = async (menteeId: string, mentorId: string) => {
    if (!programId) return;
    const existing = assignments.find((a) => a.mentee_id === menteeId);
    if (existing && existing.mentor_id === mentorId) return;
    if (existing) {
      const { error } = await supabase.from("mentor_mentee_assignments").update({ mentor_id: mentorId, assigned_by: user?.id ?? null }).eq("id", existing.id);
      if (error) return toast({ variant: "destructive", title: "Move failed", description: error.message });
      toast({ title: "Mentee reassigned" });
    } else {
      const { error } = await supabase.from("mentor_mentee_assignments").insert({ program_id: programId, mentor_id: mentorId, mentee_id: menteeId, assigned_by: user?.id ?? null });
      if (error) return toast({ variant: "destructive", title: "Assign failed", description: error.message });
      toast({ title: "Mentee assigned" });
    }
    load();
  };
  const unassign = async (menteeId: string) => {
    const a = assignments.find((x) => x.mentee_id === menteeId);
    if (!a) return;
    const { error } = await supabase.from("mentor_mentee_assignments").delete().eq("id", a.id);
    if (error) return toast({ variant: "destructive", title: "Unassign failed", description: error.message });
    toast({ title: "Mentee unassigned" });
    load();
  };

  /* drag handlers */
  const onDragStart = (e: DragStartEvent) => {
    const id = String(e.active.id).replace("mentee:", "");
    setActiveDrag(menteesInProgram.find((m) => m.id === id) ?? null);
  };
  const onDragEnd = async (e: DragEndEvent) => {
    setActiveDrag(null);
    if (!e.over) return;
    const menteeId = String(e.active.id).replace("mentee:", "");
    const mentorId = String(e.over.id).replace("mentor:", "");
    assignMentee(menteeId, mentorId);
  };

  /* members management */
  const toggleMentor = async (mentorId: string, on: boolean) => {
    if (!programId) return;
    if (on) {
      const { error } = await supabase.from("program_mentors").insert({ program_id: programId, mentor_id: mentorId, assigned_by: user?.id ?? null });
      if (error) return toast({ variant: "destructive", title: "Failed", description: error.message });
    } else {
      const { error } = await supabase.from("program_mentors").delete().match({ program_id: programId, mentor_id: mentorId });
      if (error) return toast({ variant: "destructive", title: "Failed", description: error.message });
    }
    load();
  };
  const toggleMentee = async (menteeId: string, on: boolean) => {
    if (!programId) return;
    if (on) {
      const { error } = await supabase.from("program_mentees").insert({ program_id: programId, mentee_id: menteeId, assigned_by: user?.id ?? null });
      if (error) return toast({ variant: "destructive", title: "Failed", description: error.message });
    } else {
      const { error } = await supabase.from("program_mentees").delete().match({ program_id: programId, mentee_id: menteeId });
      if (error) return toast({ variant: "destructive", title: "Failed", description: error.message });
    }
    load();
  };

  /* tags */
  const addTag = async () => {
    const label = newTag.trim();
    if (!label || !programId) return;
    const { error } = await supabase.from("program_tags").insert({ program_id: programId, label });
    if (error) toast({ variant: "destructive", title: "Tag failed", description: error.message });
    setNewTag("");
    load();
  };
  const removeTag = async (id: string) => {
    await supabase.from("program_tags").delete().eq("id", id);
    load();
  };

  const goTab = (t: typeof tab) => { setTabTouched(true); setTab(t); };

  /* program edit / archive / delete */
  const openEdit = () => {
    if (!program) return;
    setEditForm({
      name: program.name,
      description: program.description ?? "",
      status: (program.status as ProgramStatus) ?? "draft",
      starts_on: program.starts_on ?? "",
      ends_on: program.ends_on ?? "",
      capacity: program.capacity != null ? String(program.capacity) : "",
    });
    setEditOpen(true);
  };

  const saveProgram = async () => {
    if (!program) return;
    if (!editForm.name.trim()) return;
    setSavingProgram(true);
    const { error } = await supabase
      .from("programs")
      .update({
        name: editForm.name.trim(),
        description: editForm.description,
        status: editForm.status,
        starts_on: editForm.starts_on || null,
        ends_on: editForm.ends_on || null,
        capacity: editForm.capacity ? Number(editForm.capacity) : null,
      })
      .eq("id", program.id);
    setSavingProgram(false);
    if (error) {
      toast({ variant: "destructive", title: "Save failed", description: error.message });
      return;
    }
    toast({ title: "Program updated" });
    setEditOpen(false);
    load();
  };

  const setProgramStatus = async (status: ProgramStatus) => {
    if (!program) return;
    const { error } = await supabase.from("programs").update({ status }).eq("id", program.id);
    if (error) {
      toast({ variant: "destructive", title: "Failed", description: error.message });
      return;
    }
    toast({ title: status === "archived" ? "Program archived" : "Program activated" });
    setConfirmAction(null);
    load();
  };

  const deleteProgram = async () => {
    if (!program) return;
    // Children are removed via cascading deletes triggered by removing program_mentors / program_mentees
    // first; we explicitly delete dependent rows here for safety, then the program itself.
    const { error: a1 } = await supabase.from("mentor_mentee_assignments").delete().eq("program_id", program.id);
    if (a1) return toast({ variant: "destructive", title: "Delete failed", description: a1.message });
    await supabase.from("program_mentors").delete().eq("program_id", program.id);
    await supabase.from("program_mentees").delete().eq("program_id", program.id);
    await supabase.from("program_tags").delete().eq("program_id", program.id);
    const { error } = await supabase.from("programs").delete().eq("id", program.id);
    if (error) {
      toast({ variant: "destructive", title: "Delete failed", description: error.message });
      return;
    }
    toast({ title: "Program deleted" });
    setConfirmAction(null);
    navigate("/admin/programs", { replace: true });
  };


  if (!program) return <AppLayout><p className="text-muted-foreground">Loading…</p></AppLayout>;

  const hasMentors = mentorsInProgram.length > 0;
  const hasMentees = menteesInProgram.length > 0;
  const allAssigned = hasMentees && unassignedMentees.length === 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-3">
            <Link to="/admin/programs"><ArrowLeft className="h-4 w-4 mr-1" />All programs</Link>
          </Button>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">{program.name}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <Badge variant={program.status === "active" ? "default" : "secondary"} className="capitalize">{program.status}</Badge>
                {tags.map((t) => <Badge key={t.id} variant="outline" className="text-xs"><Tag className="h-3 w-3 mr-1" />{t.label}</Badge>)}
              </div>
              {program.description && <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{program.description}</p>}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={openEdit}>
                <Pencil className="h-4 w-4 mr-1.5" />Edit
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-9 w-9">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {program.status !== "archived" ? (
                    <DropdownMenuItem onClick={() => setConfirmAction("archive")}>
                      <Archive className="h-4 w-4 mr-2" />Archive program
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={() => setConfirmAction("activate")}>
                      <CheckCircle2 className="h-4 w-4 mr-2" />Reactivate program
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setConfirmAction("delete")}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />Delete permanently
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Setup checklist */}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <ChecklistItem done label="Program created" onClick={() => {}} />
          <ChecklistItem done={hasMentors} label="Add mentors" count={`${mentorsInProgram.length}`} onClick={() => goTab("members")} active={tab === "members"} />
          <ChecklistItem done={hasMentees} label="Enroll mentees" count={`${menteesInProgram.length}`} onClick={() => goTab("members")} active={tab === "members"} />
          <ChecklistItem done={allAssigned && hasMentees} label="Map to mentors" count={`${assignments.length}/${menteesInProgram.length}`} onClick={() => goTab("mapping")} active={tab === "mapping"} />
        </div>

        <Tabs value={tab} onValueChange={(v) => {
          if (v === "members" || v === "mapping" || v === "tags") goTab(v);
        }}>
          <TabsList className="w-full sm:w-auto overflow-x-auto flex [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <TabsTrigger value="members" className="shrink-0">Members ({mentorsInProgram.length} / {menteesInProgram.length})</TabsTrigger>
            <TabsTrigger value="mapping" className="shrink-0">Mapping board</TabsTrigger>
            <TabsTrigger value="tags" className="shrink-0">Tags ({tags.length})</TabsTrigger>
          </TabsList>
        </Tabs>

        {tab === "mapping" && (
          !hasMentors ? (
            <Card><CardContent className="py-10 text-center space-y-3">
              <p className="text-muted-foreground">No mentors in this program yet.</p>
              <Button onClick={() => goTab("members")}>Add mentors</Button>
            </CardContent></Card>
          ) : !hasMentees ? (
            <Card><CardContent className="py-10 text-center space-y-3">
              <p className="text-muted-foreground">No mentees enrolled yet.</p>
              <Button onClick={() => goTab("members")}>Enroll mentees</Button>
            </CardContent></Card>
          ) : (
            <>
              <div className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                <Info className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                <p>
                  <span className="font-medium text-foreground">How to map:</span> drag a mentee from the left column onto a mentor card on the right —
                  or click the <span className="font-medium text-foreground">Assign</span> button on any mentee to pick a mentor from a menu.
                </p>
              </div>

              <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
                <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        Unassigned mentees
                        <Badge variant="secondary">{unassignedMentees.length}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1.5 max-h-[600px] overflow-y-auto">
                      {unassignedMentees.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic text-center py-4">All mentees are assigned 🎉</p>
                      ) : unassignedMentees.map((m) => (
                        <MenteeChip
                          key={m.id}
                          user={m}
                          mentors={mentorsInProgram}
                          onAssign={assignMentee}
                        />
                      ))}
                    </CardContent>
                  </Card>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {mentorsInProgram.map((m) => (
                      <MentorDropZone
                        key={m.id}
                        mentor={m}
                        assignedMentees={menteesByMentor(m.id)}
                        mentors={mentorsInProgram}
                        onAssign={assignMentee}
                        onUnassign={unassign}
                      />
                    ))}
                  </div>
                </div>
                <DragOverlay>
                  {activeDrag ? (
                    <div className="flex items-center gap-2 rounded-md border bg-card px-2 py-1.5 text-sm shadow-lg">
                      <Avatar className="h-6 w-6"><AvatarFallback className="text-[10px]">{initialsOf(activeDrag.full_name)}</AvatarFallback></Avatar>
                      <span className="text-xs font-medium">{activeDrag.full_name}</span>
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            </>
          )
        )}

        {tab === "members" && (
          <>
            {(!hasMentors || !hasMentees) && (
              <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
                <Info className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                <p>
                  <span className="font-medium">Step 1:</span> tick mentors and mentees below to add them to this program.
                  Once both lists have at least one person, switch to the <span className="font-medium">Mapping board</span> to pair them up.
                </p>
              </div>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="space-y-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Mentors</CardTitle>
                    <Badge variant="secondary">{mentorsInProgram.length} in program</Badge>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search mentors…"
                      value={mentorSearch}
                      onChange={(e) => setMentorSearch(e.target.value)}
                      className="h-8 pl-7 text-sm"
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-1 max-h-[500px] overflow-y-auto">
                  {directoryLoading ? (
                    <p className="text-sm text-muted-foreground py-2">Loading mentors…</p>
                  ) : allMentors.length === 0 ? (
                    <div className="py-3 space-y-2">
                      <p className="text-sm text-muted-foreground">No mentors exist on the platform yet.</p>
                      <div className="flex flex-wrap gap-2">
                        <Button asChild size="sm" variant="outline"><Link to="/admin/applications">Review applications</Link></Button>
                        <Button asChild size="sm" variant="outline"><Link to="/admin/users">Manage users</Link></Button>
                      </div>
                    </div>
                  ) : filteredMentors.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">No mentors match “{mentorSearch}”.</p>
                  ) : filteredMentors.map((u) => (
                    <label key={u.id} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/50 cursor-pointer">
                      <Checkbox checked={programMentors.includes(u.id)} onCheckedChange={(v) => toggleMentor(u.id, !!v)} />
                      <span className="text-sm flex-1 truncate">{u.full_name}</span>
                      <span className="text-xs text-muted-foreground truncate">{u.email}</span>
                    </label>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="space-y-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Mentees</CardTitle>
                    <Badge variant="secondary">{menteesInProgram.length} in program</Badge>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search mentees…"
                      value={menteeSearch}
                      onChange={(e) => setMenteeSearch(e.target.value)}
                      className="h-8 pl-7 text-sm"
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-1 max-h-[500px] overflow-y-auto">
                  {directoryLoading ? (
                    <p className="text-sm text-muted-foreground py-2">Loading mentees…</p>
                  ) : allMentees.length === 0 ? (
                    <div className="py-3 space-y-2">
                      <p className="text-sm text-muted-foreground">No mentees exist on the platform yet.</p>
                      <Button asChild size="sm" variant="outline"><Link to="/admin/users">Manage users</Link></Button>
                    </div>
                  ) : filteredMentees.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">No mentees match “{menteeSearch}”.</p>
                  ) : filteredMentees.map((u) => (
                    <label key={u.id} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/50 cursor-pointer">
                      <Checkbox checked={programMentees.includes(u.id)} onCheckedChange={(v) => toggleMentee(u.id, !!v)} />
                      <span className="text-sm flex-1 truncate">{u.full_name}</span>
                      <span className="text-xs text-muted-foreground truncate">{u.email}</span>
                    </label>
                  ))}
                </CardContent>
              </Card>
            </div>

            {hasMentors && hasMentees && (
              <div className="flex justify-end">
                <Button onClick={() => goTab("mapping")}>
                  Open mapping board →
                </Button>
              </div>
            )}
          </>
        )}

        {tab === "tags" && (
          <Card>
            <CardHeader><CardTitle className="text-base">Program tags</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input placeholder="e.g. Frontend" value={newTag} onChange={(e) => setNewTag(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTag()} />
                <Button onClick={addTag} disabled={!newTag.trim()}><Plus className="h-4 w-4 mr-1" />Add</Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {tags.length === 0 ? <p className="text-sm text-muted-foreground">No tags yet.</p> :
                  tags.map((t) => (
                    <Badge key={t.id} variant="secondary" className="gap-1">
                      {t.label}
                      <button onClick={() => removeTag(t.id)} className="hover:text-destructive"><X className="h-3 w-3" /></button>
                    </Badge>
                  ))
                }
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit program dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <DialogHeader><DialogTitle>Edit program</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea rows={3} value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Starts on</Label>
                <Input type="date" value={editForm.starts_on} onChange={(e) => setEditForm({ ...editForm, starts_on: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Ends on</Label>
                <Input type="date" value={editForm.ends_on} onChange={(e) => setEditForm({ ...editForm, ends_on: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Capacity</Label>
                <Input type="number" min={0} value={editForm.capacity} onChange={(e) => setEditForm({ ...editForm, capacity: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={editForm.status} onValueChange={(v: ProgramStatus) => setEditForm({ ...editForm, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={saveProgram} disabled={savingProgram || !editForm.name.trim()}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive / activate confirmation */}
      <AlertDialog open={confirmAction === "archive" || confirmAction === "activate"} onOpenChange={(o) => !o && setConfirmAction(null)}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === "archive" ? "Archive this program?" : "Reactivate this program?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === "archive"
                ? "Mentees will no longer see this program in their list. All members and assignments are preserved and can be restored by reactivating."
                : "The program will move back to active and become visible to its members again."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => setProgramStatus(confirmAction === "archive" ? "archived" : "active")}>
              {confirmAction === "archive" ? "Archive" : "Reactivate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation with cascade preview */}
      <AlertDialog open={confirmAction === "delete"} onOpenChange={(o) => !o && setConfirmAction(null)}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this program permanently?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>This action cannot be undone. The following will also be removed:</p>
                <ul className="list-disc pl-5 text-sm">
                  <li><strong>{programMentors.length}</strong> mentor membership{programMentors.length === 1 ? "" : "s"}</li>
                  <li><strong>{programMentees.length}</strong> mentee enrollment{programMentees.length === 1 ? "" : "s"}</li>
                  <li><strong>{assignments.length}</strong> mentor↔mentee assignment{assignments.length === 1 ? "" : "s"}</li>
                  <li><strong>{tags.length}</strong> tag{tags.length === 1 ? "" : "s"}</li>
                </ul>
                <p className="text-xs text-muted-foreground pt-1">
                  User accounts, sessions and feedback are <strong>not</strong> deleted — only this program's data.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteProgram}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default AdminProgramDetail;
