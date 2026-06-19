import {
  AppWindow,
  ArrowRight,
  Broom,
  Gauge,
  Ghost,
  MagicWand,
  type Icon,
} from "@phosphor-icons/react";
import type { ViewId } from "../components/Sidebar";
import type { DiskUsage } from "../lib/types";
import { computeHealth } from "../lib/health";
import { formatAgo, formatBytes, formatCount } from "../lib/format";
import { Button } from "../components/Button";
import { Watermark } from "../components/Watermark";
import { SmartScanLoader } from "../components/SmartScanLoader";
import { HealthGauge } from "../components/HealthGauge";

export type OverviewPhase = "idle" | "scanning" | "done";

interface OverviewViewProps {
  phase: OverviewPhase;
  step: string;
  progress: number;
  disk: DiskUsage | null;
  reclaimable: number;
  junkBytes: number;
  leftoverCount: number;
  updateCount: number;
  startupCount: number;
  scannedAt: number | null;
  now: number;
  onSmartScan: () => void;
  onGoto: (view: ViewId) => void;
}

export function OverviewView(props: OverviewViewProps) {
  const { phase, step, progress } = props;

  if (phase === "idle") return <FirstRun onSmartScan={props.onSmartScan} />;
  if (phase === "scanning")
    return (
      <div className="grid h-full place-items-center px-7">
        <SmartScanLoader
          progress={progress}
          label={step || "Running a full sweep…"}
        />
      </div>
    );
  return <Result {...props} />;
}

/* ---- Idle / first run ---- */
function FirstRun({ onSmartScan }: { onSmartScan: () => void }) {
  return (
    <div className="relative grid h-full place-items-center overflow-hidden px-7">
      <Watermark />
      <div className="animate-fade-up relative flex max-w-md flex-col items-center text-center">
        <div className="grid size-16 place-items-center rounded-xl bg-accent-surface text-accent">
          <MagicWand size={30} weight="fill" />
        </div>
        <h2 className="mt-6 text-[22px] font-semibold tracking-[-0.01em] text-ink">
          One scan, the whole picture
        </h2>
        <p className="mt-2.5 text-[14px] leading-relaxed text-muted">
          Smart Scan checks junk, leftovers, app updates and startup load in one
          pass, then sums it up as a single disk-health score. Nothing is removed
          without your go-ahead.
        </p>
        <Button
          className="mt-7"
          icon={<MagicWand size={17} weight="fill" />}
          onClick={onSmartScan}
        >
          Smart Scan
        </Button>
        <p className="mt-4 text-[12px] text-faint">
          Takes a few seconds · runs entirely on your device
        </p>
      </div>
    </div>
  );
}

/* ---- Done ---- */
function Result({
  disk,
  reclaimable,
  junkBytes,
  leftoverCount,
  updateCount,
  startupCount,
  scannedAt,
  now,
  onSmartScan,
  onGoto,
}: OverviewViewProps) {
  const health = computeHealth({
    freeFraction: disk && disk.total > 0 ? disk.free / disk.total : null,
    reclaimableBytes: reclaimable,
    leftoverCount,
    updateCount,
    startupCount,
  });

  const freePct = disk && disk.total > 0 ? (disk.free / disk.total) * 100 : 0;

  const cards: {
    key: ViewId;
    Icon: Icon;
    label: string;
    value: string;
    hint: string;
    accent: boolean;
  }[] = [
    {
      key: "clean",
      Icon: Broom,
      label: "Junk to clean",
      value: junkBytes > 0 ? formatBytes(reclaimable) : "Clean",
      hint:
        junkBytes > 0
          ? `${formatBytes(junkBytes)} found`
          : "Nothing to clear",
      accent: reclaimable > 0,
    },
    {
      key: "leftovers",
      Icon: Ghost,
      label: "Leftovers",
      value: leftoverCount > 0 ? formatCount(leftoverCount) : "None",
      hint: leftoverCount > 0 ? "orphaned items" : "All tidy",
      accent: leftoverCount > 0,
    },
    {
      key: "apps",
      Icon: AppWindow,
      label: "Updates",
      value: updateCount > 0 ? formatCount(updateCount) : "Up to date",
      hint: updateCount > 0 ? "apps can update" : "All current",
      accent: updateCount > 0,
    },
    {
      key: "performance",
      Icon: Gauge,
      label: "Startup items",
      value: formatCount(startupCount),
      hint: "run at login",
      accent: false,
    },
  ];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-7 py-7">
      {/* Hero: health gauge + summary */}
      <section className="animate-fade-up flex flex-col items-center gap-7 rounded-xl border border-line bg-surface p-7 shadow-soft sm:flex-row sm:gap-9">
        <HealthGauge score={health.score} label={health.label} />

        <div className="min-w-0 flex-1 text-center sm:text-left">
          <div className="text-[11px] font-medium uppercase tracking-[0.07em] text-faint">
            Disk health
          </div>
          <h2 className="mt-1 text-[21px] font-semibold tracking-[-0.01em] text-ink">
            {reclaimable > 0
              ? `${formatBytes(reclaimable)} ready to reclaim`
              : "Your Mac is in good shape"}
          </h2>
          <p className="mt-1.5 text-[14px] leading-relaxed text-muted">
            {disk
              ? `${formatBytes(disk.free)} free of ${formatBytes(disk.total)} · ${Math.round(freePct)}% available`
              : "Smart Scan finished."}
          </p>

          {health.factors.length > 0 ? (
            <div className="mt-3.5 flex flex-wrap justify-center gap-1.5 sm:justify-start">
              {health.factors.map((f) => (
                <span
                  key={f.label}
                  className="tnum rounded-full bg-inset px-2.5 py-1 text-[11.5px] font-medium text-muted"
                >
                  {f.label}{" "}
                  <span className="text-caution">−{f.delta}</span>
                </span>
              ))}
            </div>
          ) : (
            <div className="mt-3.5 text-[12.5px] font-medium text-accent">
              Nothing dragging it down — nice work.
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5 sm:justify-start">
            {reclaimable > 0 && (
              <Button
                icon={<Broom size={17} weight="fill" />}
                onClick={() => onGoto("clean")}
              >
                Review &amp; clean {formatBytes(reclaimable)}
              </Button>
            )}
            <Button variant={reclaimable > 0 ? "ghost" : "primary"} onClick={onSmartScan}>
              Rescan
            </Button>
          </div>
        </div>
      </section>

      {/* Summary cards */}
      <section className="grid grid-cols-2 gap-3">
        {cards.map((c, i) => (
          <button
            key={c.key}
            onClick={() => onGoto(c.key)}
            style={{ animationDelay: `${i * 50}ms` }}
            className="animate-fade-up group flex items-center gap-3.5 rounded-xl border border-line bg-surface p-4 text-left shadow-tiny transition-colors hover:border-accent/40 hover:bg-inset/40"
          >
            <div
              className={
                "grid size-10 shrink-0 place-items-center rounded-md transition-colors " +
                (c.accent
                  ? "bg-accent-surface text-accent"
                  : "bg-inset text-muted")
              }
            >
              <c.Icon size={20} weight="fill" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-faint">
                {c.label}
              </div>
              <div className="truncate text-[16px] font-semibold text-ink">
                {c.value}
              </div>
              <div className="truncate text-[12px] text-faint">{c.hint}</div>
            </div>
            <ArrowRight
              size={16}
              weight="bold"
              className="shrink-0 text-faint opacity-0 transition-opacity group-hover:opacity-100"
            />
          </button>
        ))}
      </section>

      {scannedAt && (
        <p className="px-1 text-center text-[12px] text-faint">
          Smart Scan · {formatAgo(scannedAt, now)}
        </p>
      )}
    </div>
  );
}
