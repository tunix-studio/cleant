import { useEffect, useState, type ReactNode } from "react";
import {
  AppWindow,
  ArrowRight,
  BellRinging,
  Broom,
  CheckCircle,
  Gauge,
  HardDrives,
  Sparkle,
} from "@phosphor-icons/react";
import {
  hasFullDiskAccess,
  notificationGranted,
  openSettings,
  requestNotifications,
  SETTINGS_URL,
} from "../lib/api";
import { cn } from "../lib/cn";
import { Logo } from "./Logo";
import { BlobArt } from "./BlobArt";

export function Onboarding({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const [fda, setFda] = useState(false);
  const [notif, setNotif] = useState(false);

  const refresh = async () => {
    setFda(await hasFullDiskAccess());
    setNotif(await notificationGranted());
  };
  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden bg-[#0a212a] text-white">
      <BlobArt
        className="pointer-events-none absolute inset-0 h-full w-full"
        preserveAspectRatio="xMidYMid slice"
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/[0.08]" />

      <div className="relative z-10 flex h-full flex-col items-center justify-center px-8">
        <div key={step} className="animate-fade-up w-full max-w-md">
          {step === 0 && <Welcome onNext={() => setStep(1)} />}
          {step === 1 && (
            <Permissions
              fda={fda}
              notif={notif}
              onRefresh={refresh}
              onEnableNotif={async () => {
                await requestNotifications();
                setNotif(await notificationGranted());
              }}
              onNext={() => setStep(2)}
            />
          )}
          {step === 2 && <Ready onDone={onComplete} />}
        </div>

        <div className="absolute bottom-9 flex items-center gap-2">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === step ? "w-5 bg-[#5eead4]" : "w-1.5 bg-white/20",
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------- steps --------------------------------- */

function Welcome({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="grid size-16 place-items-center rounded-[18px] bg-[#0e2f38] text-[#5eead4] shadow-[0_8px_30px_-8px_rgba(0,0,0,0.6)] ring-1 ring-white/10">
        <Logo size={34} animated />
      </div>
      <h1 className="mt-6 text-[27px] font-semibold tracking-[-0.02em]">
        Welcome to tclean
      </h1>
      <p className="mt-2.5 text-[14px] leading-relaxed text-white/65">
        A calm way to reclaim disk space, keep your apps updated, and tune what
        runs at startup — all in one place.
      </p>

      <div className="mt-7 flex w-full flex-col gap-2.5 text-left">
        <Feature icon={<Broom size={18} weight="fill" />} title="Clean junk safely" desc="Caches, logs & leftovers — reversible by default." />
        <Feature icon={<AppWindow size={18} weight="fill" />} title="Manage your apps" desc="Update via Homebrew, uninstall with leftovers." />
        <Feature icon={<Gauge size={18} weight="fill" />} title="Tune performance" desc="Startup items, background helpers, speed test." />
      </div>

      <Cta className="mt-8" onClick={onNext}>
        Get started <ArrowRight size={17} weight="bold" />
      </Cta>
    </div>
  );
}

function Permissions({
  fda,
  notif,
  onRefresh,
  onEnableNotif,
  onNext,
}: {
  fda: boolean;
  notif: boolean;
  onRefresh: () => void;
  onEnableNotif: () => void;
  onNext: () => void;
}) {
  return (
    <div>
      <div className="text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-[14px] bg-[#2dd4bf]/15 text-[#5eead4]">
          <Sparkle size={24} weight="fill" />
        </div>
        <h1 className="mt-5 text-[24px] font-semibold tracking-[-0.02em]">
          A couple of permissions
        </h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-white/65">
          These let tclean do its job. You're always in control — nothing is
          accessed without your say.
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-2.5">
        <PermRow
          icon={<HardDrives size={19} weight="fill" />}
          title="Full Disk Access"
          desc="So tclean can measure every cache and clean safely."
          granted={fda}
          actionLabel="Open Settings"
          onAction={() => void openSettings(SETTINGS_URL.fullDisk)}
        />
        <PermRow
          icon={<BellRinging size={19} weight="fill" />}
          title="Notifications"
          desc="A heads-up when a cleanup or update finishes."
          granted={notif}
          actionLabel="Enable"
          onAction={onEnableNotif}
        />
      </div>

      <p className="mt-3 px-1 text-[12px] leading-relaxed text-white/45">
        tclean will ask for Automation access the first time you manage Login
        Items. You can change any of this later in System Settings.
      </p>

      <div className="mt-6 flex items-center gap-2.5">
        <button
          onClick={onRefresh}
          className="h-11 rounded-md px-4 text-[13.5px] font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          Re-check
        </button>
        <Cta className="flex-1" onClick={onNext}>
          Continue <ArrowRight size={17} weight="bold" />
        </Cta>
      </div>
    </div>
  );
}

function Ready({ onDone }: { onDone: () => void }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="grid size-16 place-items-center rounded-full bg-[#2dd4bf]/15 text-[#5eead4]">
        <CheckCircle size={36} weight="fill" />
      </div>
      <h1 className="mt-6 text-[27px] font-semibold tracking-[-0.02em]">
        You're all set
      </h1>
      <p className="mt-2.5 text-[14px] leading-relaxed text-white/65">
        tclean is ready to go. Start with a scan, or browse your apps and startup
        items whenever you like.
      </p>
      <Cta className="mt-8" onClick={onDone}>
        Open tclean <ArrowRight size={17} weight="bold" />
      </Cta>
    </div>
  );
}

/* ------------------------------- pieces --------------------------------- */

function Feature({
  icon,
  title,
  desc,
}: {
  icon: ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.04] px-3.5 py-2.5">
      <div className="grid size-9 shrink-0 place-items-center rounded-md bg-[#2dd4bf]/15 text-[#5eead4]">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[13.5px] font-medium text-white">{title}</div>
        <div className="text-[12px] text-white/55">{desc}</div>
      </div>
    </div>
  );
}

function PermRow({
  icon,
  title,
  desc,
  granted,
  actionLabel,
  onAction,
}: {
  icon: ReactNode;
  title: string;
  desc: string;
  granted: boolean;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.05] px-4 py-3">
      <div className="grid size-10 shrink-0 place-items-center rounded-md bg-[#2dd4bf]/15 text-[#5eead4]">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-medium text-white">{title}</div>
        <div className="text-[12px] leading-snug text-white/55">{desc}</div>
      </div>
      {granted ? (
        <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#2dd4bf]/15 px-2.5 py-1 text-[12px] font-medium text-[#5eead4]">
          <CheckCircle size={14} weight="fill" /> Granted
        </span>
      ) : (
        <button
          onClick={onAction}
          className="h-8 shrink-0 rounded-md bg-white/10 px-3 text-[12.5px] font-medium text-white transition-colors hover:bg-white/[0.16]"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function Cta({
  children,
  onClick,
  className,
}: {
  children: ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#2dd4bf] px-5 text-[14px] font-semibold text-[#06231f] transition-[filter,transform] duration-150 hover:brightness-[1.06] active:scale-[0.98]",
        className,
      )}
    >
      {children}
    </button>
  );
}
