import {
  Broom,
  CheckCircle,
  MagnifyingGlass,
  Sparkle,
  TrashSimple,
  X,
} from "@phosphor-icons/react";
import { CATEGORIES } from "../data/categories";
import type { CategoryId, CategoryState, CleanReport } from "../lib/types";
import { formatBytes, formatCount } from "../lib/format";
import { ScanRing } from "../components/ScanRing";
import { CategoryRow } from "../components/CategoryRow";
import { Button } from "../components/Button";
import { Watermark } from "../components/Watermark";
import { DolphinLoader } from "../components/DolphinLoader";

export type Phase = "idle" | "scanning" | "done";

export type CleanOutcome = CleanReport & { permanent: boolean };

interface CleanViewProps {
  phase: Phase;
  states: Record<CategoryId, CategoryState>;
  scanning: boolean;
  reclaimable: number;
  totalFound: number;
  itemsFound: number;
  selectedCount: number;
  allSelected: boolean;
  progress: { done: number; total: number; currentLabel: string | null };
  live: Record<CategoryId, { files: number; bytes: number }>;
  scannedBytes: number;
  scannedItems: number;
  cleanResult: CleanOutcome | null;
  emptyingTrash: boolean;
  onScan: () => void;
  onToggle: (id: CategoryId) => void;
  onSelectAll: (value: boolean) => void;
  onRequestClean: () => void;
  onDismissResult: () => void;
  onEmptyTrash: () => void;
}

export function CleanView(props: CleanViewProps) {
  if (props.phase === "idle" && !props.cleanResult)
    return <FirstRun onScan={props.onScan} />;
  return <Results {...props} />;
}

/* ---- First run / empty state ---- */
function FirstRun({ onScan }: { onScan: () => void }) {
  return (
    <div className="relative grid h-full place-items-center overflow-hidden px-7">
      <Watermark />
      <div className="animate-fade-up relative flex max-w-sm flex-col items-center text-center">
        <div className="grid size-16 place-items-center rounded-xl bg-accent-surface text-accent">
          <MagnifyingGlass size={30} weight="fill" />
        </div>
        <h2 className="mt-6 text-[21px] font-semibold tracking-[-0.01em] text-ink">
          Check your Mac for clutter
        </h2>
        <p className="mt-2.5 text-[14px] leading-relaxed text-muted">
          tclean inspects caches, logs, developer junk and more. You review
          everything and choose what to clear — nothing is removed without your
          go-ahead.
        </p>
        <Button
          className="mt-7"
          icon={<Broom size={17} weight="fill" />}
          onClick={onScan}
        >
          Scan my Mac
        </Button>
        <p className="mt-4 text-[12px] text-faint">
          Takes a few seconds · runs entirely on your device
        </p>
      </div>
    </div>
  );
}

/* ---- Scanning / done ---- */
function Results({
  phase,
  states,
  reclaimable,
  totalFound,
  itemsFound,
  selectedCount,
  allSelected,
  progress,
  live,
  scannedBytes,
  scannedItems,
  cleanResult,
  emptyingTrash,
  onToggle,
  onSelectAll,
  onRequestClean,
  onDismissResult,
  onEmptyTrash,
}: CleanViewProps) {
  const pct = Math.round((progress.done / progress.total) * 100);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-7 py-7">
      {cleanResult && (
        <ResultBanner
          result={cleanResult}
          emptyingTrash={emptyingTrash}
          onDismiss={onDismissResult}
          onEmptyTrash={onEmptyTrash}
        />
      )}

      {/* Hero */}
      <section className="animate-fade-up rounded-xl border border-line bg-surface p-7 shadow-soft">
        {phase === "scanning" ? (
          <div className="flex flex-col items-center text-center">
            <DolphinLoader />
            <h2 className="mt-1 text-[21px] font-semibold tracking-[-0.01em] text-ink">
              Scanning your Mac…
            </h2>
            <p className="mt-1.5 text-[14px] text-muted">
              {progress.currentLabel
                ? `Checking ${progress.currentLabel}`
                : "Preparing…"}
            </p>
            <div className="mt-5 flex w-full max-w-[280px] items-center gap-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-inset">
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-300 ease-[cubic-bezier(0.2,0,0,1)]"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="tnum text-[12.5px] font-medium text-muted">
                {progress.done}/{progress.total}
              </span>
            </div>
            <p className="tnum mt-2.5 text-[12.5px] text-faint">
              {formatCount(scannedItems)} items · {formatBytes(scannedBytes)}{" "}
              scanned
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-8 sm:flex-row sm:gap-10">
            <ScanRing
              bytes={reclaimable}
              fraction={totalFound > 0 ? reclaimable / totalFound : 0}
              label="selected to clean"
            />

            <div className="flex-1 text-center sm:text-left">
              <h2 className="text-[21px] font-semibold tracking-[-0.01em] text-ink">
                {totalFound > 0
                  ? "Ready to free up space"
                  : "Your Mac looks tidy"}
              </h2>
              <p className="mt-1.5 max-w-sm text-[14px] leading-relaxed text-muted">
                {totalFound > 0 ? (
                  <>
                    Found{" "}
                    <span className="font-medium text-ink">
                      {formatBytes(totalFound)}
                    </span>{" "}
                    across {formatCount(itemsFound)} items. Review what's
                    selected, then clear it out.
                  </>
                ) : (
                  "Nothing worth cleaning right now. Check back another time."
                )}
              </p>

              {totalFound > 0 && (
                <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5 sm:justify-start">
                  <Button
                    icon={<Broom size={17} weight="fill" />}
                    onClick={onRequestClean}
                    disabled={reclaimable === 0}
                  >
                    Clean Up{reclaimable > 0 ? ` ${formatBytes(reclaimable)}` : ""}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => onSelectAll(!allSelected)}
                  >
                    {allSelected ? "Deselect all" : "Select all"}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Category list */}
      <section className="animate-fade-up overflow-hidden rounded-xl border border-line bg-surface shadow-tiny [animation-delay:60ms]">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.06em] text-faint">
            <Sparkle size={13} weight="fill" className="text-accent" />
            Categories
          </div>
          <span className="tnum text-[12px] text-faint">
            {selectedCount} selected
          </span>
        </div>
        <div className="border-t border-line">
          {CATEGORIES.map((meta) => (
            <CategoryRow
              key={meta.id}
              meta={meta}
              state={states[meta.id]}
              live={live[meta.id]}
              onToggle={() => onToggle(meta.id)}
            />
          ))}
        </div>
      </section>

      <p className="px-1 text-center text-[12px] text-faint">
        Cleanup moves items to the Trash by default — fully reversible. Permanent
        deletion is opt-in per run.
      </p>
    </div>
  );
}

/* ---- Result banner after a cleanup ---- */
function ResultBanner({
  result,
  emptyingTrash,
  onDismiss,
  onEmptyTrash,
}: {
  result: CleanOutcome;
  emptyingTrash: boolean;
  onDismiss: () => void;
  onEmptyTrash: () => void;
}) {
  const { bytes, removed, failed, permanent } = result;
  return (
    <div className="animate-fade-up flex items-center gap-3.5 rounded-xl bg-accent-surface px-5 py-4">
      <CheckCircle size={22} weight="fill" className="shrink-0 text-accent" />
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-medium text-ink">
          {permanent
            ? `Freed ${formatBytes(bytes)}`
            : `Moved ${formatBytes(bytes)} to the Trash`}
        </div>
        <div className="text-[12.5px] text-muted">
          {formatCount(removed)} items removed
          {failed > 0 ? ` · ${formatCount(failed)} skipped` : ""}
          {!permanent && " · empty the Trash to reclaim the space"}
        </div>
      </div>
      {!permanent && bytes > 0 && (
        <Button
          size="sm"
          variant="secondary"
          icon={<TrashSimple size={15} weight="fill" />}
          loading={emptyingTrash}
          onClick={onEmptyTrash}
        >
          Empty Trash
        </Button>
      )}
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="grid size-7 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-surface hover:text-ink"
      >
        <X size={15} weight="bold" />
      </button>
    </div>
  );
}
