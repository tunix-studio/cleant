import { Broom, BellRinging, X } from "@phosphor-icons/react";
import type { ReminderFrequency } from "../lib/reminders";
import { Button } from "./Button";

const LABEL: Record<ReminderFrequency, string> = {
  daily: "daily",
  weekly: "weekly",
  monthly: "monthly",
};

/**
 * Slim bar under the title bar shown when a scheduled cleanup reminder is due.
 * Calm, dismissable, with a one-click "Scan now".
 */
export function ReminderBanner({
  frequency,
  onScan,
  onDismiss,
}: {
  frequency: ReminderFrequency;
  onScan: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="animate-fade-up flex items-center gap-3.5 border-b border-line bg-accent-surface px-7 py-3">
      <div className="grid size-9 shrink-0 place-items-center rounded-md bg-surface text-accent">
        <BellRinging size={18} weight="fill" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-medium text-ink">
          Time for your {LABEL[frequency]} cleanup
        </div>
        <div className="text-[12px] text-muted">
          A quick sweep keeps your Mac tidy — review everything before anything is
          removed.
        </div>
      </div>
      <Button
        size="sm"
        icon={<Broom size={15} weight="fill" />}
        onClick={onScan}
      >
        Scan now
      </Button>
      <button
        onClick={onDismiss}
        aria-label="Dismiss reminder"
        className="grid size-7 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-surface hover:text-ink"
      >
        <X size={15} weight="bold" />
      </button>
    </div>
  );
}
