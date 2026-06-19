import {
  Broom,
  Code,
  DownloadSimple,
  GlobeSimple,
  Scroll,
  TrashSimple,
  type Icon,
} from "@phosphor-icons/react";
import type { CategoryId, Safety } from "../lib/types";

export interface CategoryMeta {
  id: CategoryId;
  name: string;
  description: string;
  /** Where the data lives, shown in the detail view. */
  location: string;
  Icon: Icon;
  safety: Safety;
}

/**
 * The set of things tclean inspects. Phase 1 only ever *reads* these paths —
 * nothing is deleted. Order is the order shown in the list.
 */
export const CATEGORIES: CategoryMeta[] = [
  {
    id: "user_cache",
    name: "User Cache",
    description: "Reusable app caches that rebuild automatically.",
    location: "~/Library/Caches",
    Icon: Broom,
    safety: "safe",
  },
  {
    id: "developer",
    name: "Developer Junk",
    description: "Xcode derived data, simulators, npm & pnpm stores.",
    location: "~/Library/Developer · ~/.npm",
    Icon: Code,
    safety: "safe",
  },
  {
    id: "browser",
    name: "Browser Data",
    description: "Cached pages and assets from Safari & Chrome.",
    location: "~/Library/Caches",
    Icon: GlobeSimple,
    safety: "safe",
  },
  {
    id: "app_logs",
    name: "Logs & Diagnostics",
    description: "Old log files and diagnostic reports.",
    location: "~/Library/Logs",
    Icon: Scroll,
    safety: "safe",
  },
  {
    id: "trash",
    name: "Trash",
    description: "Files already sitting in the Trash.",
    location: "~/.Trash",
    Icon: TrashSimple,
    safety: "safe",
  },
  {
    id: "downloads",
    name: "Downloads",
    description: "Large or stale files in your Downloads folder.",
    location: "~/Downloads",
    Icon: DownloadSimple,
    safety: "review",
  },
];
