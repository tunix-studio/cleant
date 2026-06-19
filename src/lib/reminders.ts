/**
 * Cleanup reminders — a calm, schedulable nudge to run a sweep.
 *
 * Scheduling is in-app (checked on a timer while tclean is running, including
 * menu-bar mode), not an OS launchd job — so reminders fire whenever the app is
 * alive. Settings persist in localStorage; `lastNotified` is stamped each time a
 * reminder fires (or the schedule is changed) so a given occurrence only ever
 * nudges once.
 */

export type ReminderFrequency = "daily" | "weekly" | "monthly";

export interface ReminderSettings {
  enabled: boolean;
  frequency: ReminderFrequency;
  /** 0=Sun … 6=Sat — used for weekly */
  weekday: number;
  /** 1…28 — day of month, used for monthly */
  day: number;
  /** 0…23 — hour of day the reminder is due */
  hour: number;
  /** when due, automatically clear safe caches/logs to the Trash */
  autoClean: boolean;
  /** epoch ms of the last occurrence we already nudged for (0 = never) */
  lastNotified: number;
}

export const DEFAULT_REMINDERS: ReminderSettings = {
  enabled: false,
  frequency: "weekly",
  weekday: 0, // Sunday
  day: 1,
  hour: 10,
  autoClean: false,
  lastNotified: 0,
};

const KEY = "tclean-reminders";
const DAY = 86_400_000;

export const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function loadReminders(): ReminderSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_REMINDERS, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_REMINDERS };
}

export function saveReminders(s: ReminderSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

function atHour(ts: number, hour: number): number {
  const d = new Date(ts);
  d.setHours(hour, 0, 0, 0);
  return d.getTime();
}

/** A monthly occurrence in a given year/month (day clamped to the month length). */
function monthlyAt(year: number, month: number, day: number, hour: number): number {
  const dim = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, dim), hour, 0, 0, 0).getTime();
}

/** The most recent scheduled occurrence at or before `now`. */
export function latestOccurrence(s: ReminderSettings, now: number): number {
  if (s.frequency === "daily") {
    const today = atHour(now, s.hour);
    return today <= now ? today : today - DAY;
  }
  if (s.frequency === "weekly") {
    const diff = (new Date(now).getDay() - s.weekday + 7) % 7;
    let cand = atHour(now - diff * DAY, s.hour);
    if (cand > now) cand -= 7 * DAY; // target weekday is today but the hour hasn't arrived
    return cand;
  }
  const ref = new Date(now);
  let cand = monthlyAt(ref.getFullYear(), ref.getMonth(), s.day, s.hour);
  if (cand > now) cand = monthlyAt(ref.getFullYear(), ref.getMonth() - 1, s.day, s.hour);
  return cand;
}

/** The next upcoming scheduled occurrence strictly after `now`. */
export function nextOccurrence(s: ReminderSettings, now: number): number {
  const latest = latestOccurrence(s, now);
  if (s.frequency === "daily") return latest + DAY;
  if (s.frequency === "weekly") return latest + 7 * DAY;
  const d = new Date(latest);
  return monthlyAt(d.getFullYear(), d.getMonth() + 1, s.day, s.hour);
}

/** Is a reminder due right now (enabled, an occurrence has passed since we last nudged)? */
export function isDue(s: ReminderSettings, now: number): boolean {
  return s.enabled && latestOccurrence(s, now) > s.lastNotified;
}

function hh(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

/** "Every Sunday at 10:00" — the recurring schedule in words. */
export function describeSchedule(s: ReminderSettings): string {
  if (s.frequency === "daily") return `Every day at ${hh(s.hour)}`;
  if (s.frequency === "weekly") return `Every ${WEEKDAYS[s.weekday]} at ${hh(s.hour)}`;
  return `On the ${ordinal(s.day)} of each month at ${hh(s.hour)}`;
}

/** "Sun, Jun 21 · 10:00" — the concrete next fire time. */
export function formatNext(ts: number): string {
  const date = new Date(ts).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const time = new Date(ts).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${date} · ${time}`;
}
