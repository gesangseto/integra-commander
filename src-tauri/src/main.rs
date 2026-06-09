// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::net::UdpSocket;
use sysinfo::{System, Disks};
use std::{thread, time::Duration};
use tauri::Emitter; // Dibutuhkan untuk mengirim event


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

#[tauri::command]
fn get_local_ip() -> Result<String, String> {
    let socket = UdpSocket::bind("0.0.0.0:0")
        .map_err(|e| e.to_string())?;

    socket
        .connect("8.8.8.8:80")
        .map_err(|e| e.to_string())?;

    let addr = socket
        .local_addr()
        .map_err(|e| e.to_string())?;

    Ok(addr.ip().to_string())
}

fn main() {
    let _ = fix_path_env::fix();
    
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_serialplugin::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![shutdown, get_local_ip])
        .setup(|app| {
            let handle = app.handle().clone();
            // Jalankan BACKGROUND THREAD untuk memantau sistem
            thread::spawn(move || {
                let mut sys = System::new_all();
                loop {
                    sys.refresh_cpu_all();
                    sys.refresh_memory();
                    let disks = Disks::new_with_refreshed_list();
                    let mut storage_percentage = 0.0;
                    if let Some(disk) = disks.iter().next() {
                        let total = disk.total_space();
                        let used = total - disk.available_space();
                        if total > 0 {
                            storage_percentage =
                                (used as f64 / total as f64) * 100.0;
                        }
                    }
                    let total_memory_mb = sys.total_memory() as f64 / 1024.0 / 1024.0;
                    let used_memory_mb = sys.used_memory() as f64 / 1024.0 / 1024.0;
                    let memory_percentage = (used_memory_mb / total_memory_mb) * 100.0;

                    let _ = handle.emit(
                        "sys-stats",
                        serde_json::json!({
                            "cpu": sys.global_cpu_usage(),
                            "memory": memory_percentage,
                            "storage": storage_percentage,
                            // tambahan
                            "totalMemoryMB": total_memory_mb,
                            "usedMemoryMB": used_memory_mb
                        }),
                    );
                    thread::sleep(Duration::from_secs(10));
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
