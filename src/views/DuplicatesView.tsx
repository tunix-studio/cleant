import { useState } from "react";
import {
  ArrowSquareOut,
  CheckCircle,
  CopySimple,
  FileText,
  FileZip,
  FilmStrip,
  HardDrives,
  Image as ImageIcon,
  MusicNotes,
  X,
  type Icon,
} from "@phosphor-icons/react";
import type { CleanReport, DupeGroup } from "../lib/types";
import { formatBytes, formatCount, shortenPath } from "../lib/format";
import { revealInFinder } from "../lib/api";
import { cn } from "../lib/cn";
import { Button } from "../components/Button";
import { SelectionBar } from "../components/SelectionBar";
import { Watermark } from "../components/Watermark";
import { DolphinLoader } from "../components/DolphinLoader";

export type DuplicatesPhase = "idle" | "scanning" | "done";

interface DuplicatesViewProps {
  phase: DuplicatesPhase;
  groups: DupeGroup[];
  cleaning: boolean;
  result: CleanReport | null;
  onScan: () => void;
  onTrash: (paths: string[]) => void;
  onDismissResult: () => void;
}

const EXT: { test: RegExp; Icon: Icon }[] = [
  { test: /\.(mp4|mov|m4v|mkv|avi|webm)$/i, Icon: FilmStrip },
  { test: /\.(mp3|wav|flac|m4a|aiff|aif)$/i, Icon: MusicNotes },
  { test: /\.(jpg|jpeg|png|heic|gif|tiff?|dng|raw|psd|cr2|nef)$/i, Icon: ImageIcon },
  { test: /\.(zip|rar|7z|tar|gz|bz2|xz)$/i, Icon: FileZip },
  { test: /\.(dmg|iso|xip|pkg)$/i, Icon: HardDrives },
];
const kindIcon = (name: string): Icon =>
  EXT.find((e) => e.test.test(name))?.Icon ?? FileText;

export function DuplicatesView(props: DuplicatesViewProps) {
  const { phase, onScan } = props;
  if (phase === "idle") return <FirstRun onScan={onScan} />;
  if (phase === "scanning")
    return (
      <div className="grid h-full place-items-center px-7">
        <DolphinLoader label="Matching files by content…" />
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
          <CopySimple size={30} weight="fill" />
        </div>
        <h2 className="mt-6 text-[21px] font-semibold tracking-[-0.01em] text-ink">
          Find duplicate files
        </h2>
        <p className="mt-2.5 text-[14px] leading-relaxed text-muted">
          tclean compares files by their actual content (not just name) across your
          content folders and groups exact copies. Keep one of each — the rest move
          to the Trash.
        </p>
        <Button
          className="mt-7"
          icon={<CopySimple size={17} weight="fill" />}
          onClick={onScan}
        >
          Find duplicates
        </Button>
      </div>
    </div>
  );
}

function Result({
  groups,
  cleaning,
  result,
  onTrash,
  onDismissResult,
}: DuplicatesViewProps) {
  // Which file to KEEP per group (default: the first). The rest get trashed.
  const [keep, setKeep] = useState<Record<string, string>>({});
  const keptFor = (g: DupeGroup) => {
    const k = keep[g.id];
    return k && g.files.some((f) => f.path === k) ? k : g.files[0].path;
  };

  if (groups.length === 0) {
    return (
      <div className="grid h-full place-items-center px-7">
        <div className="animate-fade-up flex max-w-sm flex-col items-center text-center">
          <div className="grid size-16 place-items-center rounded-xl bg-accent-surface text-accent">
            <CheckCircle size={30} weight="fill" />
          </div>
          <h2 className="mt-6 text-[21px] font-semibold tracking-[-0.01em] text-ink">
            No duplicates found
          </h2>
          <p className="mt-2.5 text-[14px] leading-relaxed text-muted">
            Every file in your content folders is one of a kind. Nicely sorted.
          </p>
        </div>
      </div>
    );
  }

  const trashList = groups.flatMap((g) =>
    g.files.filter((f) => f.path !== keptFor(g)).map((f) => f.path),
  );
  const reclaimable = groups.reduce(
    (s, g) => s + g.size * (g.files.length - 1),
    0,
  );

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
              {formatCount(result.removed)} duplicate files removed
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
        title={`${formatCount(groups.length)} duplicate ${
          groups.length === 1 ? "set" : "sets"
        } · ${formatBytes(reclaimable)} reclaimable`}
        subtitle="One copy is kept in each set — the rest move to the Trash (reversible)."
        selectedCount={trashList.length}
        selectedSize={reclaimable}
        cleaning={cleaning}
        onAction={() => onTrash(trashList)}
      />

      {groups.map((g) => {
        const kept = keptFor(g);
        const GroupIcon = kindIcon(g.files[0].name);
        return (
          <section
            key={g.id}
            className="animate-fade-up overflow-hidden rounded-xl border border-line bg-surface shadow-tiny"
          >
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="grid size-9 shrink-0 place-items-center rounded-md bg-inset text-muted">
                <GroupIcon size={18} weight="fill" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-medium text-ink">
                  {g.files[0].name}
                </div>
                <div className="text-[12px] text-faint">
                  {formatBytes(g.size)} each · {g.files.length} copies
                </div>
              </div>
              <div className="shrink-0 text-right text-[12px] text-accent">
                frees {formatBytes(g.size * (g.files.length - 1))}
              </div>
            </div>

            <div className="border-t border-line">
              {g.files.map((f) => {
                const isKeep = f.path === kept;
                return (
                  <label
                    key={f.path}
                    className="group/r flex cursor-pointer items-center gap-3 border-b border-line px-4 py-2.5 transition-colors last:border-b-0 hover:bg-inset/50"
                  >
                    <input
                      type="radio"
                      name={`dup-${g.id}`}
                      checked={isKeep}
                      onChange={() =>
                        setKeep((prev) => ({ ...prev, [g.id]: f.path }))
                      }
                      className="sr-only"
                    />
                    <span
                      className={cn(
                        "grid size-[18px] shrink-0 place-items-center rounded-full border transition-all",
                        isKeep ? "border-accent" : "border-line",
                      )}
                    >
                      {isKeep && (
                        <span className="size-[10px] rounded-full bg-accent" />
                      )}
                    </span>
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate font-mono text-[12.5px]",
                        isKeep ? "text-ink" : "text-muted",
                      )}
                    >
                      {shortenPath(f.path)}
                    </span>
                    {isKeep ? (
                      <span className="shrink-0 rounded-full bg-accent-surface px-2 py-px text-[10.5px] font-medium uppercase tracking-[0.04em] text-accent">
                        Keep
                      </span>
                    ) : (
                      <span className="shrink-0 text-[11.5px] text-faint">
                        → Trash
                      </span>
                    )}
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void revealInFinder(f.path);
                      }}
                      title="Reveal in Finder"
                      className="shrink-0 text-faint opacity-0 transition-opacity hover:text-accent group-hover/r:opacity-100"
                    >
                      <ArrowSquareOut size={15} weight="bold" />
                    </button>
                  </label>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
