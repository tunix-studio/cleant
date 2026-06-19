import { ArrowClockwise, Moon, Sun } from "@phosphor-icons/react";
import { cn } from "../lib/cn";
import type { Theme } from "../lib/useTheme";

interface TitlebarProps {
  title: string;
  scanning: boolean;
  scanned: boolean;
  statusLabel: string;
  theme: Theme;
  onToggleTheme: () => void;
  onRescan: () => void;
}

export function Titlebar({
  title,
  scanning,
  scanned,
  statusLabel,
  theme,
  onToggleTheme,
  onRescan,
}: TitlebarProps) {
  return (
    <header
      data-tauri-drag-region
      className="flex h-[52px] shrink-0 items-center justify-between border-b border-line bg-canvas px-5"
    >
      <h1
        data-tauri-drag-region
        className="text-[15px] font-semibold tracking-[-0.01em] text-ink"
      >
        {title}
      </h1>

      <div className="flex items-center gap-2.5">
        {statusLabel && (
          <span className="tnum hidden text-[12px] text-faint sm:inline">
            {statusLabel}
          </span>
        )}

        {statusLabel && <div className="mx-0.5 h-5 w-px bg-line" />}

        <IconButton label="Toggle theme" onClick={onToggleTheme}>
          {theme === "light" ? (
            <Moon size={17} weight="fill" />
          ) : (
            <Sun size={17} weight="fill" />
          )}
        </IconButton>

        {scanned && (
          <IconButton
            label="Rescan"
            onClick={onRescan}
            disabled={scanning}
          >
            <ArrowClockwise
              size={17}
              weight="bold"
              className={cn(scanning && "animate-spin")}
            />
          </IconButton>
        )}
      </div>
    </header>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="grid size-8 place-items-center rounded-md text-muted transition-colors hover:bg-inset hover:text-ink disabled:opacity-40"
    >
      {children}
    </button>
  );
}
