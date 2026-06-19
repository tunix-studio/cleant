import { useEffect, useState } from "react";

// Low decorative water — one path per layer (wavy top → base), seamless.
const WATER_H = 34; // % of the inner pool, kept low so the number sits above it
const wavePath = (top: number, amp: number) =>
  `M0 ${top} q10 -${amp} 20 0 ` + "t20 0 ".repeat(13) + " V100 H0 Z";

const WAVES = [
  { top: 26, amp: 12, op: 0.3, dur: "3.8s", dir: "reverse" },
  { top: 38, amp: 16, op: 0.85, dur: "2.6s", dir: "normal" },
] as const;

const R = 45;
const C = 2 * Math.PI * R;

/**
 * The "disk health" gauge. The score reads in the clear centre (always on the
 * light pool, never on the teal water → no contrast clash); a progress ring
 * around the rim animates up to the score, with a little drifting pool below.
 */
export function HealthGauge({
  score,
  label,
  size = 184,
}: {
  score: number;
  label: string;
  size?: number;
}) {
  const [p, setP] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setP(score));
    return () => cancelAnimationFrame(id);
  }, [score]);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {/* progress ring */}
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
        <circle cx="50" cy="50" r={R} fill="none" stroke="var(--color-line)" strokeWidth="4" />
        <circle
          cx="50"
          cy="50"
          r={R}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - p / 100)}
          className="transition-[stroke-dashoffset] duration-[1100ms] ease-[cubic-bezier(0.2,0,0,1)]"
        />
      </svg>

      {/* inner pool with a low waterline */}
      <div className="absolute inset-[11%] overflow-hidden rounded-full border border-line bg-inset/40">
        <div
          className="absolute inset-x-0 bottom-0 overflow-hidden"
          style={{ height: `${WATER_H}%` }}
        >
          {WAVES.map((w, i) => (
            <svg
              key={i}
              aria-hidden="true"
              viewBox="0 0 280 100"
              preserveAspectRatio="none"
              className="wave absolute bottom-0 left-0 h-full w-[280px]"
              style={{
                animationDuration: w.dur,
                animationDirection: w.dir,
                opacity: w.op,
              }}
              fill="var(--color-accent)"
            >
              <path d={wavePath(w.top, w.amp)} />
            </svg>
          ))}
        </div>
      </div>

      {/* score readout — sits in the clear pool above the waterline */}
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="tnum text-[42px] font-bold leading-none tracking-[-0.02em] text-ink">
            {score}
          </div>
          <div className="mt-1.5 text-[12px] font-semibold text-muted">
            {label}
          </div>
        </div>
      </div>
    </div>
  );
}
