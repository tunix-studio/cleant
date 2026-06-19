/**
 * Internet speed test against Cloudflare's public endpoints (the same ones
 * speed.cloudflare.com uses). They send `Access-Control-Allow-Origin: *`, so
 * this runs entirely in the webview — no backend, works in the browser too.
 */

const DOWN = (bytes: number) => `https://speed.cloudflare.com/__down?bytes=${bytes}`;
const UP = "https://speed.cloudflare.com/__up";

export interface SpeedResult {
  downloadMbps: number;
  uploadMbps: number;
  latencyMs: number;
  jitterMs: number;
}

const toMbps = (bytes: number, seconds: number) =>
  seconds > 0 ? (bytes * 8) / seconds / 1e6 : 0;

async function ping(): Promise<number | null> {
  const t0 = performance.now();
  try {
    await fetch(DOWN(0), { cache: "no-store" }).then((r) => r.arrayBuffer());
    return performance.now() - t0;
  } catch {
    return null;
  }
}

export async function measureLatency(
  samples = 5,
): Promise<{ latencyMs: number; jitterMs: number }> {
  const times: number[] = [];
  for (let i = 0; i < samples; i++) {
    const t = await ping();
    if (t !== null) times.push(t);
  }
  if (!times.length) return { latencyMs: 0, jitterMs: 0 };
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const jitter = Math.sqrt(
    times.reduce((a, b) => a + (b - avg) ** 2, 0) / times.length,
  );
  return { latencyMs: avg, jitterMs: jitter };
}

/** Stream a large download, reporting live Mbps; caps at ~8s. */
export async function measureDownload(
  onProgress: (mbps: number) => void,
): Promise<number> {
  const t0 = performance.now();
  let received = 0;
  let last = t0;
  const res = await fetch(DOWN(100_000_000), { cache: "no-store" });
  const reader = res.body?.getReader();
  if (!reader) return 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    const now = performance.now();
    if (now - last > 120) {
      onProgress(toMbps(received, (now - t0) / 1000));
      last = now;
    }
    if (now - t0 > 8000) {
      await reader.cancel();
      break;
    }
  }
  const mbps = toMbps(received, (performance.now() - t0) / 1000);
  onProgress(mbps);
  return mbps;
}

export async function measureUpload(
  onProgress: (mbps: number) => void,
): Promise<number> {
  const size = 15_000_000;
  const body = new Uint8Array(size);
  const t0 = performance.now();
  try {
    await fetch(UP, { method: "POST", body, cache: "no-store" });
  } catch {
    return 0;
  }
  const mbps = toMbps(size, (performance.now() - t0) / 1000);
  onProgress(mbps);
  return mbps;
}
