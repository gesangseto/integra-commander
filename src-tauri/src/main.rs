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

#[tauri::command]
fn is_admin() -> bool {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("net")
            .args(["session"])
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }
    #[cfg(not(target_os = "windows"))]
    {
        std::process::Command::new("id")
            .args(["-u"])
            .output()
            .map(|o| String::from_utf8_lossy(&o.stdout).trim() == "0")
            .unwrap_or(false)
    }
}

#[tauri::command]
fn create_startup_script(
    working_directory: String,
    nginx_path: String,
    _app_name: String,
    password: String,
) -> Result<String, String> {
    // Determine PM2_HOME: prefer USERPROFILE env, fallback to current_user profile
    let pm2_home = std::env::var("USERPROFILE")
        .unwrap_or_else(|_| {
            let home_dir = dirs::home_dir()
                .unwrap_or_else(|| std::path::PathBuf::from("C:\\"));
            home_dir.to_string_lossy().to_string()
        });
    let pm2_home = format!("{}\\.pm2", pm2_home);

    let log_file = format!("{}\\log\\scheduller.log", working_directory);
    let bat_content = format!(
        "@echo off\r\n\
         pushd \"{working_directory}\"\r\n\
         set \"LOG_FILE={log_file}\"\r\n\
         if not exist \"{working_directory}\\log\" mkdir \"{working_directory}\\log\"\r\n\
         timeout /t 10 /nobreak >nul\r\n\
         echo [%%date%% %%time%%] Memulai layanan... >> \"%%LOG_FILE%%\"\r\n\
         \"{nginx_path}\\nginx.exe\" -p \"{nginx_path}\" -s reload\r\n\
         if %%errorlevel%%==0 (\r\n\
             echo [%%date%% %%time%%] Nginx: OK >> \"%%LOG_FILE%%\"\r\n\
         ) else (\r\n\
             echo [%%date%% %%time%%] Nginx: GAGAL (error %%errorlevel%%) >> \"%%LOG_FILE%%\"\r\n\
         )\r\n\
         set \"PM2_HOME={pm2_home}\" 
         pm2 resurrect\r\n\
         if %%errorlevel%%==0 (\r\n\
             echo [%%date%% %%time%%] PM2: OK >> \"%%LOG_FILE%%\"\r\n\
         ) else (\r\n\
             echo [%%date%% %%time%%] PM2: GAGAL (error %%errorlevel%%) >> \"%%LOG_FILE%%\"\r\n\
         )\r\n\
         echo [%%date%% %%time%%] Selesai >> \"%%LOG_FILE%%\"\r\n\
         exit\r\n"
    );

    // Get last folder name from workingDirectory
    let last_folder = std::path::Path::new(&working_directory)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "App".to_string());

    // Ensure cmd directory exists
    let cmd_dir = format!("{}\\cmd", working_directory);
    std::fs::create_dir_all(&cmd_dir)
        .map_err(|e| format!("Gagal membuat folder cmd: {}", e))?;

    // Write start file as .cmd
    let bat_path = format!("{}\\Autostart_{}.cmd", cmd_dir, last_folder);
    std::fs::write(&bat_path, bat_content)
        .map_err(|e| format!("Gagal membuat start.bat: {}", e))?;

    // Register on Windows Task Scheduler (runs at startup using current user account)
    let task_name = format!("Autostart_{}", last_folder);
    let username = std::env::var("USERNAME")
        .map_err(|_| "Gagal mendapatkan username saat ini".to_string())?;
    let output = std::process::Command::new("schtasks")
        .args([
            "/Create",
            "/F",                           // Force overwrite if exists
            "/TN", &task_name,              // Task name
            "/TR", &bat_path, // Script path (Rust akan quote otomatis jika ada spasi)
            "/SC", "ONSTART",              // Trigger: at system startup
            "/RL", "HIGHEST",              // Run with highest privileges
            "/RU", &username,              // Run as the user who runs Integra Commander
            "/RP", &password,              // User password (run without logon)
        ])
        .output()
        .map_err(|e| format!("Gagal menjalankan schtasks: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        return Err(format!("Gagal mendaftarkan ke Task Scheduler: {}", stderr));
    }

    Ok(format!("Berhasil! Script: {} | Task: {} | Akan jalan otomatis saat Windows startup", bat_path, task_name))
}

fn main() {
    let _ = fix_path_env::fix();
    
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,None
        ))
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_serialplugin::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![shutdown, get_local_ip, is_admin, create_startup_script])
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
