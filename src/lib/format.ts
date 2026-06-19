const UNITS = ["B", "KB", "MB", "GB", "TB", "PB"];

/** Human-readable size, e.g. 1.4 GB. Bytes (< 1 KB) show no decimals. */
export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes < 1) return "0 B";
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    UNITS.length - 1,
  );
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : decimals)} ${UNITS[i]}`;
}

/** Split a size into its number and unit, for large display (ring center). */
export function splitBytes(bytes: number): { value: string; unit: string } {
  if (!bytes || bytes < 1) return { value: "0", unit: "B" };
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    UNITS.length - 1,
  );
  const value = bytes / Math.pow(1024, i);
  const decimals = i >= 3 ? 1 : value >= 100 ? 0 : 1;
  return { value: value.toFixed(i === 0 ? 0 : decimals), unit: UNITS[i] };
}

/** Thousands-separated integer, e.g. 12,480. */
export function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}

/** Coarse "how long ago" for file dates: today / Nd / Nmo / Ny ago. */
export function formatWhen(timestampMs: number, now: number): string {
  if (!timestampMs) return "unknown";
  const days = Math.floor((now - timestampMs) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.round(days / 30)}mo ago`;
  const years = (days / 365).toFixed(days < 730 ? 1 : 0);
  return `${years}y ago`;
}

/** Show a path with the home folder collapsed to `~` (handles already-`~` paths). */
export function shortenPath(path: string): string {
  return path.replace(/^\/Users\/[^/]+\//, "~/").replace(/^\/var\/root\//, "~/");
}

/** Compact relative time for "last scanned" labels. */
export function formatAgo(timestamp: number, now: number): string {
  const secs = Math.max(0, Math.round((now - timestamp) / 1000));
  if (secs < 5) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  return `${hours}h ago`;
}
