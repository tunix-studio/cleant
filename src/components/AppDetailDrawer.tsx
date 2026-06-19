import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowCircleUp,
  ArrowRight,
  ArrowSquareOut,
  CheckCircle,
  CircleNotch,
  FolderOpen,
  Trash,
  X,
} from "@phosphor-icons/react";
import type { AppSource, UpdatableApp } from "../lib/types";
import { appSize, openExternal, revealInFinder } from "../lib/api";
import { formatBytes } from "../lib/format";
import { cn } from "../lib/cn";
import { Button } from "./Button";

const SOURCE_LABEL: Record<AppSource, string> = {
  homebrew: "Homebrew",
  appstore: "App Store",
  direct: "Direct download",
};

interface Props {
  app: UpdatableApp | null;
  upgrading: boolean;
  progressLine?: string;
  failed?: string;
  onClose: () => void;
  onUpdate: (app: UpdatableApp) => void;
  onUninstall: (app: UpdatableApp) => void;
}

export function AppDetailDrawer({
  app,
  upgrading,
  progressLine,
  failed,
  onClose,
  onUpdate,
  onUninstall,
}: Props) {
  // keep the last app rendered so content persists through the slide-out
  const cache = useRef<UpdatableApp | null>(null);
  if (app) cache.current = app;
  const shown = app ?? cache.current;
  const open = app !== null;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden
        className={cn(
          "absolute inset-0 z-30 bg-black/25 transition-opacity duration-300",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <aside
        className={cn(
          "absolute right-0 top-0 z-40 flex h-full w-[380px] flex-col border-l border-line bg-surface shadow-pop transition-transform duration-300 ease-[cubic-bezier(0.2,0,0,1)]",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        {shown && (
          <DrawerBody
            app={shown}
            upgrading={upgrading}
            progressLine={progressLine}
            failed={failed}
            onClose={onClose}
            onUpdate={onUpdate}
            onUninstall={onUninstall}
          />
        )}
      </aside>
    </>
  );
}

function DrawerBody({
  app,
  upgrading,
  progressLine,
  failed,
  onClose,
  onUpdate,
  onUninstall,
}: {
  app: UpdatableApp;
  upgrading: boolean;
  progressLine?: string;
  failed?: string;
  onClose: () => void;
  onUpdate: (app: UpdatableApp) => void;
  onUninstall: (app: UpdatableApp) => void;
}) {
  const [size, setSize] = useState<number | null>(null);
  useEffect(() => {
    setSize(null);
    let cancelled = false;
    void appSize(app.path).then((b) => {
      if (!cancelled) setSize(b);
    });
    return () => {
      cancelled = true;
    };
  }, [app.path]);

  const showUpdate = app.updateAvailable;
  const caskPage =
    app.source === "homebrew" && app.caskToken
      ? `https://formulae.brew.sh/cask/${app.caskToken}`
      : null;

  return (
    <>
      {/* header */}
      <div data-tauri-drag-region className="flex items-start gap-3.5 px-5 pb-4 pt-5">
        {app.icon ? (
          <img
            src={app.icon}
            alt=""
            className="size-12 shrink-0 rounded-[10px] object-contain"
            draggable={false}
          />
        ) : (
          <div className="grid size-12 shrink-0 place-items-center rounded-[10px] bg-inset text-[18px] font-semibold text-muted">
            {app.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="truncate text-[16px] font-semibold tracking-[-0.01em] text-ink">
            {app.name}
          </div>
          <div className="mt-0.5 truncate text-[12.5px] text-muted">
            {app.developer}
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="grid size-7 shrink-0 place-items-center rounded-lg text-faint transition-colors hover:bg-inset hover:text-ink"
        >
          <X size={16} weight="bold" />
        </button>
      </div>

      {/* status / primary action */}
      <div className="px-5 pb-4">
        <div className="flex items-center justify-between gap-3 rounded-[12px] border border-line bg-canvas px-4 py-3">
          <div className="min-w-0">
            {showUpdate ? (
              <div className="tnum flex items-center gap-1.5 text-[13px]">
                <span className="text-faint">{app.currentVersion}</span>
                <ArrowRight size={13} weight="bold" className="text-faint" />
                <span className="font-semibold text-accent">
                  {app.latestVersion}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-[13px] font-medium text-muted">
                <CheckCircle size={16} weight="fill" className="text-mint" /> Up
                to date
              </div>
            )}
            <div
              className={cn(
                "mt-0.5 truncate text-[11.5px]",
                failed && !upgrading ? "text-rose" : "text-faint",
              )}
            >
              {upgrading
                ? (progressLine ?? "Updating…")
                : failed
                  ? "Update failed — try again"
                  : showUpdate
                    ? "Update ready"
                    : `Version ${app.currentVersion}`}
            </div>
          </div>
          {upgrading ? (
            <span className="inline-flex shrink-0 items-center gap-1.5 text-[12.5px] font-medium text-accent">
              <CircleNotch size={16} weight="bold" className="animate-spin" />
              Updating
            </span>
          ) : showUpdate ? (
            <Button
              size="sm"
              className="shrink-0"
              onClick={() => onUpdate(app)}
              icon={<ArrowCircleUp size={15} weight="fill" />}
            >
              {failed ? "Retry" : "Update"}
            </Button>
          ) : null}
        </div>
      </div>

      {/* details */}
      <div className="flex-1 overflow-y-auto">
        <Section title="Information">
          <div className="divide-y divide-line">
            <Meta label="Source" value={SOURCE_LABEL[app.source]} />
            <Meta label="Category" value={app.category} />
            <Meta label="Installed version" value={app.currentVersion} />
            {showUpdate && (
              <Meta label="Latest version" value={app.latestVersion} accent />
            )}
            <Meta
              label="Size"
              value={size === null ? "…" : formatBytes(size)}
            />
            <Meta label="Bundle ID" value={app.bundleId || "—"} mono />
          </div>
        </Section>

        <Section title="Location">
          <button
            onClick={() => void revealInFinder(app.path)}
            className="group flex w-full items-center gap-2 text-left"
          >
            <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-muted">
              {app.path}
            </span>
            <FolderOpen
              size={15}
              weight="fill"
              className="shrink-0 text-faint transition-colors group-hover:text-accent"
            />
          </button>
        </Section>
      </div>

      {/* footer actions */}
      <div className="space-y-2 border-t border-line p-4">
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            onClick={() => void revealInFinder(app.path)}
            className="justify-center"
            icon={<FolderOpen size={15} weight="fill" />}
          >
            Reveal
          </Button>
          <Button
            variant="secondary"
            disabled={!caskPage}
            onClick={() => caskPage && void openExternal(caskPage)}
            title={
              caskPage
                ? "Release notes & version history"
                : "Available for Homebrew apps"
            }
            className="justify-center"
            icon={<ArrowSquareOut size={15} weight="bold" />}
          >
            Release notes
          </Button>
        </div>
        <Button
          variant="secondary"
          onClick={() => onUninstall(app)}
          className="w-full justify-center border-transparent bg-caution-surface text-caution hover:brightness-[0.97]"
          icon={<Trash size={15} weight="fill" />}
        >
          Uninstall…
        </Button>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-b border-line px-5 py-4">
      <h3 className="pb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-faint">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Meta({
  label,
  value,
  accent = false,
  mono = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-[12.5px]">
      <span className="shrink-0 text-muted">{label}</span>
      <span
        className={cn(
          "min-w-0 truncate text-right font-medium",
          accent ? "text-accent" : "text-ink",
          mono && "font-mono text-[11.5px]",
        )}
      >
        {value}
      </span>
    </div>
  );
}
