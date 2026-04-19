// Health Integrate — Tauri shell entry point.
//
// Keep this file minimal. Rust-side capabilities (DPAPI storage, pty bridge,
// PHI masker, etc.) land in their own modules under src/ as each phase ships.

use std::fs;
use std::path::Path;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|_app| Ok(()))
        .invoke_handler(tauri::generate_handler![ping, read_text_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn ping() -> &'static str {
    "pong"
}

/// Read a UTF-8 text file the user has explicitly selected via a dialog.
///
/// Preferred over the fs plugin's scoped reads for user-initiated file
/// opens: the frontend first shows `dialog.open()` (user picks a path),
/// then passes the absolute path here. No capability-scope fiddling needed
/// because this command only runs on paths the user actively chose.
#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    let p = Path::new(&path);
    if !p.is_absolute() {
        return Err(format!("path must be absolute: {}", path));
    }
    fs::read_to_string(p).map_err(|e| format!("{}: {}", path, e))
}
