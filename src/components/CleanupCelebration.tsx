import { useEffect, type CSSProperties } from "react";
import logoUrl from "../assets/logo.svg";
import { formatBytes, formatCount } from "../lib/format";
import { Button } from "./Button";

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

const SPARKLES = [
  { top: "12%", left: "22%", delay: "0.2s" },
  { top: "20%", right: "18%", delay: "0.6s" },
  { top: "46%", right: "10%", delay: "1.0s" },
  { bottom: "26%", left: "14%", delay: "0.4s" },
] as const;

/**
 * The "cleanup complete" moment — a dolphin leaps out of an expanding splash
 * with the amount reclaimed. Auto-dismisses; click anywhere to close.
 */
export function CleanupCelebration({
  bytes,
  count,
  onDone,
}: {
  bytes: number;
  count: number;
  onDone: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDone, 3600);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div
      className="animate-fade-in fixed inset-0 z-[60] grid place-items-center bg-canvas/80 backdrop-blur-[3px]"
      onClick={onDone}
      role="button"
      aria-label="Dismiss"
    >
      <div className="celebrate-pop flex flex-col items-center text-center">
        <div className="relative grid size-44 place-items-center">
          {/* splash ripples */}
          {[0, 0.6, 1.2].map((d) => (
            <span
              key={d}
              className="celebrate-ripple absolute size-36 rounded-full border-2 border-accent/50"
              style={{ animationDelay: `${d}s` }}
            />
          ))}
          {/* sparkles */}
          {SPARKLES.map((s, i) => (
            <span
              key={i}
              className="celebrate-sparkle absolute text-accent"
              style={{ ...s, animationDelay: s.delay }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0c.6 3.4 1.6 4.4 5 5-3.4.6-4.4 1.6-5 5-.6-3.4-1.6-4.4-5-5 3.4-.6 4.4-1.6 5-5Z" />
              </svg>
            </span>
          ))}
          {/* dolphin */}
          <div
            aria-hidden="true"
            className="celebrate-dolphin relative h-20 w-24"
            style={DOLPHIN}
          />
        </div>

        <div className="mt-3 text-[12px] font-medium uppercase tracking-[0.08em] text-accent">
          All swept up
        </div>
        <div className="mt-1 text-[30px] font-bold tracking-[-0.02em] text-ink">
          {bytes > 0 ? `Freed ${formatBytes(bytes)}` : "Cleanup complete"}
        </div>
        <div className="mt-1 text-[14px] text-muted">
          {formatCount(count)} {count === 1 ? "item" : "items"} cleared
        </div>

        <Button className="mt-6" variant="secondary" onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  );
}
