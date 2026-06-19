import {
  Broom,
  CheckCircle,
  ClockCounterClockwise,
  Database,
  FileDashed,
  FolderDashed,
  Ghost,
  GlobeSimple,
  Package,
  Scroll,
  SlidersHorizontal,
  Terminal,
  ArrowSquareOut,
  Check,
  X,
  type Icon,
} from "@phosphor-icons/react";
import type { CleanReport, Leftover } from "../lib/types";
import { formatBytes, formatCount } from "../lib/format";
import { revealInFinder } from "../lib/api";
import { cn } from "../lib/cn";
import { Button } from "../components/Button";
import { SelectionBar } from "../components/SelectionBar";
import { Watermark } from "../components/Watermark";
import { DolphinLoader } from "../components/DolphinLoader";

export type LeftoversPhase = "idle" | "scanning" | "done";

interface LeftoversViewProps {
  phase: LeftoversPhase;
  items: Leftover[];
  selected: Set<string>;
  cleaning: boolean;
  result: CleanReport | null;
  onScan: () => void;
  onToggle: (fullPath: string) => void;
  onToggleAll: (value: boolean) => void;
  onTrashSelected: () => void;
  onDismissResult: () => void;
}

const KIND_ICON: Record<string, Icon> = {
  "App support": Package,
  Cache: Broom,
  Preferences: SlidersHorizontal,
  Container: Package,
  "Saved state": ClockCounterClockwise,
  "Stored data": Database,
  "Web data": GlobeSimple,
  Logs: Scroll,
  Dotfolder: FolderDashed,
};

export function LeftoversView(props: LeftoversViewProps) {
  const { phase, onScan } = props;

  if (phase === "idle") return <FirstRun onScan={onScan} />;
  if (phase === "scanning") return <Scanning />;

  return <Results {...props} />;
}

function FirstRun({ onScan }: { onScan: () => void }) {
  return (
    <div className="relative grid h-full place-items-center overflow-hidden px-7">
      <Watermark />
      <div className="animate-fade-up relative flex max-w-md flex-col items-center text-center">
        <div className="grid size-16 place-items-center rounded-xl bg-accent-surface text-accent">
          <Ghost size={30} weight="fill" />
        </div>
        <h2 className="mt-6 text-[21px] font-semibold tracking-[-0.01em] text-ink">
          Find leftovers from removed apps
        </h2>
        <p className="mt-2.5 text-[14px] leading-relaxed text-muted">
          When you delete an app, support files, caches and preferences often
          stay behind. tclean matches what's on disk against your installed apps
          and surfaces the orphans — plus any dead entries in your shell PATH.
          You review every item; nothing is touched until you say so.
        </p>
        <Button
          className="mt-7"
          icon={<Ghost size={17} weight="fill" />}
          onClick={onScan}
        >
          Scan for leftovers
        </Button>
      </div>
    </div>
  );
}

function Scanning() {
  return (
    <div className="grid h-full place-items-center px-7">
      <DolphinLoader label="Matching files against your installed apps…" />
    </div>
  );
}

function Results({
  items,
  selected,
  cleaning,
  result,
  onToggle,
  onToggleAll,
  onTrashSelected,
  onDismissResult,
}: LeftoversViewProps) {
  const orphans = items.filter((i) => i.removable);
  const pathEntries = items.filter((i) => !i.removable);

  const selectedItems = orphans.filter((o) => selected.has(o.fullPath));
  const selectedSize = selectedItems.reduce((s, o) => s + o.size, 0);
  const allSelected = orphans.length > 0 && selectedItems.length === orphans.length;

  if (orphans.length === 0 && pathEntries.length === 0) {
    return (
      <div className="grid h-full place-items-center px-7">
        <div className="animate-fade-up flex max-w-sm flex-col items-center text-center">
          <div className="grid size-16 place-items-center rounded-xl bg-accent-surface text-accent">
            <CheckCircle size={30} weight="fill" />
          </div>
          <h2 className="mt-6 text-[21px] font-semibold tracking-[-0.01em] text-ink">
            No leftovers found
          </h2>
          <p className="mt-2.5 text-[14px] leading-relaxed text-muted">
            Every support file maps to an app you still have installed, and your
            shell PATH is clean. Nice and tidy.
          </p>
        </div>
      </div>
    );
  }

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
              {formatCount(result.removed)} leftovers removed
              {result.failed > 0 ? ` · ${result.failed} skipped` : ""}
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

      {/* Orphaned app files */}
      {orphans.length > 0 && (
        <>
          <SelectionBar
            title={`Orphaned app files · ${orphans.length}`}
            subtitle="Leftovers move to the Trash — fully reversible."
            allSelected={allSelected}
            onToggleAll={onToggleAll}
            selectedCount={selectedItems.length}
            selectedSize={selectedSize}
            cleaning={cleaning}
            onAction={onTrashSelected}
          />
          <section className="animate-fade-up overflow-hidden rounded-xl border border-line bg-surface shadow-tiny">
            {orphans.map((o) => (
              <OrphanRow
                key={o.fullPath}
                item={o}
                checked={selected.has(o.fullPath)}
                onToggle={() => onToggle(o.fullPath)}
              />
            ))}
          </section>
        </>
      )}

      {/* Dead PATH entries */}
      {pathEntries.length > 0 && (
        <section className="animate-fade-up overflow-hidden rounded-xl border border-line bg-surface shadow-tiny [animation-delay:60ms]">
          <div className="flex items-center gap-2 px-4 py-3 text-[11px] font-medium uppercase tracking-[0.06em] text-faint">
            <Terminal size={13} weight="fill" className="text-accent" />
            Dead PATH entries · {pathEntries.length}
          </div>
          <div className="border-t border-line">
            {pathEntries.map((p) => (
              <div
                key={`${p.source}:${p.fullPath}`}
                className="flex items-center gap-3.5 border-b border-line px-4 py-3 last:border-b-0"
              >
                <Terminal size={18} weight="fill" className="shrink-0 text-faint" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono text-[12.5px] text-ink">
                    {p.path}
                  </div>
                  <div className="text-[12px] text-faint">
                    referenced in <span className="font-mono">~/{p.source}</span>{" "}
                    · folder no longer exists
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="px-4 pb-3 pt-1 text-[11.5px] text-faint">
            These are stale lines in your shell config. tclean won't edit dotfiles
            for you — open the file above to remove them.
          </p>
        </section>
      )}

      <p className="px-1 text-center text-[12px] text-faint">
        Items marked “review” are fuzzy matches — double-check before removing.
      </p>
    </div>
  );
}

function OrphanRow({
  item,
  checked,
  onToggle,
}: {
  item: Leftover;
  checked: boolean;
  onToggle: () => void;
}) {
  const KindIcon = KIND_ICON[item.kind] ?? FileDashed;
  return (
    <div className="group flex items-center gap-3.5 border-b border-line px-4 py-3 last:border-b-0">
      <button
        onClick={onToggle}
        aria-label={checked ? "Deselect" : "Select"}
        className={cn(
          "grid size-[20px] shrink-0 place-items-center rounded-[6px] border transition-all",
          checked
            ? "border-accent bg-accent text-on-accent"
            : "border-line bg-surface hover:border-accent",
        )}
      >
        {checked && <Check size={13} weight="bold" />}
      </button>

      <div
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-md transition-colors",
          checked ? "bg-accent-surface text-accent" : "bg-inset text-muted",
        )}
      >
        <KindIcon size={20} weight="fill" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[14px] font-medium text-ink">
            {item.app}
          </span>
          <span className="rounded-full bg-inset px-1.5 py-px text-[10px] font-medium text-faint">
            {item.kind}
          </span>
          {item.confidence === "medium" && (
            <span className="rounded-full bg-caution-surface px-1.5 py-px text-[10px] font-medium text-caution">
              review
            </span>
          )}
        </div>
        <div className="truncate font-mono text-[12px] text-faint">
          {item.path}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="tnum text-[13px] font-medium text-muted">
          {item.size > 0 ? formatBytes(item.size) : "—"}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            void revealInFinder(item.fullPath);
          }}
          title="Reveal in Finder"
          className="text-faint opacity-0 transition-opacity hover:text-accent group-hover:opacity-100"
        >
          <ArrowSquareOut size={15} weight="bold" />
        </button>
      </div>
    </div>
  );
}
