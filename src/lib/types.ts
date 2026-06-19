export type CategoryId =
  | "user_cache"
  | "app_logs"
  | "trash"
  | "downloads"
  | "developer"
  | "browser";

export type Safety = "safe" | "review";

export interface SampleFile {
  path: string;
  name: string;
  size: number;
}

export interface ScanResult {
  id: CategoryId;
  size: number;
  fileCount: number;
  accessible: boolean;
  samples: SampleFile[];
  /** Absolute paths of the category's roots that exist (for "open in Finder"). */
  roots: string[];
}

export interface BigFile {
  path: string;
  name: string;
  size: number;
  /** last-modified time, epoch seconds (0 if unknown) */
  modified: number;
}

export interface DupeFile {
  path: string;
  name: string;
  /** last-modified time, epoch seconds (0 if unknown) */
  modified: number;
}

export interface DupeGroup {
  id: string;
  /** size of each identical file in bytes */
  size: number;
  files: DupeFile[];
}

export interface DevTarget {
  id: string;
  label: string;
  hint: string;
  path: string;
  size: number;
  caution: boolean;
}

export interface ScanProgress {
  id: CategoryId;
  files: number;
  bytes: number;
}

export interface CleanReport {
  /** bytes acted on (freed if permanent, moved if trashed) */
  bytes: number;
  removed: number;
  failed: number;
}

export interface AppInfo {
  name: string;
  bundleId: string;
  path: string;
  /** true for /System apps — listed but not uninstallable */
  system: boolean;
  /** the app's real icon as a data: URL, or null if unreadable */
  icon: string | null;
}

export interface AppFile {
  fullPath: string;
  path: string;
  label: string;
  size: number;
}

export interface AppBundle {
  files: AppFile[];
  totalSize: number;
}

export type AppSource = "appstore" | "homebrew" | "direct";

export type StartupKind =
  | "login"
  | "userAgent"
  | "globalAgent"
  | "systemDaemon";

export interface StartupItem {
  id: string;
  name: string;
  program: string;
  kind: StartupKind;
  enabled: boolean;
  manageable: boolean;
  path: string;
}

export interface UpdatableApp {
  name: string;
  bundleId: string;
  developer: string;
  category: string;
  path: string;
  icon: string | null;
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  source: AppSource;
  caskToken: string | null;
}

export interface UpgradeItem {
  id: string;
  cask: string;
  name: string;
}

export interface Leftover {
  fullPath: string;
  path: string;
  name: string;
  kind: string;
  app: string;
  size: number;
  confidence: "high" | "medium";
  /** false for dead PATH entries — they're config lines, not files to trash */
  removable: boolean;
  /** for PATH entries: which shell config referenced it */
  source: string;
}

export interface DiskUsage {
  /** total capacity of the boot volume, in bytes */
  total: number;
  free: number;
  used: number;
  usedPercent: number;
}

/** Per-category UI status while the dashboard works through a scan. */
export type ScanStatus = "idle" | "scanning" | "done" | "empty" | "blocked";

export interface CategoryState {
  status: ScanStatus;
  result?: ScanResult;
  selected: boolean;
}
