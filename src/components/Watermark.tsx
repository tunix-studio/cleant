import logoUrl from "../assets/logo.svg";

/**
 * A large, very faint brand silhouette for empty / first-run states. The logo is
 * multi-colour, so we tint it via a CSS mask (the accent colour fills the logo
 * shape) and keep it low-opacity in a corner — present but never competing with
 * the page content. Decorative only.
 */
export function Watermark({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={
        "pointer-events-none absolute -bottom-12 -right-10 h-[300px] w-[360px] select-none opacity-[0.07] " +
        (className ?? "")
      }
      style={{
        backgroundColor: "var(--color-accent)",
        WebkitMaskImage: `url(${logoUrl})`,
        maskImage: `url(${logoUrl})`,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskSize: "contain",
        maskSize: "contain",
      }}
    />
  );
}
