import { OceanLoader } from "./OceanLoader";

/**
 * The default loading indicator — the ocean loader with an indeterminate
 * spinning ring (no exact progress). Visually identical to the Smart Scan
 * loader so every loading state feels the same.
 */
export function DolphinLoader({ label }: { label?: string }) {
  return <OceanLoader label={label} />;
}
