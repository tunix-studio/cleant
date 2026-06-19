//! Login Items & background (LaunchAgent/Daemon) management — the "what runs at
//! startup" picker behind "faster boot" / "hidden background apps".
//!
//! Listing is read-only. Toggling is conservative: user LaunchAgents can be
//! enabled/disabled with `launchctl` (no sudo, reversible, applies next login);
//! classic Login Items can be removed via System Events; system-level daemons
//! are shown read-only.

use serde::Serialize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Command;

use crate::scanner;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StartupItem {
    /// unique id — the launchd label, or "login:<name>" for login items
    pub id: String,
    pub name: String,
    /// the program/app that runs
    pub program: String,
    /// "login" | "userAgent" | "globalAgent" | "systemDaemon"
    pub kind: String,
    pub enabled: bool,
    /// can we toggle/remove this without sudo?
    pub manageable: bool,
    /// plist path (agents) or app path (login items), for Reveal
    pub path: String,
}

fn uid() -> u32 {
    Command::new("/usr/bin/id")
        .arg("-u")
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .and_then(|s| s.trim().parse().ok())
        .unwrap_or(501)
}

pub fn list() -> Vec<StartupItem> {
    let mut items = login_items();
    let disabled = disabled_user_labels();
    items.extend(launch_items(&disabled));
    items.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    items
}

/* ----------------------------- login items ------------------------------ */

fn login_items() -> Vec<StartupItem> {
    let names = osascript("tell application \"System Events\" to get the name of every login item");
    let paths = osascript("tell application \"System Events\" to get the POSIX path of every login item");
    if names.is_empty() {
        return Vec::new();
    }
    let names = split_list(&names);
    let paths = split_list(&paths);
    names
        .into_iter()
        .enumerate()
        .map(|(i, name)| {
            let path = paths.get(i).cloned().unwrap_or_default();
            StartupItem {
                id: format!("login:{name}"),
                name: name.clone(),
                program: if path.is_empty() { name.clone() } else { path.clone() },
                kind: "login".into(),
                enabled: true,
                manageable: true,
                path,
            }
        })
        .collect()
}

fn osascript(script: &str) -> String {
    Command::new("/usr/bin/osascript")
        .args(["-e", script])
        .output()
        .ok()
        .filter(|o| o.status.success())
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.trim().to_string())
        .unwrap_or_default()
}

fn split_list(s: &str) -> Vec<String> {
    if s.is_empty() {
        return Vec::new();
    }
    s.split(", ")
        .map(|x| x.trim().to_string())
        .filter(|x| !x.is_empty())
        .collect()
}

/* --------------------------- launch agents ------------------------------ */

fn launch_items(disabled: &HashMap<String, bool>) -> Vec<StartupItem> {
    let home = scanner::home();
    let sources: &[(PathBuf, &str, bool)] = &[
        (home.join("Library/LaunchAgents"), "userAgent", true),
        (PathBuf::from("/Library/LaunchAgents"), "globalAgent", false),
        (PathBuf::from("/Library/LaunchDaemons"), "systemDaemon", false),
    ];

    let mut out = Vec::new();
    for (dir, kind, manageable) in sources {
        let rd = match std::fs::read_dir(dir) {
            Ok(r) => r,
            Err(_) => continue,
        };
        for entry in rd.filter_map(|e| e.ok()) {
            let path = entry.path();
            if path.extension().and_then(|x| x.to_str()) != Some("plist") {
                continue;
            }
            if let Some(item) = parse_agent(&path, kind, *manageable, disabled) {
                out.push(item);
            }
        }
    }
    out
}

fn parse_agent(
    path: &Path,
    kind: &str,
    manageable: bool,
    disabled: &HashMap<String, bool>,
) -> Option<StartupItem> {
    let value = plist::Value::from_file(path).ok()?;
    let dict = value.as_dictionary()?;

    let label = dict
        .get("Label")
        .and_then(|v| v.as_string())
        .map(String::from)
        .unwrap_or_else(|| {
            path.file_stem()
                .map(|s| s.to_string_lossy().into_owned())
                .unwrap_or_default()
        });

    let program = dict
        .get("Program")
        .and_then(|v| v.as_string())
        .map(String::from)
        .or_else(|| {
            dict.get("ProgramArguments")
                .and_then(|v| v.as_array())
                .and_then(|a| a.first())
                .and_then(|v| v.as_string())
                .map(String::from)
        })
        .unwrap_or_else(|| "—".to_string());

    // Disabled state: the launchctl override DB wins, else the plist's key.
    let plist_disabled = dict
        .get("Disabled")
        .and_then(|v| v.as_boolean())
        .unwrap_or(false);
    let enabled = match disabled.get(&label) {
        Some(&d) => !d,
        None => !plist_disabled,
    };

    let name = display_name(&label, &program);
    Some(StartupItem {
        id: label.clone(),
        name,
        program,
        kind: kind.to_string(),
        enabled,
        manageable,
        path: path.to_string_lossy().to_string(),
    })
}

const GENERIC: &[&str] = &[
    "agent", "helper", "daemon", "service", "services", "check", "update",
    "updater", "launcher", "app", "client", "framework", "tool", "bridge",
    "bridgeservice", "checkinstalls", "login", "startup", "autoupdate",
];

/// A readable name: prefer the outermost `.app` in the program path, else the
/// most meaningful segment of the launchd label.
fn display_name(label: &str, program: &str) -> String {
    if let Some(app) = first_app_name(program) {
        return app;
    }
    let parts: Vec<&str> = label.split('.').filter(|p| !p.is_empty()).collect();
    let chosen = parts
        .iter()
        .rev()
        .find(|p| p.len() >= 3 && !GENERIC.contains(&p.to_lowercase().as_str()))
        .or_else(|| parts.last())
        .copied()
        .unwrap_or(label);
    let mut chars = chosen.chars();
    match chars.next() {
        Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
        None => label.to_string(),
    }
}

/// The outermost `*.app` folder name in a program path, e.g.
/// `/Applications/Foo.app/Contents/.../bar` → "Foo".
fn first_app_name(program: &str) -> Option<String> {
    // Require ".app/" so we match a real bundle folder, not ".app" inside a word.
    let idx = program.find(".app/")?;
    let name = program[..idx].rsplit('/').next()?;
    if name.len() >= 2 {
        Some(name.to_string())
    } else {
        None
    }
}

fn disabled_user_labels() -> HashMap<String, bool> {
    let mut map = HashMap::new();
    let out = Command::new("/bin/launchctl")
        .args(["print-disabled", &format!("gui/{}", uid())])
        .output();
    if let Ok(out) = out {
        for line in String::from_utf8_lossy(&out.stdout).lines() {
            // lines look like:  "com.foo.bar" => true
            let line = line.trim();
            if let Some((label, state)) = line.split_once("=>") {
                let label = label.trim().trim_matches('"').to_string();
                let disabled = state.trim() == "true";
                if !label.is_empty() {
                    map.insert(label, disabled);
                }
            }
        }
    }
    map
}

/* ------------------------------- toggling -------------------------------- */

/// Enable/disable a startup item. Returns true on success.
pub fn set_enabled(id: &str, kind: &str, enabled: bool) -> bool {
    match kind {
        "userAgent" => {
            let target = format!("gui/{}/{}", uid(), id);
            let sub = if enabled { "enable" } else { "disable" };
            let ok = Command::new("/bin/launchctl")
                .args([sub, &target])
                .status()
                .map(|s| s.success())
                .unwrap_or(false);
            // Best-effort: also apply now (ignore failures — the persisted
            // enable/disable takes effect next login regardless).
            if enabled {
                // bootstrap needs the plist path; skip — next login is enough.
            } else {
                let _ = Command::new("/bin/launchctl")
                    .args(["bootout", &target])
                    .status();
            }
            ok
        }
        "login" if !enabled => {
            // Remove the login item (reversible by re-adding in System Settings).
            let name = id.strip_prefix("login:").unwrap_or(id);
            let script = format!(
                "tell application \"System Events\" to delete login item \"{}\"",
                name.replace('"', "")
            );
            Command::new("/usr/bin/osascript")
                .args(["-e", &script])
                .status()
                .map(|s| s.success())
                .unwrap_or(false)
        }
        _ => false,
    }
}
