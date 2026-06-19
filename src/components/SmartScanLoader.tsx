import { OceanLoader } from "./OceanLoader";

/**
 * Smart Scan loader — the ocean loader with a determinate progress ring driven
 * by `progress` (0–1, bumped as stages complete).
 */
export function SmartScanLoader({
  progress,
  label,
}: {
  progress: number;
  label?: string;
}) {
  return <OceanLoader progress={progress} label={label} />;
}
