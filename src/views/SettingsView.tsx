import { useLayoutEffect, useRef, useState } from "react";
import {
  AppWindow,
  Broom,
  CalendarCheck,
  ClockCounterClockwise,
  Code,
  CopySimple,
  FileMagnifyingGlass,
  FolderSimple,
  Ghost,
  Plus,
  ShieldCheck,
  TrashSimple,
  X,
  type Icon,
} from "@phosphor-icons/react";
import { cn } from "../lib/cn";
import { requestNotifications } from "../lib/api";
import {
  WEEKDAYS,
  describeSchedule,
  formatNext,
  nextOccurrence,
  type ReminderFrequency,
  type ReminderSettings,
} from "../lib/reminders";
import {
  totalReclaimed,
  type HistoryEntry,
  type HistoryKind,
} from "../lib/history";
import {
  loadExclusions,
  normalizeExclusion,
  saveExclusions,
} from "../lib/exclusions";
import { formatAgo, formatBytes, formatCount } from "../lib/format";
import { Segmented } from "../components/Segmented";
import { Logo } from "../components/Logo";

interface SettingsViewProps {
  reminders: ReminderSettings;
  onChangeReminders: (patch: Partial<ReminderSettings>) => void;
  history: HistoryEntry[];
  now: number;
  onClearHistory: () => void;
}

export function SettingsView({
  reminders,
  onChangeReminders,
  history,
  now,
  onClearHistory,
}: SettingsViewProps) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5 px-7 py-7">
      <RemindersGroup reminders={reminders} onChange={onChangeReminders} />

      <HistoryGroup history={history} now={now} onClear={onClearHistory} />

      <ExclusionsGroup />

      <SettingsGroup title="Scanning">
        <ToggleRow
          label="Scan automatically on launch"
          hint="Off by default — you decide when to check your Mac."
        />
        <ToggleRow
          label="Include Downloads"
          hint="Downloads can hold files you still need — off by default."
        />
      </SettingsGroup>

      <SettingsGroup title="Safety">
        <ToggleRow
          label="Always confirm before cleaning"
          hint="Show a summary and require confirmation before anything is removed."
          defaultOn
        />
        <ToggleRow
          label="Move to Trash by default"
          hint="Reversible cleanup — you can still choose permanent deletion per run."
          defaultOn
        />
      </SettingsGroup>

      <div className="animate-fade-up flex items-start gap-3.5 rounded-xl border border-line bg-surface p-5 shadow-tiny">
        <div className="grid size-9 shrink-0 place-items-center rounded-md bg-accent-surface text-accent">
          <ShieldCheck size={18} weight="fill" />
        </div>
        <div>
          <div className="text-[14px] font-medium text-ink">
            Cleanup is reversible by default
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">
            tclean moves items to the Trash unless you opt into permanent
            deletion, only ever touches the known cache &amp; temp locations it
            scanned, and always asks before removing anything. Downloads are only
            ever moved to the Trash.
          </p>
        </div>
      </div>

      <AboutGroup />
    </div>
  );
}

/* ---- About ---- */
const APP_VERSION = "0.1.0";

function AboutGroup() {
  return (
    <section className="animate-fade-up">
      <h3 className="mb-2 px-1 text-[11px] font-medium uppercase tracking-[0.06em] text-faint">
        About
      </h3>
      <div className="flex items-center gap-4 rounded-xl border border-line bg-surface p-5 shadow-tiny">
        <div className="grid size-12 shrink-0 place-items-center rounded-[14px] bg-[#0e2f38] text-[#5eead4] ring-1 ring-white/10">
          <Logo size={26} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[15px] font-semibold text-ink">tclean</span>
            <span className="tnum text-[12px] text-faint">v{APP_VERSION}</span>
          </div>
          <p className="mt-0.5 text-[13px] text-muted">
            A calm, lightweight macOS disk cleaner.
          </p>
          <p className="mt-1.5 text-[12.5px] font-medium text-faint">Tunix Studio</p>
        </div>
      </div>
    </section>
  );
}

/* ---- Cleanup reminders ---- */
function RemindersGroup({
  reminders,
  onChange,
}: {
  reminders: ReminderSettings;
  onChange: (patch: Partial<ReminderSettings>) => void;
}) {
  const { enabled, frequency, weekday, day, hour, autoClean } = reminders;

  // Measure the body so it can animate open/close to its exact height.
  const contentRef = useRef<HTMLDivElement>(null);
  const [bodyH, setBodyH] = useState<number | undefined>(undefined);
  useLayoutEffect(() => {
    if (contentRef.current) setBodyH(contentRef.current.scrollHeight);
  }, [frequency, enabled]);

  const toggle = async (on: boolean) => {
    if (on) await requestNotifications();
    onChange({ enabled: on });
  };

  return (
    <SettingsGroup title="Cleanup reminders">
      <ToggleRow
        label="Remind me to clean up"
        hint="A gentle nudge on your schedule. Reminders fire while tclean is running — keep it in your menu bar so you never miss one."
        checked={enabled}
        onToggle={(v) => void toggle(v)}
        border={enabled}
      />

      {/* Collapsible body — animates open/close to its measured height. */}
      <div
        className="overflow-hidden transition-[max-height,opacity] duration-300 ease-[cubic-bezier(0.2,0,0,1)]"
        style={{ maxHeight: enabled ? bodyH : 0, opacity: enabled ? 1 : 0 }}
      >
        <div ref={contentRef}>
          <div className="border-b border-line px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-[14px] text-ink">How often</div>
              <Segmented
                className="w-[268px]"
                value={frequency}
                onChange={(f) => onChange({ frequency: f as ReminderFrequency })}
                options={[
                  { value: "daily", label: "Daily" },
                  { value: "weekly", label: "Weekly" },
                  { value: "monthly", label: "Monthly" },
                ]}
              />
            </div>

            <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
              {frequency === "weekly" && (
                <Field label="On">
                  <Select
                    value={String(weekday)}
                    onChange={(v) => onChange({ weekday: Number(v) })}
                    options={WEEKDAYS.map((name, i) => ({
                      value: String(i),
                      label: name,
                    }))}
                  />
                </Field>
              )}
              {frequency === "monthly" && (
                <Field label="On the">
                  <Select
                    value={String(day)}
                    onChange={(v) => onChange({ day: Number(v) })}
                    options={Array.from({ length: 28 }, (_, i) => ({
                      value: String(i + 1),
                      label: ordinal(i + 1),
                    }))}
                  />
                </Field>
              )}
              <Field label="At">
                <Select
                  value={String(hour)}
                  onChange={(v) => onChange({ hour: Number(v) })}
                  options={Array.from({ length: 24 }, (_, i) => ({
                    value: String(i),
                    label: `${String(i).padStart(2, "0")}:00`,
                  }))}
                />
              </Field>
            </div>
          </div>

          <ToggleRow
            label="Clean automatically when due"
            hint="Clears safe caches & logs to the Trash for you — reversible, never your own files. Runs while tclean is open."
            checked={autoClean}
            onToggle={(v) => onChange({ autoClean: v })}
          />

          <div className="flex items-center gap-2.5 px-5 py-3.5 text-[12.5px] text-muted">
            <CalendarCheck size={15} weight="fill" className="shrink-0 text-accent" />
            <span>
              {describeSchedule(reminders)}
              {autoClean ? " · auto-clean" : ""} · next on{" "}
              <span className="font-medium text-ink">
                {formatNext(nextOccurrence(reminders, Date.now()))}
              </span>
            </span>
          </div>
        </div>
      </div>
    </SettingsGroup>
  );
}

/* ---- Cleanup history ---- */
const KIND_META: Record<HistoryKind, { Icon: Icon; label: string }> = {
  clean: { Icon: Broom, label: "Junk cleanup" },
  leftovers: { Icon: Ghost, label: "Leftovers" },
  duplicates: { Icon: CopySimple, label: "Duplicates" },
  developer: { Icon: Code, label: "Developer caches" },
  large: { Icon: FileMagnifyingGlass, label: "Large files" },
  uninstall: { Icon: AppWindow, label: "Uninstall" },
  trash: { Icon: TrashSimple, label: "Trash" },
};

function HistoryGroup({
  history,
  now,
  onClear,
}: {
  history: HistoryEntry[];
  now: number;
  onClear: () => void;
}) {
  return (
    <section className="animate-fade-up">
      <div className="mb-2 flex items-center justify-between px-1">
        <h3 className="text-[11px] font-medium uppercase tracking-[0.06em] text-faint">
          Cleanup history
        </h3>
        {history.length > 0 && (
          <button
            onClick={onClear}
            className="text-[11.5px] font-medium text-faint transition-colors hover:text-caution"
          >
            Clear
          </button>
        )}
      </div>
      <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-tiny">
        {history.length === 0 ? (
          <div className="flex items-center gap-3 px-5 py-5 text-[13px] text-faint">
            <ClockCounterClockwise size={18} weight="fill" className="text-muted" />
            Nothing cleaned yet — what you clear will show up here.
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2.5 border-b border-line bg-accent-surface/40 px-5 py-3">
              <ClockCounterClockwise
                size={16}
                weight="fill"
                className="shrink-0 text-accent"
              />
              <span className="text-[13px] text-muted">
                You've reclaimed{" "}
                <span className="font-semibold text-ink">
                  {formatBytes(totalReclaimed(history))}
                </span>{" "}
                with tclean
              </span>
            </div>
            {history.slice(0, 12).map((e) => {
              const meta = KIND_META[e.kind];
              return (
                <div
                  key={e.id}
                  className="flex items-center gap-3 border-b border-line px-5 py-3 last:border-b-0"
                >
                  <div className="grid size-8 shrink-0 place-items-center rounded-md bg-inset text-muted">
                    <meta.Icon size={16} weight="fill" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] text-ink">{e.label}</div>
                    <div className="text-[12px] text-faint">
                      {formatCount(e.count)} items · {formatAgo(e.ts, now)}
                    </div>
                  </div>
                  <span className="tnum shrink-0 text-[13px] font-semibold text-accent">
                    {formatBytes(e.bytes)}
                  </span>
                </div>
              );
            })}
          </>
        )}
      </div>
    </section>
  );
}

/* ---- Exclusion rules ---- */
function ExclusionsGroup() {
  const [list, setList] = useState<string[]>(() => loadExclusions());
  const [input, setInput] = useState("");

  const commit = (next: string[]) => {
    setList(next);
    saveExclusions(next);
  };
  const add = () => {
    const p = normalizeExclusion(input);
    if (!p || list.includes(p)) {
      setInput("");
      return;
    }
    commit([...list, p]);
    setInput("");
  };

  return (
    <section className="animate-fade-up">
      <h3 className="mb-2 px-1 text-[11px] font-medium uppercase tracking-[0.06em] text-faint">
        Excluded from cleanup
      </h3>
      <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-tiny">
        <div className="border-b border-line px-5 py-4">
          <div className="text-[13.5px] text-muted">
            Paths tclean will never touch — across cleanup, leftovers, large files,
            duplicates, developer caches and uninstall.
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
              placeholder="e.g. ~/Downloads/keep-this"
              className="h-9 flex-1 rounded-lg border border-line bg-inset px-3 font-mono text-[12.5px] text-ink outline-none transition-colors placeholder:font-sans placeholder:text-faint focus:border-accent"
            />
            <button
              onClick={add}
              disabled={!input.trim()}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-[13px] font-medium text-on-accent transition-[filter] hover:brightness-[1.08] disabled:opacity-50"
            >
              <Plus size={15} weight="bold" />
              Add
            </button>
          </div>
        </div>

        {list.length === 0 ? (
          <div className="px-5 py-4 text-[12.5px] text-faint">
            No exclusions yet.
          </div>
        ) : (
          list.map((p) => (
            <div
              key={p}
              className="group flex items-center gap-3 border-b border-line px-5 py-2.5 last:border-b-0"
            >
              <FolderSimple size={16} weight="fill" className="shrink-0 text-muted" />
              <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-ink">
                {p}
              </span>
              <button
                onClick={() => commit(list.filter((x) => x !== p))}
                aria-label={`Remove ${p}`}
                className="grid size-6 shrink-0 place-items-center rounded-md text-faint opacity-0 transition-all hover:bg-caution-surface hover:text-caution focus-visible:opacity-100 group-hover:opacity-100"
              >
                <X size={13} weight="bold" />
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-center gap-2 text-[13px] text-muted">
      {label}
      {children}
    </label>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-line bg-inset px-2.5 py-1.5 text-[13px] font-medium text-ink outline-none transition-colors hover:border-accent/40 focus-visible:border-accent"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

function SettingsGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="animate-fade-up">
      <h3 className="mb-2 px-1 text-[11px] font-medium uppercase tracking-[0.06em] text-faint">
        {title}
      </h3>
      <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-tiny">
        {children}
      </div>
    </section>
  );
}

function ToggleRow({
  label,
  hint,
  defaultOn = false,
  disabled = false,
  checked,
  onToggle,
  border = true,
}: {
  label: string;
  hint: string;
  defaultOn?: boolean;
  disabled?: boolean;
  checked?: boolean;
  onToggle?: (value: boolean) => void;
  /** bottom divider; turn off when this row is the last visible thing in its card */
  border?: boolean;
}) {
  const [internal, setInternal] = useState(defaultOn);
  const on = checked ?? internal;
  const toggle = () => {
    const next = !on;
    if (onToggle) onToggle(next);
    else setInternal(next);
  };
  return (
    <div
      className={cn(
        "flex items-center gap-4 px-5 py-4 transition-colors",
        border ? "border-b border-line last:border-b-0" : "",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className={cn("text-[14px] text-ink", disabled && "text-muted")}>
          {label}
        </div>
        <div className="mt-0.5 text-[12.5px] leading-relaxed text-faint">{hint}</div>
      </div>
      <button
        role="switch"
        aria-checked={on}
        disabled={disabled}
        onClick={toggle}
        className={cn(
          "relative h-[24px] w-[42px] shrink-0 rounded-full transition-colors duration-200",
          on ? "bg-accent" : "bg-inset",
          disabled && "opacity-45",
        )}
      >
        <span
          className={cn(
            "absolute top-[3px] size-[18px] rounded-full bg-surface shadow-tiny transition-[left] duration-200 ease-[cubic-bezier(0.2,0,0,1)]",
            on ? "left-[21px]" : "left-[3px]",
          )}
        />
      </button>
    </div>
  );
}
