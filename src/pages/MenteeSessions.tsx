import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  MessageSquare,
  X,
  RefreshCw,
  Video,
  Star,
  ListTodo,
  Calendar as CalendarIcon,
  Inbox,
} from "lucide-react";
import AddToCalendarMenu from "@/components/AddToCalendarMenu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import SessionActionItemsPanel from "@/components/sessions/SessionActionItemsPanel";
import BookingModal from "@/components/sessions/BookingModal";

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
import { useMyPrograms } from "@/features/programs/hooks/useMyPrograms";
import {
  useMenteeSessions,
  useMenteeRatedSessions,
  useMenteeMentorPrograms,
  useCancelMenteeSession,
  type MenteeSessionRow,
} from "@/features/mentee-sessions/useMenteeSessions";
import type { SessionStatus } from "@/features/mentor-sessions/useMentorSessions";
import { useMenteeActionItemSessionIds } from "@/features/action-items/useActionItems";

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
  s: MenteeSessionRow,
  programs: SessionCardData["programs"],
  bookedProgram?: ProgramTag | null
): SessionCardData {
  return {
    id: s.id,
    counterpartyName: s.mentor?.full_name || "Unknown mentor",
    counterpartyAvatar: s.mentor?.avatar_url ?? null,
    title: s.title,
    topic: s.topic,
    scheduledAt: s.scheduled_at,
    durationMinutes: s.duration_minutes,
    status: s.status,
    programs,
    programLinkBase: "/mentee/programs",
    meetingUrl: s.meeting_url,
    notes: s.notes,
    menteeNotes: s.mentee_notes,
    cancellationReason: s.cancellation_reason,
    mentorFeedback: s.feedback?.find((f) => f.audience === "mentee") ?? null,
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

const MenteeSessions = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: sessions = [], isLoading } = useMenteeSessions(user?.id);
  console.log("DEBUG: Mentee Sessions fetch:", sessions);
  const sessionIds = useMemo(() => sessions.map((s) => s.id), [sessions]);
  const { data: ratedSessionIds = new Set<string>() } = useMenteeRatedSessions(
    user?.id,
    sessionIds
  );
  const { data: myPrograms = [] } = useMyPrograms();
  const { data: sessionsWithItems = new Set<string>() } = useMenteeActionItemSessionIds(user?.id);

  const mentorIds = useMemo(
    () => Array.from(new Set(sessions.map((s) => s.mentor_id))),
    [sessions]
  );
  const programIds = useMemo(() => myPrograms.map((p) => p.id), [myPrograms]);
  const { data: mentorProgramRows = [] } = useMenteeMentorPrograms(
    programIds,
    mentorIds
  );

  const mentorPrograms = useMemo(() => {
    const byMentor: Record<
      string,
      { id: string; name: string; color: string; slug: string }[]
    > = {};
    const programMap = new Map(myPrograms.map((p) => [p.id, p]));
    mentorProgramRows.forEach((row) => {
      const p = programMap.get(row.program_id);
      if (!p) return;
      (byMentor[row.mentor_id] ||= []).push({
        id: p.id,
        name: p.name,
        color: p.color,
        slug: p.slug,
      });
    });
    return byMentor;
  }, [myPrograms, mentorProgramRows]);

  const cancelMutation = useCancelMenteeSession(user?.id);
  const [cancelTarget, setCancelTarget] = useState<MenteeSessionRow | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [actionItemsTarget, setActionItemsTarget] = useState<MenteeSessionRow | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<MenteeSessionRow | null>(null);


  // Filters
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [search, setSearch] = useState("");
  const [programFilter, setProgramFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<SessionStatus | "all">("all");
  const [sort, setSort] = useState<SortMode>("soonest");

  const programOptions: ProgramOption[] = useMemo(
    () => myPrograms.map((p) => ({ id: p.id, name: p.name })),
    [myPrograms]
  );

  const now = Date.now();
  const { upcoming, past, nextSession } = useMemo(() => {
    const up: MenteeSessionRow[] = [];
    const ps: MenteeSessionRow[] = [];
    for (const s of sessions) {
      if (s.status === "booked" && new Date(s.scheduled_at).getTime() >= now) up.push(s);
      else ps.push(s);
    }
    up.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
    return { upcoming: up, past: ps, nextSession: up[0] ?? null };
  }, [sessions, now]);

  const filterFn = (rows: MenteeSessionRow[]) => {
    const q = search.trim().toLowerCase();
    return rows.filter((s) => {
      if (programFilter !== "all") {
        const progs = mentorPrograms[s.mentor_id] || [];
        if (!progs.some((p) => p.id === programFilter)) return false;
      }
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (q) {
        const hay = [
          s.mentor?.full_name,
          s.title,
          s.topic,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  };

  const sortFn = (rows: MenteeSessionRow[]) =>
    [...rows].sort((a, b) => {
      const da = new Date(a.scheduled_at).getTime();
      const db = new Date(b.scheduled_at).getTime();
      return sort === "soonest" ? da - db : db - da;
    });

  const filteredUpcoming = useMemo(() => sortFn(filterFn(upcoming)), [upcoming, search, programFilter, statusFilter, sort, mentorPrograms]);
  const filteredPast = useMemo(() => sortFn(filterFn(past)), [past, search, programFilter, statusFilter, sort, mentorPrograms]);

  const handleCancel = () => {
    if (!cancelTarget) return;
    cancelMutation.mutate(
      { id: cancelTarget.id, reason: cancelReason },
      {
        onSuccess: () => {
          toast({ title: "Session cancelled" });
          setCancelTarget(null);
          setCancelReason("");
        },
      }
    );
  };

  const buildCardActions = (s: MenteeSessionRow, isUpcoming: boolean) => {
    const foundProg = s.program
      ? { name: s.program.name, color: s.program.color, slug: s.program.slug }
      : s.program_id
      ? (mentorPrograms[s.mentor_id] || []).find((p) => p.id === s.program_id)
      : null;

    const progs = foundProg
      ? [{ name: foundProg.name, color: foundProg.color, slug: foundProg.slug }]
      : (mentorPrograms[s.mentor_id] || []);
    const data = toCardData(s, progs, foundProg);
    const primary: React.ReactNode[] = [];
    const overflow: OverflowAction[] = [];

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
            title: `Mentorship session with ${s.mentor?.full_name || "your mentor"}`,
            description: [
              s.meeting_url ? `Meeting link: ${s.meeting_url}` : "",
              s.mentee_notes ? `Notes: ${s.mentee_notes}` : "",
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

      if (!s.rescheduled_from_id) {
        overflow.push({
          label: "Reschedule",
          icon: <RefreshCw className="h-3.5 w-3.5" />,
          onClick: () => setRescheduleTarget(s),
        });
      }

      overflow.push({
        label: "Cancel session",
        icon: <X className="h-3.5 w-3.5" />,
        onClick: () => setCancelTarget(s),
        destructive: true,
      });
    }

    if (s.status === "completed") {
      if (ratedSessionIds.has(s.id)) {
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
            onClick={() => navigate(`/session/${s.id}/feedback`)}
          >
            <MessageSquare className="mr-1 h-3.5 w-3.5" /> Rate session
          </Button>
        );
      }
    }

    if (sessionsWithItems.has(s.id)) {
      primary.push(
        <Button key="tasks" size="sm" variant="outline" onClick={() => setActionItemsTarget(s)}>
          <ListTodo className="mr-1 h-3.5 w-3.5" /> View tasks
        </Button>
      );
    }

    return { data, primary, overflow };
  };

  const renderGroupedUpcoming = (rows: MenteeSessionRow[]) => {
    const groups: Record<"today" | "week" | "later", MenteeSessionRow[]> = {
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
                  const { data, primary, overflow } = buildCardActions(s, true);
                  return (
                    <SessionListCard
                      key={s.id}
                      data={data}
                      isUpcoming
                      primaryActions={<>{primary}</>}
                      overflowActions={overflow}
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

  const renderGroupedPast = (rows: MenteeSessionRow[]) => {
    const groups = new Map<string, MenteeSessionRow[]>();
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
            ? "Book a session with a mentor to get started."
            : "Your past sessions will show up here."}
        </p>
      </div>
      {which === "upcoming" && (
        <Button onClick={() => navigate("/mentors")}>
          <CalendarIcon className="mr-1 h-4 w-4" /> Find a mentor
        </Button>
      )}
    </div>
  );

  // Hero
  const heroData = nextSession
    ? toCardData(nextSession, mentorPrograms[nextSession.mentor_id] || [])
    : null;

  const heroPrimary = nextSession && (
    <>
      {nextSession.meeting_url ? (
        <Button asChild size="lg">
          <a href={nextSession.meeting_url} target="_blank" rel="noreferrer">
            <Video className="mr-2 h-4 w-4" /> Join now
          </a>
        </Button>
      ) : (
        <Button size="lg" variant="secondary" disabled>
          <Video className="mr-2 h-4 w-4" /> Waiting for link
        </Button>
      )}
      <AddToCalendarMenu
        event={{
          title: `Mentorship session with ${nextSession.mentor?.full_name || "your mentor"}`,
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
      {!nextSession.rescheduled_from_id && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setRescheduleTarget(nextSession)}
        >
          <RefreshCw className="mr-1 h-3.5 w-3.5" /> Reschedule
        </Button>
      )}

      <Button variant="ghost" size="sm" onClick={() => setCancelTarget(nextSession)}>
        <X className="mr-1 h-3.5 w-3.5" /> Cancel
      </Button>
    </div>
  );

  const hasFilters = !!search || programFilter !== "all" || statusFilter !== "all";
  const resultRows = tab === "upcoming" ? filteredUpcoming : filteredPast;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">My Sessions</h1>
          <p className="text-sm text-muted-foreground">
            Join, reschedule, and review every session in one place.
          </p>
        </div>

        <SessionHeroCard
          data={heroData}
          counterpartyLabel="Mentor"
          emptyTitle="No upcoming sessions"
          emptyDescription="Book a session with one of your mentors to get going."
          emptyCtaLabel="Find a mentor"
          emptyCtaTo="/mentors"
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

      <AlertDialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this session?</AlertDialogTitle>
            <AlertDialogDescription>
              This will free the slot for someone else. You can rebook later if you change your mind.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label>Reason (optional)</Label>
            <Textarea
              rows={2}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Let your mentor know why…"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelMutation.isPending}>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} disabled={cancelMutation.isPending}>
              {cancelMutation.isPending ? "Cancelling…" : "Cancel session"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!actionItemsTarget} onOpenChange={(o) => !o && setActionItemsTarget(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {actionItemsTarget?.title || "Action items"}
              {actionItemsTarget?.mentor?.full_name
                ? ` · ${actionItemsTarget.mentor.full_name}`
                : ""}
            </DialogTitle>
            <DialogDescription>
              Follow-up tasks shared by your mentor. Check them off as you complete them.
            </DialogDescription>
          </DialogHeader>
          {actionItemsTarget && user && (
            <SessionActionItemsPanel
              sessionId={actionItemsTarget.id}
              mentorId={actionItemsTarget.mentor_id}
              menteeId={user.id}
              currentUserId={user.id}
              role="mentee"
            />
          )}
        </DialogContent>
      </Dialog>

      {rescheduleTarget && (
        <BookingModal
          mentorId={rescheduleTarget.mentor_id}
          offeringId={rescheduleTarget.offering_id ?? undefined}
          rescheduleSessionId={rescheduleTarget.id}
          lockOffering
          open={!!rescheduleTarget}
          onOpenChange={(o) => !o && setRescheduleTarget(null)}
        />
      )}
    </AppLayout>

  );
};

export default MenteeSessions;
