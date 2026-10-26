import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import confetti from "canvas-confetti";
import { ArrowLeft, Maximize2, Minimize2 } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LuckyWheel } from "@/features/event-mode/LuckyWheel";
import type { WheelName, WheelSpin } from "@/features/event-mode/LuckyWheel";

// Admin → Event mode → Presenter screen: the page to put on the projector. Only the wheel, the names in the draw and,
// at the end, the winner's name: never emails or phone numbers (those stay on the Event mode page). Spin (or Space)
// asks the server for the winner (event_draw); the wheel lands on them as attendees' phones finish counting down.
// Styled like mentorle.in (Manrope, the ink header bar, white dot grid, orange accents, square corners), since the
// room sees it. /admin/event-mode/preview/stage is a practice run with sample names: nothing is drawn or saved.

const db = supabase as unknown as SupabaseClient;
const INK = "#2b2b2b";
const BRAND = "#e8501b";
const CONFETTI = [BRAND, INK, "#f6b399", "#b6370a", "#ffd7c6"];
const PREVIEW_SECONDS = 12;
const SAMPLE_NAMES = [
  "Riya Sharma", "Arjun Mehta", "Simran Kaur", "Kabir Singh", "Ananya Gupta", "Rohan Verma", "Isha Patel", "Dev Malhotra", "Meera Joshi",
  "Vikram Rao", "Tara Sen", "Nikhil Bansal", "Priya Nair", "Aditya Kapoor", "Sneha Iyer", "Karan Arora", "Neha Chauhan", "Rahul Khanna",
].map((name, i) => ({ id: `sample-${i}`, name }));

// mentorle.in's bg-dots: white with a 24px dot grid (a shade darker than the site's so it shows on a projector).
const dots = { backgroundColor: "#ffffff", backgroundImage: "radial-gradient(circle, #e9e9e9 0.09375rem, transparent 0.125rem)", backgroundSize: "1.5rem 1.5rem" };

type Entry = { id: string; full_name: string; created_at: string; disqualified_at: string | null; in_draw: boolean };
type Detail = { event: { id: string; name: string; active: boolean }; entries: Entry[]; draws: { winner: { entry_id: string } | null }[] };

function useManrope() {
  useEffect(() => {
    const id = "manrope-font";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap";
    document.head.appendChild(link);
  }, []);
}

function celebrate() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const end = Date.now() + 2600;
  const shoot = () => {
    confetti({ particleCount: 6, angle: 60, spread: 70, origin: { x: 0, y: 0.75 }, colors: CONFETTI, shapes: ["square"], scalar: 1.3 });
    confetti({ particleCount: 6, angle: 120, spread: 70, origin: { x: 1, y: 0.75 }, colors: CONFETTI, shapes: ["square"], scalar: 1.3 });
    if (Date.now() < end) requestAnimationFrame(shoot);
  };
  confetti({ particleCount: 150, spread: 110, startVelocity: 55, origin: { y: 0.55 }, colors: CONFETTI, shapes: ["square"], scalar: 1.4 });
  shoot();
}

const AdminEventStage = () => {
  useManrope();
  const { id } = useParams<{ id: string }>();
  const preview = id === "preview";
  const { toast } = useToast();
  const root = useRef<HTMLDivElement>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [spin, setSpin] = useState<WheelSpin | null>(null);
  const [wheelNames, setWheelNames] = useState<WheelName[] | null>(null);
  const [ticker, setTicker] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [winner, setWinner] = useState<string | null>(null);
  const [previewDraws, setPreviewDraws] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (preview) return;
    const { data, error: loadError } = await db.rpc("event_mode_detail", { _event_id: id });
    if (loadError) setError(loadError.message);
    else setDetail(data as Detail | null);
  }, [id, preview]);

  // Keep the names fresh until a spin starts.
  useEffect(() => {
    void load();
    const timer = setInterval(() => !busy && void load(), 5000);
    return () => clearInterval(timer);
  }, [load, busy]);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const winners = new Set((detail?.draws ?? []).map((d) => d.winner?.entry_id));
  const eligible: WheelName[] = preview
    ? SAMPLE_NAMES.filter((n) => !previewDraws.includes(n.id))
    : (detail?.entries ?? [])
        .filter((e) => e.in_draw && !e.disqualified_at && !winners.has(e.id))
        .reverse()
        .map((e) => ({ id: e.id, name: e.full_name }));
  const names = wheelNames ?? eligible;

  const draw = useCallback(async () => {
    if (busy || winner || !id || names.length === 0) return;
    setBusy(true);
    if (preview) {
      // Practice spin: a random sample name, nothing saved.
      const pick = names[Math.floor(Math.random() * names.length)];
      setWheelNames(names);
      setPending(pick.name);
      setPreviewDraws((list) => [...list, pick.id]);
      setSpin({ key: `preview-${Date.now()}`, winnerId: pick.id, durationMs: PREVIEW_SECONDS * 1000 });
      return;
    }
    const began = performance.now();
    const { data, error: drawError } = await db.rpc("event_draw", { _event_id: id });
    if (drawError) {
      setBusy(false);
      toast({ title: "Couldn't draw", description: drawError.message, variant: "destructive" });
      return;
    }
    const result = data as { draw_id: string; reveal_in: number; pool: WheelName[]; winner: { entry_id: string; name: string } };
    setWheelNames(result.pool);
    setPending(result.winner.name);
    setSpin({ key: result.draw_id, winnerId: result.winner.entry_id, durationMs: Math.max(3000, result.reveal_in * 1000 - (performance.now() - began)) });
  }, [busy, winner, id, names, preview, toast]);

  const done = () => {
    setWinner(pending);
    setBusy(false);
    celebrate();
    void load();
  };

  const next = () => {
    setWinner(null);
    setWheelNames(null);
    setSpin(null);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== "Space" && event.code !== "Enter") return;
      // Leave Space/Enter to a focused button or link.
      if (event.target instanceof Element && event.target.closest("button, a, input")) return;
      event.preventDefault();
      if (winner) next();
      else void draw();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [draw, winner]);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void root.current?.requestFullscreen();
  };

  const drawn = preview ? previewDraws.length : (detail?.draws.length ?? 0);
  // While spinning or showing a winner, the draw just made is already counted.
  const round = busy || winner ? Math.max(drawn, 1) : drawn + 1;
  const title = preview ? "Mentorle Meetup (preview)" : (detail?.event.name ?? " ");

  return (
    <div ref={root} className="relative flex min-h-screen flex-col overflow-hidden text-[#2b2b2b]" style={{ ...dots, fontFamily: "Manrope, system-ui, sans-serif" }}>
      {/* mentorle.in's header bar */}
      <header className="relative z-10 mx-[2.5vw] mt-[2.5vh] flex items-center justify-between gap-4 bg-[#2b2b2b] px-[2vw] py-[1.6vh] text-white">
        <img src="/event/mentorle-logo.svg" alt="Mentorle" className="h-[5vh] min-h-8 w-auto" />
        <div className="flex items-center gap-1 text-sm text-white/70">
          {preview && <span className="mr-3 border border-white/30 px-2.5 py-1 text-xs uppercase tracking-[0.12em] text-white">Preview · nothing is saved</span>}
          {!fullscreen && (
            <Link to="/admin/event-mode" className="flex items-center gap-1.5 px-3 py-2 hover:text-white">
              <ArrowLeft className="h-4 w-4" /> Event mode
            </Link>
          )}
          <button type="button" onClick={toggleFullscreen} className="flex items-center gap-1.5 px-3 py-2 hover:text-white" aria-label={fullscreen ? "Exit full screen" : "Full screen"}>
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            {!fullscreen && "Full screen"}
          </button>
        </div>
      </header>

      <main className="relative z-10 grid flex-1 items-center gap-[3vw] px-[4vw] py-[3vh] lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        <div className="mx-auto w-full max-w-[min(76vh,92vw)]">
          <LuckyWheel names={names} spin={spin} onDone={done} onTick={setTicker} />
        </div>

        <section className="text-center lg:text-left">
          <p className="flex items-center justify-center gap-3 text-[clamp(0.9rem,1.5vw,1.35rem)] uppercase tracking-[0.14em] text-[#686868] lg:justify-start">
            <span className="h-3 w-3 bg-[#e8501b]" aria-hidden /> Lucky draw{round > 1 ? ` · Round ${round}` : ""}
          </p>
          <h1 className="mt-4 text-[clamp(2rem,4.4vw,4.5rem)] font-medium leading-[1.08] tracking-[-0.02em]" style={{ fontFamily: "inherit" }}>
            {title}
          </h1>
          <div className="mt-[4.5vh] min-h-[clamp(3.5rem,8vw,7.5rem)] border-l-4 border-[#e8501b] pl-[1.5vw] text-left" aria-live="off">
            {busy ? (
              <>
                <p className="text-[clamp(0.8rem,1.1vw,1rem)] uppercase tracking-[0.14em] text-[#808080]">Spinning</p>
                <p className="mt-1 truncate text-[clamp(2.25rem,5.2vw,5.25rem)] font-bold leading-none text-[#e8501b]">{ticker}</p>
              </>
            ) : (
              <>
                <p className="text-[clamp(0.8rem,1.1vw,1rem)] uppercase tracking-[0.14em] text-[#808080]">In the draw</p>
                <p className="mt-1 text-[clamp(2.25rem,5.2vw,5.25rem)] font-medium leading-none tabular-nums">
                  {names.length.toLocaleString("en-IN")} <span className="text-[0.45em] text-[#686868]">{names.length === 1 ? "person" : "people"}</span>
                </p>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={() => void draw()}
            disabled={busy || names.length === 0 || Boolean(winner)}
            className="mt-[4.5vh] inline-flex h-[clamp(3.5rem,8vh,5.25rem)] items-center border border-[#e8501b] bg-[#e8501b] px-[clamp(2rem,4vw,4rem)] text-[clamp(1.1rem,1.9vw,1.8rem)] text-white transition hover:bg-[#b6370a] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-[#2b2b2b] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Spinning…" : drawn > 0 ? "Draw again" : "Spin the wheel"}
          </button>
          {!busy && names.length > 0 && <p className="mt-3 text-sm text-[#808080]">or press Space</p>}
          {names.length === 0 && !busy && <p className="mt-3 text-sm text-[#808080]">No one is in the draw yet.</p>}
          {error && <p className="mt-6 text-sm text-red-600">{error}</p>}
        </section>
      </main>

      {winner && (
        <div className="absolute inset-0 z-20 flex animate-in fade-in flex-col items-center justify-center px-[6vw] text-center duration-500" style={dots}>
          <div className="flex flex-col items-center border border-[#d5d5d5] bg-white px-[6vw] py-[7vh] shadow-[0_30px_80px_rgba(43,43,43,0.12)] animate-in zoom-in-95 duration-500">
            <p className="flex items-center gap-3 text-[clamp(1rem,1.8vw,1.6rem)] uppercase tracking-[0.3em] text-[#e8501b]">
              <span className="h-3 w-3 bg-[#e8501b]" aria-hidden /> Winner <span className="h-3 w-3 bg-[#e8501b]" aria-hidden />
            </p>
            <h2 className="mt-[3vh] max-w-[80vw] break-words text-[clamp(3rem,9vw,9rem)] font-extrabold leading-[0.95] tracking-[-0.03em]" style={{ fontFamily: "inherit" }}>
              {winner}
            </h2>
            <p className="mt-[3.5vh] text-[clamp(1.1rem,2.2vw,2rem)] text-[#686868]">In a crowd of 1000s, we found you. Congratulations!</p>
            <div className="mt-[5vh] bg-[#2b2b2b] px-5 py-3">
              <img src="/event/mentorle-logo.svg" alt="Mentorle" className="h-[4.5vh] min-h-7 w-auto" />
            </div>
          </div>
          <button type="button" onClick={next} className="absolute bottom-[3vh] right-[3vw] px-4 py-2 text-sm text-[#808080] hover:text-[#2b2b2b]">
            Back to the wheel
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminEventStage;
