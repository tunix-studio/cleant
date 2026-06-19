import { invoke } from "@tauri-apps/api/core";
import type {
  AppBundle,
  AppFile,
  AppInfo,
  BigFile,
  CategoryId,
  CleanReport,
  DevTarget,
  DiskUsage,
  DupeGroup,
  Leftover,
  ScanProgress,
  ScanResult,
  StartupItem,
  UpdatableApp,
  UpgradeItem,
} from "./types";
import { loadExclusions } from "./exclusions";

/**
 * When the frontend is opened in a plain browser (e.g. design preview), the
 * Tauri bridge isn't there. We detect that and serve plausible mock data so
 * the whole UI is demoable without the native shell — while the real app
 * always hits the Rust side.
 */
const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export async function getDiskUsage(): Promise<DiskUsage> {
  if (!isTauri) return mockDisk();
  return invoke<DiskUsage>("get_disk_usage");
}

export async function scanCategory(id: CategoryId): Promise<ScanResult> {
  if (!isTauri) return mockScan(id);
  return invoke<ScanResult>("scan_category", { id });
}

/**
 * Subscribe to live scan progress (running file/byte totals per category).
 * Returns an unlisten function. In the browser the mock drives this too.
 */
export async function listenScanProgress(
  cb: (p: ScanProgress) => void,
): Promise<() => void> {
  if (!isTauri) {
    mockProgressCb = cb;
    return () => {
      mockProgressCb = null;
    };
  }
  const { listen } = await import("@tauri-apps/api/event");
  return listen<ScanProgress>("scan-progress", (e) => cb(e.payload));
}

/**
 * Clean the given categories. `permanent` opts into hard deletion for
 * regenerable categories — the Rust side still refuses it for Downloads and
 * always empties the Trash permanently.
 */
export async function cleanCategories(
  ids: CategoryId[],
  permanent: boolean,
): Promise<CleanReport> {
  if (!isTauri) return mockClean(ids);
  return invoke<CleanReport>("clean_categories", {
    ids,
    permanent,
    exclusions: loadExclusions(),
  });
}

export async function emptyTrash(): Promise<CleanReport> {
  if (!isTauri) return mockClean(["trash"]);
  return invoke<CleanReport>("empty_trash");
}

/** Find leftovers of uninstalled apps + dead PATH entries (read-only). */
export async function scanLeftovers(): Promise<Leftover[]> {
  if (!isTauri) return mockLeftovers();
  return invoke<Leftover[]>("scan_leftovers");
}

/** Find large files in the user's content folders (read-only). */
export async function scanBigFiles(): Promise<BigFile[]> {
  if (!isTauri) return mockBigFiles();
  return invoke<BigFile[]>("scan_big_files");
}

/** Find duplicate files (identical content) in content folders (read-only). */
export async function scanDuplicates(): Promise<DupeGroup[]> {
  if (!isTauri) return mockDuplicates();
  return invoke<DupeGroup[]>("scan_duplicates");
}

/** Scan developer cache/junk locations with sizes (read-only). */
export async function scanDevJunk(): Promise<DevTarget[]> {
  if (!isTauri) return mockDevJunk();
  return invoke<DevTarget[]>("scan_dev_junk");
}

/** Move chosen leftover paths to the Trash (reversible, $HOME-guarded). */
export async function trashPaths(paths: string[]): Promise<CleanReport> {
  if (!isTauri) return mockTrashPaths(paths);
  return invoke<CleanReport>("trash_paths", { paths, exclusions: loadExclusions() });
}

/* ---- Uninstaller ---- */

export async function listApps(): Promise<AppInfo[]> {
  if (!isTauri) return mockApps();
  return invoke<AppInfo[]>("list_apps");
}

/** Minimal shape shared by AppInfo and UpdatableApp. */
export interface AppRef {
  path: string;
  bundleId: string;
  name: string;
  icon?: string | null;
}

export async function appFiles(app: AppRef): Promise<AppBundle> {
  if (!isTauri) return mockAppFiles(app);
  return invoke<AppBundle>("app_files", {
    appPath: app.path,
    bundleId: app.bundleId,
    name: app.name,
  });
}

export async function uninstallApp(paths: string[]): Promise<CleanReport> {
  if (!isTauri) return mockUninstall(paths);
  return invoke<CleanReport>("uninstall_app", { paths, exclusions: loadExclusions() });
}

/* ---- Updates ---- */

export async function checkUpdates(): Promise<UpdatableApp[]> {
  if (!isTauri) return mockUpdates();
  return invoke<UpdatableApp[]>("check_updates");
}

export async function runUpgrade(items: UpgradeItem[]): Promise<void> {
  if (!isTauri) return mockUpgrade(items);
  await invoke("run_upgrade", { items });
}

/** On-disk size of one app bundle, in bytes (lazy, for the detail panel). */
export async function appSize(path: string): Promise<number> {
  if (!isTauri) return mockAppSize(path);
  return invoke<number>("app_size", { path });
}

/** On-disk size of every installed app bundle (opt-in; parallel). */
export async function appSizes(): Promise<{ path: string; size: number }[]> {
  if (!isTauri) return mockAppSizes();
  return invoke<{ path: string; size: number }[]>("app_sizes");
}

/* ---- Startup / background items ---- */

export async function listStartupItems(): Promise<StartupItem[]> {
  if (!isTauri) return mockStartup();
  return invoke<StartupItem[]>("list_startup_items");
}

export async function setStartupEnabled(
  item: StartupItem,
  enabled: boolean,
): Promise<boolean> {
  if (!isTauri) return mockSetStartup(item, enabled);
  return invoke<boolean>("set_startup_enabled", {
    id: item.id,
    kind: item.kind,
    enabled,
  });
}

export interface UpdateProgress {
  id: string;
  line: string;
}
export interface UpdateDone {
  id: string;
  success: boolean;
  error?: string;
}

/** Subscribe to upgrade progress + completion events. */
export async function listenUpdate(
  onProgress: (p: UpdateProgress) => void,
  onDone: (d: UpdateDone) => void,
): Promise<() => void> {
  if (!isTauri) {
    mockUpdateCbs = { onProgress, onDone };
    return () => {
      mockUpdateCbs = null;
    };
  }
  const { listen } = await import("@tauri-apps/api/event");
  const un1 = await listen<UpdateProgress>("update-progress", (e) =>
    onProgress(e.payload),
  );
  const un2 = await listen<UpdateDone>("update-done", (e) => onDone(e.payload));
  return () => {
    un1();
    un2();
  };
}

/** Open an external URL (e.g. a release-notes page). */
export async function openExternal(url: string): Promise<void> {
  if (!isTauri) {
    window.open(url, "_blank");
    return;
  }
  const { openUrl } = await import("@tauri-apps/plugin-opener");
  await openUrl(url);
}

/* ---- Notifications ---- */

/* ---- Permissions / onboarding ---- */

export const SETTINGS_URL = {
  fullDisk:
    "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles",
  automation:
    "x-apple.systempreferences:com.apple.preference.security?Privacy_Automation",
  notifications: "x-apple.systempreferences:com.apple.preference.notifications",
};

/** Whether the app currently has Full Disk Access (best-effort probe). */
export async function hasFullDiskAccess(): Promise<boolean> {
  if (!isTauri) return false;
  return invoke<boolean>("has_full_disk_access");
}

/** Open a URL or a system-settings pane (`SETTINGS_URL.*`). */
export async function openSettings(url: string): Promise<void> {
  if (!isTauri) return;
  await invoke("open_url", { url });
}

export async function notificationGranted(): Promise<boolean> {
  if (!isTauri) return false;
  try {
    const n = await import("@tauri-apps/plugin-notification");
    return await n.isPermissionGranted();
  } catch {
    return false;
  }
}

export async function requestNotifications(): Promise<boolean> {
  if (!isTauri) return true;
  try {
    const n = await import("@tauri-apps/plugin-notification");
    return (await n.requestPermission()) === "granted";
  } catch {
    return false;
  }
}

/** Best-effort native notification (no-op in the browser). */
export async function notify(title: string, body: string): Promise<void> {
  if (!isTauri) return;
  try {
    const n = await import("@tauri-apps/plugin-notification");
    let granted = await n.isPermissionGranted();
    if (!granted) granted = (await n.requestPermission()) === "granted";
    if (granted) n.sendNotification({ title, body });
  } catch {
    /* notifications are best-effort */
  }
}

/** Reveal a path in Finder (selects it in its parent; read-only, native only). */
export async function revealInFinder(path: string): Promise<void> {
  if (!isTauri) return;
  const { revealItemInDir } = await import("@tauri-apps/plugin-opener");
  await revealItemInDir(path);
}

/** Open a folder (or file) in Finder / the default app (native only). */
export async function openPath(path: string): Promise<void> {
  if (!isTauri) return;
  const { openPath: open } = await import("@tauri-apps/plugin-opener");
  await open(path);
}

/* ------------------------------------------------------------------ *
 * Browser-preview mocks
 * ------------------------------------------------------------------ */
const GiB = 1024 ** 3;
const MiB = 1024 ** 2;

function mockDisk(): DiskUsage {
  const total = 994.66 * GiB;
  const free = 318.2 * GiB;
  const used = total - free;
  return { total, free, used, usedPercent: (used / total) * 100 };
}

const MOCK: Record<
  CategoryId,
  {
    size: number;
    fileCount: number;
    samples: [string, number][];
    roots: string[];
  }
> = {
  user_cache: {
    size: 4.82 * GiB,
    fileCount: 28411,
    roots: ["~/Library/Caches"],
    samples: [
      ["~/Library/Caches/com.apple.WebKit.WebContent/Cache.db", 612 * MiB],
      ["~/Library/Caches/Cypress/14.2.0/cache.bin", 446 * MiB],
      ["~/Library/Caches/com.spotify.client/Data", 287 * MiB],
    ],
  },
  app_logs: {
    size: 731 * MiB,
    fileCount: 1942,
    roots: ["~/Library/Logs"],
    samples: [
      ["~/Library/Logs/DiagnosticReports/term.log", 92 * MiB],
      ["~/Library/Logs/Docker/vm.log", 64 * MiB],
    ],
  },
  trash: {
    size: 2.13 * GiB,
    fileCount: 318,
    roots: ["~/.Trash"],
    samples: [
      ["~/.Trash/old-export.mov", 884 * MiB],
      ["~/.Trash/design-archive.zip", 412 * MiB],
    ],
  },
  downloads: {
    size: 6.41 * GiB,
    fileCount: 214,
    roots: ["~/Downloads"],
    samples: [
      ["~/Downloads/Xcode_16.4.xip", 3.1 * GiB],
      ["~/Downloads/ubuntu-24.04.iso", 1.8 * GiB],
      ["~/Downloads/figma-export.zip", 540 * MiB],
    ],
  },
  developer: {
    size: 12.74 * GiB,
    fileCount: 64203,
    roots: [
      "~/Library/Developer/Xcode/DerivedData",
      "~/.npm/_cacache",
      "~/Library/Developer/CoreSimulator/Caches",
    ],
    samples: [
      ["~/Library/Developer/Xcode/DerivedData", 7.2 * GiB],
      ["~/.npm/_cacache", 2.9 * GiB],
      ["~/Library/Developer/CoreSimulator/Caches", 1.6 * GiB],
    ],
  },
  browser: {
    size: 1.96 * GiB,
    fileCount: 8830,
    roots: [
      "~/Library/Caches/Google/Chrome",
      "~/Library/Caches/com.apple.Safari",
    ],
    samples: [
      ["~/Library/Caches/Google/Chrome/Default/Cache", 1.1 * GiB],
      ["~/Library/Caches/com.apple.Safari", 612 * MiB],
    ],
  },
};

let mockProgressCb: ((p: ScanProgress) => void) | null = null;

// Remember what was "cleaned" in preview so a rescan reflects it.
const cleanedInPreview = new Set<CategoryId>();

function mockScan(id: CategoryId): Promise<ScanResult> {
  const m = MOCK[id];
  const wiped = cleanedInPreview.has(id);
  const finalBytes = wiped ? 0 : m.size;
  const finalFiles = wiped ? 0 : m.fileCount;
  const duration = 600 + (Math.abs(hash(id)) % 1200);

  return new Promise((resolve) => {
    const start = performance.now();
    const tick = () => {
      const t = Math.min(1, (performance.now() - start) / duration);
      // Ramp the running totals up so preview shows a live scan.
      mockProgressCb?.({
        id,
        files: Math.round(finalFiles * t),
        bytes: Math.round(finalBytes * t),
      });
      if (t < 1) {
        setTimeout(tick, 90);
      } else {
        resolve({
          id,
          size: finalBytes,
          fileCount: finalFiles,
          accessible: true,
          roots: m.roots,
          samples: wiped
            ? []
            : m.samples.map(([path, size]) => ({
                path,
                size,
                name: path.split("/").pop() ?? path,
              })),
        });
      }
    };
    tick();
  });
}

function mockClean(ids: CategoryId[]): Promise<CleanReport> {
  let bytes = 0;
  let removed = 0;
  for (const id of ids) {
    if (cleanedInPreview.has(id)) continue;
    bytes += MOCK[id].size;
    removed += MOCK[id].fileCount;
    cleanedInPreview.add(id);
  }
  return new Promise((resolve) =>
    setTimeout(() => resolve({ bytes, removed, failed: 0 }), 1100),
  );
}

/* ---- Leftovers preview mocks ---- */
const removedLeftovers = new Set<string>();
const removedBig = new Set<string>();
const removedDup = new Set<string>();
const removedDev = new Set<string>();

const MOCK_DEV: DevTarget[] = [
  { id: "xcode-derived", label: "Xcode DerivedData", hint: "Build intermediates — Xcode rebuilds them", path: "~/Library/Developer/Xcode/DerivedData", size: 7.2 * GiB, caution: false },
  { id: "npm", label: "npm cache", hint: "node package manager cache", path: "~/.npm/_cacache", size: 2.9 * GiB, caution: false },
  { id: "xcode-ios-devsupport", label: "iOS DeviceSupport", hint: "Debug symbols for old iOS versions", path: "~/Library/Developer/Xcode/iOS DeviceSupport", size: 2.1 * GiB, caution: false },
  { id: "sim-devices", label: "Simulator Devices", hint: "Removes installed simulators (recreatable)", path: "~/Library/Developer/CoreSimulator/Devices", size: 1.6 * GiB, caution: true },
  { id: "gradle", label: "Gradle caches", hint: "Gradle dependency & build cache", path: "~/.gradle/caches", size: 980 * MiB, caution: false },
  { id: "cocoapods", label: "CocoaPods cache", hint: "Downloaded pods cache", path: "~/Library/Caches/CocoaPods", size: 612 * MiB, caution: false },
  { id: "homebrew", label: "Homebrew cache", hint: "Downloaded bottles & casks", path: "~/Library/Caches/Homebrew", size: 430 * MiB, caution: false },
  { id: "xcode-archives", label: "Xcode Archives", hint: "Old app archives — keep if you still distribute them", path: "~/Library/Developer/Xcode/Archives", size: 1.2 * GiB, caution: true },
];

const MOCK_DUPES: DupeGroup[] = [
  {
    id: "a1",
    size: 612 * MiB,
    files: [
      { path: "~/Downloads/keynote-export.mp4", name: "keynote-export.mp4", modified: 0 },
      { path: "~/Desktop/keynote-export.mp4", name: "keynote-export.mp4", modified: 0 },
      { path: "~/Movies/exports/keynote-export.mp4", name: "keynote-export.mp4", modified: 0 },
    ],
  },
  {
    id: "b2",
    size: 188 * MiB,
    files: [
      { path: "~/Pictures/iphone-backup/IMG_4821.HEIC", name: "IMG_4821.HEIC", modified: 0 },
      { path: "~/Downloads/IMG_4821.HEIC", name: "IMG_4821.HEIC", modified: 0 },
    ],
  },
  {
    id: "c3",
    size: 64 * MiB,
    files: [
      { path: "~/Documents/contract-final.pdf", name: "contract-final.pdf", modified: 0 },
      { path: "~/Documents/old/contract-final.pdf", name: "contract-final.pdf", modified: 0 },
      { path: "~/Desktop/contract-final.pdf", name: "contract-final.pdf", modified: 0 },
    ],
  },
];

const daysAgoSecs = (d: number) =>
  Math.floor((Date.now() - d * 86_400_000) / 1000);

const MOCK_BIG_FILES: BigFile[] = [
  { path: "~/Downloads/Xcode_16.4.xip", name: "Xcode_16.4.xip", size: 3.1 * GiB, modified: daysAgoSecs(218) },
  { path: "~/Movies/wedding-4k-master.mov", name: "wedding-4k-master.mov", size: 2.4 * GiB, modified: daysAgoSecs(540) },
  { path: "~/Downloads/ubuntu-24.04.iso", name: "ubuntu-24.04.iso", size: 1.8 * GiB, modified: daysAgoSecs(96) },
  { path: "~/Documents/Archive/2019-photos.zip", name: "2019-photos.zip", size: 1.3 * GiB, modified: daysAgoSecs(1290) },
  { path: "~/Desktop/screen-recording.mov", name: "screen-recording.mov", size: 870 * MiB, modified: daysAgoSecs(12) },
  { path: "~/Downloads/figma-export.zip", name: "figma-export.zip", size: 540 * MiB, modified: daysAgoSecs(38) },
  { path: "~/Music/live-set-stems.logicx", name: "live-set-stems.logicx", size: 420 * MiB, modified: daysAgoSecs(310) },
  { path: "~/Pictures/raw-shoot.dng", name: "raw-shoot.dng", size: 96 * MiB, modified: daysAgoSecs(4) },
];

const MOCK_LEFTOVERS: Leftover[] = [
  {
    fullPath: "/Users/you/Library/Application Support/Kiro",
    path: "~/Library/Application Support/Kiro",
    name: "Kiro",
    kind: "App support",
    app: "Kiro",
    size: 412 * MiB,
    confidence: "medium",
    removable: true,
    source: "",
  },
  {
    fullPath: "/Users/you/Library/Caches/com.kiro.app",
    path: "~/Library/Caches/com.kiro.app",
    name: "com.kiro.app",
    kind: "Cache",
    app: "com.kiro.app",
    size: 286 * MiB,
    confidence: "high",
    removable: true,
    source: "",
  },
  {
    fullPath: "/Users/you/Documents/.kiro",
    path: "~/Documents/.kiro",
    name: ".kiro",
    kind: "Dotfolder",
    app: "kiro",
    size: 9.4 * MiB,
    confidence: "medium",
    removable: true,
    source: "",
  },
  {
    fullPath: "/Users/you/Library/Saved Application State/com.sublimetext.4.savedState",
    path: "~/Library/Saved Application State/com.sublimetext.4.savedState",
    name: "com.sublimetext.4.savedState",
    kind: "Saved state",
    app: "com.sublimetext.4",
    size: 1.2 * MiB,
    confidence: "high",
    removable: true,
    source: "",
  },
  {
    fullPath: "/Users/you/Library/Preferences/com.kiro.app.plist",
    path: "~/Library/Preferences/com.kiro.app.plist",
    name: "com.kiro.app.plist",
    kind: "Preferences",
    app: "com.kiro.app",
    size: 14 * 1024,
    confidence: "high",
    removable: true,
    source: "",
  },
  {
    fullPath: "/opt/old-toolchain/bin",
    path: "/opt/old-toolchain/bin",
    name: "/opt/old-toolchain/bin",
    kind: "Dead PATH entry",
    app: "Shell config",
    size: 0,
    confidence: "high",
    removable: false,
    source: ".zshrc",
  },
  {
    fullPath: "/Users/you/.rbenv/shims",
    path: "~/.rbenv/shims",
    name: "/Users/you/.rbenv/shims",
    kind: "Dead PATH entry",
    app: "Shell config",
    size: 0,
    confidence: "high",
    removable: false,
    source: ".zprofile",
  },
];

function mockLeftovers(): Promise<Leftover[]> {
  return new Promise((resolve) =>
    setTimeout(
      () =>
        resolve(MOCK_LEFTOVERS.filter((l) => !removedLeftovers.has(l.fullPath))),
      1000,
    ),
  );
}

function mockBigFiles(): Promise<BigFile[]> {
  return new Promise((resolve) =>
    setTimeout(
      () => resolve(MOCK_BIG_FILES.filter((f) => !removedBig.has(f.path))),
      1100,
    ),
  );
}

function mockDuplicates(): Promise<DupeGroup[]> {
  return new Promise((resolve) =>
    setTimeout(
      () =>
        resolve(
          MOCK_DUPES.map((g) => ({
            ...g,
            files: g.files.filter((f) => !removedDup.has(f.path)),
          })).filter((g) => g.files.length > 1),
        ),
      1300,
    ),
  );
}

function mockDevJunk(): Promise<DevTarget[]> {
  return new Promise((resolve) =>
    setTimeout(
      () => resolve(MOCK_DEV.filter((t) => !removedDev.has(t.path))),
      1200,
    ),
  );
}

function mockTrashPaths(paths: string[]): Promise<CleanReport> {
  let bytes = 0;
  let removed = 0;
  for (const p of paths) {
    const dev = MOCK_DEV.find((t) => t.path === p);
    if (dev && !removedDev.has(p)) {
      bytes += dev.size;
      removed += 1;
      removedDev.add(p);
    }
    const l = MOCK_LEFTOVERS.find((x) => x.fullPath === p);
    if (l && !removedLeftovers.has(p)) {
      bytes += l.size;
      removed += 1;
      removedLeftovers.add(p);
    }
    const b = MOCK_BIG_FILES.find((x) => x.path === p);
    if (b && !removedBig.has(p)) {
      bytes += b.size;
      removed += 1;
      removedBig.add(p);
    }
    const dg = MOCK_DUPES.find((g) => g.files.some((f) => f.path === p));
    if (dg && !removedDup.has(p)) {
      bytes += dg.size;
      removed += 1;
      removedDup.add(p);
    }
  }
  return new Promise((resolve) =>
    setTimeout(() => resolve({ bytes, removed, failed: 0 }), 700),
  );
}

/* ---- Uninstaller preview mocks ---- */
const uninstalledApps = new Set<string>();
const mockFileSizes = new Map<string, number>();

function fakeIcon(letter: string, bg: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" rx="15" fill="${bg}"/><text x="32" y="44" font-family="-apple-system,sans-serif" font-size="34" font-weight="700" fill="white" text-anchor="middle">${letter}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const MOCK_APPS: AppInfo[] = [
  { name: "Kiro", bundleId: "com.kiro.app", path: "/Applications/Kiro.app", system: false, icon: fakeIcon("K", "#7c5cff") },
  { name: "Spotify", bundleId: "com.spotify.client", path: "/Applications/Spotify.app", system: false, icon: fakeIcon("S", "#1db954") },
  { name: "Figma", bundleId: "com.figma.Desktop", path: "/Applications/Figma.app", system: false, icon: fakeIcon("F", "#f24e1e") },
  { name: "Slack", bundleId: "com.tinyspeck.slackmacgap", path: "/Applications/Slack.app", system: false, icon: fakeIcon("S", "#4a154b") },
  { name: "Transmission", bundleId: "org.m0k.transmission", path: "/Applications/Transmission.app", system: false, icon: fakeIcon("T", "#d9342b") },
  { name: "VLC", bundleId: "org.videolan.vlc", path: "/Applications/VLC.app", system: false, icon: fakeIcon("V", "#ff8800") },
  { name: "OBS Studio", bundleId: "com.obsproject.obs-studio", path: "/Applications/OBS.app", system: false, icon: fakeIcon("O", "#302e31") },
];

function mockApps(): Promise<AppInfo[]> {
  return new Promise((resolve) =>
    setTimeout(
      () => resolve(MOCK_APPS.filter((a) => !uninstalledApps.has(a.path))),
      700,
    ),
  );
}

function mockAppFiles(app: AppRef): Promise<AppBundle> {
  const home = "/Users/you";
  const b = app.bundleId;
  const appSize = (220 + (Math.abs(hash(app.name)) % 380)) * MiB;
  const files: AppFile[] = [
    { fullPath: app.path, path: app.path, label: "Application", size: appSize },
    {
      fullPath: `${home}/Library/Application Support/${app.name}`,
      path: `~/Library/Application Support/${app.name}`,
      label: "Support files",
      size: 164 * MiB,
    },
    {
      fullPath: `${home}/Library/Caches/${b}`,
      path: `~/Library/Caches/${b}`,
      label: "Cache",
      size: 92 * MiB,
    },
    {
      fullPath: `${home}/Library/Preferences/${b}.plist`,
      path: `~/Library/Preferences/${b}.plist`,
      label: "Preferences",
      size: 18 * 1024,
    },
    {
      fullPath: `${home}/Library/Saved Application State/${b}.savedState`,
      path: `~/Library/Saved Application State/${b}.savedState`,
      label: "Saved state",
      size: 2.1 * MiB,
    },
    {
      fullPath: `${home}/Library/HTTPStorages/${b}`,
      path: `~/Library/HTTPStorages/${b}`,
      label: "Stored data",
      size: 11 * MiB,
    },
  ];
  files.forEach((f) => mockFileSizes.set(f.fullPath, f.size));
  const totalSize = files.reduce((s, f) => s + f.size, 0);
  return new Promise((resolve) => setTimeout(() => resolve({ files, totalSize }), 600));
}

function mockUninstall(paths: string[]): Promise<CleanReport> {
  let bytes = 0;
  for (const p of paths) bytes += mockFileSizes.get(p) ?? 0;
  for (const a of MOCK_APPS) if (paths.includes(a.path)) uninstalledApps.add(a.path);
  return new Promise((resolve) =>
    setTimeout(() => resolve({ bytes, removed: paths.length, failed: 0 }), 900),
  );
}

/* ---- Updates preview mocks ---- */
let mockUpdateCbs: {
  onProgress: (p: UpdateProgress) => void;
  onDone: (d: UpdateDone) => void;
} | null = null;
const upgradedInPreview = new Set<string>();

const MOCK_UPDATES_BASE: UpdatableApp[] = [
  { name: "Visual Studio Code", bundleId: "com.microsoft.VSCode", developer: "Microsoft", category: "Developer Tools", path: "/Applications/Visual Studio Code.app", icon: fakeIcon("V", "#2496ed"), currentVersion: "1.92.1", latestVersion: "1.94.0", updateAvailable: true, source: "homebrew", caskToken: "visual-studio-code" },
  { name: "Rectangle", bundleId: "com.knollsoft.Rectangle", developer: "Knollsoft", category: "Utilities", path: "/Applications/Rectangle.app", icon: fakeIcon("R", "#0e7c72"), currentVersion: "0.76", latestVersion: "0.81", updateAvailable: true, source: "homebrew", caskToken: "rectangle" },
  { name: "Figma", bundleId: "com.figma.Desktop", developer: "Figma", category: "Design", path: "/Applications/Figma.app", icon: fakeIcon("F", "#f24e1e"), currentVersion: "124.3.0", latestVersion: "125.1.4", updateAvailable: true, source: "homebrew", caskToken: "figma" },
  { name: "Spotify", bundleId: "com.spotify.client", developer: "Spotify", category: "Music", path: "/Applications/Spotify.app", icon: fakeIcon("S", "#1db954"), currentVersion: "1.2.40", latestVersion: "1.2.40", updateAvailable: false, source: "homebrew", caskToken: "spotify" },
  { name: "Things 3", bundleId: "com.culturedcode.ThingsMac", developer: "Culturedcode", category: "Productivity", path: "/Applications/Things3.app", icon: fakeIcon("T", "#3b82f6"), currentVersion: "3.20.1", latestVersion: "3.20.1", updateAvailable: false, source: "appstore", caskToken: null },
  { name: "Safari", bundleId: "com.apple.Safari", developer: "Apple", category: "Browser", path: "/Applications/Safari.app", icon: fakeIcon("S", "#1786b7"), currentVersion: "17.5", latestVersion: "17.5", updateAvailable: false, source: "direct", caskToken: null },
];

function mockAppSize(path: string): Promise<number> {
  const base = (140 + (Math.abs(hash(path)) % 760)) * MiB;
  return new Promise((r) => setTimeout(() => r(base), 350));
}

function mockAppSizes(): Promise<{ path: string; size: number }[]> {
  const list = MOCK_UPDATES_BASE.map((a) => ({
    path: a.path,
    size: (90 + (Math.abs(hash(a.path)) % 1500)) * MiB,
  }));
  return new Promise((r) => setTimeout(() => r(list), 900));
}

function mockUpdates(): Promise<UpdatableApp[]> {
  const list = MOCK_UPDATES_BASE.map((a) =>
    upgradedInPreview.has(a.bundleId)
      ? { ...a, currentVersion: a.latestVersion, updateAvailable: false }
      : a,
  );
  list.sort(
    (a, b) =>
      Number(b.updateAvailable) - Number(a.updateAvailable) ||
      a.name.localeCompare(b.name),
  );
  return new Promise((r) => setTimeout(() => r(list), 1100));
}

function mockUpgrade(items: UpgradeItem[]): Promise<void> {
  return new Promise((resolve) => {
    let i = 0;
    const step = () => {
      if (i >= items.length) {
        resolve();
        return;
      }
      const it = items[i];
      const lines = [
        `==> Downloading ${it.name}…`,
        `==> Upgrading Cask ${it.cask}`,
        `==> Moving App to /Applications`,
        `🍺  ${it.name} was successfully upgraded`,
      ];
      let j = 0;
      const tick = () => {
        if (j < lines.length) {
          mockUpdateCbs?.onProgress({ id: it.id, line: lines[j] });
          j++;
          setTimeout(tick, 360);
        } else {
          upgradedInPreview.add(it.id);
          mockUpdateCbs?.onDone({ id: it.id, success: true });
          i++;
          setTimeout(step, 250);
        }
      };
      tick();
    };
    step();
  });
}

/* ---- Startup preview mocks ---- */
let MOCK_STARTUP: StartupItem[] = [
  { id: "login:Spotify", name: "Spotify", program: "/Applications/Spotify.app", kind: "login", enabled: true, manageable: true, path: "/Applications/Spotify.app" },
  { id: "login:Rectangle", name: "Rectangle", program: "/Applications/Rectangle.app", kind: "login", enabled: true, manageable: true, path: "/Applications/Rectangle.app" },
  { id: "com.google.keystone.agent", name: "GoogleUpdater", program: "~/Library/.../GoogleUpdater.app/.../GoogleUpdater", kind: "userAgent", enabled: true, manageable: true, path: "~/Library/LaunchAgents/com.google.keystone.agent.plist" },
  { id: "com.docker.helper", name: "Docker", program: "/Applications/Docker.app/Contents/MacOS/com.docker.helper", kind: "userAgent", enabled: true, manageable: true, path: "~/Library/LaunchAgents/com.docker.helper.plist" },
  { id: "com.adobe.ARMDCHelper", name: "Adobe ARM Helper", program: "/Library/.../ARMDCHelper", kind: "userAgent", enabled: false, manageable: true, path: "~/Library/LaunchAgents/com.adobe.ARMDCHelper.plist" },
  { id: "com.microsoft.update.agent", name: "Microsoft AutoUpdate", program: "/Library/Application Support/Microsoft/MAU2.0/.../Microsoft Update Assistant", kind: "globalAgent", enabled: true, manageable: false, path: "/Library/LaunchAgents/com.microsoft.update.agent.plist" },
  { id: "com.microsoft.office.licensingV2.helper", name: "LicensingV2", program: "/Library/PrivilegedHelperTools/com.microsoft.office.licensingV2.helper", kind: "systemDaemon", enabled: true, manageable: false, path: "/Library/LaunchDaemons/com.microsoft.office.licensingV2.helper.plist" },
];

function mockStartup(): Promise<StartupItem[]> {
  return new Promise((r) => setTimeout(() => r(MOCK_STARTUP.map((i) => ({ ...i }))), 600));
}

function mockSetStartup(item: StartupItem, enabled: boolean): Promise<boolean> {
  if (item.kind === "login" && !enabled) {
    MOCK_STARTUP = MOCK_STARTUP.filter((i) => i.id !== item.id);
  } else {
    MOCK_STARTUP = MOCK_STARTUP.map((i) =>
      i.id === item.id ? { ...i, enabled } : i,
    );
  }
  return new Promise((r) => setTimeout(() => r(true), 300));
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h;
}
