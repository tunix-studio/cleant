//! Large & old file finder. Walks the user's content folders (Downloads,
//! Documents, Desktop, Movies, Music, Pictures) and reports files above a size
//! threshold with their size and last-modified time, so the UI can surface big
//! or long-forgotten files. Read-only — removal goes through `cleaner::trash_paths`.

use serde::Serialize;
use std::path::PathBuf;
use std::time::UNIX_EPOCH;
use walkdir::{DirEntry, WalkDir};

use crate::scanner;

/// Only files at least this large are listed.
const MIN_SIZE: u64 = 50 * 1024 * 1024; // 50 MB
const MAX_RESULTS: usize = 300;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BigFile {
    pub path: String,
    pub name: String,
    pub size: u64,
    /// last-modified time, epoch seconds (0 if unknown)
    pub modified: u64,
}

fn content_roots() -> Vec<PathBuf> {
    let h = scanner::home();
    ["Downloads", "Documents", "Desktop", "Movies", "Music", "Pictures"]
        .iter()
        .map(|d| h.join(d))
        .collect()
}

/// Prune hidden dirs and dependency/junk trees we don't want to surface.
fn skip_dir(e: &DirEntry) -> bool {
    if !e.file_type().is_dir() {
        return false;
    }
    let name = e.file_name().to_string_lossy();
    name.starts_with('.') || name == "node_modules"
}

pub fn scan() -> Vec<BigFile> {
    let mut files: Vec<BigFile> = Vec::new();

    for root in content_roots() {
        if !root.exists() {
            continue;
        }
        for entry in WalkDir::new(&root)
            .follow_links(false)
            .into_iter()
            .filter_entry(|e| !skip_dir(e))
            .filter_map(|e| e.ok())
        {
            if !entry.file_type().is_file() {
                continue;
            }
            if entry.file_name().to_string_lossy().starts_with('.') {
                continue;
            }
            let meta = match entry.metadata() {
                Ok(m) => m,
                Err(_) => continue,
            };
            let size = meta.len();
            if size < MIN_SIZE {
                continue;
            }
            let modified = meta
                .modified()
                .ok()
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_secs())
                .unwrap_or(0);

            files.push(BigFile {
                path: entry.path().to_string_lossy().into_owned(),
                name: entry.file_name().to_string_lossy().into_owned(),
                size,
                modified,
            });
        }
    }

    files.sort_by(|a, b| b.size.cmp(&a.size));
    files.truncate(MAX_RESULTS);
    files
}
