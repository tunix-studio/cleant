//! Duplicate file finder. Groups files in the user's content folders by exact
//! content. Two-pass for speed: bucket by size first (a unique size can't have a
//! duplicate), then confirm same-size files by hashing their full contents
//! (FNV-1a 64-bit, streamed). Read-only — removal goes through `cleaner::trash_paths`.

use serde::Serialize;
use std::collections::HashMap;
use std::fs::File;
use std::io::{BufReader, Read};
use std::path::PathBuf;
use std::time::UNIX_EPOCH;
use walkdir::{DirEntry, WalkDir};

use crate::scanner;

/// Ignore files smaller than this — tiny duplicates aren't worth the noise/IO.
const MIN_SIZE: u64 = 1024 * 1024; // 1 MB
const MAX_GROUPS: usize = 200;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DupeFile {
    pub path: String,
    pub name: String,
    /// last-modified time, epoch seconds (0 if unknown)
    pub modified: u64,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DupeGroup {
    /// content hash (hex) — stable id for the group
    pub id: String,
    /// size of each (identical) file in bytes
    pub size: u64,
    pub files: Vec<DupeFile>,
}

fn content_roots() -> Vec<PathBuf> {
    let h = scanner::home();
    ["Downloads", "Documents", "Desktop", "Movies", "Music", "Pictures"]
        .iter()
        .map(|d| h.join(d))
        .collect()
}

fn skip_dir(e: &DirEntry) -> bool {
    if !e.file_type().is_dir() {
        return false;
    }
    let name = e.file_name().to_string_lossy();
    name.starts_with('.') || name == "node_modules"
}

/// FNV-1a 64-bit over the whole file. Same-size + same-hash ⇒ duplicate.
fn hash_file(path: &PathBuf) -> Option<u64> {
    let file = File::open(path).ok()?;
    let mut reader = BufReader::new(file);
    let mut buf = [0u8; 65536];
    let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
    loop {
        let n = reader.read(&mut buf).ok()?;
        if n == 0 {
            break;
        }
        for &b in &buf[..n] {
            hash ^= b as u64;
            hash = hash.wrapping_mul(0x0000_0100_0000_01b3);
        }
    }
    Some(hash)
}

pub fn scan() -> Vec<DupeGroup> {
    // Pass 1: bucket candidate files by size.
    let mut by_size: HashMap<u64, Vec<(PathBuf, u64)>> = HashMap::new();
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
            by_size
                .entry(size)
                .or_default()
                .push((entry.path().to_path_buf(), modified));
        }
    }

    // Pass 2: within each size bucket, confirm by content hash.
    let mut groups: Vec<DupeGroup> = Vec::new();
    for (size, entries) in by_size {
        if entries.len() < 2 {
            continue;
        }
        let mut by_hash: HashMap<u64, Vec<(PathBuf, u64)>> = HashMap::new();
        for (path, modified) in entries {
            if let Some(h) = hash_file(&path) {
                by_hash.entry(h).or_default().push((path, modified));
            }
        }
        for (h, files) in by_hash {
            if files.len() < 2 {
                continue;
            }
            groups.push(DupeGroup {
                id: format!("{h:016x}"),
                size,
                files: files
                    .into_iter()
                    .map(|(p, m)| DupeFile {
                        name: p
                            .file_name()
                            .map(|n| n.to_string_lossy().into_owned())
                            .unwrap_or_default(),
                        path: p.to_string_lossy().into_owned(),
                        modified: m,
                    })
                    .collect(),
            });
        }
    }

    // Most wasted space first.
    groups.sort_by(|a, b| {
        let wa = a.size * (a.files.len() as u64 - 1);
        let wb = b.size * (b.files.len() as u64 - 1);
        wb.cmp(&wa)
    });
    groups.truncate(MAX_GROUPS);
    groups
}
