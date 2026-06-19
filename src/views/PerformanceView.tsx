import { useState } from "react";
import {
  AppWindow,
  ArrowSquareOut,
  CircleNotch,
  Gauge,
  LockSimple,
  WifiHigh,
} from "@phosphor-icons/react";
import type { StartupItem, StartupKind } from "../lib/types";
import { cn } from "../lib/cn";
import { SpeedTestCard } from "../components/SpeedTestCard";
import { Segmented } from "../components/Segmented";
import { DolphinLoader } from "../components/DolphinLoader";

interface PerformanceViewProps {
  items: StartupItem[];
  loading: boolean;
  busy: Set<string>;
  onToggle: (item: StartupItem, enabled: boolean) => void;
  onReveal: (path: string) => void;
}

const GROUPS: { title: string; hint: string; kinds: StartupKind[] }[] = [
  {
    title: "Opens at login",
    hint: "Apps that launch when you sign in. Fewer means a faster boot.",
    kinds: ["login"],
  },
  {
    title: "Background helpers",
    hint: "Updaters and agents that run quietly in the background.",
    kinds: ["userAgent"],
  },
  {
    title: "System (managed by macOS)",
    hint: "Global agents & daemons — view only; macOS or an installer manages these.",
    kinds: ["globalAgent", "systemDaemon"],
  },
];

export function PerformanceView({
  items,
  loading,
  busy,
  onToggle,
  onReveal,
}: PerformanceViewProps) {
  const [tab, setTab] = useState<"startup" | "internet">("startup");

  const onCount = items.filter(
    (i) => i.enabled && (i.kind === "login" || i.kind === "userAgent"),
  ).length;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-7 py-7">
      <Segmented
        value={tab}
        onChange={(v) => setTab(v as "startup" | "internet")}
        options={[
          { value: "startup", label: "Startup", icon: <Gauge size={15} weight="fill" /> },
          {
            value: "internet",
            label: "Internet Speed",
            icon: <WifiHigh size={15} weight="fill" />,
          },
        ]}
      />

      <div key={tab} className="animate-fade-in flex flex-col gap-5">
        {tab === "internet" ? (
        <SpeedTestCard />
      ) : loading ? (
        <div className="grid place-items-center rounded-xl border border-line bg-surface py-12 shadow-tiny">
          <DolphinLoader label="Reading startup items…" />
        </div>
      ) : (
        <>
          {/* Intro */}
          <section className="animate-fade-up flex items-center gap-3.5 rounded-xl border border-line bg-surface p-5 shadow-tiny">
            <div className="grid size-10 shrink-0 place-items-center rounded-md bg-accent-surface text-accent">
              <Gauge size={20} weight="fill" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-medium text-ink">
                Startup &amp; background items
              </div>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">
                {onCount} items run automatically. Turn off what you don't need —
                changes apply at your next login and are fully reversible.
              </p>
            </div>
          </section>

          {GROUPS.map(({ title, hint, kinds }, gi) => {
            const group = items.filter((i) => kinds.includes(i.kind));
            if (group.length === 0) return null;
            return (
              <section
                key={title}
                className="animate-fade-up overflow-hidden rounded-xl border border-line bg-surface shadow-tiny"
                style={{ animationDelay: `${gi * 50}ms` }}
              >
                <div className="px-4 pb-1 pt-3">
                  <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-faint">
                    {title} · {group.length}
                  </div>
                  <div className="text-[12px] text-faint">{hint}</div>
                </div>
                <div className="mt-1 border-t border-line">
                  {group.map((item) => (
                    <Row
                      key={item.id}
                      item={item}
                      busy={busy.has(item.id)}
                      onToggle={onToggle}
                      onReveal={onReveal}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </>
        )}
      </div>
    </div>
  );
}

function Row({
  item,
  busy,
  onToggle,
  onReveal,
}: {
  item: StartupItem;
  busy: boolean;
  onToggle: (item: StartupItem, enabled: boolean) => void;
  onReveal: (path: string) => void;
}) {
  return (
    <div className="group flex items-center gap-3.5 border-b border-line px-4 py-3 last:border-b-0">
      <div
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-md transition-colors",
          item.enabled ? "bg-inset text-muted" : "bg-inset text-faint",
        )}
      >
        <AppWindow size={18} weight="fill" />
      </div>
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "truncate text-[14px] font-medium",
            item.enabled ? "text-ink" : "text-muted",
          )}
        >
          {item.name}
        </div>
        <div className="truncate font-mono text-[11.5px] text-faint">
          {item.program}
        </div>
      </div>

      <button
        onClick={() => onReveal(item.path)}
        title="Reveal in Finder"
        className="shrink-0 text-faint opacity-0 transition-opacity hover:text-accent group-hover:opacity-100"
      >
        <ArrowSquareOut size={15} weight="bold" />
      </button>

      {item.manageable ? (
        busy ? (
          <CircleNotch
            size={18}
            weight="bold"
            className="shrink-0 animate-spin text-accent"
          />
        ) : (
          <Switch on={item.enabled} onChange={(v) => onToggle(item, v)} />
        )
      ) : (
        <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-faint">
          <LockSimple size={12} weight="fill" /> System
        </span>
      )}
    </div>
  );
}

function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={cn(
        "relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors duration-200",
        on ? "bg-accent" : "bg-inset",
      )}
    >
      <span
        className={cn(
          "absolute top-[2px] size-[18px] rounded-full bg-white shadow-tiny transition-[left] duration-200 ease-[cubic-bezier(0.2,0,0,1)]",
          on ? "left-[18px]" : "left-[2px]",
        )}
      />
    </button>
  );
}
