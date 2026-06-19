/**
 * Exclusion rules — paths tclean must never touch. Stored in localStorage and
 * passed to every Rust removal command, which skips anything at/under an
 * excluded path (see cleaner::is_excluded). `~/` is expanded on the Rust side.
 */

const KEY = "tclean-exclusions";

export function loadExclusions(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as string[];
  } catch {
    /* ignore */
  }
  return [];
}

export function saveExclusions(list: string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

/** Normalise a typed path: trim, drop a trailing slash, collapse `$HOME`→`~`. */
export function normalizeExclusion(input: string): string {
  let p = input.trim();
  if (!p) return "";
  p = p.replace(/\/+$/, "");
  return p;
}
