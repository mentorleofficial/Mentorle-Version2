import { useEffect, useRef, useState } from "react";

// The lucky-draw wheel, projected from the admin panel. The winner is picked by the server first (event_draw); this
// only animates: it spins for `durationMs` and stops with the winner's segment under the pointer, at the same moment
// the countdown ends on attendees' phones. With many names the segments get thin, so the name under the pointer is
// also shown large below the wheel.

export type WheelName = { id: string; name: string };
export type WheelSpin = { key: string; winnerId: string; durationMs: number };

const COLOURS = ["#e8501b", "#2b2b2b", "#f6b399", "#b6370a", "#686868", "#ffd7c6"];
const TEXT_ON = (fill: string) => (["#f6b399", "#ffd7c6"].includes(fill) ? "#2b2b2b" : "#ffffff");
// Repeating colours; the last segment never matches the first one it touches.
const colourAt = (i: number, total: number) => (i === total - 1 && i > 0 && i % COLOURS.length === 0 ? COLOURS[2] : COLOURS[i % COLOURS.length]);
const LABEL_LIMIT = 48; // above this, segments are too thin to label

const easeOut = (t: number) => 1 - Math.pow(1 - t, 4);

export function LuckyWheel({ names, spin, onDone }: { names: WheelName[]; spin: WheelSpin | null; onDone?: () => void }) {
  const [rotation, setRotation] = useState(0);
  const rotationRef = useRef(0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  const count = Math.max(names.length, 1);
  const seg = 360 / count;
  const under = (angle: number) => {
    const at = (((360 - (angle % 360)) % 360) + 360) % 360;
    return names[Math.min(names.length - 1, Math.floor(at / seg))];
  };

  useEffect(() => {
    if (!spin) return;
    const index = names.findIndex((n) => n.id === spin.winnerId);
    if (index < 0) return;
    const start = rotationRef.current;
    // Land inside the winner's segment (not on an edge), after several full turns.
    const jitter = (Math.random() - 0.5) * seg * 0.6;
    const target = index * seg + seg / 2 + jitter;
    const base = start - (start % 360) + 360 * Math.max(6, Math.round(spin.durationMs / 1500));
    const end = base + ((360 - target) % 360 + 360) % 360;
    const began = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - began) / spin.durationMs);
      const value = start + (end - start) * easeOut(t);
      rotationRef.current = value;
      setRotation(value);
      if (t < 1) frame = requestAnimationFrame(step);
      else doneRef.current?.();
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
    // A new spin only when `spin.key` changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spin?.key]);

  const current = names.length ? under(rotation) : null;
  const radius = 100;
  const labelled = names.length <= LABEL_LIMIT;

  return (
    <div className="flex flex-col items-center">
      <div className="relative aspect-square w-full max-w-[min(70vh,40rem)]">
        {/* pointer */}
        <svg viewBox="0 0 20 20" className="absolute left-1/2 top-0 z-10 h-8 w-8 -translate-x-1/2 -translate-y-1" aria-hidden>
          <path d="M10 20L1 2h18z" fill="#2b2b2b" stroke="#ffffff" strokeWidth="1.5" />
        </svg>
        <svg viewBox="-102 -102 204 204" className="h-full w-full" role="img" aria-label="Lucky draw wheel">
          <g transform={`rotate(${rotation})`}>
            {names.length === 0 && <circle r={radius} fill="#f3f3f3" />}
            {names.length === 1 && <circle r={radius} fill={COLOURS[0]} />}
            {names.length > 1 &&
              names.map((n, i) => {
                const a0 = ((i * seg - 90) * Math.PI) / 180;
                const a1 = (((i + 1) * seg - 90) * Math.PI) / 180;
                const large = seg > 180 ? 1 : 0;
                const fill = colourAt(i, names.length);
                return (
                  <path
                    key={n.id}
                    d={`M0 0 L${radius * Math.cos(a0)} ${radius * Math.sin(a0)} A${radius} ${radius} 0 ${large} 1 ${radius * Math.cos(a1)} ${radius * Math.sin(a1)} Z`}
                    fill={fill}
                    stroke="#ffffff"
                    strokeWidth={names.length > 120 ? 0 : 0.4}
                  />
                );
              })}
            {labelled &&
              names.map((n, i) => {
                const mid = i * seg + seg / 2;
                const fill = colourAt(i, names.length);
                const label = n.name.length > 18 ? `${n.name.slice(0, 17)}…` : n.name;
                return (
                  <text
                    key={`t-${n.id}`}
                    transform={`rotate(${mid - 90}) translate(${radius - 6} 0)`}
                    textAnchor="end"
                    dominantBaseline="middle"
                    fontSize={Math.min(9, Math.max(4, seg * 0.9))}
                    fill={names.length === 1 ? "#ffffff" : TEXT_ON(fill)}
                    fontFamily="inherit"
                  >
                    {label}
                  </text>
                );
              })}
          </g>
          <circle r="14" fill="#ffffff" stroke="#2b2b2b" strokeWidth="1" />
          <text textAnchor="middle" dominantBaseline="middle" fontSize="6" fill="#2b2b2b" fontWeight="600">
            {names.length}
          </text>
        </svg>
      </div>
      <p className="mt-6 min-h-[2.5em] text-center text-3xl font-semibold md:text-5xl" aria-live="off">
        {current?.name ?? ""}
      </p>
    </div>
  );
}
