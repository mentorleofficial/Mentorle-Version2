import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Ban, Download, ExternalLink, Eye, MonitorPlay, Radio, Search, Square, Ticket, Trash2, Trophy, UserCheck, Users, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import TablePagination from "@/components/TablePagination";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

// Admin → Event mode. While an event is on, mentorle.in's signup has no email code (event-quick-signup), every new
// mentee is entered into the lucky draw, and mentorle.in/live tells attendees the winner will be revealed soon. The
// draw runs on the presenter screen (AdminEventStage, its own window for the projector: wheel and winner's name only).
// This page is the admin's: stats, the full signup list with contact details, winners, CSV, and past events (which
// can be deleted once over).

// The event tables aren't in the generated types yet.
const db = supabase as unknown as SupabaseClient;
const MENTEE_SITE = (import.meta.env.VITE_MENTEE_SITE_URL as string | undefined)?.replace(/\/$/, "") || "https://mentorle.in";

type EventRow = { id: string; name: string; started_at: string; ends_at: string | null; ended_at: string | null; entries_closed_at: string | null };
type Entry = {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  quick_signup: boolean;
  created_at: string;
  disqualified_at: string | null;
  onboarded: boolean;
  in_draw: boolean;
};
type Winner = { entry_id: string; name: string; email: string; phone: string | null };
type Draw = { id: string; drawn_at: string; reveal_at: string; eligible_count: number; winner: Winner | null; drawn_by: string | null };
type Detail = { event: EventRow & { active: boolean }; entries: Entry[]; draws: Draw[] };

const PER_PAGE = 50;
const isRunning = (e: EventRow) => !e.ended_at && (!e.ends_at || new Date(e.ends_at) > new Date());
const when = (iso: string | null) => (iso ? format(new Date(iso), "d MMM yyyy, h:mm a") : "—");
const openPresenter = (id: string) => window.open(`/admin/event-mode/${id}/stage`, `mentorle-stage-${id}`, "noopener");

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const AdminEventMode = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<EventRow | null>(null);

  const events = useQuery<EventRow[]>({
    queryKey: ["admin", "event-modes"],
    queryFn: async () => {
      const { data, error } = await db.from("event_modes").select("id, name, started_at, ends_at, ended_at, entries_closed_at").order("started_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as EventRow[];
    },
    refetchInterval: 15_000,
  });
  const running = events.data?.find(isRunning) ?? null;
  const eventId = (selected && events.data?.some((e) => e.id === selected) ? selected : null) ?? running?.id ?? events.data?.[0]?.id ?? null;

  const detail = useQuery<Detail | null>({
    queryKey: ["admin", "event-mode", eventId],
    enabled: Boolean(eventId),
    queryFn: async () => {
      const { data, error } = await db.rpc("event_mode_detail", { _event_id: eventId });
      if (error) throw error;
      return data as Detail | null;
    },
    refetchInterval: (query) => ((query.state.data as Detail | null)?.event.active ? 5000 : false),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "event-modes"] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "event-mode"] });
  };

  const remove = async () => {
    if (!deleting) return;
    const target = deleting;
    setDeleting(null);
    const { error } = await db.rpc("event_mode_delete", { _event_id: target.id });
    if (error) {
      toast({ title: "Couldn't delete the event", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Event deleted", description: `“${target.name}” and its list are gone. The accounts people created stay.` });
    if (selected === target.id) setSelected(null);
    refresh();
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-2xl">Event mode</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Quick signup (no email code) and a lucky draw for live events. Attendees keep{" "}
              <a href={`${MENTEE_SITE}/live`} target="_blank" rel="noreferrer" className="font-medium underline underline-offset-2">
                {MENTEE_SITE.replace(/^https?:\/\//, "")}/live
              </a>{" "}
              open; the draw runs on the presenter screen.
            </p>
          </div>
          {(events.data?.length ?? 0) > 1 && (
            <Select value={eventId ?? undefined} onValueChange={setSelected}>
              <SelectTrigger className="w-72">
                <SelectValue placeholder="Choose an event" />
              </SelectTrigger>
              <SelectContent>
                {events.data!.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name} · {isRunning(e) ? "on now" : format(new Date(e.started_at), "d MMM yyyy")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {!running && !events.isLoading && <StartEvent onStarted={(id) => { setSelected(id); refresh(); }} />}

        {detail.data && <EventDetail key={detail.data.event.id} detail={detail.data} onChanged={refresh} onDelete={() => setDeleting(detail.data!.event)} />}
        {detail.isError && <p className="text-sm text-destructive">Couldn't load the event. {(detail.error as Error)?.message}</p>}
        {events.isError && <p className="text-sm text-destructive">Couldn't load events. {(events.error as Error)?.message}</p>}

        <PreviewScreens />

        {(events.data?.length ?? 0) > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">All events</CardTitle>
              <CardDescription>Every event run with event mode. Delete test runs or old events once they're over.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Ended</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.data!.map((e) => (
                    <TableRow key={e.id} className={e.id === eventId ? "bg-muted/50" : undefined}>
                      <TableCell className="font-medium">
                        {e.name}
                        {isRunning(e) && <Badge className="ml-2">On now</Badge>}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{when(e.started_at)}</TableCell>
                      <TableCell className="whitespace-nowrap">{isRunning(e) ? "—" : when(e.ended_at ?? e.ends_at)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => setSelected(e.id)} disabled={e.id === eventId}>
                          {e.id === eventId ? "Showing" : "View"}
                        </Button>
                        {!isRunning(e) && (
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleting(e)} aria-label={`Delete ${e.name}`}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleting?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the event's signup list, stats and winners for good. The Mentorle accounts people created stay. Export the CSV first if you need the list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete event
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

// Every screen people will see, to check before the event: the presenter screen with sample names (a practice spin,
// nothing saved) and each state of mentorle.in/live. The /live previews only work where the site allows them (local
// development, or a test deployment with NEXT_PUBLIC_EVENT_PREVIEW=1), so nobody can show a fake "you won" screen.
const LIVE_PREVIEWS = [
  ["waiting", "Waiting (signed out)"],
  ["entered", "Waiting (in the draw)"],
  ["countdown", "Countdown"],
  ["won", "Winner"],
  ["lost", "Better luck next time"],
  ["not-entered", "Not in the draw"],
  ["signed-out-result", "Result, signed out"],
  ["no-event", "No event on"],
] as const;

function PreviewScreens() {
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Eye className="h-5 w-5" /> Try the screens
          </CardTitle>
          <CardDescription className="max-w-2xl">
            See every screen before the event. The presenter preview uses sample names and a practice spin; nothing is drawn or saved. Attendee previews open on{" "}
            {MENTEE_SITE.replace(/^https?:\/\//, "")} and work on a local or test site only.
          </CardDescription>
        </div>
        <Button variant="outline" onClick={() => openPresenter("preview")}>
          <MonitorPlay className="mr-2 h-4 w-4" /> Preview presenter screen
        </Button>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {LIVE_PREVIEWS.map(([state, label]) => (
          <a
            key={state}
            href={`${MENTEE_SITE}/live?preview=${state}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
          >
            {label} <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
          </a>
        ))}
      </CardContent>
    </Card>
  );
}

function StartEvent({ onStarted }: { onStarted: (id: string) => void }) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [busy, setBusy] = useState(false);
  const start = async () => {
    if (!name.trim()) {
      toast({ title: "Give the event a name", variant: "destructive" });
      return;
    }
    setBusy(true);
    const { data, error } = await db.rpc("event_mode_start", { _name: name.trim(), _ends_at: endsAt ? new Date(endsAt).toISOString() : null });
    setBusy(false);
    if (error) {
      toast({ title: "Couldn't start event mode", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Event mode is on", description: "Quick signup is live on mentorle.in, and new signups are entered into the draw." });
    onStarted(data as string);
  };
  return (
    <Card className="overflow-hidden border-primary/30">
      <div className="h-1 bg-gradient-to-r from-primary/70 via-primary to-primary/70" aria-hidden />
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Radio className="h-5 w-5 text-primary" /> Start event mode
        </CardTitle>
        <CardDescription>Starts with an empty list: only people who sign up from now on are counted and entered into the draw.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-[1fr_16rem_auto] md:items-end">
        <div className="space-y-2">
          <Label htmlFor="event-name">Event name</Label>
          <Input id="event-name" value={name} maxLength={120} placeholder="e.g. Mentorle Meetup, Chandigarh" onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="event-ends">Turn off automatically at (optional)</Label>
          <Input id="event-ends" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
        </div>
        <Button onClick={start} disabled={busy} size="lg">
          {busy ? "Starting…" : "Turn on event mode"}
        </Button>
      </CardContent>
    </Card>
  );
}

function EventDetail({ detail, onChanged, onDelete }: { detail: Detail; onChanged: () => void; onDelete: () => void }) {
  const { toast } = useToast();
  const { event, entries, draws } = detail;
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  const counted = entries.filter((e) => !e.disqualified_at);
  const winners = useMemo(() => new Set(draws.map((d) => d.winner?.entry_id)), [draws]);
  const inDraw = entries.filter((e) => e.in_draw && !e.disqualified_at && !winners.has(e.id)).length;
  const perHour = useMemo(() => {
    const buckets = new Map<string, number>();
    for (const e of [...entries].reverse()) {
      if (e.disqualified_at) continue;
      const key = format(new Date(e.created_at), "d MMM, h a");
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
    return [...buckets.entries()];
  }, [entries]);
  const busiest = Math.max(1, ...perHour.map(([, n]) => n));

  const end = async () => {
    const { error } = await db.rpc("event_mode_end", { _event_id: event.id });
    setConfirmEnd(false);
    if (error) toast({ title: "Couldn't end event mode", description: error.message, variant: "destructive" });
    else toast({ title: "Event mode is off", description: "Signup on mentorle.in asks for the email code again." });
    onChanged();
  };

  const setDisqualified = async (entry: Entry, value: boolean) => {
    const { error } = await db.rpc("event_entry_set_disqualified", { _entry_id: entry.id, _disqualified: value });
    if (error) toast({ title: "Couldn't update the entry", description: error.message, variant: "destructive" });
    onChanged();
  };

  const exportCsv = () => {
    const rows = [
      ["Name", "Email", "Phone", "Signed up (IST)", "Quick signup", "Profile complete", "In the draw", "Disqualified", "Winner"],
      ...entries.map((e) => [
        e.full_name,
        e.email,
        e.phone ?? "",
        new Date(e.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
        e.quick_signup ? "Yes" : "No",
        e.onboarded ? "Yes" : "No",
        e.in_draw ? "Yes" : "No",
        e.disqualified_at ? "Yes" : "No",
        winners.has(e.id) ? "Yes" : "No",
      ]),
    ];
    const blob = new Blob([rows.map((r) => r.map(csvCell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${event.name.replace(/[^\w-]+/g, "-").toLowerCase()}-signups.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const q = query.trim().toLowerCase();
  const matches = q ? entries.filter((e) => [e.full_name, e.email, e.phone ?? ""].some((v) => v.toLowerCase().includes(q))) : entries;
  // 50 rows a page, so thousands of signups don't slow the page down.
  const totalPages = Math.max(1, Math.ceil(matches.length / PER_PAGE));
  const safePage = Math.min(page, totalPages - 1);
  const shown = matches.slice(safePage * PER_PAGE, (safePage + 1) * PER_PAGE);
  // A draw still counting down isn't shown yet, so this page can't spoil it.
  const revealed = draws.filter((d) => new Date(d.reveal_at) <= new Date());

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <div className={`h-1 ${event.active ? "bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400" : "bg-muted"}`} aria-hidden />
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4 space-y-0">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <CardTitle className="font-serif text-2xl">{event.name}</CardTitle>
              {event.active ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  Live: quick signup on
                </span>
              ) : (
                <Badge variant="secondary">Ended</Badge>
              )}
            </div>
            <CardDescription className="mt-1.5">
              Started {when(event.started_at)}
              {event.active && event.ends_at && ` · turns off automatically ${when(event.ends_at)}`}
              {!event.active && ` · ended ${when(event.ended_at ?? event.ends_at)}`}
              {event.entries_closed_at && ` · draw list closed ${when(event.entries_closed_at)}`}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => openPresenter(event.id)}>
              <MonitorPlay className="mr-2 h-4 w-4" /> Open presenter screen
            </Button>
            {event.active ? (
              <Button variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setConfirmEnd(true)}>
                <Square className="mr-2 h-4 w-4" /> Turn off
              </Button>
            ) : (
              <Button variant="outline" className="text-destructive hover:text-destructive" onClick={onDelete}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete event
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Stat icon={Users} label="Signups" value={counted.length} />
          <Stat icon={Zap} label="Quick signups" value={counted.filter((e) => e.quick_signup).length} />
          <Stat icon={UserCheck} label="Profiles completed" value={counted.filter((e) => e.onboarded).length} />
          <Stat icon={Ticket} label="In the draw now" value={inDraw} highlight />
          <Stat icon={Ban} label="Disqualified" value={entries.length - counted.length} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Trophy className="h-5 w-5 text-amber-500" /> Winners
            </CardTitle>
            <CardDescription>Contact details are only shown here, never on the presenter screen.</CardDescription>
          </CardHeader>
          <CardContent>
            {revealed.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                No winner yet. Open the presenter screen on the projector and spin the wheel there.
                <div className="mt-4">
                  <Button variant="outline" size="sm" onClick={() => openPresenter(event.id)}>
                    <ExternalLink className="mr-2 h-4 w-4" /> Open presenter screen
                  </Button>
                </div>
              </div>
            ) : (
              <ol className="space-y-3">
                {revealed.map((d, i) => (
                  <li key={d.id} className="flex items-start gap-4 rounded-lg border bg-amber-50/60 p-4 dark:bg-amber-500/5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-400 text-sm font-bold text-amber-950">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-semibold">{d.winner?.name ?? "Removed entry"}</p>
                      <p className="truncate text-sm">{d.winner?.email}</p>
                      <p className="text-sm">{d.winner?.phone ?? "No phone"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {when(d.drawn_at)} · from {d.eligible_count} {d.eligible_count === 1 ? "person" : "people"}
                        {d.drawn_by ? ` · by ${d.drawn_by}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Signups per hour</CardTitle>
            <CardDescription>Not counting disqualified entries.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {perHour.length === 0 && <p className="text-sm text-muted-foreground">No signups yet.</p>}
            {perHour.map(([hour, n]) => (
              <div key={hour} className="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-3 text-sm">
                <span className="text-muted-foreground">{hour}</span>
                <span className="h-2.5 overflow-hidden rounded-full bg-muted">
                  <span className="block h-full rounded-full bg-primary" style={{ width: `${(n / busiest) * 100}%` }} />
                </span>
                <span className="text-right font-medium tabular-nums">{n}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-lg">Signups ({entries.length})</CardTitle>
            <CardDescription>Newest first. Disqualified people stay listed but aren't in the draw.</CardDescription>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={query} onChange={(e) => { setQuery(e.target.value); setPage(0); }} placeholder="Search name, email, phone" className="w-64 pl-8" />
            </div>
            <Button variant="outline" onClick={exportCsv} disabled={!entries.length}>
              <Download className="mr-2 h-4 w-4" /> CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Signed up</TableHead>
                <TableHead>Profile</TableHead>
                <TableHead>Draw</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((e) => (
                <TableRow key={e.id} className={e.disqualified_at ? "opacity-50" : undefined}>
                  <TableCell className="font-medium">{e.full_name}</TableCell>
                  <TableCell>{e.email}</TableCell>
                  <TableCell>{e.phone ?? "—"}</TableCell>
                  <TableCell className="whitespace-nowrap">{format(new Date(e.created_at), "d MMM, h:mm a")}</TableCell>
                  <TableCell>{e.onboarded ? <Badge variant="secondary">Complete</Badge> : <span className="text-muted-foreground">Skipped</span>}</TableCell>
                  <TableCell>
                    {e.disqualified_at ? (
                      <Badge variant="destructive">Disqualified</Badge>
                    ) : winners.has(e.id) && revealed.some((d) => d.winner?.entry_id === e.id) ? (
                      <Badge className="bg-amber-400 text-amber-950 hover:bg-amber-400">Winner</Badge>
                    ) : e.in_draw ? (
                      "In the draw"
                    ) : (
                      <span className="text-muted-foreground">Joined after the draw</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {!winners.has(e.id) && (
                      <Button variant="ghost" size="sm" onClick={() => setDisqualified(e, !e.disqualified_at)}>
                        {e.disqualified_at ? "Restore" : "Disqualify"}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!shown.length && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    {entries.length ? "No one matches that search." : "No signups yet."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <TablePagination className="mt-4" page={safePage} totalPages={totalPages} onPageChange={setPage} />
        </CardContent>
      </Card>

      <AlertDialog open={confirmEnd} onOpenChange={setConfirmEnd}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Turn off event mode?</AlertDialogTitle>
            <AlertDialogDescription>
              Quick signup stops straight away and signup on mentorle.in asks for the email code again. The list, stats and winners stay here, and you can still draw from the
              people who signed up during the event.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it on</AlertDialogCancel>
            <AlertDialogAction onClick={end}>Turn off</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Stat({ icon: Icon, label, value, highlight }: { icon: LucideIcon; label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? "border-primary/30 bg-primary/5" : "bg-muted/30"}`}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className={`h-4 w-4 ${highlight ? "text-primary" : ""}`} />
        {label}
      </div>
      <p className="mt-2 text-3xl font-semibold tabular-nums">{value.toLocaleString("en-IN")}</p>
    </div>
  );
}

export default AdminEventMode;
