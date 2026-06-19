import logoUrl from "../assets/logo.svg";

interface LogoProps {
  size?: number;
  className?: string;
  /** kept for call-site compatibility; the mark itself is static */
  animated?: boolean;
}

/**
 * The tclean brand mark — the user's logo, used verbatim from
 * ~/Desktop/logo.svg (kept in src/assets/logo.svg). Multi-colour, so it is
 * rendered as an image rather than recoloured.
 */
export function Logo({ size = 24, className }: LogoProps) {
  return (
    <img
      src={logoUrl}
      width={size}
      height={size}
      className={className}
      alt=""
      draggable={false}
      aria-hidden="true"
    />
  );
}
