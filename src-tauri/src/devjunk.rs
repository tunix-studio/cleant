//! Deep developer cleanup. Surfaces well-known dev cache/junk locations with
//! their on-disk size so they can be cleared. Read-only here; removal goes
//! through `cleaner::trash_paths` (each target folder is trashed and rebuilt by
//! its tool on next use).

use rayon::prelude::*;
use serde::Serialize;
use std::panic::AssertUnwindSafe;

use crate::cleaner;
use crate::scanner;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DevTarget {
    pub id: String,
    pub label: String,
    pub hint: String,
    pub path: String,
    pub size: u64,
    /// true = clearing has a real cost (review before removing)
    pub caution: bool,
}

/// (id, label, hint, home-relative path, caution)
const TARGETS: &[(&str, &str, &str, &str, bool)] = &[
    ("xcode-derived", "Xcode DerivedData", "Build intermediates — Xcode rebuilds them", "Library/Developer/Xcode/DerivedData", false),
    ("xcode-ios-devsupport", "iOS DeviceSupport", "Debug symbols for old iOS versions", "Library/Developer/Xcode/iOS DeviceSupport", false),
    ("xcode-watchos-devsupport", "watchOS DeviceSupport", "Debug symbols for old watchOS versions", "Library/Developer/Xcode/watchOS DeviceSupport", false),
    ("xcode-archives", "Xcode Archives", "Old app archives — keep if you still distribute them", "Library/Developer/Xcode/Archives", true),
    ("sim-caches", "Simulator Caches", "CoreSimulator caches", "Library/Developer/CoreSimulator/Caches", false),
    ("sim-devices", "Simulator Devices", "Removes installed simulators (recreatable)", "Library/Developer/CoreSimulator/Devices", true),
    ("npm", "npm cache", "node package manager cache", ".npm/_cacache", false),
    ("yarn", "Yarn cache", "Yarn package cache", "Library/Caches/Yarn", false),
    ("pnpm", "pnpm store", "pnpm content-addressable store", "Library/pnpm/store", false),
    ("cocoapods", "CocoaPods cache", "Downloaded pods cache", "Library/Caches/CocoaPods", false),
    ("carthage", "Carthage cache", "Carthage build cache", "Library/Caches/org.carthage.CarthageKit", false),
    ("gradle", "Gradle caches", "Gradle dependency & build cache", ".gradle/caches", false),
    ("go-build", "Go build cache", "Go compiler cache", "Library/Caches/go-build", false),
    ("pip", "pip cache", "Python pip download cache", "Library/Caches/pip", false),
    ("cargo", "Cargo registry cache", "Rust crate download cache", ".cargo/registry/cache", false),
    ("homebrew", "Homebrew cache", "Downloaded bottles & casks", "Library/Caches/Homebrew", false),
];

pub fn scan() -> Vec<DevTarget> {
    let home = scanner::home();
    let mut targets: Vec<DevTarget> = TARGETS
        .par_iter()
        .filter_map(|(id, label, hint, rel, caution)| {
            let path = home.join(rel);
            if !path.exists() {
                return None;
            }
            let size = std::panic::catch_unwind(AssertUnwindSafe(|| cleaner::entry_size(&path)))
                .unwrap_or(0);
            if size == 0 {
                return None;
            }
            Some(DevTarget {
                id: (*id).to_string(),
                label: (*label).to_string(),
                hint: (*hint).to_string(),
                path: path.to_string_lossy().into_owned(),
                size,
                caution: *caution,
            })
        })
        .collect();
    targets.sort_by(|a, b| b.size.cmp(&a.size));
    targets
}
