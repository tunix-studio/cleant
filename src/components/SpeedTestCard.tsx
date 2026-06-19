import { useState } from "react";
import {
  DownloadSimple,
  Gauge,
  Timer,
  UploadSimple,
  WifiHigh,
} from "@phosphor-icons/react";
import {
  measureDownload,
  measureLatency,
  measureUpload,
  type SpeedResult,
} from "../lib/speedtest";
import { cn } from "../lib/cn";
import { Button } from "./Button";

type Status = "idle" | "ping" | "download" | "upload" | "done" | "error";

const PHASE_LABEL: Record<string, string> = {
  ping: "Measuring latency…",
  download: "Measuring download…",
  upload: "Measuring upload…",
};

function fmtSpeed(mbps: number): string {
  if (mbps <= 0) return "0";
  return mbps >= 100 ? mbps.toFixed(0) : mbps.toFixed(1);
}

export function SpeedTestCard() {
  const [status, setStatus] = useState<Status>("idle");
  const [live, setLive] = useState(0);
  const [result, setResult] = useState<SpeedResult | null>(null);

  const testing =
    status === "ping" || status === "download" || status === "upload";

  const run = async () => {
    setResult(null);
    setLive(0);
    try {
      setStatus("ping");
      const { latencyMs, jitterMs } = await measureLatency();
      setStatus("download");
      setLive(0);
      const downloadMbps = await measureDownload(setLive);
      setStatus("upload");
      setLive(0);
      const uploadMbps = await measureUpload(setLive);
      setResult({ downloadMbps, uploadMbps, latencyMs, jitterMs });
      setStatus("done");
    } catch {
      setStatus("error");
    }
  };

  const headline =
    status === "done" && result ? result.downloadMbps : live;
  const headlineLabel =
    status === "done"
      ? "Mbps download"
      : status === "upload"
        ? "Mbps upload"
        : status === "download"
          ? "Mbps download"
          : "Mbps";

  return (
    <section className="animate-fade-up overflow-hidden rounded-xl border border-line bg-surface shadow-tiny">
      <div className="flex items-center gap-2 px-4 py-3">
        <WifiHigh size={15} weight="fill" className="text-accent" />
        <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-faint">
          Internet speed
        </span>
      </div>

      <div className="flex flex-col items-center gap-5 border-t border-line px-5 py-7 sm:flex-row sm:items-center sm:gap-8">
        {/* live / result headline */}
        <div className="flex w-[150px] shrink-0 flex-col items-center text-center">
          <div className="grid size-14 place-items-center rounded-full bg-accent-surface text-accent">
            <Gauge
              size={26}
              weight="fill"
              className={cn(testing && "animate-pulse")}
            />
          </div>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="tnum text-[36px] font-semibold leading-none tracking-[-0.03em] text-ink">
              {status === "idle" ? "—" : fmtSpeed(headline)}
            </span>
          </div>
          <div className="mt-1 text-[11.5px] text-faint">
            {status === "idle"
              ? "Not tested"
              : testing
                ? (PHASE_LABEL[status] ?? "")
                : headlineLabel}
          </div>
        </div>

        {/* stats */}
        <div className="grid flex-1 grid-cols-3 gap-3">
          <Stat
            icon={<DownloadSimple size={15} weight="bold" />}
            label="Download"
            value={result ? `${fmtSpeed(result.downloadMbps)} Mbps` : "—"}
            active={status === "download"}
          />
          <Stat
            icon={<UploadSimple size={15} weight="bold" />}
            label="Upload"
            value={result ? `${fmtSpeed(result.uploadMbps)} Mbps` : "—"}
            active={status === "upload"}
          />
          <Stat
            icon={<Timer size={15} weight="bold" />}
            label="Ping"
            value={result ? `${Math.round(result.latencyMs)} ms` : "—"}
            active={status === "ping"}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
        <span className="text-[11.5px] text-faint">
          {status === "error"
            ? "Couldn't reach the test server — check your connection."
            : "Measured against Cloudflare. No data leaves beyond the test traffic."}
        </span>
        <Button size="sm" onClick={() => void run()} loading={testing}>
          {status === "done" ? "Test again" : "Test speed"}
        </Button>
      </div>
    </section>
  );
}

function Stat({
  icon,
  label,
  value,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  active: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2.5 transition-colors",
        active ? "border-accent/40 bg-accent-surface" : "border-line bg-inset/40",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.04em]",
          active ? "text-accent" : "text-faint",
        )}
      >
        {icon}
        {label}
      </div>
      <div className="tnum mt-1 text-[15px] font-semibold text-ink">{value}</div>
    </div>
  );
}
