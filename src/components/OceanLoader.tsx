import type { CSSProperties } from "react";
import logoUrl from "../assets/logo.svg";

const DOLPHIN: CSSProperties = {
  backgroundColor: "var(--color-accent)",
  WebkitMaskImage: `url(${logoUrl})`,
  maskImage: `url(${logoUrl})`,
  WebkitMaskRepeat: "no-repeat",
  maskRepeat: "no-repeat",
  WebkitMaskPosition: "center",
  maskPosition: "center",
  WebkitMaskSize: "contain",
  maskSize: "contain",
};

// One path per layer (wavy top → base) so surface and body are seamless.
const WATER_H = 54; // px, low waterline
const wavePath = (top: number, amp: number) =>
  `M0 ${top} q10 -${amp} 20 0 ` + "t20 0 ".repeat(13) + ` V${WATER_H} H0 Z`;

const WAVES = [
  { top: 10, amp: 6, op: 0.3, dur: "4.2s", dir: "reverse" },
  { top: 16, amp: 8, op: 0.85, dur: "2.6s", dir: "normal" },
] as const;

const R = 92;
const C = 2 * Math.PI * R;

/**
 * The shared ocean loader: a ring wrapped around a little pool with the dolphin
 * leaping inside (waves drift, dolphin bobs). Pass `progress` (0–1) for a
 * determinate ring (Smart Scan); omit it for an indeterminate spinning ring
 * (every other loading state) — same look, just no exact progress.
 */
export function OceanLoader({
  progress,
  label,
}: {
  progress?: number;
  label?: string;
}) {
  const determinate = progress != null;
  const p = Math.max(0, Math.min(1, progress ?? 0));

  return (
    <div className="animate-fade-in flex flex-col items-center">
      <div className="relative" style={{ width: 200, height: 200 }}>
        {/* ring */}
        {determinate ? (
          <svg viewBox="0 0 200 200" className="absolute inset-0 -rotate-90">
            <circle cx="100" cy="100" r={R} fill="none" stroke="var(--color-line)" strokeWidth="5" />
            <circle
              cx="100"
              cy="100"
              r={R}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - p)}
              className="transition-[stroke-dashoffset] duration-500 ease-[cubic-bezier(0.2,0,0,1)]"
            />
          </svg>
        ) : (
          <svg
            viewBox="0 0 200 200"
            className="absolute inset-0 animate-spin [animation-duration:1.3s]"
          >
            <circle cx="100" cy="100" r={R} fill="none" stroke="var(--color-line)" strokeWidth="5" />
            <circle
              cx="100"
              cy="100"
              r={R}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={`${C * 0.28} ${C}`}
            />
          </svg>
        )}

        {/* inner pool: water + dolphin */}
        <div className="absolute inset-[18px] overflow-hidden rounded-full border border-line bg-inset/40">
          <div
            className="absolute inset-x-0 bottom-0 overflow-hidden"
            style={{ height: WATER_H }}
          >
            {WAVES.map((w, i) => (
              <svg
                key={i}
                aria-hidden="true"
                viewBox={`0 0 280 ${WATER_H}`}
                preserveAspectRatio="none"
                className="wave absolute bottom-0 left-0 w-[280px]"
                style={{
                  height: WATER_H,
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

          <div className="absolute inset-x-0 top-[20%] flex justify-center">
            <div className="dolphin-bob h-16 w-[72px]" style={DOLPHIN} />
          </div>
        </div>
      </div>

      {label && (
        <p className="mt-5 text-[14px] font-medium text-muted">{label}</p>
      )}
    </div>
  );
}
