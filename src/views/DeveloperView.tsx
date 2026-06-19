import {
  ArrowSquareOut,
  Check,
  CheckCircle,
  Code,
  X,
} from "@phosphor-icons/react";
import type { CleanReport, DevTarget } from "../lib/types";
import { formatBytes } from "../lib/format";
import { revealInFinder } from "../lib/api";
import { cn } from "../lib/cn";
import { Button } from "../components/Button";
import { SelectionBar } from "../components/SelectionBar";
import { Watermark } from "../components/Watermark";
import { DolphinLoader } from "../components/DolphinLoader";

export type DeveloperPhase = "idle" | "scanning" | "done";

interface DeveloperViewProps {
  phase: DeveloperPhase;
  targets: DevTarget[];
  selected: Set<string>;
  cleaning: boolean;
  result: CleanReport | null;
  onScan: () => void;
  onToggle: (path: string) => void;
  onToggleAll: (value: boolean) => void;
  onTrashSelected: () => void;
  onDismissResult: () => void;
}

export function DeveloperView(props: DeveloperViewProps) {
  const { phase, onScan } = props;
  if (phase === "idle") return <FirstRun onScan={onScan} />;
  if (phase === "scanning")
    return (
      <div className="grid h-full place-items-center px-7">
        <DolphinLoader label="Measuring developer caches…" />
      </div>
    );
  return <Result {...props} />;
}

function FirstRun({ onScan }: { onScan: () => void }) {
  return (
    <div className="relative grid h-full place-items-center overflow-hidden px-7">
      <Watermark />
      <div className="animate-fade-up relative flex max-w-md flex-col items-center text-center">
        <div className="grid size-16 place-items-center rounded-xl bg-accent-surface text-accent">
          <Code size={30} weight="fill" />
        </div>
        <h2 className="mt-6 text-[21px] font-semibold tracking-[-0.01em] text-ink">
          Reclaim developer junk
        </h2>
        <p className="mt-2.5 text-[14px] leading-relaxed text-muted">
          Xcode DerivedData &amp; DeviceSupport, simulators, and npm / Gradle /
          CocoaPods / Homebrew caches pile up fast. tclean measures each so you can
          clear what regenerates on its own.
        </p>
        <Button
          className="mt-7"
          icon={<Code size={17} weight="fill" />}
          onClick={onScan}
        >
          Scan developer caches
        </Button>
      </div>
    </div>
  );
}

function Result({
  targets,
  selected,
  cleaning,
  result,
  onToggle,
  onToggleAll,
  onTrashSelected,
  onDismissResult,
}: DeveloperViewProps) {
  if (targets.length === 0) {
    return (
      <div className="grid h-full place-items-center px-7">
        <div className="animate-fade-up flex max-w-sm flex-col items-center text-center">
          <div className="grid size-16 place-items-center rounded-xl bg-accent-surface text-accent">
            <CheckCircle size={30} weight="fill" />
          </div>
          <h2 className="mt-6 text-[21px] font-semibold tracking-[-0.01em] text-ink">
            No developer junk
          </h2>
          <p className="mt-2.5 text-[14px] leading-relaxed text-muted">
            None of the known dev cache locations have anything to clear.
          </p>
        </div>
      </div>
    );
  }

  const total = targets.reduce((s, t) => s + t.size, 0);
  const selectedTargets = targets.filter((t) => selected.has(t.path));
  const selectedSize = selectedTargets.reduce((s, t) => s + t.size, 0);
  const allSelected = selectedTargets.length === targets.length;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-7 py-7">
      {result && (
        <div className="animate-fade-up flex items-center gap-3.5 rounded-xl bg-accent-surface px-5 py-4">
          <CheckCircle size={22} weight="fill" className="shrink-0 text-accent" />
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-medium text-ink">
              Moved {formatBytes(result.bytes)} to the Trash
            </div>
            <div className="text-[12.5px] text-muted">
              {result.removed} caches cleared — they rebuild as you work
            </div>
          </div>
          <button
            onClick={onDismissResult}
            aria-label="Dismiss"
            className="grid size-7 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-surface hover:text-ink"
          >
            <X size={15} weight="bold" />
          </button>
        </div>
      )}

      <SelectionBar
        title={`${targets.length} cache locations · ${formatBytes(total)}`}
        subtitle="Everything moves to the Trash — caches rebuild automatically."
        allSelected={allSelected}
        onToggleAll={onToggleAll}
        selectedCount={selectedTargets.length}
        selectedSize={selectedSize}
        cleaning={cleaning}
        onAction={onTrashSelected}
      />

      <section className="animate-fade-up overflow-hidden rounded-xl border border-line bg-surface shadow-tiny [animation-delay:60ms]">
        {targets.map((t) => {
          const checked = selected.has(t.path);
          return (
            <div
              key={t.path}
              className="group flex cursor-pointer items-center gap-3.5 border-b border-line px-4 py-3 transition-colors last:border-b-0 hover:bg-inset/60"
              onClick={() => onToggle(t.path)}
            >
              <span
                className={cn(
                  "grid size-[20px] shrink-0 place-items-center rounded-[6px] border transition-all",
                  checked
                    ? "border-accent bg-accent text-on-accent"
                    : "border-line bg-surface group-hover:border-accent",
                )}
              >
                {checked && <Check size={13} weight="bold" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[14px] font-medium text-ink">
                    {t.label}
                  </span>
                  {t.caution && (
                    <span className="rounded-full bg-caution-surface px-1.5 py-px text-[10px] font-medium uppercase tracking-[0.04em] text-caution">
                      review
                    </span>
                  )}
                </div>
                <div className="truncate text-[12.5px] text-faint">{t.hint}</div>
              </div>
              <div className="tnum shrink-0 text-[14px] font-semibold text-ink">
                {formatBytes(t.size)}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  void revealInFinder(t.path);
                }}
                title="Reveal in Finder"
                className="shrink-0 text-faint opacity-0 transition-opacity hover:text-accent focus-visible:opacity-100 group-hover:opacity-100"
              >
                <ArrowSquareOut size={16} weight="bold" />
              </button>
            </div>
          );
        })}
      </section>
    </div>
  );
}
