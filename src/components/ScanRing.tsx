import { splitBytes } from "../lib/format";
import { useCountUp } from "../lib/useCountUp";

interface ScanRingProps {
  /** the big number in the center, in bytes */
  bytes: number;
  /** 0..1 — how much of the ring is filled */
  fraction: number;
  /** caption under the number */
  label: string;
}

const SIZE = 200;
const STROKE = 12;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

export function ScanRing({ bytes, fraction, label }: ScanRingProps) {
  const animated = useCountUp(bytes);
  const { value, unit } = splitBytes(animated);
  const clamped = Math.max(0, Math.min(fraction, 1));

  return (
    <div
      className="relative grid shrink-0 place-items-center"
      style={{ width: SIZE, height: SIZE }}
    >
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke="var(--inset)"
          strokeWidth={STROKE}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - clamped)}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          style={{ transition: "stroke-dashoffset 500ms var(--ease-quiet)" }}
        />
      </svg>

      <div className="absolute inset-0 grid place-content-center text-center">
        <div className="flex items-baseline justify-center gap-1">
          <span className="tnum text-[42px] font-semibold leading-none tracking-[-0.03em] text-ink">
            {value}
          </span>
          <span className="text-[17px] font-medium text-muted">{unit}</span>
        </div>
        <div className="mt-2 text-[12px] text-faint">{label}</div>
      </div>
    </div>
  );
}
