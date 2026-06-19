import type { ButtonHTMLAttributes, ReactNode } from "react";
import { CircleNotch } from "@phosphor-icons/react";
import { cn } from "../lib/cn";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "sm";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
}

const base =
  "inline-flex items-center justify-center gap-2 font-medium rounded-md " +
  "transition-[filter,background-color,color,transform] duration-150 ease-[cubic-bezier(0.2,0,0,1)] " +
  "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-on-accent hover:brightness-[1.08]",
  secondary: "bg-surface text-ink border border-line hover:bg-inset",
  ghost: "text-muted hover:text-ink hover:bg-inset",
};

const sizes: Record<Size, string> = {
  md: "h-11 px-5 text-[14px]",
  sm: "h-9 px-3.5 text-[13px]",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  children,
  className,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <CircleNotch size={16} weight="bold" className="animate-spin" />
      ) : (
        icon
      )}
      {children}
    </button>
  );
}
