import { useEffect, useState } from "react";
import { Broom, TrashSimple, Warning } from "@phosphor-icons/react";
import type { CategoryMeta } from "../data/categories";
import { formatBytes, formatCount } from "../lib/format";
import { cn } from "../lib/cn";
import { Button } from "./Button";

export interface CleanItem {
  meta: CategoryMeta;
  size: number;
  count: number;
}

interface ConfirmCleanModalProps {
  open: boolean;
  items: CleanItem[];
  totalBytes: number;
  totalItems: number;
  cleaning: boolean;
  onCancel: () => void;
  onConfirm: (permanent: boolean) => void;
}

export function ConfirmCleanModal({
  open,
  items,
  totalBytes,
  totalItems,
  cleaning,
  onCancel,
  onConfirm,
}: ConfirmCleanModalProps) {
  const [permanent, setPermanent] = useState(false);

  // Reset the choice each time the sheet opens.
  useEffect(() => {
    if (open) setPermanent(false);
  }, [open]);

  // Esc to cancel (unless mid-clean).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !cleaning) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, cleaning, onCancel]);

  if (!open) return null;

  return (
    <div
      className="animate-fade-in fixed inset-0 z-50 grid place-items-center bg-black/40 p-6"
      onClick={() => !cleaning && onCancel()}
    >
      <div
        className="animate-fade-up w-full max-w-md rounded-xl border border-line bg-surface p-6 shadow-soft"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-md bg-accent-surface text-accent">
            <Broom size={20} weight="fill" />
          </div>
          <div>
            <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-ink">
              Clean up {formatBytes(totalBytes)}?
            </h2>
            <p className="text-[12.5px] text-faint">
              {formatCount(totalItems)} items across {items.length} categories
            </p>
          </div>
        </div>

        {/* Summary list */}
        <ul className="mt-5 flex flex-col gap-px overflow-hidden rounded-lg border border-line">
          {items.map(({ meta, size }) => {
            const note =
              meta.id === "trash"
                ? "emptied permanently"
                : meta.id === "downloads"
                  ? "to Trash"
                  : permanent
                    ? "deleted"
                    : "to Trash";
            return (
              <li
                key={meta.id}
                className="flex items-center gap-3 bg-inset/50 px-3.5 py-2.5"
              >
                <meta.Icon size={17} weight="fill" className="shrink-0 text-muted" />
                <span className="flex-1 truncate text-[13.5px] text-ink">
                  {meta.name}
                </span>
                <span className="text-[11px] text-faint">{note}</span>
                <span className="tnum w-16 shrink-0 text-right text-[13px] font-medium text-muted">
                  {formatBytes(size)}
                </span>
              </li>
            );
          })}
        </ul>

        {/* Mode selector */}
        <div className="mt-5">
          <div className="flex gap-1 rounded-[11px] bg-inset p-[3px]">
            <ModeTab
              active={!permanent}
              onClick={() => setPermanent(false)}
              icon={<TrashSimple size={15} weight="fill" />}
              label="Move to Trash"
            />
            <ModeTab
              active={permanent}
              onClick={() => setPermanent(true)}
              icon={<Warning size={15} weight="fill" />}
              label="Delete permanently"
            />
          </div>
          <p className="mt-2.5 px-1 text-[12px] leading-relaxed text-muted">
            {permanent
              ? "Regenerable files are deleted outright. Downloads still go to the Trash, and the Trash is always emptied permanently."
              : "Reversible — items move to the Trash so you can restore them. Empty the Trash to reclaim the space."}
          </p>
        </div>

        {/* Actions */}
        <div className="mt-6 flex justify-end gap-2.5">
          <Button variant="secondary" onClick={onCancel} disabled={cleaning}>
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm(permanent)}
            loading={cleaning}
            className={cn(
              permanent &&
                !cleaning &&
                "bg-caution text-on-accent hover:brightness-[1.06]",
            )}
          >
            {cleaning
              ? "Cleaning…"
              : permanent
                ? "Delete permanently"
                : "Move to Trash"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ModeTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg text-[13px] font-medium transition-colors",
        active
          ? "bg-surface text-accent shadow-tiny"
          : "text-muted hover:text-ink",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
