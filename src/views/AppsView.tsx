import { useState } from "react";
import {
  AppWindow,
  ArrowCircleUp,
  ArrowRight,
  ArrowSquareOut,
  CircleNotch,
  HardDrives,
  MagnifyingGlass,
  Trash,
} from "@phosphor-icons/react";
import type { AppSource, UpdatableApp } from "../lib/types";
import { openExternal } from "../lib/api";
import { formatBytes } from "../lib/format";
import { cn } from "../lib/cn";
import { Button } from "../components/Button";
import { Segmented } from "../components/Segmented";
import { DolphinLoader } from "../components/DolphinLoader";

const FILTER_LABEL: Record<string, string> = {
  all: "All apps",
  updates: "Updates available",
  homebrew: "Homebrew",
  appstore: "App Store",
  direct: "Direct download",
};

interface AppsViewProps {
  apps: UpdatableApp[];
  loading: boolean;
  upgrading: Set<string>;
  progress: Record<string, string>;
  failed: Record<string, string>;
  sizes: Record<string, number>;
  sizing: boolean;
  onMeasureSizes: () => void;
  onCheck: () => void;
  onUpdate: (app: UpdatableApp) => void;
  onUpdateAll: () => void;
  onSelect: (app: UpdatableApp) => void;
  onUninstall: (app: UpdatableApp) => void;
}

export function AppsView({
  apps,
  loading,
  upgrading,
  progress,
  failed,
  sizes,
  sizing,
  onMeasureSizes,
  onCheck,
  onUpdate,
  onUpdateAll,
  onSelect,
  onUninstall,
}: AppsViewProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [bySize, setBySize] = useState(false);
  const measured = Object.keys(sizes).length > 0;

  if (loading) {
    return (
      <div className="grid h-full place-items-center px-7">
        <DolphinLoader label="Reading your applications…" />
      </div>
    );
  }

  const q = search.trim().toLowerCase();
  const bySource = (s: AppSource) => apps.filter((a) => a.source === s).length;
  const visible = apps
    .filter((a) => a.name.toLowerCase().includes(q))
    .filter((a) => {
      if (filter === "all") return true;
      if (filter === "updates") return a.updateAvailable;
      return a.source === filter;
    })
    .sort((a, b) =>
      bySize && measured
        ? (sizes[b.path] ?? 0) - (sizes[a.path] ?? 0)
        : Number(b.updateAvailable) - Number(a.updateAvailable) ||
          a.name.localeCompare(b.name),
    );
  const updatableInView = visible.filter((a) => a.updateAvailable);
  const anyUpgrading = upgrading.size > 0;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-7 py-7">
      {/* Search */}
      <div className="relative">
        <MagnifyingGlass
          size={17}
          weight="bold"
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint"
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search applications…"
          className="h-11 w-full rounded-md border border-line bg-surface pl-10 pr-4 text-[14px] text-ink outline-none transition-colors placeholder:text-faint focus:border-accent"
        />
      </div>

      {/* Source filter */}
      <Segmented
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: "All", count: apps.length },
          {
            value: "updates",
            label: "Updates",
            count: apps.filter((a) => a.updateAvailable).length,
          },
          { value: "homebrew", label: "Homebrew", count: bySource("homebrew") },
          { value: "appstore", label: "App Store", count: bySource("appstore") },
          { value: "direct", label: "Direct", count: bySource("direct") },
        ]}
      />

      {/* List */}
      <section
        key={filter}
        className="animate-fade-in overflow-hidden rounded-xl border border-line bg-surface shadow-tiny"
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-faint">
            {FILTER_LABEL[filter]} · {visible.length}
          </span>
          <div className="flex items-center gap-3">
            {measured ? (
              <button
                onClick={() => setBySize((v) => !v)}
                className={cn(
                  "flex items-center gap-1.5 text-[12px] font-medium transition-colors",
                  bySize ? "text-accent" : "text-muted hover:text-accent",
                )}
              >
                <HardDrives size={14} weight="fill" />
                {bySize ? "Largest first" : "By size"}
              </button>
            ) : (
              <button
                onClick={onMeasureSizes}
                disabled={sizing}
                className="flex items-center gap-1.5 text-[12px] font-medium text-muted transition-colors hover:text-accent disabled:opacity-60"
              >
                {sizing ? (
                  <CircleNotch size={13} weight="bold" className="animate-spin" />
                ) : (
                  <HardDrives size={14} weight="fill" />
                )}
                {sizing ? "Measuring…" : "Measure sizes"}
              </button>
            )}
            {updatableInView.length > 0 ? (
              <Button
                size="sm"
                onClick={onUpdateAll}
                loading={anyUpgrading}
                icon={<ArrowCircleUp size={15} weight="fill" />}
              >
                Update all · {updatableInView.length}
              </Button>
            ) : (
              <button
                onClick={onCheck}
                className="text-[12px] font-medium text-muted transition-colors hover:text-accent"
              >
                Re-check
              </button>
            )}
          </div>
        </div>
        <div className="border-t border-line">
          {visible.length === 0 ? (
            <p className="px-4 py-6 text-center text-[13.5px] text-faint">
              {q ? `No apps match “${search}”.` : "No apps in this category."}
            </p>
          ) : (
            visible.map((app) => (
              <AppRow
                key={app.bundleId}
                app={app}
                size={sizes[app.path]}
                state={
                  app.updateAvailable
                    ? upgrading.has(app.bundleId)
                      ? "upgrading"
                      : failed[app.bundleId]
                        ? "failed"
                        : "ready"
                    : "installed"
                }
                progressLine={progress[app.bundleId]}
                error={failed[app.bundleId]}
                onUpdate={() => onUpdate(app)}
                onSelect={() => onSelect(app)}
                onUninstall={() => onUninstall(app)}
              />
            ))
          )}
        </div>
      </section>

      <p className="px-1 text-center text-[12px] text-faint">
        Tap an app for details. Update detection uses Homebrew; cleanup moves the
        app &amp; its leftovers to the Trash.
      </p>
    </div>
  );
}

function AppRow({
  app,
  size,
  state,
  progressLine,
  error,
  onUpdate,
  onSelect,
  onUninstall,
}: {
  app: UpdatableApp;
  size?: number;
  state: "ready" | "upgrading" | "failed" | "installed";
  progressLine?: string;
  error?: string;
  onUpdate: () => void;
  onSelect: () => void;
  onUninstall: () => void;
}) {
  const installed = state === "installed";
  return (
    <div
      onClick={onSelect}
      className="group flex cursor-pointer items-center gap-3.5 border-b border-line px-4 py-3 transition-colors last:border-b-0 hover:bg-inset/40"
    >
      <AppIcon app={app} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[14px] font-medium text-ink">
            {app.name}
          </span>
          <SourceBadge source={app.source} />
        </div>
        {state === "upgrading" ? (
          <div className="truncate font-mono text-[11.5px] text-faint">
            {progressLine ?? "Starting…"}
          </div>
        ) : state === "failed" ? (
          <div className="truncate text-[12px] text-rose">{error}</div>
        ) : installed ? (
          <div className="tnum text-[12.5px] text-faint">
            {app.currentVersion}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-[12.5px]">
            <span className="tnum text-faint">{app.currentVersion}</span>
            <ArrowRight size={12} weight="bold" className="text-faint" />
            <span className="tnum font-medium text-accent">
              {app.latestVersion}
            </span>
            <ReleaseNotes app={app} />
          </div>
        )}
      </div>
      {size != null && state !== "upgrading" && (
        <span className="tnum shrink-0 text-[12.5px] font-medium text-muted">
          {formatBytes(size)}
        </span>
      )}
      {state !== "upgrading" && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onUninstall();
          }}
          title={`Uninstall ${app.name}`}
          aria-label={`Uninstall ${app.name}`}
          className="grid size-7 shrink-0 place-items-center rounded-md text-faint opacity-0 transition-all hover:bg-caution-surface hover:text-caution focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Trash size={15} weight="fill" />
        </button>
      )}
      {state === "upgrading" ? (
        <CircleNotch size={18} weight="bold" className="animate-spin text-accent" />
      ) : installed ? (
        <span className="text-[12px] font-medium text-faint transition-colors group-hover:text-accent">
          Details →
        </span>
      ) : (
        <Button
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onUpdate();
          }}
        >
          {state === "failed" ? "Retry" : "Update"}
        </Button>
      )}
    </div>
  );
}

function ReleaseNotes({ app }: { app: UpdatableApp }) {
  if (app.source !== "homebrew" || !app.caskToken) return null;
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        void openExternal(`https://formulae.brew.sh/cask/${app.caskToken}`);
      }}
      title="Release notes & version history"
      className="text-faint transition-colors hover:text-accent"
    >
      <ArrowSquareOut size={14} weight="bold" />
    </button>
  );
}

function SourceBadge({ source }: { source: AppSource }) {
  const map: Record<AppSource, [string, string]> = {
    homebrew: ["Homebrew", "bg-caution-surface text-caution"],
    appstore: ["App Store", "bg-[#3b82f6]/12 text-[#2563eb]"],
    direct: ["Direct", "bg-inset text-faint"],
  };
  const [label, cls] = map[source];
  return (
    <span
      className={cn(
        "rounded-full px-1.5 py-px text-[10px] font-medium uppercase tracking-[0.03em]",
        cls,
      )}
    >
      {label}
    </span>
  );
}

function AppIcon({ app }: { app: UpdatableApp }) {
  if (app.icon) {
    return (
      <img
        src={app.icon}
        alt=""
        className="size-10 shrink-0 rounded-[8px] object-contain"
      />
    );
  }
  return (
    <div className="grid size-10 shrink-0 place-items-center rounded-md bg-inset text-muted">
      <AppWindow size={20} weight="fill" />
    </div>
  );
}
