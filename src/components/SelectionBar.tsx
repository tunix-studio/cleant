import type { ReactNode } from "react";
import { Check, TrashSimple } from "@phosphor-icons/react";
import { formatBytes } from "../lib/format";
import { cn } from "../lib/cn";
import { Button } from "./Button";

interface SelectionBarProps {
  /** Primary summary line, e.g. "128 large files · 4.2 GB". */
  title: ReactNode;
  /** Faint secondary line under the title. */
  subtitle?: ReactNode;
  /** How many items are currently selected; the action appears when > 0. */
  selectedCount: number;
  /** Total bytes of the current selection, shown next to the action. */
  selectedSize?: number;
  /** When provided, renders a select-all checkbox on the left. */
  allSelected?: boolean;
  onToggleAll?: (value: boolean) => void;
  /** Action button label (default "Move to Trash"). */
  actionLabel?: string;
  cleaning?: boolean;
  onAction: () => void;
  /** Extra controls placed before the action (e.g. a sort segmented control). */
  trailing?: ReactNode;
  className?: string;
}

/**
 * A sticky toolbar that pins to the top of the scroll area, keeping the
 * selection summary and the Move-to-Trash action visible no matter how far
 * the list is scrolled. Shared by every "scan → review → trash" screen so
 * they all behave the same way.
 */
export function SelectionBar({
  title,
  subtitle,
  selectedCount,
  selectedSize,
  allSelected,
  onToggleAll,
  actionLabel = "Move to Trash",
  cleaning,
  onAction,
  trailing,
  className,
}: SelectionBarProps) {
  const hasSelection = selectedCount > 0;
  return (
    <div
      className={cn(
        "animate-fade-up sticky top-0 z-20 flex flex-wrap items-center gap-x-3 gap-y-2.5 rounded-xl border border-line bg-surface/85 p-3 pl-3.5 shadow-soft backdrop-blur-md",
        className,
      )}
    >
      {onToggleAll && (
        <button
          onClick={() => onToggleAll(!allSelected)}
          aria-label={allSelected ? "Deselect all" : "Select all"}
          className={cn(
            "grid size-[20px] shrink-0 place-items-center rounded-[6px] border transition-all",
            allSelected
              ? "border-accent bg-accent text-on-accent"
              : "border-line bg-surface hover:border-accent",
          )}
        >
          {allSelected && <Check size={13} weight="bold" />}
        </button>
      )}

      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-medium text-ink">{title}</div>
        {subtitle && (
          <div className="truncate text-[12.5px] text-faint">{subtitle}</div>
        )}
      </div>

      {trailing}

      {hasSelection && (
        <div className="flex shrink-0 items-center gap-3.5">
          <span className="tnum text-[13px] text-muted">
            <span className="font-medium text-ink">{selectedCount} selected</span>
            {selectedSize != null ? ` · ${formatBytes(selectedSize)}` : ""}
          </span>
          <Button
            size="sm"
            icon={<TrashSimple size={15} weight="fill" />}
            loading={cleaning}
            onClick={onAction}
          >
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
