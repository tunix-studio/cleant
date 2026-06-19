//! Cleanup engine — the only code in tclean that removes files.
//!
//! Safety model (deliberately conservative):
//!   * Only the **direct children** of a validated category root are ever
//!     touched. We never remove a root itself, the home dir, or anything whose
//!     canonical parent is not exactly that root.
//!   * Default action is **move to Trash** (reversible). Permanent deletion is
//!     opt-in and is refused for user-data categories (Downloads).
//!   * The Trash category is always emptied permanently (it is already trashed).
//!   * Symlinks are never followed — we act on the link entry itself.

use serde::Serialize;
use std::path::{Path, PathBuf};

use crate::scanner;

/// Canonicalise the user's exclusion paths once. Anything at or under one of
/// these is left untouched by every removal path.
pub(crate) fn canon_exclusions(raw: &[String]) -> Vec<PathBuf> {
    raw.iter()
        .filter_map(|p| {
            let path = match p.strip_prefix("~/") {
                Some(rest) => scanner::home().join(rest),
                None => PathBuf::from(p),
            };
            path.canonicalize().ok()
        })
        .collect()
}

pub(crate) fn is_excluded(path: &Path, excl: &[PathBuf]) -> bool {
    excl.iter().any(|e| path.starts_with(e))
}

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct CleanReport {
    /// bytes acted on (freed if permanent, moved if trashed)
    pub bytes: u64,
    /// top-level entries successfully removed / trashed
    pub removed: u64,
    /// entries that could not be removed (skipped or errored)
    pub failed: u64,
}

#[derive(Clone, Copy, PartialEq)]
enum Mode {
    Trash,
    Permanent,
}

/// Per-category policy. User data is never permanently deleted here; the Trash
/// category is always emptied permanently.
fn mode_for(id: &str, prefer_permanent: bool) -> Mode {
    match id {
        "trash" => Mode::Permanent,
        "downloads" => Mode::Trash,
        _ if prefer_permanent => Mode::Permanent,
        _ => Mode::Trash,
    }
}

pub fn clean(ids: &[String], prefer_permanent: bool, exclusions: &[String]) -> CleanReport {
    let mut report = CleanReport::default();
    let excl = canon_exclusions(exclusions);
    let home = match scanner::home().canonicalize() {
        Ok(h) => h,
        Err(_) => return report,
    };

    for id in ids {
        let mode = mode_for(id, prefer_permanent);
        for root in scanner::category_roots(id) {
            if !root.exists() {
                continue;
            }
            let canon_root = match root.canonicalize() {
                Ok(p) => p,
                Err(_) => continue,
            };
            // A category root must live inside the user's home — never operate
            // outside it, whatever the config said.
            if !canon_root.starts_with(&home) || canon_root == home {
                continue;
            }

            let entries = match std::fs::read_dir(&root) {
                Ok(e) => e,
                Err(_) => continue,
            };
            for entry in entries.filter_map(|e| e.ok()) {
                let path = entry.path();
                if !is_safe_target(&path, &canon_root) {
                    report.failed += 1;
                    continue;
                }
                // Honour user exclusions — skip anything under an excluded path.
                if !excl.is_empty() {
                    if let Ok(cp) = path.canonicalize() {
                        if is_excluded(&cp, &excl) {
                            continue;
                        }
                    }
                }
                let size = entry_size(&path);
                let ok = match mode {
                    Mode::Trash => trash::delete(&path).is_ok(),
                    Mode::Permanent => remove_path(&path).is_ok(),
                };
                if ok {
                    report.bytes += size;
                    report.removed += 1;
                } else {
                    report.failed += 1;
                }
            }
        }
    }

    report
}

/// A target is safe only if its canonical parent is exactly the category root.
/// This guarantees we only ever delete direct children of a known root and can
/// never be redirected elsewhere by a symlinked parent.
fn is_safe_target(path: &Path, canon_root: &Path) -> bool {
    let parent = match path.parent() {
        Some(p) => p,
        None => return false,
    };
    match parent.canonicalize() {
        Ok(canon_parent) => canon_parent == *canon_root,
        Err(_) => false,
    }
}

pub(crate) fn entry_size(path: &Path) -> u64 {
    let meta = match std::fs::symlink_metadata(path) {
        Ok(m) => m,
        Err(_) => return 0,
    };
    if meta.is_file() || meta.file_type().is_symlink() {
        return meta.len();
    }
    let mut total = 0u64;
    for e in walkdir::WalkDir::new(path)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if e.file_type().is_file() {
            if let Ok(m) = e.metadata() {
                total += m.len();
            }
        }
    }
    total
}

/// Permanent removal. Symlinks are unlinked, not followed.
fn remove_path(path: &Path) -> std::io::Result<()> {
    let meta = std::fs::symlink_metadata(path)?;
    if meta.is_file() || meta.file_type().is_symlink() {
        std::fs::remove_file(path)
    } else {
        std::fs::remove_dir_all(path)
    }
}

/// Move a specific set of paths to the Trash (used for leftover removal).
/// Each path must resolve inside `$HOME`, must not be `$HOME` itself, and must
/// not be one of the protected top-level user folders.
pub fn trash_paths(paths: &[String], exclusions: &[String]) -> CleanReport {
    let mut report = CleanReport::default();
    let excl = canon_exclusions(exclusions);
    let home = match scanner::home().canonicalize() {
        Ok(h) => h,
        Err(_) => return report,
    };
    let protected = protected_dirs(&home);

    for raw in paths {
        let path = PathBuf::from(raw);
        let canon = match path.canonicalize() {
            Ok(c) => c,
            Err(_) => {
                report.failed += 1;
                continue;
            }
        };
        if !canon.starts_with(&home) || canon == home || protected.contains(&canon) {
            report.failed += 1;
            continue;
        }
        if is_excluded(&canon, &excl) {
            continue;
        }
        let size = entry_size(&canon);
        if trash::delete(&path).is_ok() {
            report.bytes += size;
            report.removed += 1;
        } else {
            report.failed += 1;
        }
    }
    report
}

/// Top-level user folders that must never be trashed wholesale.
fn protected_dirs(home: &Path) -> std::collections::HashSet<PathBuf> {
    [
        "Documents",
        "Desktop",
        "Downloads",
        "Library",
        "Movies",
        "Music",
        "Pictures",
        "Public",
        "Applications",
        "Library/Application Support",
        "Library/Caches",
        "Library/Preferences",
        "Library/Containers",
    ]
    .iter()
    .filter_map(|d| home.join(d).canonicalize().ok())
    .collect()
}

/// Move everything currently in the Trash out permanently. Returns freed bytes.
pub fn empty_trash() -> CleanReport {
    let trash_dir: PathBuf = scanner::home().join(".Trash");
    if !trash_dir.exists() {
        return CleanReport::default();
    }
    clean(&["trash".to_string()], true, &[])
}
