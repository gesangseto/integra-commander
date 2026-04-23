// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use sysinfo::{System, Disks};
use std::sync::Mutex;
use tauri::State;

// Struct untuk menyimpan state system agar perhitungan CPU delta akurat
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

#[tauri::command]
fn get_system_stats(state: State<'_, SystemState>) -> serde_json::Value {
    let mut sys = state.0.lock().unwrap();
    
    // Refresh data internal
    sys.refresh_cpu_all();
    sys.refresh_memory();
    
    // --- LOGIC STORAGE ---
    // Kita refresh daftar disk setiap kali dipanggil untuk deteksi disk baru/perubahan space
    let disks = Disks::new_with_refreshed_list();
    let mut storage_percentage = 0.0;
    
    // Mengambil disk utama (index 0)
    if let Some(disk) = disks.iter().next() {
        let total = disk.total_space();
        let available = disk.available_space();
        let used = total - available;
        
        if total > 0 {
            storage_percentage = (used as f64 / total as f64) * 100.0;
        }
    }

    // --- DATA OUTPUT ---
    serde_json::json!({
        "cpu": sys.global_cpu_usage(),
        "memory": (sys.used_memory() as f64 / sys.total_memory() as f64) * 100.0,
        "storage": storage_percentage,
    })
}

fn main() {
    let _ = fix_path_env::fix();
    
    // Inisialisasi awal system info
    let mut sys = System::new_all();
    sys.refresh_all();

    tauri::Builder::default()
        // Daftarkan state agar bisa dipakai di command get_system_stats
        .manage(SystemState(Mutex::new(sys)))
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_serialplugin::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            shutdown, 
            get_system_stats
        ]) 
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}