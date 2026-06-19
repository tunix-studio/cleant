//! Read-only disk inspection for tclean.
//!
//! Everything here only *reads* the filesystem: it sums file sizes, counts
//! entries, and records the largest files as samples. Nothing is ever moved
//! or deleted in this phase.

use serde::Serialize;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

/// Only files at least this large are kept as "largest items" samples.
const SAMPLE_THRESHOLD: u64 = 1_000_000; // 1 MB
const MAX_SAMPLES: usize = 8;
/// Trim the running sample list once it grows past this, to bound memory.
const SAMPLE_SOFT_CAP: usize = 256;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiskUsage {
    pub total: u64,
    pub free: u64,
    pub used: u64,
    pub used_percent: f64,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SampleFile {
    pub path: String,
    pub name: String,
    pub size: u64,
}

#[derive(Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanResult {
    pub id: String,
    pub size: u64,
    pub file_count: u64,
    /// false when none of the category's roots exist / are readable.
    pub accessible: bool,
    pub samples: Vec<SampleFile>,
    /// Absolute paths of the category's roots that exist (for "open in Finder").
    pub roots: Vec<String>,
}

/// Streamed to the UI while a category is being walked, so the scan feels live.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanProgress {
    pub id: String,
    pub files: u64,
    pub bytes: u64,
}

/// Emit running totals roughly this often (in files walked).
const PROGRESS_EVERY: u64 = 3000;

pub(crate) fn home() -> PathBuf {
    dirs::home_dir().unwrap_or_else(|| PathBuf::from("/"))
}

/// The directories scanned for a given category id (must match the frontend).
/// Shared with the cleaner so scan and clean always agree on what's in scope.
pub(crate) fn category_roots(id: &str) -> Vec<PathBuf> {
    let h = home();
    match id {
        "user_cache" => vec![h.join("Library/Caches")],
        "app_logs" => vec![h.join("Library/Logs")],
        "trash" => vec![h.join(".Trash")],
        "downloads" => vec![h.join("Downloads")],
        "developer" => vec![
            h.join("Library/Developer/Xcode/DerivedData"),
            h.join("Library/Developer/Xcode/Archives"),
            h.join("Library/Developer/CoreSimulator/Caches"),
            h.join(".npm/_cacache"),
            h.join("Library/Caches/Yarn"),
            h.join("Library/pnpm/store"),
        ],
        "browser" => vec![
            h.join("Library/Caches/com.apple.Safari"),
            h.join("Library/Caches/Google/Chrome"),
            h.join("Library/Application Support/Google/Chrome/Default/Cache"),
            h.join("Library/Caches/Firefox"),
            h.join("Library/Caches/com.brave.Browser"),
        ],
        _ => vec![],
    }
}

/// Walk a category. `on_progress(files, bytes)` is called periodically with the
/// running totals so the UI can show live activity during a long scan.
pub fn scan(id: &str, mut on_progress: impl FnMut(u64, u64)) -> ScanResult {
    let mut size: u64 = 0;
    let mut file_count: u64 = 0;
    let mut accessible = false;
    let mut samples: Vec<SampleFile> = Vec::new();
    let mut roots_out: Vec<String> = Vec::new();
    let mut since_emit: u64 = 0;

    for root in category_roots(id) {
        if !root.exists() {
            continue;
        }
        accessible = true;
        roots_out.push(root.to_string_lossy().into_owned());

        for entry in WalkDir::new(&root)
            .follow_links(false)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            if !entry.file_type().is_file() {
                continue;
            }
            let len = match entry.metadata() {
                Ok(m) => m.len(),
                Err(_) => continue,
            };
            size += len;
            file_count += 1;

            since_emit += 1;
            if since_emit >= PROGRESS_EVERY {
                since_emit = 0;
                on_progress(file_count, size);
            }

            if len >= SAMPLE_THRESHOLD {
                let path = entry.path();
                samples.push(SampleFile {
                    path: path.to_string_lossy().into_owned(),
                    name: path
                        .file_name()
                        .map(|n| n.to_string_lossy().into_owned())
                        .unwrap_or_default(),
                    size: len,
                });
                if samples.len() > SAMPLE_SOFT_CAP {
                    samples.sort_by(|a, b| b.size.cmp(&a.size));
                    samples.truncate(MAX_SAMPLES);
                }
            }
        }
    }

    samples.sort_by(|a, b| b.size.cmp(&a.size));
    samples.truncate(MAX_SAMPLES);

    // Final tick so the live totals land exactly on the result.
    on_progress(file_count, size);

    ScanResult {
        id: id.to_string(),
        size,
        file_count,
        accessible,
        samples,
        roots: roots_out,
    }
}

pub fn disk_usage() -> DiskUsage {
    use sysinfo::Disks;
    let disks = Disks::new_with_refreshed_list();

    // Prefer the volume mounted at "/", else fall back to the largest disk.
    let mut root: Option<(u64, u64)> = None;
    let mut largest: Option<(u64, u64)> = None;
    for disk in disks.list() {
        let pair = (disk.total_space(), disk.available_space());
        if disk.mount_point() == Path::new("/") {
            root = Some(pair);
        }
        if largest.map_or(true, |(t, _)| pair.0 > t) {
            largest = Some(pair);
        }
    }

    let (total, free) = root.or(largest).unwrap_or((0, 0));
    let used = total.saturating_sub(free);
    let used_percent = if total > 0 {
        (used as f64 / total as f64) * 100.0
    } else {
        0.0
    };

    DiskUsage {
        total,
        free,
        used,
        used_percent,
    }
}
