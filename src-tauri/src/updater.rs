//! App update checking via Homebrew Cask (the same proven approach as the
//! standalone MacUpdater project): read each installed app's version from its
//! Info.plist, detect its source, and merge `brew outdated --cask` to know
//! which have a newer version available. Upgrades run `brew upgrade --cask`.

use rayon::prelude::*;
use serde::Serialize;
use std::collections::{HashMap, HashSet};
use std::panic::AssertUnwindSafe;
use std::path::{Path, PathBuf};
use std::process::Command;

use crate::scanner;
use crate::uninstaller::app_icon;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UpdatableApp {
    pub name: String,
    pub bundle_id: String,
    pub developer: String,
    pub category: String,
    pub path: String,
    pub icon: Option<String>,
    pub current_version: String,
    pub latest_version: String,
    pub update_available: bool,
    /// "appstore" | "homebrew" | "direct"
    pub source: String,
    /// brew cask token (for upgrades), if managed by brew
    pub cask_token: Option<String>,
}

pub fn check_updates() -> Vec<UpdatableApp> {
    let (casks, outdated) = brew_info();
    let home = scanner::home();
    let roots = [
        PathBuf::from("/Applications"),
        PathBuf::from("/Applications/Utilities"),
        home.join("Applications"),
    ];

    // Collect bundle paths first…
    let mut bundles = Vec::new();
    let mut seen = HashSet::new();
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

    // …then read + icon-extract them in parallel. A panic on one bad bundle is
    // caught so it can't wipe the whole list.
    let mut apps: Vec<UpdatableApp> = bundles
        .par_iter()
        .filter_map(|p| {
            std::panic::catch_unwind(AssertUnwindSafe(|| process(p, &casks, &outdated)))
                .ok()
                .flatten()
        })
        .collect();

    // updatable first, then alphabetical
    apps.sort_by(|a, b| {
        b.update_available
            .cmp(&a.update_available)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    apps
}

fn process(
    path: &Path,
    casks: &HashSet<String>,
    outdated: &HashMap<String, String>,
) -> Option<UpdatableApp> {
    let value = plist::Value::from_file(path.join("Contents/Info.plist")).ok()?;
    let dict = value.as_dictionary()?;

    let stem = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("App")
        .to_string();
    let name = dict_str(dict, "CFBundleDisplayName")
        .or_else(|| dict_str(dict, "CFBundleName"))
        .unwrap_or(stem);
    let bundle_id = dict_str(dict, "CFBundleIdentifier").unwrap_or_default();
    let current = dict_str(dict, "CFBundleShortVersionString")
        .or_else(|| dict_str(dict, "CFBundleVersion"))
        .unwrap_or_else(|| "—".to_string());

    let token = slug(&name);
    let is_brew = casks.contains(&token);
    let is_mas = path.join("Contents/_MASReceipt/receipt").exists();
    let source = if is_mas {
        "appstore"
    } else if is_brew {
        "homebrew"
    } else {
        "direct"
    };

    let (update_available, latest) = match outdated.get(&token) {
        Some(latest) => (true, latest.clone()),
        None => (false, current.clone()),
    };

    let developer = developer_from_bundle_id(&bundle_id, &name);
    let category = category_label(dict_str(dict, "LSApplicationCategoryType").as_deref());

    Some(UpdatableApp {
        name,
        bundle_id,
        developer,
        category,
        path: path.to_string_lossy().to_string(),
        icon: app_icon(path),
        current_version: current,
        latest_version: latest,
        update_available,
        source: source.to_string(),
        cask_token: if is_brew { Some(token) } else { None },
    })
}

fn developer_from_bundle_id(id: &str, fallback: &str) -> String {
    let parts: Vec<&str> = id.split('.').collect();
    if parts.len() >= 2 && !parts[1].is_empty() {
        let mut chars = parts[1].chars();
        let first = chars.next().unwrap().to_uppercase().collect::<String>();
        return first + chars.as_str();
    }
    fallback.to_string()
}

fn category_label(cat: Option<&str>) -> String {
    let c = cat.unwrap_or("");
    if c.contains("developer") {
        "Developer Tools"
    } else if c.contains("productivity") {
        "Productivity"
    } else if c.contains("utilities") {
        "Utilities"
    } else if c.contains("music") {
        "Music"
    } else if c.contains("video") || c.contains("entertainment") {
        "Media"
    } else if c.contains("graphics") || c.contains("design") || c.contains("photography") {
        "Design"
    } else if c.contains("social") || c.contains("communication") {
        "Communication"
    } else if c.contains("business") || c.contains("finance") {
        "Business"
    } else if c.contains("games") {
        "Games"
    } else if c.contains("browser") || c.contains("internet") {
        "Browser"
    } else {
        "Application"
    }
    .to_string()
}

fn dict_str(dict: &plist::Dictionary, key: &str) -> Option<String> {
    dict.get(key).and_then(|v| v.as_string()).map(String::from)
}

fn slug(name: &str) -> String {
    let mut s: String = name
        .trim()
        .to_lowercase()
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
        .collect();
    while s.contains("--") {
        s = s.replace("--", "-");
    }
    s.trim_matches('-').to_string()
}

pub fn brew_path() -> Option<String> {
    for p in ["/opt/homebrew/bin/brew", "/usr/local/bin/brew"] {
        if Path::new(p).exists() {
            return Some(p.to_string());
        }
    }
    None
}

/// (installed cask tokens, outdated token → latest version)
fn brew_info() -> (HashSet<String>, HashMap<String, String>) {
    let mut casks = HashSet::new();
    let mut outdated = HashMap::new();
    let Some(brew) = brew_path() else {
        return (casks, outdated);
    };

    if let Ok(out) = Command::new(&brew).args(["list", "--cask", "-1"]).output() {
        for line in String::from_utf8_lossy(&out.stdout).lines() {
            let t = line.trim();
            if !t.is_empty() {
                casks.insert(t.to_string());
            }
        }
    }

    if let Ok(out) = Command::new(&brew)
        .args(["outdated", "--cask", "--json=v2"])
        .output()
    {
        if let Ok(json) = serde_json::from_slice::<serde_json::Value>(&out.stdout) {
            if let Some(arr) = json.get("casks").and_then(|c| c.as_array()) {
                for c in arr {
                    let token = c.get("name").and_then(|v| v.as_str()).unwrap_or("");
                    let latest = c
                        .get("current_version")
                        .and_then(|v| v.as_str())
                        .unwrap_or("");
                    if !token.is_empty() && !latest.is_empty() {
                        outdated.insert(token.to_string(), latest.to_string());
                    }
                }
            }
        }
    }

    (casks, outdated)
}
