import { HardDrives } from "@phosphor-icons/react";
import { CATEGORIES } from "../data/categories";
import type { CategoryId, CategoryState, DiskUsage } from "../lib/types";
import { formatBytes } from "../lib/format";
import { Button } from "../components/Button";
import { Watermark } from "../components/Watermark";

interface StorageViewProps {
  disk: DiskUsage | null;
  states: Record<CategoryId, CategoryState>;
  reclaimable: number;
  scanned: boolean;
  onScan: () => void;
}

export function StorageView({
  disk,
  states,
  reclaimable,
  scanned,
  onScan,
}: StorageViewProps) {
  if (!scanned || !disk) {
    return (
      <div className="relative grid h-full place-items-center overflow-hidden px-7">
        <Watermark />
        <div className="animate-fade-up relative flex max-w-sm flex-col items-center text-center">
          <div className="grid size-16 place-items-center rounded-xl bg-accent-surface text-accent">
            <HardDrives size={30} weight="fill" />
          </div>
          <h2 className="mt-6 text-[21px] font-semibold tracking-[-0.01em] text-ink">
            See what's using your disk
          </h2>
          <p className="mt-2.5 text-[14px] leading-relaxed text-muted">
            Run a scan to break down your storage and see how much space you can
            reclaim.
          </p>
          <Button className="mt-7" onClick={onScan}>
            Scan my Mac
          </Button>
        </div>
      </div>
    );
  }

  const { total, used, free } = disk;
  const reclaimPct = total > 0 ? (reclaimable / total) * 100 : 0;
  const usedPct = total > 0 ? (used / total) * 100 : 0;
  const inUsePct = Math.max(usedPct - reclaimPct, 0);

  const rows = CATEGORIES.map((meta) => ({
    meta,
    size: states[meta.id]?.result?.size ?? 0,
  }))
    .filter((r) => r.size > 0)
    .sort((a, b) => b.size - a.size);
  const max = rows[0]?.size ?? 1;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-7 py-7">
      <section className="animate-fade-up rounded-xl border border-line bg-surface p-6 shadow-tiny">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-ink">
            Macintosh HD
          </h2>
          <span className="tnum text-[12.5px] text-faint">
            {formatBytes(free)} free of {formatBytes(total)}
          </span>
        </div>

        <div className="mt-4 flex h-3.5 w-full overflow-hidden rounded-full bg-inset">
          <div
            className="h-full bg-accent transition-[width] duration-700"
            style={{ width: `${reclaimPct}%` }}
          />
          <div
            className="h-full bg-faint transition-[width] duration-700"
            style={{ width: `${inUsePct}%` }}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-[12.5px]">
          <Legend swatch="bg-accent" label="Reclaimable" value={formatBytes(reclaimable)} />
          <Legend swatch="bg-faint" label="In use" value={formatBytes(used)} />
          <Legend swatch="bg-inset border border-line" label="Free" value={formatBytes(free)} />
        </div>
      </section>

      <section className="animate-fade-up rounded-xl border border-line bg-surface p-6 shadow-tiny [animation-delay:60ms]">
        <h3 className="text-[11px] font-medium uppercase tracking-[0.06em] text-faint">
          What's taking space
        </h3>
        <div className="mt-4 flex flex-col gap-4">
          {rows.length === 0 ? (
            <p className="text-[13.5px] text-faint">Nothing notable found.</p>
          ) : (
            rows.map(({ meta, size }) => {
              const { Icon } = meta;
              return (
                <div key={meta.id} className="flex items-center gap-3.5">
                  <Icon size={18} weight="fill" className="shrink-0 text-muted" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-[14px] text-ink">
                        {meta.name}
                      </span>
                      <span className="tnum shrink-0 text-[13px] font-medium text-muted">
                        {formatBytes(size)}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-inset">
                      <div
                        className="h-full rounded-full bg-accent transition-[width] duration-700"
                        style={{ width: `${(size / max) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}

function Legend({
  swatch,
  label,
  value,
}: {
  swatch: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={`size-2.5 rounded-full ${swatch}`} />
      <span className="text-muted">{label}</span>
      <span className="tnum font-medium text-ink">{value}</span>
    </div>
  );
}
