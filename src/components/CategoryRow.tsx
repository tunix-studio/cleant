import { useState } from "react";
import {
  ArrowSquareOut,
  CaretRight,
  Check,
  FolderOpen,
  LockSimple,
} from "@phosphor-icons/react";
import type { CategoryMeta } from "../data/categories";
import type { CategoryState } from "../lib/types";
import { formatBytes, formatCount, shortenPath } from "../lib/format";
import { openPath, revealInFinder } from "../lib/api";
import { cn } from "../lib/cn";

interface Props {
  meta: CategoryMeta;
  state: CategoryState;
  live?: { files: number; bytes: number };
  onToggle: () => void;
}

export function CategoryRow({ meta, state, live, onToggle }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { Icon } = meta;
  const { status, result, selected } = state;

  const size = result?.size ?? 0;
  const samples = result?.samples ?? [];
  const roots = result?.roots ?? [];

  const isQueued = status === "idle";
  const isScanning = status === "scanning";
  const isEmpty = status === "empty";
  const isBlocked = status === "blocked";
  const canSelect = status === "done" && size > 0;
  // Expandable whenever we know where it lives — even if there's nothing to
  // clean — so the location can always be opened in Finder.
  const canExpand = roots.length > 0 || samples.length > 0;

  return (
    <div className="border-b border-line last:border-b-0">
      <div
        className={cn(
          "group flex items-center gap-3.5 px-4 py-3 transition-colors",
          canExpand && "cursor-pointer hover:bg-inset/60",
        )}
        onClick={() => canExpand && setExpanded((e) => !e)}
      >
        {/* Checkbox */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (canSelect) onToggle();
          }}
          disabled={!canSelect}
          aria-label={selected ? "Deselect" : "Select"}
          className={cn(
            "grid size-[20px] shrink-0 place-items-center rounded-[6px] border transition-all duration-150",
            selected && canSelect
              ? "border-accent bg-accent text-on-accent"
              : "border-line bg-surface",
            canSelect ? "hover:border-accent" : "opacity-40",
          )}
        >
          {selected && canSelect && <Check size={13} weight="bold" />}
        </button>

        {/* Icon tile */}
        <div
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-md transition-colors duration-200",
            selected && canSelect
              ? "bg-accent-surface text-accent"
              : "bg-inset text-muted",
          )}
        >
          <Icon size={20} weight="fill" />
        </div>

        {/* Name + description */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[15px] font-medium text-ink">
              {meta.name}
            </span>
            {meta.safety === "review" && (
              <span className="rounded-full bg-caution-surface px-1.5 py-px text-[10px] font-medium uppercase tracking-[0.04em] text-caution">
                review
              </span>
            )}
          </div>
          <div className="truncate text-[13px] text-faint">
            {isBlocked
              ? "Permission needed to read this folder"
              : meta.description}
          </div>
        </div>

        {/* Right: size / status */}
        <div className="flex items-center gap-3">
          {isQueued ? (
            <span className="text-[12.5px] text-faint">Queued</span>
          ) : isScanning ? (
            <span className="tnum flex items-center gap-2 text-[12.5px] text-muted">
              <span className="size-1.5 animate-breathe rounded-full bg-accent" />
              {live && live.files > 0
                ? `${formatCount(live.files)} items · ${formatBytes(live.bytes)}`
                : "Scanning"}
            </span>
          ) : isBlocked ? (
            <span className="flex items-center gap-1.5 text-[12.5px] text-faint">
              <LockSimple size={14} weight="fill" /> Locked
            </span>
          ) : isEmpty || size === 0 ? (
            <span className="text-[12.5px] text-faint">Nothing to clean</span>
          ) : (
            <div className="animate-fade-in text-right">
              <div className="tnum text-[14.5px] font-semibold text-ink">
                {formatBytes(size)}
              </div>
              <div className="tnum text-[11px] text-faint">
                {formatCount(result?.fileCount ?? 0)} items
              </div>
            </div>
          )}

          <CaretRight
            size={14}
            weight="bold"
            className={cn(
              "text-faint transition-transform duration-200",
              canExpand ? "opacity-100" : "opacity-0",
              expanded && "rotate-90",
            )}
          />
        </div>
      </div>

      {/* Expanded details */}
      {expanded && canExpand && (
        <div className="animate-fade-up flex flex-col gap-3 bg-inset/50 px-4 pb-3.5 pl-[68px] pt-1">
          {/* Location(s) — open the folder in Finder */}
          {roots.length > 0 && (
            <div>
              <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-faint">
                {roots.length > 1 ? "Locations" : "Location"}
              </div>
              <ul className="flex flex-col gap-0.5">
                {roots.map((root) => (
                  <li key={root}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        void openPath(root);
                      }}
                      title="Open in Finder"
                      className="group/r flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-surface"
                    >
                      <FolderOpen
                        size={15}
                        weight="fill"
                        className="shrink-0 text-faint transition-colors group-hover/r:text-accent"
                      />
                      <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-muted">
                        {shortenPath(root)}
                      </span>
                      <span className="shrink-0 text-[11.5px] font-medium text-faint opacity-0 transition-opacity group-hover/r:opacity-100 group-hover/r:text-accent">
                        Open
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Largest items */}
          {samples.length > 0 && (
            <div>
              <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-faint">
                Largest items
              </div>
              <ul className="flex flex-col gap-0.5">
                {samples.map((s) => (
                  <li
                    key={s.path}
                    className="group/s flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-surface"
                  >
                    <span className="min-w-0 flex-1 truncate text-[13px] text-muted">
                      {s.name}
                    </span>
                    <span className="tnum shrink-0 text-[12px] text-faint">
                      {formatBytes(s.size)}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        void revealInFinder(s.path);
                      }}
                      title="Reveal in Finder"
                      className="shrink-0 text-faint opacity-0 transition-opacity hover:text-accent group-hover/s:opacity-100"
                    >
                      <ArrowSquareOut size={15} weight="bold" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
