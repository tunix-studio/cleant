import { useCallback, useEffect, useMemo, useState } from "react";
import { CATEGORIES } from "./data/categories";
import {
  appFiles,
  checkUpdates,
  cleanCategories,
  emptyTrash,
  getDiskUsage,
  listStartupItems,
  listenScanProgress,
  listenUpdate,
  notify,
  revealInFinder,
  appSizes,
  runUpgrade,
  scanBigFiles,
  scanCategory,
  scanDevJunk,
  scanDuplicates,
  scanLeftovers,
  setStartupEnabled,
  trashPaths,
  uninstallApp,
} from "./lib/api";
import type {
  AppBundle,
  BigFile,
  CategoryId,
  CategoryState,
  CleanReport,
  DevTarget,
  DiskUsage,
  DupeGroup,
  Leftover,
  StartupItem,
  UpdatableApp,
} from "./lib/types";
import { formatAgo, formatBytes } from "./lib/format";
import {
  isDue,
  loadReminders,
  saveReminders,
  type ReminderSettings,
} from "./lib/reminders";
import {
  clearHistory,
  loadHistory,
  recordHistory,
  type HistoryEntry,
  type HistoryKind,
} from "./lib/history";
import { useTheme } from "./lib/useTheme";
import { Sidebar, type ViewId } from "./components/Sidebar";
import { Titlebar } from "./components/Titlebar";
import { ReminderBanner } from "./components/ReminderBanner";
import { CleanupCelebration } from "./components/CleanupCelebration";
import {
  ConfirmCleanModal,
  type CleanItem,
} from "./components/ConfirmCleanModal";
import { CleanView, type CleanOutcome, type Phase } from "./views/CleanView";
import { StorageView } from "./views/StorageView";
import {
  LeftoversView,
  type LeftoversPhase,
} from "./views/LeftoversView";
import { AppsView } from "./views/AppsView";
import { AppDetailDrawer } from "./components/AppDetailDrawer";
import { UninstallModal } from "./components/UninstallModal";
import { PerformanceView } from "./views/PerformanceView";
import { SettingsView } from "./views/SettingsView";
import { OverviewView, type OverviewPhase } from "./views/OverviewView";
import {
  LargeFilesView,
  type LargeFilesPhase,
} from "./views/LargeFilesView";
import {
  DuplicatesView,
  type DuplicatesPhase,
} from "./views/DuplicatesView";
import {
  DeveloperView,
  type DeveloperPhase,
} from "./views/DeveloperView";
import { Onboarding } from "./components/Onboarding";

const TITLES: Record<ViewId, string> = {
  overview: "Overview",
  clean: "Clean",
  storage: "Storage",
  large: "Large Files",
  duplicates: "Duplicates",
  developer: "Developer",
  leftovers: "Leftovers",
  apps: "Apps",
  performance: "Performance",
  settings: "Settings",
};

function buildStates(
  status: CategoryState["status"],
): Record<CategoryId, CategoryState> {
  return Object.fromEntries(
    CATEGORIES.map((m) => [m.id, { status, selected: m.safety === "safe" }]),
  ) as Record<CategoryId, CategoryState>;
}

type LiveCounts = Record<CategoryId, { files: number; bytes: number }>;

function zeroLive(): LiveCounts {
  return Object.fromEntries(
    CATEGORIES.map((m) => [m.id, { files: 0, bytes: 0 }]),
  ) as LiveCounts;
}

export default function App() {
  const { theme, toggle } = useTheme();
  const [onboarded, setOnboarded] = useState(() => {
    try {
      return localStorage.getItem("tclean-onboarded") === "1";
    } catch {
      return true;
    }
  });
  const [view, setView] = useState<ViewId>("overview");
  const [phase, setPhase] = useState<Phase>("idle");
  const [disk, setDisk] = useState<DiskUsage | null>(null);
  const [states, setStates] = useState<Record<CategoryId, CategoryState>>(() =>
    buildStates("idle"),
  );
  const [progress, setProgress] = useState({
    done: 0,
    total: CATEGORIES.length,
    currentLabel: null as string | null,
  });
  const [lastScanAt, setLastScanAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Cleanup reminders
  const [reminders, setReminders] = useState<ReminderSettings>(loadReminders);
  const [reminderDue, setReminderDue] = useState(false);

  // Cleanup history + completion celebration
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
  const [celebration, setCelebration] = useState<{
    bytes: number;
    count: number;
  } | null>(null);
  const logHistory = useCallback(
    (
      kind: HistoryKind,
      label: string,
      bytes: number,
      count: number,
      celebrate = true,
    ) => {
      setHistory((prev) => recordHistory({ kind, label, bytes, count }, prev));
      if (celebrate && (bytes > 0 || count > 0)) setCelebration({ bytes, count });
    },
    [],
  );

  // Smart Scan (Overview)
  const [smartPhase, setSmartPhase] = useState<OverviewPhase>("idle");
  const [smartStep, setSmartStep] = useState("");
  const [smartProgress, setSmartProgress] = useState(0);
  const [smartScannedAt, setSmartScannedAt] = useState<number | null>(null);

  // Large files
  const [bigPhase, setBigPhase] = useState<LargeFilesPhase>("idle");
  const [bigFiles, setBigFiles] = useState<BigFile[]>([]);
  const [bigSelected, setBigSelected] = useState<Set<string>>(() => new Set());
  const [bigCleaning, setBigCleaning] = useState(false);
  const [bigResult, setBigResult] = useState<CleanReport | null>(null);

  // Duplicates
  const [dupPhase, setDupPhase] = useState<DuplicatesPhase>("idle");
  const [dupGroups, setDupGroups] = useState<DupeGroup[]>([]);
  const [dupCleaning, setDupCleaning] = useState(false);
  const [dupResult, setDupResult] = useState<CleanReport | null>(null);

  // Developer junk
  const [devPhase, setDevPhase] = useState<DeveloperPhase>("idle");
  const [devTargets, setDevTargets] = useState<DevTarget[]>([]);
  const [devSelected, setDevSelected] = useState<Set<string>>(() => new Set());
  const [devCleaning, setDevCleaning] = useState(false);
  const [devResult, setDevResult] = useState<CleanReport | null>(null);
  const [live, setLive] = useState<LiveCounts>(() => zeroLive());

  // Cleanup flow
  const [modalOpen, setModalOpen] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [emptyingTrash, setEmptyingTrash] = useState(false);
  const [cleanResult, setCleanResult] = useState<CleanOutcome | null>(null);

  // Leftovers flow
  const [leftPhase, setLeftPhase] = useState<LeftoversPhase>("idle");
  const [leftItems, setLeftItems] = useState<Leftover[]>([]);
  const [leftSelected, setLeftSelected] = useState<Set<string>>(() => new Set());
  const [leftCleaning, setLeftCleaning] = useState(false);
  const [leftResult, setLeftResult] = useState<CleanReport | null>(null);

  // Uninstall flow (triggered from the app detail drawer)
  const [uninTarget, setUninTarget] = useState<UpdatableApp | null>(null);
  const [uninBundle, setUninBundle] = useState<AppBundle | null>(null);
  const [uninLoadingFiles, setUninLoadingFiles] = useState(false);
  const [uninstalling, setUninstalling] = useState(false);

  // Performance / startup items
  const [perfLoaded, setPerfLoaded] = useState(false);
  const [perfLoading, setPerfLoading] = useState(false);
  const [startupItems, setStartupItems] = useState<StartupItem[]>([]);
  const [startupBusy, setStartupBusy] = useState<Set<string>>(() => new Set());

  // Updates flow
  const [updLoaded, setUpdLoaded] = useState(false);
  const [updLoading, setUpdLoading] = useState(false);
  const [updApps, setUpdApps] = useState<UpdatableApp[]>([]);
  const [upgrading, setUpgrading] = useState<Set<string>>(() => new Set());
  const [updProgress, setUpdProgress] = useState<Record<string, string>>({});
  const [updFailed, setUpdFailed] = useState<Record<string, string>>({});
  const [selectedUpdId, setSelectedUpdId] = useState<string | null>(null);
  const [appSizeMap, setAppSizeMap] = useState<Record<string, number>>({});
  const [sizingApps, setSizingApps] = useState(false);

  // Manual, sequential scan — the user triggers it; categories complete one by
  // one with visible progress (lighter on disk than firing all at once).
  const scan = useCallback(async () => {
    setPhase("scanning");
    setStates(buildStates("idle"));
    setProgress({ done: 0, total: CATEGORIES.length, currentLabel: null });
    setLive(zeroLive());
    void getDiskUsage().then(setDisk).catch(() => {});

    let done = 0;
    for (const meta of CATEGORIES) {
      setProgress({ done, total: CATEGORIES.length, currentLabel: meta.name });
      setStates((prev) => ({
        ...prev,
        [meta.id]: { ...prev[meta.id], status: "scanning" },
      }));
      try {
        const result = await scanCategory(meta.id);
        const status: CategoryState["status"] = !result.accessible
          ? "blocked"
          : result.size === 0
            ? "empty"
            : "done";
        setStates((prev) => ({
          ...prev,
          [meta.id]: {
            status,
            result,
            selected: status === "done" ? meta.safety === "safe" : false,
          },
        }));
      } catch {
        setStates((prev) => ({
          ...prev,
          [meta.id]: { status: "blocked", selected: false },
        }));
      }
      done += 1;
      setProgress({ done, total: CATEGORIES.length, currentLabel: null });
    }

    setLastScanAt(Date.now());
    setPhase("done");
    setReminderDue(false);
  }, []);

  // Update + persist reminder settings; changing the schedule re-stamps
  // lastNotified so an already-passed slot won't fire the moment it's saved.
  const updateReminders = useCallback((patch: Partial<ReminderSettings>) => {
    setReminders((prev) => {
      const next = { ...prev, ...patch, lastNotified: Date.now() };
      saveReminders(next);
      return next;
    });
    setReminderDue(false);
  }, []);

  // Scheduled auto-clean: silently clear the safe cache/log categories to Trash.
  const runAutoClean = useCallback(async () => {
    const ids = CATEGORIES.filter((m) => m.safety === "safe").map((m) => m.id);
    try {
      const report = await cleanCategories(ids, false);
      logHistory("clean", "Scheduled cleanup", report.bytes, report.removed, false);
      void notify(
        report.bytes > 0 ? "Scheduled cleanup done" : "Scheduled cleanup",
        report.bytes > 0
          ? `Moved ${formatBytes(report.bytes)} to the Trash · ${report.removed} items`
          : "Nothing to clear right now",
      );
    } catch {
      /* best effort */
    }
  }, [logHistory]);

  // In-app scheduler: while tclean runs (incl. menu-bar mode), check each minute
  // whether a reminder is due; if so, auto-clean or nudge once.
  useEffect(() => {
    if (!reminders.enabled) {
      setReminderDue(false);
      return;
    }
    const check = () => {
      if (!isDue(reminders, Date.now())) return;
      const stamped = { ...reminders, lastNotified: Date.now() };
      saveReminders(stamped);
      setReminders(stamped);
      if (reminders.autoClean) {
        void runAutoClean();
      } else {
        setReminderDue(true);
        void notify(
          "Time for a cleanup",
          "Open tclean and give your Mac a quick sweep.",
        );
      }
    };
    check();
    const t = setInterval(check, 60_000);
    return () => clearInterval(t);
  }, [reminders, runAutoClean]);

  // Keep "scanned Xm ago" fresh.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Live scan progress streamed from the backend (running file/byte totals).
  useEffect(() => {
    let un: (() => void) | undefined;
    void listenScanProgress((p) => {
      setLive((prev) => ({ ...prev, [p.id]: { files: p.files, bytes: p.bytes } }));
    }).then((u) => {
      un = u;
    });
    return () => un?.();
  }, []);

  const toggleCategory = useCallback((id: CategoryId) => {
    setStates((prev) => {
      const s = prev[id];
      if (s.status !== "done") return prev;
      return { ...prev, [id]: { ...s, selected: !s.selected } };
    });
  }, []);

  const selectAll = useCallback((value: boolean) => {
    setStates((prev) => {
      const next = { ...prev };
      for (const m of CATEGORIES) {
        const s = next[m.id];
        if (s.status === "done" && (s.result?.size ?? 0) > 0) {
          next[m.id] = { ...s, selected: value };
        }
      }
      return next;
    });
  }, []);

  const d = useMemo(() => {
    let reclaimable = 0;
    let totalFound = 0;
    let itemsFound = 0;
    let selectedCount = 0;
    let selectedItems = 0;
    let selectable = 0;
    const items: CleanItem[] = [];
    for (const meta of CATEGORIES) {
      const s = states[meta.id];
      const size = s.result?.size ?? 0;
      const count = s.result?.fileCount ?? 0;
      if (s.status === "done" && size > 0) {
        totalFound += size;
        itemsFound += count;
        selectable += 1;
        if (s.selected) {
          reclaimable += size;
          selectedCount += 1;
          selectedItems += count;
          items.push({ meta, size, count });
        }
      }
    }
    return {
      reclaimable,
      totalFound,
      itemsFound,
      selectedCount,
      selectedItems,
      selectable,
      items,
    };
  }, [states]);

  const confirmClean = useCallback(
    async (permanent: boolean) => {
      const ids = d.items.map((it) => it.meta.id);
      if (ids.length === 0) return;
      setCleaning(true);
      try {
        const report = await cleanCategories(ids, permanent);
        setCleanResult({ ...report, permanent });
        void notify(
          permanent ? "Cleanup complete" : "Moved to Trash",
          `${permanent ? "Freed" : "Moved"} ${formatBytes(report.bytes)} · ${report.removed} items`,
        );
        logHistory("clean", "Junk cleanup", report.bytes, report.removed);
      } catch {
        setCleanResult({ bytes: 0, removed: 0, failed: ids.length, permanent });
      }
      setCleaning(false);
      setModalOpen(false);
      // Reflect the removal locally instead of kicking off a full re-scan
      // (that felt jarring): cleaned categories are now empty; refresh free
      // space silently in the background.
      setStates((prev) => {
        const next = { ...prev };
        for (const id of ids) next[id] = { status: "empty", selected: false };
        return next;
      });
      void getDiskUsage().then(setDisk).catch(() => {});
    },
    [d.items],
  );

  const handleEmptyTrash = useCallback(async () => {
    setEmptyingTrash(true);
    try {
      const report = await emptyTrash();
      setCleanResult({ ...report, permanent: true });
      void notify(
        "Trash emptied",
        report.bytes > 0
          ? `Freed ${formatBytes(report.bytes)}`
          : "The Trash was already empty",
      );
    } catch {
      /* keep previous result */
    }
    setEmptyingTrash(false);
    // Trash is now empty — reflect it locally + refresh disk, no full re-scan.
    setStates((prev) => ({
      ...prev,
      trash: { status: "empty", selected: false },
    }));
    void getDiskUsage().then(setDisk).catch(() => {});
  }, []);

  /* ---- Leftovers ---- */
  const scanLeft = useCallback(async () => {
    setLeftPhase("scanning");
    setLeftSelected(new Set());
    setLeftResult(null);
    try {
      setLeftItems(await scanLeftovers());
    } catch {
      setLeftItems([]);
    }
    setLeftPhase("done");
  }, []);

  const toggleLeft = useCallback((fullPath: string) => {
    setLeftSelected((prev) => {
      const next = new Set(prev);
      if (next.has(fullPath)) next.delete(fullPath);
      else next.add(fullPath);
      return next;
    });
  }, []);

  const toggleAllLeft = useCallback(
    (value: boolean) => {
      setLeftSelected(
        value
          ? new Set(leftItems.filter((i) => i.removable).map((i) => i.fullPath))
          : new Set(),
      );
    },
    [leftItems],
  );

  const trashSelectedLeft = useCallback(async () => {
    const paths = leftItems
      .filter((i) => i.removable && leftSelected.has(i.fullPath))
      .map((i) => i.fullPath);
    if (paths.length === 0) return;
    setLeftCleaning(true);
    try {
      const report = await trashPaths(paths);
      setLeftResult(report);
      const removed = new Set(paths);
      setLeftItems((prev) => prev.filter((i) => !removed.has(i.fullPath)));
      setLeftSelected(new Set());
      void notify(
        "Leftovers removed",
        `Moved ${formatBytes(report.bytes)} to the Trash · ${report.removed} items`,
      );
      logHistory("leftovers", "Leftovers", report.bytes, report.removed);
    } catch {
      setLeftResult({ bytes: 0, removed: 0, failed: paths.length });
    }
    setLeftCleaning(false);
  }, [leftItems, leftSelected]);

  /* ---- Large files ---- */
  const scanBig = useCallback(async () => {
    setBigPhase("scanning");
    setBigSelected(new Set());
    setBigResult(null);
    try {
      setBigFiles(await scanBigFiles());
    } catch {
      setBigFiles([]);
    }
    setBigPhase("done");
  }, []);

  const toggleBig = useCallback((path: string) => {
    setBigSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const toggleAllBig = useCallback(
    (value: boolean) => {
      setBigSelected(value ? new Set(bigFiles.map((f) => f.path)) : new Set());
    },
    [bigFiles],
  );

  const trashSelectedBig = useCallback(async () => {
    const paths = bigFiles
      .filter((f) => bigSelected.has(f.path))
      .map((f) => f.path);
    if (paths.length === 0) return;
    setBigCleaning(true);
    try {
      const report = await trashPaths(paths);
      setBigResult(report);
      const removed = new Set(paths);
      setBigFiles((prev) => prev.filter((f) => !removed.has(f.path)));
      setBigSelected(new Set());
      void notify(
        "Large files removed",
        `Moved ${formatBytes(report.bytes)} to the Trash · ${report.removed} files`,
      );
      logHistory("large", "Large files", report.bytes, report.removed);
    } catch {
      setBigResult({ bytes: 0, removed: 0, failed: paths.length });
    }
    setBigCleaning(false);
  }, [bigFiles, bigSelected]);

  /* ---- Duplicates ---- */
  const scanDup = useCallback(async () => {
    setDupPhase("scanning");
    setDupResult(null);
    try {
      setDupGroups(await scanDuplicates());
    } catch {
      setDupGroups([]);
    }
    setDupPhase("done");
  }, []);

  const trashDup = useCallback(async (paths: string[]) => {
    if (paths.length === 0) return;
    setDupCleaning(true);
    try {
      const report = await trashPaths(paths);
      setDupResult(report);
      const removed = new Set(paths);
      // Drop trashed files; a set with one copy left is no longer a duplicate.
      setDupGroups((prev) =>
        prev
          .map((g) => ({
            ...g,
            files: g.files.filter((f) => !removed.has(f.path)),
          }))
          .filter((g) => g.files.length > 1),
      );
      void notify(
        "Duplicates removed",
        `Moved ${formatBytes(report.bytes)} to the Trash · ${report.removed} files`,
      );
      logHistory("duplicates", "Duplicates", report.bytes, report.removed);
    } catch {
      setDupResult({ bytes: 0, removed: 0, failed: paths.length });
    }
    setDupCleaning(false);
  }, []);

  /* ---- Developer junk ---- */
  const scanDev = useCallback(async () => {
    setDevPhase("scanning");
    setDevResult(null);
    try {
      const targets = await scanDevJunk();
      setDevTargets(targets);
      // Pre-select the safe (non-caution) caches.
      setDevSelected(
        new Set(targets.filter((t) => !t.caution).map((t) => t.path)),
      );
    } catch {
      setDevTargets([]);
      setDevSelected(new Set());
    }
    setDevPhase("done");
  }, []);

  const toggleDev = useCallback((path: string) => {
    setDevSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const toggleAllDev = useCallback(
    (value: boolean) => {
      setDevSelected(value ? new Set(devTargets.map((t) => t.path)) : new Set());
    },
    [devTargets],
  );

  const trashSelectedDev = useCallback(async () => {
    const paths = devTargets
      .filter((t) => devSelected.has(t.path))
      .map((t) => t.path);
    if (paths.length === 0) return;
    setDevCleaning(true);
    try {
      const report = await trashPaths(paths);
      setDevResult(report);
      const removed = new Set(paths);
      setDevTargets((prev) => prev.filter((t) => !removed.has(t.path)));
      setDevSelected(new Set());
      void notify(
        "Developer caches cleared",
        `Moved ${formatBytes(report.bytes)} to the Trash`,
      );
      logHistory("developer", "Developer caches", report.bytes, report.removed);
    } catch {
      setDevResult({ bytes: 0, removed: 0, failed: paths.length });
    }
    setDevCleaning(false);
  }, [devTargets, devSelected]);

  /* ---- Uninstall (from the app detail drawer) ---- */
  const requestUninstall = useCallback(async (app: UpdatableApp) => {
    setUninTarget(app);
    setUninBundle(null);
    setUninLoadingFiles(true);
    try {
      setUninBundle(await appFiles(app));
    } catch {
      setUninBundle({ files: [], totalSize: 0 });
    }
    setUninLoadingFiles(false);
  }, []);

  const confirmUninstall = useCallback(async () => {
    if (!uninTarget || !uninBundle) return;
    const target = uninTarget;
    const paths = uninBundle.files.map((f) => f.fullPath);
    setUninstalling(true);
    try {
      const report = await uninstallApp(paths);
      setUpdApps((prev) => prev.filter((a) => a.bundleId !== target.bundleId));
      void notify(
        `Uninstalled ${target.name}`,
        `Moved ${formatBytes(report.bytes)} to the Trash · ${report.removed} items`,
      );
      logHistory("uninstall", `Uninstalled ${target.name}`, report.bytes, report.removed);
    } catch {
      /* keep the app in the list on failure */
    }
    setUninstalling(false);
    setUninTarget(null);
    setUninBundle(null);
    setSelectedUpdId(null);
  }, [uninTarget, uninBundle]);

  /* ---- Updates ---- */
  const checkUpd = useCallback(async () => {
    setUpdLoading(true);
    setUpdFailed({});
    try {
      setUpdApps(await checkUpdates());
    } catch {
      setUpdApps([]);
    }
    setUpdLoading(false);
  }, []);

  // Opt-in: measure every app's on-disk footprint, then show + allow sort by size.
  const measureAppSizes = useCallback(async () => {
    setSizingApps(true);
    try {
      const sizes = await appSizes();
      const map: Record<string, number> = {};
      for (const s of sizes) map[s.path] = s.size;
      setAppSizeMap(map);
    } catch {
      /* leave sizes unmeasured */
    }
    setSizingApps(false);
  }, []);

  // Smart Scan — run every check in one pass, then land on the health score.
  const smartScan = useCallback(async () => {
    setView("overview");
    setSmartPhase("scanning");
    setSmartProgress(0.04);
    setSmartStep("Inspecting junk…");
    await scan();
    setSmartProgress(0.5);
    setSmartStep("Finding leftovers…");
    await scanLeft();
    setSmartProgress(0.7);
    setSmartStep("Reading startup items…");
    setPerfLoaded(true);
    setStartupItems(await listStartupItems().catch(() => []));
    setSmartProgress(0.85);
    setSmartStep("Checking for updates…");
    setUpdLoaded(true);
    await checkUpd();
    setSmartProgress(1);
    setSmartScannedAt(Date.now());
    setSmartPhase("done");
  }, [scan, scanLeft, checkUpd]);

  // Lazily check for updates the first time Updates is opened.
  useEffect(() => {
    if (view !== "apps" || updLoaded) return;
    setUpdLoaded(true);
    void checkUpd();
  }, [view, updLoaded, checkUpd]);

  // Lazily load startup items the first time Performance is opened.
  useEffect(() => {
    if (view !== "performance" || perfLoaded) return;
    setPerfLoaded(true);
    setPerfLoading(true);
    listStartupItems()
      .then(setStartupItems)
      .catch(() => setStartupItems([]))
      .finally(() => setPerfLoading(false));
  }, [view, perfLoaded]);

  const toggleStartup = useCallback(
    async (item: StartupItem, enabled: boolean) => {
      setStartupBusy((prev) => new Set(prev).add(item.id));
      const ok = await setStartupEnabled(item, enabled).catch(() => false);
      if (ok) {
        if (item.kind === "login" && !enabled) {
          setStartupItems((prev) => prev.filter((i) => i.id !== item.id));
        } else {
          setStartupItems((prev) =>
            prev.map((i) => (i.id === item.id ? { ...i, enabled } : i)),
          );
        }
      }
      setStartupBusy((prev) => {
        const n = new Set(prev);
        n.delete(item.id);
        return n;
      });
    },
    [],
  );

  // Stream upgrade progress / completion from the backend.
  useEffect(() => {
    let un: (() => void) | undefined;
    void listenUpdate(
      (p) => setUpdProgress((prev) => ({ ...prev, [p.id]: p.line })),
      (d) => {
        setUpgrading((prev) => {
          const n = new Set(prev);
          n.delete(d.id);
          return n;
        });
        setUpdProgress((prev) => {
          const n = { ...prev };
          delete n[d.id];
          return n;
        });
        if (d.success) {
          setUpdApps((prev) =>
            prev.map((a) =>
              a.bundleId === d.id
                ? { ...a, currentVersion: a.latestVersion, updateAvailable: false }
                : a,
            ),
          );
        } else {
          setUpdFailed((prev) => ({ ...prev, [d.id]: d.error ?? "Update failed" }));
        }
      },
    ).then((u) => {
      un = u;
    });
    return () => un?.();
  }, []);

  const updateOne = useCallback((app: UpdatableApp) => {
    if (!app.caskToken) return;
    setUpdFailed((prev) => {
      const n = { ...prev };
      delete n[app.bundleId];
      return n;
    });
    setUpgrading((prev) => new Set(prev).add(app.bundleId));
    void runUpgrade([
      { id: app.bundleId, cask: app.caskToken, name: app.name },
    ]);
  }, []);

  const updateAll = useCallback(() => {
    const items = updApps.filter((a) => a.updateAvailable && a.caskToken);
    if (items.length === 0) return;
    setUpdFailed({});
    setUpgrading((prev) => {
      const n = new Set(prev);
      items.forEach((a) => n.add(a.bundleId));
      return n;
    });
    void runUpgrade(
      items.map((a) => ({ id: a.bundleId, cask: a.caskToken!, name: a.name })),
    );
  }, [updApps]);

  const liveTotals = useMemo(() => {
    let bytes = 0;
    let items = 0;
    for (const meta of CATEGORIES) {
      const s = states[meta.id];
      if (s.status === "done" || s.status === "empty") {
        bytes += s.result?.size ?? 0;
        items += s.result?.fileCount ?? 0;
      } else {
        bytes += live[meta.id]?.bytes ?? 0;
        items += live[meta.id]?.files ?? 0;
      }
    }
    return { bytes, items };
  }, [states, live]);

  const scanning = phase === "scanning";
  const scanned = phase === "done";
  const allSelected = d.selectable > 0 && d.selectedCount === d.selectable;

  // The app shown in the detail drawer, kept in sync with the live list.
  const drawerApp = selectedUpdId
    ? (updApps.find((a) => a.bundleId === selectedUpdId) ?? null)
    : null;

  const statusLabel = scanning
    ? "Scanning…"
    : lastScanAt
      ? `Scanned ${formatAgo(lastScanAt, now)}`
      : "";

  if (!onboarded) {
    return (
      <Onboarding
        onComplete={() => {
          try {
            localStorage.setItem("tclean-onboarded", "1");
          } catch {
            /* ignore */
          }
          setOnboarded(true);
        }}
      />
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-canvas text-ink">
      <Sidebar
        view={view}
        onSelect={setView}
        reclaimable={d.reclaimable}
        scanned={scanned}
      />
      <div className="relative flex min-w-0 flex-1 flex-col">
        <Titlebar
          title={TITLES[view]}
          scanning={scanning}
          scanned={scanned}
          statusLabel={statusLabel}
          theme={theme}
          onToggleTheme={toggle}
          onRescan={() => {
            setCleanResult(null);
            setView("clean");
            void scan();
          }}
        />
        {reminderDue && (
          <ReminderBanner
            frequency={reminders.frequency}
            onScan={() => {
              setReminderDue(false);
              setView("clean");
              void scan();
            }}
            onDismiss={() => setReminderDue(false)}
          />
        )}
        <main className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]">
          {view === "overview" && (
            <OverviewView
              phase={smartPhase}
              step={smartStep}
              progress={smartProgress}
              disk={disk}
              reclaimable={d.reclaimable}
              junkBytes={d.totalFound}
              leftoverCount={leftItems.filter((i) => i.removable).length}
              updateCount={updApps.filter((a) => a.updateAvailable).length}
              startupCount={startupItems.filter((i) => i.enabled).length}
              scannedAt={smartScannedAt}
              now={now}
              onSmartScan={() => void smartScan()}
              onGoto={setView}
            />
          )}
          {view === "clean" && (
            <CleanView
              phase={phase}
              states={states}
              scanning={scanning}
              reclaimable={d.reclaimable}
              totalFound={d.totalFound}
              itemsFound={d.itemsFound}
              selectedCount={d.selectedCount}
              allSelected={allSelected}
              progress={progress}
              live={live}
              scannedBytes={liveTotals.bytes}
              scannedItems={liveTotals.items}
              cleanResult={cleanResult}
              emptyingTrash={emptyingTrash}
              onScan={() => void scan()}
              onToggle={toggleCategory}
              onSelectAll={selectAll}
              onRequestClean={() => setModalOpen(true)}
              onDismissResult={() => setCleanResult(null)}
              onEmptyTrash={() => void handleEmptyTrash()}
            />
          )}
          {view === "storage" && (
            <StorageView
              disk={disk}
              states={states}
              reclaimable={d.reclaimable}
              scanned={scanned}
              onScan={() => void scan()}
            />
          )}
          {view === "large" && (
            <LargeFilesView
              phase={bigPhase}
              files={bigFiles}
              selected={bigSelected}
              cleaning={bigCleaning}
              result={bigResult}
              now={now}
              onScan={() => void scanBig()}
              onToggle={toggleBig}
              onToggleAll={toggleAllBig}
              onTrashSelected={() => void trashSelectedBig()}
              onDismissResult={() => setBigResult(null)}
            />
          )}
          {view === "duplicates" && (
            <DuplicatesView
              phase={dupPhase}
              groups={dupGroups}
              cleaning={dupCleaning}
              result={dupResult}
              onScan={() => void scanDup()}
              onTrash={(paths) => void trashDup(paths)}
              onDismissResult={() => setDupResult(null)}
            />
          )}
          {view === "developer" && (
            <DeveloperView
              phase={devPhase}
              targets={devTargets}
              selected={devSelected}
              cleaning={devCleaning}
              result={devResult}
              onScan={() => void scanDev()}
              onToggle={toggleDev}
              onToggleAll={toggleAllDev}
              onTrashSelected={() => void trashSelectedDev()}
              onDismissResult={() => setDevResult(null)}
            />
          )}
          {view === "leftovers" && (
            <LeftoversView
              phase={leftPhase}
              items={leftItems}
              selected={leftSelected}
              cleaning={leftCleaning}
              result={leftResult}
              onScan={() => void scanLeft()}
              onToggle={toggleLeft}
              onToggleAll={toggleAllLeft}
              onTrashSelected={() => void trashSelectedLeft()}
              onDismissResult={() => setLeftResult(null)}
            />
          )}
          {view === "apps" && (
            <AppsView
              apps={updApps}
              loading={updLoading}
              upgrading={upgrading}
              progress={updProgress}
              failed={updFailed}
              sizes={appSizeMap}
              sizing={sizingApps}
              onMeasureSizes={() => void measureAppSizes()}
              onCheck={() => void checkUpd()}
              onUpdate={updateOne}
              onUpdateAll={updateAll}
              onSelect={(app) => setSelectedUpdId(app.bundleId)}
              onUninstall={(app) => void requestUninstall(app)}
            />
          )}
          {view === "performance" && (
            <PerformanceView
              items={startupItems}
              loading={perfLoading}
              busy={startupBusy}
              onToggle={(item, enabled) => void toggleStartup(item, enabled)}
              onReveal={(path) => void revealInFinder(path)}
            />
          )}
          {view === "settings" && (
            <SettingsView
              reminders={reminders}
              onChangeReminders={updateReminders}
              history={history}
              now={now}
              onClearHistory={() => {
                clearHistory();
                setHistory([]);
              }}
            />
          )}
        </main>

        <AppDetailDrawer
          app={drawerApp}
          upgrading={drawerApp ? upgrading.has(drawerApp.bundleId) : false}
          progressLine={drawerApp ? updProgress[drawerApp.bundleId] : undefined}
          failed={drawerApp ? updFailed[drawerApp.bundleId] : undefined}
          onClose={() => setSelectedUpdId(null)}
          onUpdate={updateOne}
          onUninstall={(app) => void requestUninstall(app)}
        />
      </div>

      <UninstallModal
        open={uninTarget !== null}
        appName={uninTarget?.name ?? ""}
        appIcon={uninTarget?.icon ?? null}
        bundle={uninBundle}
        loading={uninLoadingFiles}
        uninstalling={uninstalling}
        onClose={() => {
          setUninTarget(null);
          setUninBundle(null);
        }}
        onConfirm={() => void confirmUninstall()}
      />

      <ConfirmCleanModal
        open={modalOpen}
        items={d.items}
        totalBytes={d.reclaimable}
        totalItems={d.selectedItems}
        cleaning={cleaning}
        onCancel={() => setModalOpen(false)}
        onConfirm={(permanent) => void confirmClean(permanent)}
      />

      {celebration && (
        <CleanupCelebration
          bytes={celebration.bytes}
          count={celebration.count}
          onDone={() => setCelebration(null)}
        />
      )}
    </div>
  );
}
