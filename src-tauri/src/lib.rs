mod bigfiles;
mod cleaner;
mod devjunk;
mod dupes;
mod leftovers;
mod scanner;
mod startup;
mod uninstaller;
mod updater;

use serde::Deserialize;
use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};
use tauri::{Emitter, Manager};
use tauri_plugin_notification::NotificationExt;

/// Real disk usage of the boot volume. Read-only.
#[tauri::command]
fn get_disk_usage() -> scanner::DiskUsage {
    scanner::disk_usage()
}

/// Inspect one cleanup category. Reads sizes only — never deletes. Streams
/// `scan-progress` events with running totals so the UI can show live activity.
///
/// Async + `spawn_blocking` so the (potentially long) disk walk runs off the
/// main thread — the UI stays responsive and switches to the scan view instantly.
#[tauri::command]
async fn scan_category(id: String, window: tauri::Window) -> scanner::ScanResult {
    tauri::async_runtime::spawn_blocking(move || {
        let progress_id = id.clone();
        scanner::scan(&id, move |files, bytes| {
            let _ = window.emit(
                "scan-progress",
                scanner::ScanProgress {
                    id: progress_id.clone(),
                    files,
                    bytes,
                },
            );
        })
    })
    .await
    .unwrap_or_default()
}

/// Clean the given categories. Moves to Trash by default; `permanent` opts into
/// hard deletion for regenerable categories (never for Downloads).
#[tauri::command]
async fn clean_categories(
    ids: Vec<String>,
    permanent: bool,
    exclusions: Vec<String>,
) -> cleaner::CleanReport {
    tauri::async_runtime::spawn_blocking(move || cleaner::clean(&ids, permanent, &exclusions))
        .await
        .unwrap_or_default()
}

/// Permanently empty the Trash.
#[tauri::command]
async fn empty_trash() -> cleaner::CleanReport {
    tauri::async_runtime::spawn_blocking(cleaner::empty_trash)
        .await
        .unwrap_or_default()
}

/// Find leftovers of uninstalled apps + dead PATH entries. Read-only.
#[tauri::command]
async fn scan_leftovers() -> Vec<leftovers::Leftover> {
    tauri::async_runtime::spawn_blocking(leftovers::scan)
        .await
        .unwrap_or_default()
}

/// Find large files in the user's content folders. Read-only.
#[tauri::command]
async fn scan_big_files() -> Vec<bigfiles::BigFile> {
    tauri::async_runtime::spawn_blocking(bigfiles::scan)
        .await
        .unwrap_or_default()
}

/// Find duplicate files (identical content) in the user's content folders.
#[tauri::command]
async fn scan_duplicates() -> Vec<dupes::DupeGroup> {
    tauri::async_runtime::spawn_blocking(dupes::scan)
        .await
        .unwrap_or_default()
}

/// Scan well-known developer cache/junk locations with their sizes. Read-only.
#[tauri::command]
async fn scan_dev_junk() -> Vec<devjunk::DevTarget> {
    tauri::async_runtime::spawn_blocking(devjunk::scan)
        .await
        .unwrap_or_default()
}

/// Move a chosen set of leftover paths to the Trash (reversible, $HOME-guarded).
#[tauri::command]
async fn trash_paths(paths: Vec<String>, exclusions: Vec<String>) -> cleaner::CleanReport {
    tauri::async_runtime::spawn_blocking(move || cleaner::trash_paths(&paths, &exclusions))
        .await
        .unwrap_or_default()
}

/// List installed apps (fast — no sizing).
#[tauri::command]
async fn list_apps() -> Vec<uninstaller::AppInfo> {
    tauri::async_runtime::spawn_blocking(uninstaller::list_apps)
        .await
        .unwrap_or_default()
}

/// The bundle + every associated file tclean can find for one app.
#[tauri::command]
async fn app_files(app_path: String, bundle_id: String, name: String) -> uninstaller::AppBundle {
    tauri::async_runtime::spawn_blocking(move || uninstaller::app_files(app_path, bundle_id, name))
        .await
        .unwrap_or_default()
}

/// Uninstall: move the app + its associated files to the Trash.
#[tauri::command]
async fn uninstall_app(paths: Vec<String>, exclusions: Vec<String>) -> cleaner::CleanReport {
    tauri::async_runtime::spawn_blocking(move || uninstaller::uninstall(&paths, &exclusions))
        .await
        .unwrap_or_default()
}

/// Check installed apps for available updates (via Homebrew Cask). Read-only.
#[tauri::command]
async fn check_updates() -> Vec<updater::UpdatableApp> {
    tauri::async_runtime::spawn_blocking(updater::check_updates)
        .await
        .unwrap_or_default()
}

/// On-disk size of one app bundle, in bytes (computed lazily for the detail panel).
#[tauri::command]
async fn app_size(path: String) -> u64 {
    tauri::async_runtime::spawn_blocking(move || cleaner::entry_size(std::path::Path::new(&path)))
        .await
        .unwrap_or(0)
}

/// On-disk size of every installed app bundle (opt-in; parallel).
#[tauri::command]
async fn app_sizes() -> Vec<uninstaller::AppSize> {
    tauri::async_runtime::spawn_blocking(uninstaller::app_sizes)
        .await
        .unwrap_or_default()
}

/// Best-effort Full Disk Access probe — try reading a TCC-protected location.
#[tauri::command]
fn has_full_disk_access() -> bool {
    let home = scanner::home();
    let files = [
        home.join("Library/Application Support/com.apple.TCC/TCC.db"),
        home.join("Library/Safari/CloudTabs.db"),
    ];
    if files.iter().any(|p| std::fs::File::open(p).is_ok()) {
        return true;
    }
    std::fs::read_dir(home.join("Library/Safari")).is_ok()
}

/// Open a URL or `x-apple.systempreferences:` settings pane via macOS `open`.
#[tauri::command]
fn open_url(url: String) {
    let _ = std::process::Command::new("/usr/bin/open").arg(url).spawn();
}

/// Login items + background LaunchAgents/Daemons that run at startup. Read-only.
#[tauri::command]
async fn list_startup_items() -> Vec<startup::StartupItem> {
    tauri::async_runtime::spawn_blocking(startup::list)
        .await
        .unwrap_or_default()
}

/// Enable/disable (or remove, for login items) a startup item.
#[tauri::command]
async fn set_startup_enabled(id: String, kind: String, enabled: bool) -> bool {
    tauri::async_runtime::spawn_blocking(move || startup::set_enabled(&id, &kind, enabled))
        .await
        .unwrap_or(false)
}

#[derive(Deserialize)]
struct UpgradeItem {
    id: String,
    cask: String,
    name: String,
}

/// Run `brew upgrade --cask` for each item in turn, streaming output to the UI
/// via `update-progress` / `update-done` events, and notifying when finished.
#[tauri::command]
async fn run_upgrade(app: tauri::AppHandle, items: Vec<UpgradeItem>) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let brew = updater::brew_path();
        let mut ok = 0usize;
        let mut last = String::new();

        for item in &items {
            let _ = app.emit(
                "update-progress",
                serde_json::json!({ "id": item.id, "line": format!("Updating {}…", item.name) }),
            );
            let result = match &brew {
                Some(b) => run_brew_upgrade(b, &item.cask, &app, &item.id),
                None => Err("Homebrew not found".to_string()),
            };
            if result.is_ok() {
                ok += 1;
                last = item.name.clone();
            }
            let _ = app.emit(
                "update-done",
                serde_json::json!({ "id": item.id, "success": result.is_ok(), "error": result.err() }),
            );
        }

        if ok > 0 {
            let body = if ok == 1 {
                format!("{last} updated")
            } else {
                format!("{ok} apps updated")
            };
            let _ = app.notification().builder().title("tclean").body(body).show();
        }
    })
    .await
    .map_err(|e| e.to_string())
}

fn run_brew_upgrade(
    brew: &str,
    cask: &str,
    app: &tauri::AppHandle,
    id: &str,
) -> Result<(), String> {
    let mut child = Command::new(brew)
        .args(["upgrade", "--cask", cask])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| e.to_string())?;

    // Drain stderr on its own thread so the pipe can't deadlock.
    let stderr = child.stderr.take();
    let app_err = app.clone();
    let id_err = id.to_string();
    let err_handle = std::thread::spawn(move || {
        let mut collected = String::new();
        if let Some(e) = stderr {
            for line in BufReader::new(e).lines().map_while(Result::ok) {
                let _ = app_err
                    .emit("update-progress", serde_json::json!({ "id": id_err, "line": line }));
                collected.push_str(&line);
                collected.push('\n');
            }
        }
        collected
    });

    if let Some(out) = child.stdout.take() {
        for line in BufReader::new(out).lines().map_while(Result::ok) {
            let _ = app.emit("update-progress", serde_json::json!({ "id": id, "line": line }));
        }
    }

    let status = child.wait().map_err(|e| e.to_string())?;
    let err_text = err_handle.join().unwrap_or_default();
    if status.success() {
        Ok(())
    } else if err_text.trim().is_empty() {
        Err("Update failed".to_string())
    } else {
        Err(err_text
            .lines()
            .last()
            .unwrap_or("Update failed")
            .to_string())
    }
}

fn human_bytes(b: u64) -> String {
    const U: [&str; 5] = ["B", "KB", "MB", "GB", "TB"];
    let mut v = b as f64;
    let mut i = 0;
    while v >= 1024.0 && i < U.len() - 1 {
        v /= 1024.0;
        i += 1;
    }
    if i == 0 {
        format!("{b} B")
    } else {
        format!("{v:.1} {}", U[i])
    }
}

/// macOS menu-bar (tray) icon with quick actions.
fn build_tray(app: &tauri::App) -> tauri::Result<()> {
    use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
    use tauri::tray::TrayIconBuilder;

    let show = MenuItem::with_id(app, "show", "Open tclean", true, None::<&str>)?;
    let empty = MenuItem::with_id(app, "empty_trash", "Empty Trash…", true, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Quit tclean", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &empty, &sep, &quit])?;

    let builder = TrayIconBuilder::new()
        // Monochrome dolphin silhouette, no coloured squircle — macOS renders it
        // as a template image (auto light/dark) so it matches system menu-bar icons.
        .icon(tauri::include_image!("icons/tray.png"))
        .icon_as_template(true)
        .tooltip("tclean")
        .menu(&menu)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                // Bring tclean back from the menu bar: restore the Dock icon + window.
                #[cfg(target_os = "macos")]
                let _ = app.set_activation_policy(tauri::ActivationPolicy::Regular);
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.unminimize();
                    let _ = w.set_focus();
                }
            }
            "empty_trash" => {
                let report = cleaner::empty_trash();
                let body = if report.bytes > 0 {
                    format!("Freed {} from the Trash", human_bytes(report.bytes))
                } else {
                    "The Trash was already empty".to_string()
                };
                let _ = app
                    .notification()
                    .builder()
                    .title("Trash emptied")
                    .body(body)
                    .show();
            }
            "quit" => app.exit(0),
            _ => {}
        });

    builder.build(app)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            get_disk_usage,
            scan_category,
            clean_categories,
            empty_trash,
            scan_leftovers,
            scan_big_files,
            scan_duplicates,
            scan_dev_junk,
            trash_paths,
            list_apps,
            app_files,
            uninstall_app,
            check_updates,
            app_size,
            app_sizes,
            run_upgrade,
            list_startup_items,
            set_startup_enabled,
            has_full_disk_access,
            open_url
        ])
        .on_window_event(|window, event| {
            // Closing the main window tucks tclean into the menu bar instead of
            // quitting — like ZeroTier. Only the tray "Quit tclean" actually exits.
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                    #[cfg(target_os = "macos")]
                    let _ = window
                        .app_handle()
                        .set_activation_policy(tauri::ActivationPolicy::Accessory);
                }
            }
        })
        .setup(|app| {
            build_tray(app)?;
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tclean")
        .run(|app_handle, event| match event {
            // Cmd+Q (code: None) keeps tclean running in the menu bar; the tray
            // "Quit tclean" calls app.exit(0) (code: Some) which is let through.
            tauri::RunEvent::ExitRequested { api, code, .. } if code.is_none() => {
                api.prevent_exit();
                if let Some(w) = app_handle.get_webview_window("main") {
                    let _ = w.hide();
                }
                #[cfg(target_os = "macos")]
                let _ = app_handle.set_activation_policy(tauri::ActivationPolicy::Accessory);
            }
            // Clicking the Dock icon (when visible) reopens the window.
            tauri::RunEvent::Reopen { .. } => {
                #[cfg(target_os = "macos")]
                let _ = app_handle.set_activation_policy(tauri::ActivationPolicy::Regular);
                if let Some(w) = app_handle.get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }
            _ => {}
        });
}
