import {
  AppWindow,
  Broom,
  Code,
  CopySimple,
  FileMagnifyingGlass,
  Gauge,
  GearSix,
  Ghost,
  HardDrives,
  Heartbeat,
  Sparkle,
  type Icon,
} from "@phosphor-icons/react";
import { cn } from "../lib/cn";
import { splitBytes } from "../lib/format";
import { useCountUp } from "../lib/useCountUp";
import { Logo } from "./Logo";
import { SidebarArt } from "./SidebarArt";

export type ViewId =
  | "overview"
  | "clean"
  | "storage"
  | "large"
  | "duplicates"
  | "developer"
  | "leftovers"
  | "apps"
  | "performance"
  | "settings";

interface NavItem {
  id: ViewId;
  label: string;
  Icon: Icon;
}

const NAV: NavItem[] = [
  { id: "overview", label: "Overview", Icon: Heartbeat },
  { id: "clean", label: "Clean", Icon: Broom },
  { id: "storage", label: "Storage", Icon: HardDrives },
  { id: "large", label: "Large Files", Icon: FileMagnifyingGlass },
  { id: "duplicates", label: "Duplicates", Icon: CopySimple },
  { id: "developer", label: "Developer", Icon: Code },
  { id: "leftovers", label: "Leftovers", Icon: Ghost },
  { id: "apps", label: "Apps", Icon: AppWindow },
  { id: "performance", label: "Performance", Icon: Gauge },
  { id: "settings", label: "Settings", Icon: GearSix },
];

interface SidebarProps {
  view: ViewId;
  onSelect: (v: ViewId) => void;
  reclaimable: number;
  scanned: boolean;
}

export function Sidebar({ view, onSelect, reclaimable, scanned }: SidebarProps) {
  const animated = useCountUp(reclaimable);
  const { value, unit } = splitBytes(animated);
  const hasReclaimable = reclaimable > 0;

  return (
    <aside className="relative flex w-[240px] shrink-0 flex-col overflow-hidden border-r border-white/[0.06] bg-[#0a212a]">
      <SidebarArt />
      {/* top sheen */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/[0.08]" />

      <div className="relative z-10 flex h-full flex-col">
        {/* Brand — padded to clear the macOS traffic lights */}
        <div
          data-tauri-drag-region
          className="flex items-center gap-3 px-5 pb-5 pt-[34px]"
        >
          <div className="grid size-9 place-items-center rounded-[11px] bg-[#0e2f38] text-[#5eead4] shadow-[0_2px_8px_rgba(0,0,0,0.35)] ring-1 ring-white/10 transition-transform duration-200 hover:scale-[1.05]">
            <Logo size={20} animated />
          </div>
          <div className="leading-tight">
            <div className="text-[16px] font-semibold tracking-[-0.01em] text-white">
              tclean
            </div>
            <div className="text-[12px] text-[#7e969d]">Disk cleaner</div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-1 px-3">
          {NAV.map(({ id, label, Icon }, i) => {
            const active = view === id;
            return (
              <button
                key={id}
                onClick={() => onSelect(id)}
                style={{ animationDelay: `${i * 45}ms` }}
                className={cn(
                  "animate-fade-up group flex h-10 items-center gap-3 rounded-[10px] px-3 text-[14.5px] transition-[background-color,color,transform] duration-150",
                  active
                    ? "bg-[#2dd4bf]/[0.18] font-semibold text-white ring-1 ring-[#2dd4bf]/25"
                    : "font-medium text-[#9cb0b6] hover:translate-x-0.5 hover:bg-white/[0.06] hover:text-white",
                )}
              >
                <Icon
                  size={20}
                  weight="fill"
                  className={cn(
                    "transition-transform duration-200",
                    active
                      ? "scale-110 text-white"
                      : "text-[#80979e] group-hover:scale-105 group-hover:text-white",
                  )}
                />
                {label}
              </button>
            );
          })}
        </nav>

        <div className="flex-1" />

        {/* Reclaimable card */}
        <div className="m-3 overflow-hidden rounded-[14px] border border-white/[0.08] bg-white/[0.05] backdrop-blur-[2px]">
          <div className="flex items-center gap-3 px-3.5 py-3">
            <div
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-md transition-colors",
                hasReclaimable
                  ? "bg-[#2dd4bf]/[0.18] text-[#5eead4]"
                  : "bg-white/[0.06] text-[#7e969d]",
              )}
            >
              <Sparkle size={17} weight="fill" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#7e969d]">
                Reclaimable
              </div>
              {scanned ? (
                <div className="flex items-baseline gap-1">
                  <span
                    className={cn(
                      "tnum text-[20px] font-semibold leading-tight tracking-[-0.02em]",
                      hasReclaimable ? "text-[#6ff0de]" : "text-[#9cb0b6]",
                    )}
                  >
                    {value}
                  </span>
                  <span className="text-[12px] font-medium text-[#9cb0b6]">
                    {unit}
                  </span>
                </div>
              ) : (
                <div className="mt-0.5 text-[12.5px] text-[#7e969d]">
                  Not scanned yet
                </div>
              )}
            </div>
          </div>
          {scanned && hasReclaimable && (
            <button
              onClick={() => onSelect("clean")}
              className="flex w-full items-center justify-center gap-1.5 border-t border-white/[0.08] py-2 text-[12px] font-medium text-[#6ff0de] transition-colors hover:bg-[#2dd4bf]/[0.12]"
            >
              <Broom size={13} weight="fill" />
              Clean up
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
