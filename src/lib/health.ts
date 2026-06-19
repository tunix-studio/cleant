/**
 * Disk "health" score (0–100) for the Smart Scan overview. A calm single number
 * that rolls up everything tclean checks: free space, junk to clean, leftovers,
 * pending updates and startup load. Higher = tidier.
 */

const GiB = 1024 ** 3;

export interface HealthInput {
  /** free disk space as a fraction 0..1 (null if unknown → ignored) */
  freeFraction: number | null;
  /** reclaimable junk in bytes */
  reclaimableBytes: number;
  /** removable leftover items */
  leftoverCount: number;
  /** apps with an update available */
  updateCount: number;
  /** items that run at login / in the background */
  startupCount: number;
}

export type HealthTone = "great" | "good" | "ok" | "low";

export interface HealthFactor {
  label: string;
  /** points removed (positive number) */
  delta: number;
}

export interface HealthResult {
  score: number;
  label: string;
  tone: HealthTone;
  /** what pulled the score down, biggest first */
  factors: HealthFactor[];
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function computeHealth(input: HealthInput): HealthResult {
  let score = 100;
  const factors: HealthFactor[] = [];
  const hit = (label: string, delta: number) => {
    if (delta > 0) {
      score -= delta;
      factors.push({ label, delta: Math.round(delta) });
    }
  };

  // Junk: ~2 pts per GB, capped.
  hit("Junk to clean", clamp((input.reclaimableBytes / GiB) * 2, 0, 32));

  // Low free space hurts the most.
  if (input.freeFraction != null) {
    const freePct = input.freeFraction * 100;
    if (freePct < 10) hit("Low free space", 26);
    else if (freePct < 20) hit("Low free space", 14);
    else if (freePct < 30) hit("Low free space", 6);
  }

  hit("Leftovers", clamp(input.leftoverCount * 1.2, 0, 12));
  hit("Pending updates", clamp(input.updateCount * 1.5, 0, 12));
  hit("Startup load", clamp((input.startupCount - 4) * 1, 0, 12));

  factors.sort((a, b) => b.delta - a.delta);
  score = Math.round(clamp(score, 0, 100));

  let label: string;
  let tone: HealthTone;
  if (score >= 85) {
    label = "Crystal clear";
    tone = "great";
  } else if (score >= 70) {
    label = "Calm waters";
    tone = "good";
  } else if (score >= 50) {
    label = "A bit choppy";
    tone = "ok";
  } else {
    label = "Time for a sweep";
    tone = "low";
  }

  return { score, label, tone, factors };
}
