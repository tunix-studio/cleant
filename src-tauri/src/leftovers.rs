//! Finds leftovers from apps that are no longer installed, plus dead PATH
//! entries referenced by shell config files.
//!
//! This is read-only discovery. It deliberately errs toward *not* flagging
//! something (fuzzy "looks installed" matching) because the user reviews every
//! finding before anything is removed — and removal goes to the Trash.

use serde::Serialize;
use std::collections::HashSet;
use std::path::{Path, PathBuf};

use crate::cleaner;
use crate::scanner;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Leftover {
    pub full_path: String,
    /// `~`-shortened path for display
    pub path: String,
    pub name: String,
    /// where it lives, e.g. "Preferences", "App support", "Dead PATH entry"
    pub kind: String,
    /// inferred app / identifier this belongs to
    pub app: String,
    pub size: u64,
    /// "high" | "medium"
    pub confidence: String,
    /// false for PATH entries (a config line, not a file to trash)
    pub removable: bool,
    /// for PATH entries: which config file referenced it
    pub source: String,
}

pub fn scan() -> Vec<Leftover> {
    let home = scanner::home();
    let (ids, names) = installed_identifiers(&home);

    let mut out = orphan_app_files(&home, &ids, &names);
    out.extend(orphan_dotfolders(&home, &names));
    out.extend(dead_path_entries(&home));
    out.sort_by(|a, b| b.size.cmp(&a.size));
    out
}

/* ---------------------- orphaned dotfolders (~, Docs) -------------------- */

/// Common dev/system dotfolders that are NOT app leftovers — never flag these.
const DOTFOLDER_DENY: &[&str] = &[
    "config", "cache", "local", "ssh", "gnupg", "aws", "docker", "kube", "npm",
    "nodegyp", "cargo", "rustup", "gem", "bundle", "cocoapods", "gradle", "m2",
    "vscode", "vscodeserver", "cursor", "vim", "ohmyzsh", "nvm", "pyenv",
    "rbenv", "android", "trash", "dsstore", "cfusertextencoding", "zshsessions",
    "zshhistory", "bashhistory", "bashprofile", "bashrc", "viminfo", "lesshst",
    "pythonhistory", "nodereplhistory", "yarn", "pnpm", "deno", "bun", "expo",
    "gitconfig", "git", "netrc", "wgetrc", "curlrc", "ipython", "jupyter",
    "matplotlib", "sqlitehistory", "lesskey", "xauthority", "swiftpm", "sdkman",
    "conda", "anaconda", "miniconda", "p10k", "powerlevel10k", "fzf", "tmux",
    "zprofile", "zshrc", "zshenv", "profile", "ss5", "terminfo", "zcompdump",
];

fn orphan_dotfolders(home: &Path, names: &HashSet<String>) -> Vec<Leftover> {
    let roots = [home.to_path_buf(), home.join("Documents")];
    let mut out = Vec::new();
    for dir in roots {
        let rd = match std::fs::read_dir(&dir) {
            Ok(r) => r,
            Err(_) => continue,
        };
        for entry in rd.filter_map(|e| e.ok()) {
            let fname = entry.file_name().to_string_lossy().to_string();
            if !fname.starts_with('.') || fname.len() < 3 || !entry.path().is_dir() {
                continue;
            }
            let norm = normalize(fname.trim_start_matches('.'));
            if norm.len() < 3
                || DOTFOLDER_DENY.contains(&norm.as_str())
                || name_overlaps(&norm, names)
            {
                continue;
            }
            let path = entry.path();
            out.push(Leftover {
                full_path: path.to_string_lossy().to_string(),
                path: shorten(&path.to_string_lossy(), home),
                name: fname.clone(),
                kind: "Dotfolder".into(),
                app: fname.trim_start_matches('.').to_string(),
                size: cleaner::entry_size(&path),
                confidence: "medium".into(),
                removable: true,
                source: String::new(),
            });
        }
    }
    out
}

/* ----------------------------- installed apps ---------------------------- */

fn installed_identifiers(home: &Path) -> (HashSet<String>, HashSet<String>) {
    let mut ids = HashSet::new();
    let mut names = HashSet::new();
    let roots = [
        PathBuf::from("/Applications"),
        PathBuf::from("/System/Applications"),
        home.join("Applications"),
    ];
    for root in roots {
        collect_apps(&root, &mut ids, &mut names, 0);
    }
    (ids, names)
}

fn collect_apps(dir: &Path, ids: &mut HashSet<String>, names: &mut HashSet<String>, depth: usize) {
    if depth > 2 {
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
            names.insert(normalize(fname.trim_end_matches(".app")));
            if let Some(id) = bundle_id(&path) {
                ids.insert(id.to_lowercase());
            }
        } else if fname == "Utilities" || (path.is_dir() && !fname.starts_with('.') && depth == 0) {
            collect_apps(&path, ids, names, depth + 1);
        }
    }
}

pub(crate) fn bundle_id(app: &Path) -> Option<String> {
    let value = plist::Value::from_file(app.join("Contents/Info.plist")).ok()?;
    value
        .as_dictionary()?
        .get("CFBundleIdentifier")?
        .as_string()
        .map(str::to_string)
}

/* --------------------------- orphaned app files -------------------------- */

fn orphan_app_files(
    home: &Path,
    ids: &HashSet<String>,
    names: &HashSet<String>,
) -> Vec<Leftover> {
    // (relative dir, display kind)
    let locations: &[(&str, &str)] = &[
        ("Library/Application Support", "App support"),
        ("Library/Caches", "Cache"),
        ("Library/Preferences", "Preferences"),
        ("Library/Containers", "Container"),
        ("Library/Saved Application State", "Saved state"),
        ("Library/HTTPStorages", "Stored data"),
        ("Library/WebKit", "Web data"),
        ("Library/Logs", "Logs"),
    ];

    let mut out = Vec::new();
    for (rel, kind) in locations {
        let dir = home.join(rel);
        let rd = match std::fs::read_dir(&dir) {
            Ok(r) => r,
            Err(_) => continue,
        };
        for entry in rd.filter_map(|e| e.ok()) {
            let fname = entry.file_name().to_string_lossy().to_string();
            if fname.starts_with(".") {
                continue;
            }
            let cand = fname
                .trim_end_matches(".plist")
                .trim_end_matches(".savedState")
                .to_string();
            let cand_lower = cand.to_lowercase();
            let cand_norm = normalize(&cand);

            if cand_norm.len() < 3 || is_system(&cand_lower) {
                continue;
            }
            if is_installed(&cand_lower, &cand_norm, ids, names) {
                continue;
            }

            let path = entry.path();
            let looks_bundle = cand_lower.matches('.').count() >= 2;
            out.push(Leftover {
                full_path: path.to_string_lossy().to_string(),
                path: shorten(&path.to_string_lossy(), home),
                name: fname,
                kind: (*kind).to_string(),
                app: cand,
                size: cleaner::entry_size(&path),
                confidence: if looks_bundle { "high".into() } else { "medium".into() },
                removable: true,
                source: String::new(),
            });
        }
    }
    out
}

fn is_system(cand_lower: &str) -> bool {
    if cand_lower.starts_with("com.apple") || cand_lower.starts_with("apple.") {
        return true;
    }
    const EXACT: &[&str] = &[
        "crashreporter",
        "mobilesync",
        "addressbook",
        "knowledge",
        "syncservices",
        "callhistorydb",
        "callhistorytransactions",
        "icloud",
        "iclouddrive",
        "group.com.apple",
        "diagnosticreports",
    ];
    EXACT.contains(&cand_lower)
}

/// Fuzzy "does this belong to an installed app?" — biased toward yes so we don't
/// false-flag. Matches bundle-id relationships and substring name overlaps.
fn is_installed(
    cand_lower: &str,
    cand_norm: &str,
    ids: &HashSet<String>,
    names: &HashSet<String>,
) -> bool {
    for id in ids {
        if id == cand_lower
            || cand_lower.starts_with(&format!("{id}."))
            || id.starts_with(&format!("{cand_lower}."))
        {
            return true;
        }
    }
    if name_overlaps(cand_norm, names) {
        return true;
    }
    for seg in cand_lower.split('.') {
        let segn = normalize(seg);
        if segn.len() >= 4 && name_overlaps(&segn, names) {
            return true;
        }
    }
    false
}

fn name_overlaps(token: &str, names: &HashSet<String>) -> bool {
    if token.len() < 4 {
        return names.contains(token);
    }
    names
        .iter()
        .any(|n| n.len() >= 4 && (n.contains(token) || token.contains(n.as_str())))
}

/* ---------------------------- dead PATH entries -------------------------- */

fn dead_path_entries(home: &Path) -> Vec<Leftover> {
    let configs = [
        ".zshrc",
        ".zprofile",
        ".zshenv",
        ".bash_profile",
        ".bashrc",
        ".profile",
    ];
    let mut seen = HashSet::new();
    let mut out = Vec::new();

    for cfg in configs {
        let content = match std::fs::read_to_string(home.join(cfg)) {
            Ok(c) => c,
            Err(_) => continue,
        };
        for dir in extract_path_dirs(&content, home) {
            if Path::new(&dir).exists() || !seen.insert(dir.clone()) {
                continue;
            }
            out.push(Leftover {
                full_path: dir.clone(),
                path: shorten(&dir, home),
                name: dir.clone(),
                kind: "Dead PATH entry".into(),
                app: "Shell config".into(),
                size: 0,
                confidence: "high".into(),
                removable: false,
                source: cfg.to_string(),
            });
        }
    }
    out
}

fn extract_path_dirs(content: &str, home: &Path) -> Vec<String> {
    let mut dirs = Vec::new();
    for line in content.lines() {
        let l = line.trim();
        if l.starts_with('#') {
            continue;
        }
        let lower = l.to_lowercase();
        if !(lower.contains("path=") || lower.contains("path+=") || lower.contains("path =")) {
            continue;
        }
        for tok in l.split(|c: char| {
            matches!(c, ':' | '=' | '(' | ')' | '"' | '\'' | ' ' | '\t' | ',')
        }) {
            if let Some(expanded) = expand(tok.trim(), home) {
                dirs.push(expanded);
            }
        }
    }
    dirs
}

fn expand(tok: &str, home: &Path) -> Option<String> {
    if tok.is_empty() || tok.starts_with("${") {
        return None;
    }
    let h = home.to_string_lossy();
    let t = if let Some(rest) = tok.strip_prefix("$HOME") {
        format!("{h}{rest}")
    } else if let Some(rest) = tok.strip_prefix("~") {
        format!("{h}{rest}")
    } else {
        tok.to_string()
    };
    // Only verifiable absolute paths with no remaining shell variables.
    if t.starts_with('/') && !t.contains('$') {
        Some(t)
    } else {
        None
    }
}

/* -------------------------------- helpers -------------------------------- */

pub(crate) fn normalize(s: &str) -> String {
    s.chars()
        .filter(|c| c.is_alphanumeric())
        .collect::<String>()
        .to_lowercase()
}

pub(crate) fn shorten(full: &str, home: &Path) -> String {
    let h = home.to_string_lossy();
    match full.strip_prefix(h.as_ref()) {
        Some(rest) => format!("~{rest}"),
        None => full.to_string(),
    }
}
