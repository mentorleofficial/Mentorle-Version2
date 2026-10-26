import { memo, useEffect, useMemo, useRef, useState } from "react";

// The lucky-draw wheel on the presenter screen. The winner is picked by the server first (event_draw); this only
// animates: it spins for `durationMs` and stops with the winner's segment under the pointer, at the same moment the
// countdown ends on attendees' phones. `onTick` reports the name under the pointer (shown large by the presenter
// screen, since segments get thin with many names). mentorle.in's colours (orange, ink, peach on white) and an ink rim
// like the site's header.
//
// Built for thousands of names: the segments are drawn once into their own layer, and the spin only rotates that
// layer (a GPU transform set straight on the element each frame), so nothing is re-rendered or repainted while it
// turns. The rim, lights, hub and pointer are separate layers that never move.

export type WheelName = { id: string; name: string };
export type WheelSpin = { key: string; winnerId: string; durationMs: number };

const SEGMENTS = ["#e8501b", "#2b2b2b", "#f6b399", "#b6370a", "#4a4a4a", "#ffd7c6"];
const LIGHT = new Set(["#f6b399", "#ffd7c6"]);
// Repeating colours; the last segment never matches the first one it touches.
const colourAt = (i: number, total: number) => (i === total - 1 && i > 0 && i % SEGMENTS.length === 0 ? SEGMENTS[2] : SEGMENTS[i % SEGMENTS.length]);
const LABEL_LIMIT = 60; // above this, segments are too thin to label
const BULBS = 24;
const R = 100;
const VIEW = "-118 -118 236 236";

// Slow start, long glide, gentle stop.
const ease = (t: number) => (t < 0.08 ? 0.5 * (t / 0.08) * (t / 0.08) * 0.08 : 0.04 + 0.96 * (1 - Math.pow(1 - (t - 0.08) / 0.92, 4)));

const nameAt = (list: WheelName[], angle: number) => {
  if (!list.length) return null;
  const seg = 360 / list.length;
  const at = (((360 - (angle % 360)) % 360) + 360) % 360;
  return list[Math.min(list.length - 1, Math.floor(at / seg))]?.name ?? null;
};

// The segments and labels: drawn once per list of names.
const Face = memo(function Face({ names }: { names: WheelName[] }) {
  const count = names.length;
  const seg = 360 / Math.max(count, 1);
  const labelled = count <= LABEL_LIMIT;
  const fontSize = Math.min(8.5, Math.max(3.2, seg * 0.62));
  const maxChars = count > 30 ? 14 : 18;
  const thin = count > 150; // no dividers once segments are hairlines
  return (
    <svg viewBox={VIEW} className="h-full w-full" aria-hidden>
      {count === 0 && <circle r={R} fill="#f3f3f3" />}
      {count === 1 && <circle r={R} fill={SEGMENTS[0]} />}
      {count > 1 &&
        names.map((n, i) => {
          const a0 = ((i * seg - 90) * Math.PI) / 180;
          const a1 = (((i + 1) * seg - 90) * Math.PI) / 180;
          return (
            <path
              key={n.id}
              d={`M0 0 L${R * Math.cos(a0)} ${R * Math.sin(a0)} A${R} ${R} 0 ${seg > 180 ? 1 : 0} 1 ${R * Math.cos(a1)} ${R * Math.sin(a1)} Z`}
              fill={colourAt(i, count)}
              stroke={thin ? undefined : "#ffffff"}
              strokeWidth={thin ? undefined : 0.6}
            />
          );
        })}
      {labelled &&
        names.map((n, i) => {
          const fill = colourAt(i, count);
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
              fill={count === 1 || !LIGHT.has(fill) ? "#ffffff" : "#2b2b2b"}
              style={{ fontFamily: "Manrope, system-ui, sans-serif" }}
            >
              {label}
            </text>
          );
        })}
    </svg>
  );
});

export function LuckyWheel({ names, spin, onDone, onTick }: { names: WheelName[]; spin: WheelSpin | null; onDone?: () => void; onTick?: (name: string | null) => void }) {
  const [spinning, setSpinning] = useState(false);
  const layer = useRef<HTMLDivElement>(null);
  const rotationRef = useRef(0);
  const doneRef = useRef(onDone);
  const tickRef = useRef(onTick);
  const namesRef = useRef(names);
  useEffect(() => {
    doneRef.current = onDone;
    tickRef.current = onTick;
    namesRef.current = names;
  });

  // Report the name under the pointer whenever the list changes.
  useEffect(() => {
    tickRef.current?.(nameAt(names, rotationRef.current));
  }, [names]);

  useEffect(() => {
    if (!spin) return;
    const list = namesRef.current;
    const index = list.findIndex((n) => n.id === spin.winnerId);
    if (index < 0) return;
    const seg = 360 / list.length;
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
      if (layer.current) layer.current.style.transform = `rotate(${value}deg)`;
      const current = nameAt(list, value);
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
  }, [spin]);

  // The face keeps its angle across re-renders; only the spin moves it.
  const initial = useMemo(() => ({ transform: "rotate(0deg)" }), []);

  return (
    <div className="relative aspect-square w-full" role="img" aria-label={`Lucky draw wheel with ${names.length} names`}>
      {/* rim with lights (still) */}
      <svg viewBox={VIEW} className="absolute inset-0 h-full w-full drop-shadow-[0_24px_48px_rgba(43,43,43,0.22)]" aria-hidden>
        <circle r="116" fill="#2b2b2b" />
        {Array.from({ length: BULBS }, (_, i) => {
          const a = ((i * 360) / BULBS - 90) * (Math.PI / 180);
          return (
            <circle
              key={i}
              cx={108 * Math.cos(a)}
              cy={108 * Math.sin(a)}
              r="3.2"
              fill={i % 2 ? "#e8501b" : "#ffffff"}
              className={spinning ? "animate-pulse" : undefined}
              style={spinning ? { animationDelay: `${(i % 4) * 150}ms`, animationDuration: "600ms" } : undefined}
            />
          );
        })}
      </svg>
      {/* the face: drawn once, rotated as one layer */}
      <div ref={layer} className="absolute inset-0 will-change-transform" style={initial}>
        <Face names={names} />
      </div>
      {/* hub (still) */}
      <svg viewBox={VIEW} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
        <circle r="22" fill="#ffffff" stroke="#2b2b2b" strokeWidth="2.5" />
        <image href="/event/mentorle-mark.svg" x="-15" y="-15" width="30" height="30" style={{ filter: "invert(1)" }} />
      </svg>
      {/* pointer */}
      <svg viewBox="0 0 40 48" className="absolute left-1/2 top-[-3%] z-10 h-[11%] -translate-x-1/2 drop-shadow-[0_6px_10px_rgba(43,43,43,0.3)]" aria-hidden>
        <path d="M20 46L3 6a19 19 0 0 1 34 0z" fill="#e8501b" stroke="#ffffff" strokeWidth="3" strokeLinejoin="round" />
        <circle cx="20" cy="15" r="5" fill="#ffffff" />
      </svg>
    </div>
  );
}
