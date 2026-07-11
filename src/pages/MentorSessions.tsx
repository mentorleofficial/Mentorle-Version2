import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useMentorProfile, useUpdateGlobalAttachmentToggle } from "@/features/mentor-profile";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CheckCircle2,
  X,
  UserX,
  User,
  FileEdit,
  Video,
  Star,
  ListTodo,
  AlertCircle,
  Inbox,
  ChevronRight,
} from "lucide-react";
import AddToCalendarMenu from "@/components/AddToCalendarMenu";
import SessionActionItemsPanel from "@/components/sessions/SessionActionItemsPanel";
import SessionHeroCard from "@/components/sessions/SessionHeroCard";
import SessionListCard, {
  type OverflowAction,
  type SessionCardData,
  type ProgramTag,
} from "@/components/sessions/SessionListCard";
import SessionsToolbar, {
  type SortMode,
  type ProgramOption,
} from "@/components/sessions/SessionsToolbar";
import SessionSectionHeader from "@/components/sessions/SessionSectionHeader";
import SessionCardSkeleton from "@/components/sessions/SessionCardSkeleton";
import { upcomingGroup, monthYearIST } from "@/lib/relativeTime";
import {
  useMentorSessions,
  useMentorRatedSessions,
  useUpdateSessionStatus,
  useUpdateSessionDetails,
  type MentorSessionRow,
  type SessionStatus,
} from "@/features/mentor-sessions/useMentorSessions";
import {
  useMentorMentees,
  selectMenteeProgramMap,
} from "@/features/mentor-mentees/useMentorMentees";
import { MenteeDetailsDialog } from "@/features/mentor-mentees/components/MenteeDetailsDialog";

const cleanComment = (comment: string | null) => {
  if (!comment) return "";
  const delimiter = "---\nSurvey Responses:\n";
  const delimiterIndex = comment.indexOf(delimiter);
  if (delimiterIndex !== -1) {
    return comment.substring(0, delimiterIndex).trim();
  }
  if (comment.startsWith("Survey Responses:\n")) {
    return "";
  }
  return comment;
};

function toCardData(
  s: MentorSessionRow,
  programs: SessionCardData["programs"],
  bookedProgram?: ProgramTag | null
): SessionCardData {
  return {
    id: s.id,
    counterpartyName: s.mentee?.full_name || "Unknown mentee",
    counterpartyAvatar: s.mentee?.avatar_url ?? null,
    title: s.title,
    topic: s.topic,
    scheduledAt: s.scheduled_at,
    durationMinutes: s.duration_minutes,
    status: s.status,
    programs,
    programLinkBase: "/mentor/programs",
    meetingUrl: s.meeting_url,
    notes: s.notes,
    menteeNotes: s.mentee_notes,
    cancellationReason: s.cancellation_reason,
    mentorFeedback: (() => {
      const f = s.feedback?.find((f) => f.audience === "mentee");
      if (!f) return null;
      return {
        rating: f.rating,
        comment: cleanComment(f.comment),
        response: f.response ?? null,
        responded_at: f.responded_at ?? null,
      };
    })(),
    menteeFeedback: (() => {
      const f = s.feedback?.find((f) => f.audience === "mentor");
      if (!f) return null;
      return {
        rating: f.rating,
        comment: cleanComment(f.comment),
        response: f.response ?? null,
        responded_at: f.responded_at ?? null,
      };
    })(),
    bookedProgram: bookedProgram ?? (s.program
      ? { name: s.program.name, color: s.program.color, slug: s.program.slug }
      : null),
  };
}

const MentorSessions = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: profile, isLoading: isLoadingProfile } = useMentorProfile(user?.id);
  const updateToggle = useUpdateGlobalAttachmentToggle(user?.id ?? "");

  const handleToggleChange = (checked: boolean) => {
    updateToggle.mutate(checked, {
      onSuccess: () => {
        toast({
          title: checked ? "Replies attachments enabled" : "Replies attachments disabled",
          description: checked
            ? "Mentees can now upload file attachments when replying to action items."
            : "Mentees can no longer upload file attachments when replying to action items.",
        });
      },
      onError: (err) => {
        toast({
          variant: "destructive",
          title: "Error saving settings",
          description: err.message,
        });
      },
    });
  };

  const { data: sessions = [], isLoading } = useMentorSessions(user?.id);
  console.log("DEBUG: Mentor Sessions fetch:", sessions);
  const sessionIds = useMemo(() => sessions.map((s) => s.id), [sessions]);
  const { data: ratedSessionIds } = useMentorRatedSessions(user?.id, sessionIds);
  const { data: menteeRows = [] } = useMentorMentees(user?.id);
  const menteePrograms = useMemo(() => selectMenteeProgramMap(menteeRows), [menteeRows]);

  // Build program options from mentee program list (deduped)
  const programOptions: ProgramOption[] = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    menteeRows.forEach((r) => {
      if (!map.has(r.program.id)) {
        map.set(r.program.id, { id: r.program.id, name: r.program.name });
      }
    });
    return Array.from(map.values());
  }, [menteeRows]);

  // Map mentee_id -> program ids (for filtering)
  const menteeProgramIds = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    menteeRows.forEach((r) => {
      (map[r.mentee.id] ||= new Set()).add(r.program.id);
    });
    return map;
  }, [menteeRows]);

  // Cards need program tag id too; rebuild map with ids
  const menteeProgramsWithId = useMemo(() => {
    const map: Record<string, { id: string; name: string; color: string; slug: string }[]> = {};
    menteeRows.forEach((r) => {
      (map[r.mentee.id] ||= []).push({
        id: r.program.id,
        name: r.program.name,
        color: r.program.color,
        slug: r.program.slug,
      });
    });
    return map;
  }, [menteeRows]);

  const updateStatus = useUpdateSessionStatus(user?.id);
  const updateDetails = useUpdateSessionDetails(user?.id);

  const [editing, setEditing] = useState<MentorSessionRow | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [editMeetingUrl, setEditMeetingUrl] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editTopic, setEditTopic] = useState("");
  const [actionItemsTarget, setActionItemsTarget] = useState<MentorSessionRow | null>(null);
  const [selectedMenteeId, setSelectedMenteeId] = useState<string | null>(null);

  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [search, setSearch] = useState("");
  const [programFilter, setProgramFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<SessionStatus | "all">("all");
  const [sort, setSort] = useState<SortMode>("soonest");

  const openEdit = (s: MentorSessionRow) => {
    setEditing(s);
    setEditNotes(s.notes || "");
    setEditMeetingUrl(s.meeting_url || "");
    setEditTitle(s.title || "");
    setEditTopic(s.topic || "");
  };

  const saveEdit = () => {
    if (!editing) return;
    updateDetails.mutate(
      {
        id: editing.id,
        notes: editNotes,
        meeting_url: editMeetingUrl,
        title: editTitle,
        topic: editTopic,
      },
      { onSuccess: () => setEditing(null) }
    );
  };

  const { upcoming, past, nextSession } = useMemo(() => {
    const now = Date.now();
    const up: MentorSessionRow[] = [];
    const ps: MentorSessionRow[] = [];
    for (const s of sessions) {
      if (s.status === "booked" && new Date(s.scheduled_at).getTime() >= now) up.push(s);
      else ps.push(s);
    }
    up.sort(
      (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
    );
    return { upcoming: up, past: ps, nextSession: up[0] ?? null };
  }, [sessions]);

  const filterFn = (rows: MentorSessionRow[]) => {
    const q = search.trim().toLowerCase();
    return rows.filter((s) => {
      if (programFilter !== "all") {
        const ids = menteeProgramIds[s.mentee_id];
        if (!ids || !ids.has(programFilter)) return false;
      }
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (q) {
        const hay = [s.mentee?.full_name, s.title, s.topic]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  };
  const sortFn = (rows: MentorSessionRow[]) =>
    [...rows].sort((a, b) => {
      const da = new Date(a.scheduled_at).getTime();
      const db = new Date(b.scheduled_at).getTime();
      return sort === "soonest" ? da - db : db - da;
    });

  const filteredUpcoming = useMemo(
    () => sortFn(filterFn(upcoming)),
    [upcoming, search, programFilter, statusFilter, sort, menteeProgramIds]
  );
  const filteredPast = useMemo(
    () => sortFn(filterFn(past)),
    [past, search, programFilter, statusFilter, sort, menteeProgramIds]
  );

  const buildCardActions = (s: MentorSessionRow, isUpcoming: boolean) => {
    const foundProg = s.program
      ? { name: s.program.name, color: s.program.color, slug: s.program.slug }
      : s.program_id
      ? (menteeProgramsWithId[s.mentee_id] || []).find((p) => p.id === s.program_id)
      : null;

    const progs = foundProg
      ? [{ name: foundProg.name, color: foundProg.color, slug: foundProg.slug }]
      : (menteeProgramsWithId[s.mentee_id] || []).map((p) => ({
          name: p.name,
          color: p.color,
          slug: p.slug,
        }));
    const data = toCardData(s, progs, foundProg);
    const primary: React.ReactNode[] = [];
    const overflow: OverflowAction[] = [];
    let alert: React.ReactNode = null;

    if (isUpcoming && s.meeting_url) {
      primary.push(
        <Button asChild size="sm" key="join">
          <a href={s.meeting_url} target="_blank" rel="noreferrer">
            <Video className="mr-1 h-3.5 w-3.5" /> Join now
          </a>
        </Button>
      );
    }
    if (isUpcoming) {
      primary.push(
        <AddToCalendarMenu
          key="cal"
          event={{
            title: `Mentorship session with ${s.mentee?.full_name || "your mentee"}`,
            description: [
              s.meeting_url ? `Meeting link: ${s.meeting_url}` : "",
              s.mentee_notes ? `Mentee asked: ${s.mentee_notes}` : "",
              s.notes ? `Your notes: ${s.notes}` : "",
            ]
              .filter(Boolean)
              .join("\n"),
            location: s.meeting_url || undefined,
            startISO: s.scheduled_at,
            durationMinutes: s.duration_minutes,
          }}
          filename={`session-${s.id}.ics`}
        />
      );

      if (!s.meeting_url) {
        alert = (
          <button
            type="button"
            onClick={() => openEdit(s)}
            className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/5 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-500/10 dark:text-amber-400"
          >
            <AlertCircle className="h-3.5 w-3.5" />
            Add meeting link
          </button>
        );
      }
    }

    if (s.status === "booked") {
      overflow.push(
        {
          label: "Mark complete",
          icon: <CheckCircle2 className="h-3.5 w-3.5" />,
          onClick: () => updateStatus.mutate({ id: s.id, status: "completed" }),
        },
        {
          label: "Mark no-show",
          icon: <UserX className="h-3.5 w-3.5" />,
          onClick: () => updateStatus.mutate({ id: s.id, status: "no_show" }),
        },
        {
          label: "Cancel session",
          icon: <X className="h-3.5 w-3.5" />,
          onClick: () => updateStatus.mutate({ id: s.id, status: "cancelled" }),
          destructive: true,
        }
      );
    }

    if (s.status === "completed") {
      if (ratedSessionIds?.has(s.id)) {
        primary.push(
          <span
            key="rated"
            className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/5 px-2 py-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400"
          >
            <Star className="h-3 w-3" /> Rated
          </span>
        );
      } else {
        primary.push(
          <Button
            key="rate"
            size="sm"
            variant="outline"
            onClick={() => navigate(`/session/${s.id}/feedback`)}
          >
            <Star className="mr-1 h-3.5 w-3.5" /> Rate mentee
          </Button>
        );
      }
    }

    primary.push(
      <Button
        key="view-details"
        size="sm"
        variant="outline"
        onClick={() => navigate(`/mentor/sessions/${s.id}`)}
      >
        <ChevronRight className="mr-1 h-3.5 w-3.5" /> View details
      </Button>
    );

    primary.push(
      <Button key="action-items" size="sm" variant="outline" onClick={() => setActionItemsTarget(s)}>
        <ListTodo className="mr-1 h-3.5 w-3.5" /> Action items
      </Button>
    );

    overflow.push(
      {
        label: "View Mentee Details",
        icon: <User className="h-3.5 w-3.5" />,
        onClick: () => setSelectedMenteeId(s.mentee_id),
      },
      {
        label: "Edit details",
        icon: <FileEdit className="h-3.5 w-3.5" />,
        onClick: () => openEdit(s),
      }
    );

    return { data, primary, overflow, alert };
  };

  const renderGroupedUpcoming = (rows: MentorSessionRow[]) => {
    const groups: Record<"today" | "week" | "later", MentorSessionRow[]> = {
      today: [],
      week: [],
      later: [],
    };
    rows.forEach((s) => groups[upcomingGroup(s.scheduled_at)].push(s));
    const labels: Record<keyof typeof groups, string> = {
      today: "Today",
      week: "This week",
      later: "Later",
    };
    return (
      <div className="space-y-5">
        {(["today", "week", "later"] as const).map((key) =>
          groups[key].length === 0 ? null : (
            <section key={key}>
              <SessionSectionHeader title={labels[key]} count={groups[key].length} />
              <div className="space-y-2">
                {groups[key].map((s) => {
                  const { data, primary, overflow, alert } = buildCardActions(s, true);
                  return (
                    <SessionListCard
                      key={s.id}
                      data={data}
                      isUpcoming
                      primaryActions={<>{primary}</>}
                      overflowActions={overflow}
                      alert={alert}
                    />
                  );
                })}
              </div>
            </section>
          )
        )}
      </div>
    );
  };

  const renderGroupedPast = (rows: MentorSessionRow[]) => {
    const groups = new Map<string, MentorSessionRow[]>();
    rows.forEach((s) => {
      const k = monthYearIST(s.scheduled_at);
      const arr = groups.get(k) ?? [];
      arr.push(s);
      groups.set(k, arr);
    });
    return (
      <div className="space-y-5">
        {Array.from(groups.entries()).map(([month, items]) => (
          <section key={month}>
            <SessionSectionHeader title={month} count={items.length} />
            <div className="space-y-2">
              {items.map((s) => {
                const { data, primary, overflow } = buildCardActions(s, false);
                return (
                  <SessionListCard
                    key={s.id}
                    data={data}
                    isUpcoming={false}
                    primaryActions={<>{primary}</>}
                    overflowActions={overflow}
                  />
                );
              })}
            </div>
          </section>
        ))}
      </div>
    );
  };

  const renderEmpty = (which: "upcoming" | "past") => (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-card py-12 text-center">
      <Inbox className="h-8 w-8 text-muted-foreground" />
      <div>
        <p className="font-medium">
          {which === "upcoming" ? "No upcoming sessions" : "Nothing here yet"}
        </p>
        <p className="text-sm text-muted-foreground">
          {which === "upcoming"
            ? "Open up more availability for mentees to book."
            : "Your completed and cancelled sessions will show up here."}
        </p>
      </div>
      {which === "upcoming" && (
        <Button onClick={() => navigate("/mentor/availability")}>
          Set availability
        </Button>
      )}
    </div>
  );

  const heroProgs = nextSession
    ? (menteeProgramsWithId[nextSession.mentee_id] || []).map((p) => ({
      name: p.name,
      color: p.color,
      slug: p.slug,
    }))
    : [];
  const heroData = nextSession ? toCardData(nextSession, heroProgs) : null;

  const heroPrimary = nextSession && (
    <>
      {nextSession.meeting_url ? (
        <Button asChild size="lg">
          <a href={nextSession.meeting_url} target="_blank" rel="noreferrer">
            <Video className="mr-2 h-4 w-4" /> Join now
          </a>
        </Button>
      ) : (
        <Button size="lg" onClick={() => openEdit(nextSession)}>
          <AlertCircle className="mr-2 h-4 w-4" /> Add meeting link
        </Button>
      )}
      <AddToCalendarMenu
        event={{
          title: `Mentorship session with ${nextSession.mentee?.full_name || "your mentee"}`,
          description: nextSession.meeting_url ? `Meeting link: ${nextSession.meeting_url}` : "",
          location: nextSession.meeting_url || undefined,
          startISO: nextSession.scheduled_at,
          durationMinutes: nextSession.duration_minutes,
        }}
        filename={`session-${nextSession.id}.ics`}
      />
    </>
  );

  const heroSecondary = nextSession && (
    <div className="flex flex-wrap gap-2">
      <Button variant="ghost" size="sm" onClick={() => setActionItemsTarget(nextSession)}>
        <ListTodo className="mr-1 h-3.5 w-3.5" /> Action items
      </Button>
      <Button variant="ghost" size="sm" onClick={() => openEdit(nextSession)}>
        <FileEdit className="mr-1 h-3.5 w-3.5" /> Edit
      </Button>
    </div>
  );

  const hasFilters = !!search || programFilter !== "all" || statusFilter !== "all";
  const resultRows = tab === "upcoming" ? filteredUpcoming : filteredPast;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">My Sessions</h1>
            <p className="text-sm text-muted-foreground">
              Manage upcoming sessions, share follow-ups, and review past meetings.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-lg border bg-card p-3 shadow-sm">
            <Label htmlFor="global-attachments-toggle" className="cursor-pointer font-medium text-sm">
              Allow mentees to send attachments in replies
            </Label>
            <Switch
              id="global-attachments-toggle"
              checked={profile?.allow_mentee_attachments ?? false}
              onCheckedChange={handleToggleChange}
              disabled={isLoadingProfile || updateToggle.isPending}
            />
          </div>
        </div>

        <SessionHeroCard
          data={heroData}
          counterpartyLabel="Mentee"
          emptyTitle="No upcoming sessions"
          emptyDescription="Add availability so mentees can book time with you."
          emptyCtaLabel="Set availability"
          emptyCtaTo="/mentor/availability"
          primaryActions={heroPrimary}
          secondaryActions={heroSecondary}
        />

        <Tabs value={tab} onValueChange={(v) => setTab(v as "upcoming" | "past")}>
          <TabsList>
            <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
            <TabsTrigger value="past">Past ({past.length})</TabsTrigger>
          </TabsList>

          <div className="mt-4 space-y-4">
            <SessionsToolbar
              search={search}
              onSearchChange={setSearch}
              programOptions={programOptions}
              programFilter={programFilter}
              onProgramFilterChange={setProgramFilter}
              showStatusFilter={tab === "past"}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              sort={sort}
              onSortChange={setSort}
              resultCount={resultRows.length}
              hasFilters={hasFilters}
              onClear={() => {
                setSearch("");
                setProgramFilter("all");
                setStatusFilter("all");
              }}
            />

            <TabsContent value="upcoming" className="m-0">
              {isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <SessionCardSkeleton key={i} />
                  ))}
                </div>
              ) : filteredUpcoming.length === 0 ? (
                renderEmpty("upcoming")
              ) : (
                renderGroupedUpcoming(filteredUpcoming)
              )}
            </TabsContent>

            <TabsContent value="past" className="m-0">
              {isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <SessionCardSkeleton key={i} />
                  ))}
                </div>
              ) : filteredPast.length === 0 ? (
                renderEmpty("past")
              ) : (
                renderGroupedPast(filteredPast)
              )}
            </TabsContent>
          </div>
        </Tabs>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Session details</DialogTitle>
            <DialogDescription>
              Update the session title, topic, meeting link, and your private notes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Session title"
              />
            </div>
            <div className="space-y-2">
              <Label>Topic</Label>
              <Input
                value={editTopic}
                onChange={(e) => setEditTopic(e.target.value)}
                placeholder="Topic / focus area"
              />
            </div> */}
            <div className="space-y-2">
              <Label>Meeting link</Label>
              <Input
                value={editMeetingUrl}
                onChange={(e) => setEditMeetingUrl(e.target.value)}
                placeholder="https://meet…"
              />
            </div>
            <div className="space-y-2">
              <Label>Mentor notes (private)</Label>
              <Textarea
                rows={4}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditing(null)}
              disabled={updateDetails.isPending}
            >
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={updateDetails.isPending}>
              {updateDetails.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!actionItemsTarget}
        onOpenChange={(o) => !o && setActionItemsTarget(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {actionItemsTarget?.title || "Action items"}
              {actionItemsTarget?.mentee?.full_name
                ? ` · ${actionItemsTarget.mentee.full_name}`
                : ""}
            </DialogTitle>
            <DialogDescription>
              Assign follow-up tasks to your mentee. They'll see them on their dashboard.
            </DialogDescription>
          </DialogHeader>
          {actionItemsTarget && user && (
            <SessionActionItemsPanel
              sessionId={actionItemsTarget.id}
              mentorId={user.id}
              menteeId={actionItemsTarget.mentee_id}
              currentUserId={user.id}
              role="mentor"
            />
          )}
        </DialogContent>
      </Dialog>

      <MenteeDetailsDialog
        menteeId={selectedMenteeId}
        open={!!selectedMenteeId}
        onOpenChange={(open) => {
          if (!open) setSelectedMenteeId(null);
        }}
      />
    </AppLayout>
  );
};

export default MentorSessions;
