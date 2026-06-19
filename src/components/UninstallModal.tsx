import { useEffect } from "react";
import { AppWindow, CircleNotch, Trash } from "@phosphor-icons/react";
import type { AppBundle } from "../lib/types";
import { formatBytes, formatCount } from "../lib/format";
import { Button } from "./Button";

interface Props {
  open: boolean;
  appName: string;
  appIcon: string | null;
  bundle: AppBundle | null;
  loading: boolean;
  uninstalling: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function UninstallModal({
  open,
  appName,
  appIcon,
  bundle,
  loading,
  uninstalling,
  onClose,
  onConfirm,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !uninstalling) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, uninstalling, onClose]);

  if (!open) return null;

  return (
    <div
      className="animate-fade-in fixed inset-0 z-[60] grid place-items-center bg-black/40 p-6"
      onClick={() => !uninstalling && onClose()}
    >
      <div
        className="animate-fade-up flex max-h-[80vh] w-full max-w-md flex-col rounded-xl border border-line bg-surface p-6 shadow-pop"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center gap-3">
          {appIcon ? (
            <img
              src={appIcon}
              alt=""
              className="size-10 shrink-0 rounded-[9px] object-contain"
            />
          ) : (
            <div className="grid size-10 shrink-0 place-items-center rounded-md bg-accent-surface text-accent">
              <AppWindow size={20} weight="fill" />
            </div>
          )}
          <div className="min-w-0">
            <h2 className="truncate text-[17px] font-semibold tracking-[-0.01em] text-ink">
              Uninstall {appName}?
            </h2>
            <p className="text-[12.5px] text-faint">
              {loading
                ? "Finding associated files…"
                : bundle
                  ? `${formatCount(bundle.files.length)} items · ${formatBytes(bundle.totalSize)}`
                  : ""}
            </p>
          </div>
        </div>

        <div className="mt-5 min-h-[120px] flex-1 overflow-y-auto rounded-lg border border-line">
          {loading || !bundle ? (
            <div className="grid h-[120px] place-items-center">
              <CircleNotch size={24} weight="bold" className="animate-spin text-faint" />
            </div>
          ) : (
            <ul className="flex flex-col">
              {bundle.files.map((f) => (
                <li
                  key={f.fullPath}
                  className="flex items-center gap-3 border-b border-line px-3.5 py-2.5 last:border-b-0"
                >
                  <span className="w-[104px] shrink-0 text-[11px] font-medium uppercase tracking-[0.04em] text-faint">
                    {f.label}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-muted">
                    {f.path}
                  </span>
                  <span className="tnum shrink-0 text-[12.5px] font-medium text-muted">
                    {f.size > 0 ? formatBytes(f.size) : "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="mt-3 text-[12px] leading-relaxed text-muted">
          Everything above moves to the Trash together — you can restore it from
          there if you change your mind.
        </p>

        <div className="mt-5 flex justify-end gap-2.5">
          <Button variant="secondary" onClick={onClose} disabled={uninstalling}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            loading={uninstalling}
            disabled={loading || !bundle}
            icon={<Trash size={16} weight="fill" />}
          >
            {uninstalling
              ? "Removing…"
              : bundle
                ? `Uninstall ${formatBytes(bundle.totalSize)}`
                : "Uninstall"}
          </Button>
        </div>
      </div>
    </div>
  );
}
