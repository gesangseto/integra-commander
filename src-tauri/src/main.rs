// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use sysinfo::{System, Disks};
use std::sync::Mutex;
use std::{thread, time::Duration};
use tauri::Emitter; // Dibutuhkan untuk mengirim event

// Struct tetap dipertahankan jika Anda masih ingin memanggil get_system_stats secara manual
struct SystemState(Mutex<System>);

#[tauri::command]
fn shutdown() {
    #[cfg(target_os = "windows")]
    let _ = std::process::Command::new("shutdown")
        .args(["/s", "/t", "0"])
        .spawn();
    
    #[cfg(not(target_os = "windows"))]
    let _ = std::process::Command::new("shutdown")
        .args(["-h", "now"])
        .spawn();
}

fn main() {
    let _ = fix_path_env::fix();
    
    // Inisialisasi awal system info
    let sys = System::new_all();

    tauri::Builder::default()
        .manage(SystemState(Mutex::new(sys)))
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_serialplugin::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![shutdown])
        .setup(|app| {
            let handle = app.handle().clone();
            // Jalankan BACKGROUND THREAD untuk memantau sistem
            thread::spawn(move || {
                let mut sys = System::new_all();
                loop {
                    // 1. Refresh CPU & Memory
                    sys.refresh_cpu_all();
                    sys.refresh_memory();
                    // 2. Refresh Storage
                    let disks = Disks::new_with_refreshed_list();
                    let mut storage_percentage = 0.0;
                    if let Some(disk) = disks.iter().next() {
                        let total = disk.total_space();
                        let used = total - disk.available_space();
                        if total > 0 {
                            storage_percentage = (used as f64 / total as f64) * 100.0;
                        }
                    }
                    // 3. EMIT DATA ke Frontend
                    let _ = handle.emit("sys-stats", serde_json::json!({
                        "cpu": sys.global_cpu_usage(),
                        "memory": (sys.used_memory() as f64 / sys.total_memory() as f64) * 100.0,
                        "storage": storage_percentage,
                    }));
                    // 4. Jeda 2 detik
                    thread::sleep(Duration::from_secs(10));
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
