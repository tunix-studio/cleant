import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "../lib/cn";

export interface SegmentOption {
  value: string;
  label: string;
  count?: number;
  icon?: ReactNode;
}

interface SegmentedProps {
  value: string;
  options: SegmentOption[];
  onChange: (value: string) => void;
  className?: string;
}

/**
 * Segmented control with a sliding pill: the active highlight physically glides
 * (with a soft spring) from one segment to the next. Measured from the live DOM
 * so it stays exact at any width.
 */
export function Segmented({
  value,
  options,
  onChange,
  className,
}: SegmentedProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const track = trackRef.current;
    const el = track?.querySelector<HTMLElement>(`[data-seg="${value}"]`);
    if (el) setPill({ left: el.offsetLeft, width: el.offsetWidth });
  }, [value, options]);

  return (
    <div
      ref={trackRef}
      className={cn(
        "relative flex gap-1 rounded-[13px] bg-inset p-1",
        className,
      )}
    >
      {pill && (
        <div
          aria-hidden
          className="absolute bottom-1 top-1 rounded-[10px] bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.06),0_4px_12px_-6px_rgba(0,0,0,0.18)] transition-[left,width] duration-[320ms] ease-[cubic-bezier(0.34,1.4,0.5,1)]"
          style={{ left: pill.left, width: pill.width }}
        />
      )}
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            data-seg={o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative z-10 flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[10px] px-2 text-[13px] font-medium transition-colors duration-200",
              active ? "text-accent" : "text-muted hover:text-ink",
            )}
          >
            {o.icon}
            <span className="truncate">{o.label}</span>
            {o.count != null && (
              <span
                className={cn(
                  "tnum rounded-full px-1.5 py-px text-[11px] font-semibold transition-colors",
                  active ? "bg-accent/15 text-accent" : "bg-surface text-faint",
                )}
              >
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
