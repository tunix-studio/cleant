//! App uninstaller. Lists installed apps, finds every file an app left around
//! (bundle + caches, preferences, support, containers, …) and moves the whole
//! set to the Trash together. Reversible; never touches `/System` apps.

use base64::Engine;
use rayon::prelude::*;
use serde::Serialize;
use std::panic::AssertUnwindSafe;
use std::path::{Path, PathBuf};

use crate::cleaner;
use crate::leftovers::{bundle_id, normalize, shorten};
use crate::scanner;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub name: String,
    pub bundle_id: String,
    pub path: String,
    /// true for /System/Applications — listed but not uninstallable
    pub system: bool,
    /// the app's real icon as a `data:image/png;base64,…` URL (None if unreadable)
    pub icon: Option<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AppFile {
    pub full_path: String,
    pub path: String,
    pub label: String,
    pub size: u64,
}

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AppBundle {
    pub files: Vec<AppFile>,
    pub total_size: u64,
}

/// List installed apps (no sizing here — kept fast). Sizing + associated files
/// happen on demand in `app_files`.
pub fn list_apps() -> Vec<AppInfo> {
    let home = scanner::home();
    let roots: [(PathBuf, bool); 3] = [
        (PathBuf::from("/Applications"), false),
        (home.join("Applications"), false),
        (PathBuf::from("/System/Applications"), true),
    ];
    // Gather paths first, then read + icon-extract in parallel (fast, and a
    // panic on one bad bundle can't wipe the whole list).
    let mut paths: Vec<(PathBuf, bool)> = Vec::new();
    for (root, system) in &roots {
        collect_paths(root, *system, &mut paths, 0);
    }
    let mut apps: Vec<AppInfo> = paths
        .par_iter()
        .filter_map(|(p, system)| {
            std::panic::catch_unwind(AssertUnwindSafe(|| make_info(p, *system)))
                .ok()
                .flatten()
        })
        .collect();
    apps.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    apps.dedup_by(|a, b| a.path == b.path);
    apps
}

fn collect_paths(dir: &Path, system: bool, out: &mut Vec<(PathBuf, bool)>, depth: usize) {
    if depth > 1 {
        return;
    }
    let rd = match std::fs::read_dir(dir) {
        Ok(r) => r,
        Err(_) => return,
    };
    for entry in rd.filter_map(|e| e.ok()) {
        let fname = entry.file_name().to_string_lossy().to_string();
        let path = entry.path();
        if fname.ends_with(".app") {
            out.push((path, system));
        } else if fname == "Utilities" && path.is_dir() {
            collect_paths(&path, system, out, depth + 1);
        }
    }
}

fn make_info(path: &Path, system: bool) -> Option<AppInfo> {
    let fname = path.file_name()?.to_string_lossy().to_string();
    Some(AppInfo {
        name: fname.trim_end_matches(".app").to_string(),
        bundle_id: bundle_id(path).unwrap_or_default(),
        icon: app_icon(path),
        path: path.to_string_lossy().to_string(),
        system,
    })
}

/// The bundle + every associated file we can find for one app.
pub fn app_files(app_path: String, bundle_id: String, name: String) -> AppBundle {
    let home = scanner::home();
    let mut files = Vec::new();

    let app = PathBuf::from(&app_path);
    if app.exists() {
        files.push(AppFile {
            full_path: app_path.clone(),
            path: shorten(&app_path, &home),
            label: "Application".into(),
            size: cleaner::entry_size(&app),
        });
    }

    let bid = bundle_id.to_lowercase();
    let nname = normalize(&name);

    let locations: &[(&str, &str)] = &[
        ("Library/Application Support", "Support files"),
        ("Library/Caches", "Cache"),
        ("Library/Preferences", "Preferences"),
        ("Library/Containers", "Container"),
        ("Library/Group Containers", "Group container"),
        ("Library/Saved Application State", "Saved state"),
        ("Library/HTTPStorages", "Stored data"),
        ("Library/WebKit", "Web data"),
        ("Library/Logs", "Logs"),
        ("Library/Application Scripts", "Scripts"),
        ("Library/LaunchAgents", "Launch agent"),
    ];

    for (rel, label) in locations {
        let dir = home.join(rel);
        let rd = match std::fs::read_dir(&dir) {
            Ok(r) => r,
            Err(_) => continue,
        };
        for entry in rd.filter_map(|e| e.ok()) {
            let fname = entry.file_name().to_string_lossy().to_string();
            let cand = fname
                .trim_end_matches(".plist")
                .trim_end_matches(".savedState")
                .to_string();
            let candl = cand.to_lowercase();

            let by_id = !bid.is_empty()
                && (candl == bid
                    || candl.starts_with(&format!("{bid}."))
                    || candl.ends_with(&bid));
            let by_name = nname.len() >= 4 && normalize(&cand) == nname;

            if by_id || by_name {
                let path = entry.path();
                files.push(AppFile {
                    full_path: path.to_string_lossy().to_string(),
                    path: shorten(&path.to_string_lossy(), &home),
                    label: (*label).to_string(),
                    size: cleaner::entry_size(&path),
                });
            }
        }
    }

    let total_size = files.iter().map(|f| f.size).sum();
    AppBundle { files, total_size }
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AppSize {
    pub path: String,
    pub size: u64,
}

/// On-disk size of every installed .app bundle (the "app size" Finder shows),
/// computed in parallel. Opt-in from the UI since it walks every bundle.
pub fn app_sizes() -> Vec<AppSize> {
    let home = scanner::home();
    let roots = [
        PathBuf::from("/Applications"),
        PathBuf::from("/Applications/Utilities"),
        home.join("Applications"),
    ];
    let mut bundles: Vec<PathBuf> = Vec::new();
    let mut seen = std::collections::HashSet::new();
    for root in &roots {
        let rd = match std::fs::read_dir(root) {
            Ok(r) => r,
            Err(_) => continue,
        };
        for entry in rd.filter_map(|e| e.ok()) {
            let path = entry.path();
            if path.extension().and_then(|x| x.to_str()) == Some("app")
                && seen.insert(path.to_string_lossy().to_string())
            {
                bundles.push(path);
            }
        }
    }
    bundles
        .par_iter()
        .filter_map(|p| {
            std::panic::catch_unwind(AssertUnwindSafe(|| AppSize {
                path: p.to_string_lossy().into_owned(),
                size: cleaner::entry_size(p),
            }))
            .ok()
        })
        .collect()
}

/// Move an app + its associated files to the Trash. Each path must be a real
/// app location (`/Applications`, `~/Applications`) or live inside `$HOME`,
/// and never under `/System`.
pub fn uninstall(paths: &[String], exclusions: &[String]) -> cleaner::CleanReport {
    let mut report = cleaner::CleanReport::default();
    let excl = cleaner::canon_exclusions(exclusions);
    let home = match scanner::home().canonicalize() {
        Ok(h) => h,
        Err(_) => return report,
    };
    let app_roots: Vec<PathBuf> = [PathBuf::from("/Applications"), home.join("Applications")]
        .into_iter()
        .filter_map(|p| p.canonicalize().ok())
        .collect();

    for raw in paths {
        let path = PathBuf::from(raw);
        let canon = match path.canonicalize() {
            Ok(c) => c,
            Err(_) => {
                report.failed += 1;
                continue;
            }
        };
        if canon.starts_with("/System") || canon == home {
            report.failed += 1;
            continue;
        }
        let under_home = canon.starts_with(&home);
        let under_apps = app_roots.iter().any(|r| canon.starts_with(r) && &canon != r);
        if !(under_home || under_apps) {
            report.failed += 1;
            continue;
        }
        if cleaner::is_excluded(&canon, &excl) {
            continue;
        }
        let size = cleaner::entry_size(&canon);
        if trash::delete(&path).is_ok() {
            report.bytes += size;
            report.removed += 1;
        } else {
            report.failed += 1;
        }
    }
    report
}

/* -------------------------------- icons ---------------------------------- */

/// Extract the app's real icon as a `data:image/png;base64,…` URL.
pub(crate) fn app_icon(app: &Path) -> Option<String> {
    let icns_path = find_icns(app)?;
    let file = std::io::BufReader::new(std::fs::File::open(&icns_path).ok()?);
    let family = icns::IconFamily::read(file).ok()?;

    let mut types = family.available_icons();
    if types.is_empty() {
        return None;
    }
    types.sort_by_key(|t| t.pixel_width());
    // Aim for ~48–128px; fall back to the largest available entry.
    let chosen = types
        .iter()
        .copied()
        .find(|t| t.pixel_width() >= 48)
        .or_else(|| types.last().copied())?;

    let image = family.get_icon_with_type(chosen).ok()?;
    let mut png = Vec::new();
    image.write_png(&mut png).ok()?;
    Some(format!(
        "data:image/png;base64,{}",
        base64::engine::general_purpose::STANDARD.encode(&png)
    ))
}

fn find_icns(app: &Path) -> Option<PathBuf> {
    let resources = app.join("Contents/Resources");

    // 1) The icon named in Info.plist (CFBundleIconFile)
    if let Ok(v) = plist::Value::from_file(app.join("Contents/Info.plist")) {
        if let Some(name) = v
            .as_dictionary()
            .and_then(|d| d.get("CFBundleIconFile"))
            .and_then(|x| x.as_string())
        {
            let direct = resources.join(name);
            if direct.exists() {
                return Some(direct);
            }
            let with_ext = resources.join(format!("{name}.icns"));
            if with_ext.exists() {
                return Some(with_ext);
            }
        }
    }

    // 2) Common names
    for cand in ["AppIcon.icns", "app.icns", "icon.icns", "electron.icns"] {
        let p = resources.join(cand);
        if p.exists() {
            return Some(p);
        }
    }

    // 3) Any .icns in Resources
    if let Ok(rd) = std::fs::read_dir(&resources) {
        for entry in rd.filter_map(|e| e.ok()) {
            let p = entry.path();
            if p.extension().is_some_and(|x| x == "icns") {
                return Some(p);
            }
        }
    }
    None
}
