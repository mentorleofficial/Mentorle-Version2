import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Download, Maximize2, Minimize2, Radio, Search, Square, Trophy } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
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
import { LuckyWheel } from "@/features/event-mode/LuckyWheel";
import type { WheelName, WheelSpin } from "@/features/event-mode/LuckyWheel";

// Admin → Event mode. While an event is on, mentorle.in's signup has no email code (event-quick-signup), every new
// mentee is entered into the lucky draw, and mentorle.in/live tells attendees the winner will be revealed soon. The wheel
// is meant to be projected:
// Spin asks the server for the winner (event_draw), the wheel lands on them as the countdown on attendees' phones
// ends, and only then are the winner's details shown here. Past events keep their list, stats and winners.

// The event tables aren't in the generated types yet.
const db = supabase as unknown as SupabaseClient;
const MENTEE_SITE = (import.meta.env.VITE_MENTEE_SITE_URL as string | undefined)?.replace(/\/$/, "") || "https://mentorle.in";

type EventRow = { id: string; name: string; started_at: string; ends_at: string | null; ended_at: string | null; entries_closed_at: string | null; active?: boolean };
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
type Draw = { id: string; drawn_at: string; reveal_at: string; eligible_count: number; winner: Winner; drawn_by: string | null };
type Detail = { event: EventRow & { active: boolean }; entries: Entry[]; draws: Draw[] };

const isRunning = (e: EventRow) => !e.ended_at && (!e.ends_at || new Date(e.ends_at) > new Date());
const when = (iso: string | null) => (iso ? format(new Date(iso), "d MMM yyyy, h:mm a") : "—");

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const AdminEventMode = () => {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);

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
  const eventId = selected ?? running?.id ?? events.data?.[0]?.id ?? null;

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

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-2xl">Event mode</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              For live events: signup on mentorle.in skips the email code, everyone who joins is entered into the lucky draw, and{" "}
              <a href={`${MENTEE_SITE}/live`} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                {MENTEE_SITE.replace(/^https?:\/\//, "")}/live
              </a>{" "}
              shows attendees a countdown and their own result when you spin. Turn it off when the event is over: normal signup (with the code) comes back straight away.
            </p>
          </div>
          {(events.data?.length ?? 0) > 0 && (
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

        {detail.data && <EventDetail detail={detail.data} onChanged={refresh} />}
        {detail.isError && (
          <p className="text-sm text-destructive">
            Couldn't load the event. {(detail.error as Error)?.message}
          </p>
        )}
        {events.isError && (
          <p className="text-sm text-destructive">
            Couldn't load events. {(events.error as Error)?.message}
          </p>
        )}
      </div>
    </AppLayout>
  );
};

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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Radio className="h-5 w-5" /> Start event mode
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
        <Button onClick={start} disabled={busy}>
          {busy ? "Starting…" : "Turn on event mode"}
        </Button>
      </CardContent>
    </Card>
  );
}

function EventDetail({ detail, onChanged }: { detail: Detail; onChanged: () => void }) {
  const { toast } = useToast();
  const { event, entries, draws } = detail;
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [query, setQuery] = useState("");

  const counted = entries.filter((e) => !e.disqualified_at);
  const winners = new Set(draws.map((d) => d.winner?.entry_id));
  // Oldest first, the same order the server uses for the wheel.
  const eligible = useMemo(
    () => entries.filter((e) => e.in_draw && !e.disqualified_at && !winners.has(e.id)).reverse(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entries, draws],
  );
  const perHour = useMemo(() => {
    const buckets = new Map<string, number>();
    for (const e of counted) {
      const key = format(new Date(e.created_at), "d MMM, h a");
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
    return [...buckets.entries()].reverse();
  }, [counted]);
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
  const shown = q ? entries.filter((e) => [e.full_name, e.email, e.phone ?? ""].some((v) => v.toLowerCase().includes(q))) : entries;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              {event.name}
              {event.active ? <Badge>On now</Badge> : <Badge variant="secondary">Ended</Badge>}
            </CardTitle>
            <CardDescription className="mt-1">
              Started {when(event.started_at)}
              {event.active && event.ends_at && ` · turns off automatically ${when(event.ends_at)}`}
              {!event.active && ` · ended ${when(event.ended_at ?? event.ends_at)}`}
              {event.entries_closed_at && ` · draw list closed ${when(event.entries_closed_at)}`}
            </CardDescription>
          </div>
          {event.active && (
            <Button variant="destructive" onClick={() => setConfirmEnd(true)}>
              <Square className="mr-2 h-4 w-4" /> Turn off event mode
            </Button>
          )}
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <Stat label="Signups" value={counted.length} />
          <Stat label="Quick signups" value={counted.filter((e) => e.quick_signup).length} />
          <Stat label="Profiles completed" value={counted.filter((e) => e.onboarded).length} />
          <Stat label="In the draw now" value={eligible.length} />
          <Stat label="Disqualified" value={entries.length - counted.length} />
        </CardContent>
      </Card>

      <DrawPanel event={event} eligible={eligible} draws={draws} onDrawn={onChanged} />

      {perHour.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Signups per hour</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {perHour.map(([hour, n]) => (
              <div key={hour} className="grid grid-cols-[8rem_1fr_3rem] items-center gap-3 text-sm">
                <span className="text-muted-foreground">{hour}</span>
                <span className="h-2 bg-primary/80" style={{ width: `${(n / busiest) * 100}%` }} />
                <span className="text-right tabular-nums">{n}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-lg">Signups ({entries.length})</CardTitle>
            <CardDescription>Newest first. Disqualified people stay listed but aren't in the draw or on the live page.</CardDescription>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email, phone" className="w-64 pl-8" />
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
                  <TableCell className="font-medium">
                    {e.full_name}
                    {winners.has(e.id) && <Trophy className="ml-2 inline h-4 w-4 text-amber-500" aria-label="Winner" />}
                  </TableCell>
                  <TableCell>{e.email}</TableCell>
                  <TableCell>{e.phone ?? "—"}</TableCell>
                  <TableCell className="whitespace-nowrap">{format(new Date(e.created_at), "d MMM, h:mm a")}</TableCell>
                  <TableCell>{e.onboarded ? <Badge variant="secondary">Complete</Badge> : <span className="text-muted-foreground">Skipped</span>}</TableCell>
                  <TableCell>
                    {e.disqualified_at ? (
                      <Badge variant="destructive">Disqualified</Badge>
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value.toLocaleString("en-IN")}</p>
    </div>
  );
}

function DrawPanel({ event, eligible, draws, onDrawn }: { event: EventRow; eligible: Entry[]; draws: Draw[]; onDrawn: () => void }) {
  const { toast } = useToast();
  const panel = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [spin, setSpin] = useState<WheelSpin | null>(null);
  const [wheelNames, setWheelNames] = useState<WheelName[] | null>(null);
  const [pending, setPending] = useState<Winner | null>(null);
  const [revealed, setRevealed] = useState<Winner | null>(null);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const names: WheelName[] = wheelNames ?? eligible.map((e) => ({ id: e.id, name: e.full_name }));

  const draw = async () => {
    setBusy(true);
    setRevealed(null);
    const began = performance.now();
    const { data, error } = await db.rpc("event_draw", { _event_id: event.id });
    if (error) {
      setBusy(false);
      toast({ title: "Couldn't draw", description: error.message, variant: "destructive" });
      return;
    }
    const result = data as { draw_id: string; reveal_in: number; pool: WheelName[]; winner: Winner };
    const latency = performance.now() - began;
    setWheelNames(result.pool);
    setPending(result.winner);
    setSpin({ key: result.draw_id, winnerId: result.winner.entry_id, durationMs: Math.max(3000, result.reveal_in * 1000 - latency) });
  };

  const done = () => {
    setRevealed(pending);
    setBusy(false);
    onDrawn();
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void panel.current?.requestFullscreen();
  };

  // Back to the live list once the next spin can start (the revealed winner stays on screen until then).
  const nextDraw = () => {
    setWheelNames(null);
    setSpin(null);
    setRevealed(null);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Trophy className="h-5 w-5" /> Lucky draw
          </CardTitle>
          <CardDescription>
            Project this screen. Spin picks a winner at random from everyone in the draw; phones on the live page count down and show each person their result as the wheel
            stops. The first spin closes the list.
          </CardDescription>
        </div>
        <Button variant="outline" onClick={toggleFullscreen}>
          {fullscreen ? <Minimize2 className="mr-2 h-4 w-4" /> : <Maximize2 className="mr-2 h-4 w-4" />}
          {fullscreen ? "Exit full screen" : "Full screen"}
        </Button>
      </CardHeader>
      <CardContent>
        <div ref={panel} className={fullscreen ? "flex h-full flex-col items-center justify-center bg-white p-8 text-[#2b2b2b]" : ""}>
          {fullscreen && <p className="mb-6 text-2xl font-semibold">{event.name}</p>}
          <LuckyWheel names={names} spin={spin} onDone={done} />
          <div className="mt-6 flex flex-col items-center gap-4">
            {revealed ? (
              <div className="w-full max-w-xl rounded-lg border-2 border-amber-400 bg-amber-50 p-6 text-center text-[#2b2b2b]">
                <p className="text-sm uppercase tracking-wide text-amber-700">Winner</p>
                <p className="mt-1 text-3xl font-bold">{revealed.name}</p>
                <p className="mt-3 text-base">{revealed.email}</p>
                <p className="text-base">{revealed.phone ?? "No phone"}</p>
                <Button className="mt-5" variant="outline" onClick={nextDraw}>
                  Done
                </Button>
              </div>
            ) : (
              <Button size="lg" className="h-14 px-10 text-lg" onClick={draw} disabled={busy || names.length === 0}>
                {busy ? "Spinning…" : draws.length ? "Draw again" : "Spin the wheel"}
              </Button>
            )}
            {names.length === 0 && !busy && !revealed && <p className="text-sm text-muted-foreground">No one is in the draw yet.</p>}
          </div>
        </div>
        {draws.length > 0 && (
          <div className="mt-8">
            <p className="mb-2 text-sm font-medium">Draws</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Winner</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Drawn</TableHead>
                  <TableHead>From</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {draws.map((d, i) => {
                  const hidden = busy && i === draws.length - 1 && new Date(d.reveal_at) > new Date();
                  return (
                    <TableRow key={d.id}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell className="font-medium">{hidden ? "Spinning…" : d.winner?.name}</TableCell>
                      <TableCell>{hidden ? "" : d.winner?.email}</TableCell>
                      <TableCell>{hidden ? "" : d.winner?.phone ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {when(d.drawn_at)}
                        {d.drawn_by ? ` by ${d.drawn_by}` : ""}
                      </TableCell>
                      <TableCell>{d.eligible_count} people</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default AdminEventMode;
