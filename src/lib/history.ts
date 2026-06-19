/**
 * Cleanup history — a local log of everything tclean has cleared, so the user can
 * see what happened and how much they've reclaimed over time. Persisted in
 * localStorage; capped to the most recent entries.
 */

export type HistoryKind =
  | "clean"
  | "leftovers"
  | "duplicates"
  | "developer"
  | "large"
  | "uninstall"
  | "trash";

export interface HistoryEntry {
  id: string;
  ts: number; // epoch ms
  kind: HistoryKind;
  label: string;
  bytes: number;
  count: number;
}

const KEY = "tclean-history";
const CAP = 100;

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as HistoryEntry[];
  } catch {
    /* ignore */
  }
  return [];
}

function save(list: HistoryEntry[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

/** Prepend a new entry and persist. Returns the new list. No-op for empty cleans. */
export function recordHistory(
  entry: { kind: HistoryKind; label: string; bytes: number; count: number },
  prev: HistoryEntry[],
): HistoryEntry[] {
  if (entry.bytes <= 0 && entry.count <= 0) return prev;
  const full: HistoryEntry = {
    ...entry,
    id: `${Date.now()}-${Math.round(Date.now() % 100000)}`,
    ts: Date.now(),
  };
  const next = [full, ...prev].slice(0, CAP);
  save(next);
  return next;
}

export function clearHistory(): void {
  save([]);
}

export function totalReclaimed(list: HistoryEntry[]): number {
  return list.reduce((s, e) => s + e.bytes, 0);
}
