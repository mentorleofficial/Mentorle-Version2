import { useEffect, useRef, useState } from "react";

// The lucky-draw wheel on the presenter screen. The winner is picked by the server first (event_draw); this only
// animates: it spins for `durationMs` and stops with the winner's segment under the pointer, at the same moment the
// countdown ends on attendees' phones. `onTick` reports the name under the pointer (shown large by the presenter
// screen, since segments get thin with many names). mentorle.in's colours (orange, ink, peach on white) and an ink rim
// like the site's header; drawn in SVG so it stays sharp on a projector.

export type WheelName = { id: string; name: string };
export type WheelSpin = { key: string; winnerId: string; durationMs: number };

const SEGMENTS = ["#e8501b", "#2b2b2b", "#f6b399", "#b6370a", "#4a4a4a", "#ffd7c6"];
const LIGHT = new Set(["#f6b399", "#ffd7c6"]);
// Repeating colours; the last segment never matches the first one it touches.
const colourAt = (i: number, total: number) => (i === total - 1 && i > 0 && i % SEGMENTS.length === 0 ? SEGMENTS[2] : SEGMENTS[i % SEGMENTS.length]);
const LABEL_LIMIT = 60; // above this, segments are too thin to label
const BULBS = 24;

// Slow start, long glide, gentle stop.
const ease = (t: number) => (t < 0.08 ? 0.5 * (t / 0.08) * (t / 0.08) * 0.08 : 0.04 + 0.96 * (1 - Math.pow(1 - (t - 0.08) / 0.92, 4)));

export function LuckyWheel({ names, spin, onDone, onTick }: { names: WheelName[]; spin: WheelSpin | null; onDone?: () => void; onTick?: (name: string | null) => void }) {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const rotationRef = useRef(0);
  const doneRef = useRef(onDone);
  const tickRef = useRef(onTick);
  doneRef.current = onDone;
  tickRef.current = onTick;

  const count = Math.max(names.length, 1);
  const seg = 360 / count;
  const nameAt = (angle: number) => {
    if (!names.length) return null;
    const at = (((360 - (angle % 360)) % 360) + 360) % 360;
    return names[Math.min(names.length - 1, Math.floor(at / seg))]?.name ?? null;
  };

  useEffect(() => {
    tickRef.current?.(nameAt(rotationRef.current));
    // Report the name under the pointer whenever the list changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [names]);

  useEffect(() => {
    if (!spin) return;
    const index = names.findIndex((n) => n.id === spin.winnerId);
    if (index < 0) return;
    const start = rotationRef.current;
    // Land inside the winner's segment (not on an edge), after several full turns.
    const jitter = (Math.random() - 0.5) * seg * 0.6;
    const target = index * seg + seg / 2 + jitter;
    const base = start - (start % 360) + 360 * Math.max(7, Math.round(spin.durationMs / 1400));
    const end = base + ((((360 - target) % 360) + 360) % 360);
    const began = performance.now();
    let frame = 0;
    let last: string | null = null;
    setSpinning(true);
    const step = (now: number) => {
      const t = Math.min(1, (now - began) / spin.durationMs);
      const value = start + (end - start) * ease(t);
      rotationRef.current = value;
      setRotation(value);
      const current = nameAt(value);
      if (current !== last) {
        last = current;
        tickRef.current?.(current);
      }
      if (t < 1) frame = requestAnimationFrame(step);
      else {
        setSpinning(false);
        doneRef.current?.();
      }
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
    // A new spin only when `spin.key` changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spin?.key]);

  const R = 100;
  const labelled = names.length <= LABEL_LIMIT;
  const fontSize = Math.min(8.5, Math.max(3.2, seg * 0.62));
  const maxChars = names.length > 30 ? 14 : 18;

  return (
    <div className="relative aspect-square w-full">
      {/* pointer */}
      <svg viewBox="0 0 40 48" className="absolute left-1/2 top-[-3%] z-10 h-[11%] -translate-x-1/2 drop-shadow-[0_6px_10px_rgba(43,43,43,0.3)]" aria-hidden>
        <path d="M20 46L3 6a19 19 0 0 1 34 0z" fill="#e8501b" stroke="#ffffff" strokeWidth="3" strokeLinejoin="round" />
        <circle cx="20" cy="15" r="5" fill="#ffffff" />
      </svg>
      <svg viewBox="-118 -118 236 236" className="h-full w-full drop-shadow-[0_24px_48px_rgba(43,43,43,0.22)]" role="img" aria-label="Lucky draw wheel">
        {/* rim with lights */}
        <circle r="116" fill="#2b2b2b" />
        {Array.from({ length: BULBS }, (_, i) => {
          const a = (i * 360) / BULBS - 90;
          const x = 108 * Math.cos((a * Math.PI) / 180);
          const y = 108 * Math.sin((a * Math.PI) / 180);
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="3.2"
              fill={i % 2 ? "#e8501b" : "#ffffff"}
              className={spinning ? "animate-pulse" : undefined}
              style={spinning ? { animationDelay: `${(i % 4) * 150}ms`, animationDuration: "600ms" } : undefined}
            />
          );
        })}
        <g transform={`rotate(${rotation})`}>
          {names.length === 0 && <circle r={R} fill="#f3f3f3" />}
          {names.length === 1 && <circle r={R} fill={SEGMENTS[0]} />}
          {names.length > 1 &&
            names.map((n, i) => {
              const a0 = ((i * seg - 90) * Math.PI) / 180;
              const a1 = (((i + 1) * seg - 90) * Math.PI) / 180;
              const large = seg > 180 ? 1 : 0;
              return (
                <path
                  key={n.id}
                  d={`M0 0 L${R * Math.cos(a0)} ${R * Math.sin(a0)} A${R} ${R} 0 ${large} 1 ${R * Math.cos(a1)} ${R * Math.sin(a1)} Z`}
                  fill={colourAt(i, names.length)}
                  stroke="#ffffff"
                  strokeWidth={names.length > 150 ? 0 : 0.6}
                />
              );
            })}
          {labelled &&
            names.map((n, i) => {
              const fill = colourAt(i, names.length);
              const label = n.name.length > maxChars ? `${n.name.slice(0, maxChars - 1)}…` : n.name;
              // Names on the left half are flipped so every name reads left to right from the rim inwards.
              const mid = i * seg + seg / 2;
              const flip = mid > 180;
              return (
                <text
                  key={`t-${n.id}`}
                  transform={`rotate(${mid - 90}) translate(${R - 7} 0)${flip ? " rotate(180)" : ""}`}
                  textAnchor={flip ? "start" : "end"}
                  dominantBaseline="middle"
                  fontSize={fontSize}
                  fontWeight={600}
                  fill={names.length === 1 || !LIGHT.has(fill) ? "#ffffff" : "#2b2b2b"}
                  style={{ fontFamily: "Manrope, system-ui, sans-serif" }}
                >
                  {label}
                </text>
              );
            })}
        </g>
        {/* hub */}
        <circle r="22" fill="#ffffff" stroke="#2b2b2b" strokeWidth="2.5" />
        <image href="/event/mentorle-mark.svg" x="-15" y="-15" width="30" height="30" style={{ filter: "invert(1)" }} />
      </svg>
    </div>
  );
}
