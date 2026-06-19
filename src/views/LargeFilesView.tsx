import { useState } from "react";
import {
  ArrowSquareOut,
  Check,
  CheckCircle,
  FileMagnifyingGlass,
  FileText,
  FileZip,
  FilmStrip,
  HardDrives,
  Image as ImageIcon,
  MusicNotes,
  TrashSimple,
  type Icon,
} from "@phosphor-icons/react";
import type { BigFile, CleanReport } from "../lib/types";
import { formatBytes, formatCount, formatWhen, shortenPath } from "../lib/format";
import { revealInFinder } from "../lib/api";
import { cn } from "../lib/cn";
import { Button } from "../components/Button";
import { SelectionBar } from "../components/SelectionBar";
import { Segmented } from "../components/Segmented";
import { Watermark } from "../components/Watermark";
import { DolphinLoader } from "../components/DolphinLoader";

export type LargeFilesPhase = "idle" | "scanning" | "done";

const OLD_DAYS = 180;

interface LargeFilesViewProps {
  phase: LargeFilesPhase;
  files: BigFile[];
  selected: Set<string>;
  cleaning: boolean;
  result: CleanReport | null;
  now: number;
  onScan: () => void;
  onToggle: (path: string) => void;
  onToggleAll: (value: boolean) => void;
  onTrashSelected: () => void;
  onDismissResult: () => void;
}

const EXT: { test: RegExp; Icon: Icon }[] = [
  { test: /\.(mp4|mov|m4v|mkv|avi|webm)$/i, Icon: FilmStrip },
  { test: /\.(mp3|wav|flac|m4a|aiff|logicx|aif)$/i, Icon: MusicNotes },
  { test: /\.(jpg|jpeg|png|heic|gif|tiff?|dng|raw|psd|cr2|nef)$/i, Icon: ImageIcon },
  { test: /\.(zip|rar|7z|tar|gz|bz2|xz)$/i, Icon: FileZip },
  { test: /\.(dmg|iso|xip|pkg)$/i, Icon: HardDrives },
];

function kindIcon(name: string): Icon {
  return EXT.find((e) => e.test.test(name))?.Icon ?? FileText;
}

export function LargeFilesView(props: LargeFilesViewProps) {
  const { phase, onScan } = props;
  if (phase === "idle") return <FirstRun onScan={onScan} />;
  if (phase === "scanning")
    return (
      <div className="grid h-full place-items-center px-7">
        <DolphinLoader label="Combing through your files…" />
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
          <FileMagnifyingGlass size={30} weight="fill" />
        </div>
        <h2 className="mt-6 text-[21px] font-semibold tracking-[-0.01em] text-ink">
          Find big &amp; forgotten files
        </h2>
        <p className="mt-2.5 text-[14px] leading-relaxed text-muted">
          tclean looks through Downloads, Documents, Desktop and your media folders
          for large files (50 MB+) and ones you haven't touched in ages — the kind
          that quietly eat your disk. You choose what goes.
        </p>
        <Button
          className="mt-7"
          icon={<FileMagnifyingGlass size={17} weight="fill" />}
          onClick={onScan}
        >
          Find large files
        </Button>
      </div>
    </div>
  );
}

function Result({
  files,
  selected,
  cleaning,
  result,
  now,
  onToggle,
  onToggleAll,
  onTrashSelected,
  onDismissResult,
}: LargeFilesViewProps) {
  const [sort, setSort] = useState("size");

  if (files.length === 0) {
    return (
      <div className="grid h-full place-items-center px-7">
        <div className="animate-fade-up flex max-w-sm flex-col items-center text-center">
          <div className="grid size-16 place-items-center rounded-xl bg-accent-surface text-accent">
            <CheckCircle size={30} weight="fill" />
          </div>
          <h2 className="mt-6 text-[21px] font-semibold tracking-[-0.01em] text-ink">
            No large files
          </h2>
          <p className="mt-2.5 text-[14px] leading-relaxed text-muted">
            Nothing over 50 MB in your content folders. Your disk is travelling
            light.
          </p>
        </div>
      </div>
    );
  }

  const sorted = [...files].sort((a, b) =>
    sort === "age" ? a.modified - b.modified : b.size - a.size,
  );
  const selectedFiles = files.filter((f) => selected.has(f.path));
  const selectedSize = selectedFiles.reduce((s, f) => s + f.size, 0);
  const allSelected = selectedFiles.length === files.length;
  const totalSize = files.reduce((s, f) => s + f.size, 0);

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
              {formatCount(result.removed)} files removed · empty the Trash to
              reclaim the space
            </div>
          </div>
          <button
            onClick={onDismissResult}
            aria-label="Dismiss"
            className="grid size-7 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-surface hover:text-ink"
          >
            <TrashSimple size={15} weight="fill" />
          </button>
        </div>
      )}

      {/* Header / actions — sticky so the trash action stays in reach */}
      <SelectionBar
        title={`${formatCount(files.length)} large files · ${formatBytes(totalSize)}`}
        subtitle="Items move to the Trash — fully reversible."
        allSelected={allSelected}
        onToggleAll={onToggleAll}
        selectedCount={selectedFiles.length}
        selectedSize={selectedSize}
        cleaning={cleaning}
        onAction={onTrashSelected}
        trailing={
          <Segmented
            className="w-[180px]"
            value={sort}
            onChange={setSort}
            options={[
              { value: "size", label: "Largest" },
              { value: "age", label: "Oldest" },
            ]}
          />
        }
      />

      {/* List */}
      <section className="animate-fade-up overflow-hidden rounded-xl border border-line bg-surface shadow-tiny [animation-delay:60ms]">
        {sorted.map((f) => {
            const FileIcon = kindIcon(f.name);
            const checked = selected.has(f.path);
            const ms = f.modified * 1000;
            const old = f.modified > 0 && now - ms > OLD_DAYS * 86_400_000;
            return (
              <div
                key={f.path}
                className="group flex cursor-pointer items-center gap-3.5 border-b border-line px-4 py-3 transition-colors last:border-b-0 hover:bg-inset/60"
                onClick={() => onToggle(f.path)}
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
                <div className="grid size-10 shrink-0 place-items-center rounded-md bg-inset text-muted">
                  <FileIcon size={20} weight="fill" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-medium text-ink">
                    {f.name}
                  </div>
                  <div className="truncate font-mono text-[12px] text-faint">
                    {shortenPath(f.path)}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="tnum text-[14px] font-semibold text-ink">
                    {formatBytes(f.size)}
                  </div>
                  <div
                    className={cn(
                      "tnum text-[11.5px]",
                      old ? "text-caution" : "text-faint",
                    )}
                  >
                    {formatWhen(ms, now)}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    void revealInFinder(f.path);
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
