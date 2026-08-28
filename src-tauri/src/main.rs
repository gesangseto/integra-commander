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
    pm2_path: String,
    _app_name: String,
    password: String,
) -> Result<String, String> {

    // =========================================================
    // USER PROFILE
    // =========================================================

    let user_profile = std::env::var("USERPROFILE")
        .unwrap_or_else(|_| {
            let home_dir = dirs::home_dir()
                .unwrap_or_else(|| std::path::PathBuf::from("C:\\"));

            home_dir.to_string_lossy().to_string()
        });

    let pm2_home = format!("{}\\.pm2", user_profile);

    let pm2_cmd = &pm2_path;


    // =========================================================
    // WORKING DIRECTORY
    // =========================================================

    let working_path = std::path::Path::new(&working_directory);

    let last_folder = working_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "App".to_string());


    // =========================================================
    // BAT / CMD CONTENT
    // =========================================================

    let bat_content = format!(
r#"@echo off

pushd "{working_directory}" || exit /b 1

timeout /t 10 /nobreak >nul

set "LOG_DIR={working_directory}\log"
set "LOG_FILE=%LOG_DIR%\services.log"

REM =========================================================
REM MAKE SURE LOG DIRECTORY EXISTS
REM =========================================================

if not exist "%LOG_DIR%" (
    mkdir "%LOG_DIR%"
)

REM =========================================================
REM MAKE SURE SERVICES.LOG EXISTS
REM =========================================================

if not exist "%LOG_FILE%" (
    type nul > "%LOG_FILE%"
)

REM =========================================================
REM TIMESTAMP
REM =========================================================

for /f "delims=" %%t in ('powershell -NoProfile -Command "Get-Date -Format 'yyyy-MM-dd HH:mm:ss'"') do set "TS=%%t"

set "FAILED=0"

REM =========================================================
REM NGINX
REM =========================================================

tasklist /FI "IMAGENAME eq nginx.exe" 2>nul | find /I "nginx.exe" >nul

if errorlevel 1 (

    start "" "{nginx_path}\nginx.exe" -p "{nginx_path}"

    timeout /t 2 /nobreak >nul

    tasklist /FI "IMAGENAME eq nginx.exe" 2>nul | find /I "nginx.exe" >nul

    if errorlevel 1 (
        set "FAILED=1"
        call :WriteLog "[%TS%] -> FAILED: MERTRACK {last_folder}, failed running nginx."
    )

) else (

    "{nginx_path}\nginx.exe" -p "{nginx_path}" -s reload

    if errorlevel 1 (
        set "FAILED=1"
        call :WriteLog "[%TS%] -> FAILED: MERTRACK {last_folder}, failed running nginx."
    )
)

REM =========================================================
REM PM2
REM =========================================================

set "PM2_HOME={pm2_home}"

if not exist "{pm2_cmd}" (

    set "FAILED=1"

    call :WriteLog "[%TS%] -> FAILED: MERTRACK {last_folder}, pm2.cmd not found."

) else (

    call "{pm2_cmd}" resurrect

    if errorlevel 1 (
        set "FAILED=1"
        call :WriteLog "[%TS%] -> FAILED: MERTRACK {last_folder}, failed running pm2."
    )
)

REM =========================================================
REM RESULT
REM =========================================================

if "%FAILED%"=="0" (
    call :WriteLog "[%TS%] -> SUCCESS: MERTRACK {last_folder} server successfully started."
)

popd

exit /b


REM =========================================================
REM WRITE LOG
REM =========================================================

:WriteLog
set "msg=%~1"
set "msg=%msg:>=^>%"
if not exist "%LOG_FILE%" (
    echo(%msg%>"%LOG_FILE%"
) else (
    echo(%msg%>"%LOG_FILE%.new"
    type "%LOG_FILE%" >> "%LOG_FILE%.new"
    move /y "%LOG_FILE%.new" "%LOG_FILE%" >nul
)
goto :eof
"#,
        working_directory = working_directory,
        nginx_path = nginx_path,
        pm2_home = pm2_home,
        pm2_cmd = pm2_cmd,
        last_folder = last_folder,
    );


    // =========================================================
    // CREATE CMD DIRECTORY
    // =========================================================

    let cmd_dir = format!("{}\\cmd", working_directory);

    std::fs::create_dir_all(&cmd_dir)
        .map_err(|e| format!("Gagal membuat folder cmd: {}", e))?;


    // =========================================================
    // WRITE CMD FILE
    // =========================================================

    let cmd_path = format!(
        "{}\\Autostart_{}.cmd",
        cmd_dir,
        last_folder
    );

    std::fs::write(&cmd_path, bat_content)
        .map_err(|e| format!("Gagal membuat file CMD: {}", e))?;


    // =========================================================
    // TASK SCHEDULER
    // =========================================================

    let task_name = format!("Autostart_{}", last_folder);

    let username = std::env::var("USERNAME")
        .map_err(|_| "Gagal mendapatkan username saat ini".to_string())?;

    let output = std::process::Command::new("schtasks")
        .args([
            "/Create",
            "/F",
            "/TN",
            &task_name,
            "/TR",
            &cmd_path,
            "/SC",
            "ONSTART",
            "/RL",
            "HIGHEST",
            "/RU",
            &username,
            "/RP",
            &password,
        ])
        .output()
        .map_err(|e| format!("Gagal menjalankan schtasks: {}", e))?;


    // =========================================================
    // CHECK RESULT
    // =========================================================

    if !output.status.success() {

        let stderr = String::from_utf8_lossy(&output.stderr).to_string();

        return Err(format!(
            "Gagal mendaftarkan ke Task Scheduler: {}",
            stderr
        ));
    }


    Ok(format!(
        "Berhasil! Script: {} | Task: {} | Akan jalan otomatis saat Windows startup",
        cmd_path,
        task_name
    ))
}


#[tauri::command]
fn create_autorun_commander() -> Result<String, String> {

    // =========================================================
    // GET CURRENT EXE PATH
    // =========================================================

    let exe_path = std::env::current_exe()
        .map_err(|e| format!("Gagal mendapatkan path executable: {}", e))?;

    let exe_path_str = exe_path.to_string_lossy().to_string();


    // =========================================================
    // CURRENT USER (DOMAIN\USER)
    // =========================================================

    let username = std::env::var("USERNAME")
        .map_err(|_| "Gagal mendapatkan username saat ini".to_string())?;

    let user_domain = std::env::var("USERDOMAIN")
        .or_else(|_| std::env::var("COMPUTERNAME"))
        .unwrap_or_else(|_| ".".to_string());

    let user_id = format!("{}\\{}", user_domain, username);


    // =========================================================
    // TASK NAME
    // =========================================================

    let task_name = "Autostart_Integra_Commander";


    // =========================================================
    // TASK SCHEDULER XML
    // =========================================================

    let task_xml = format!(
r#"<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>Auto-run Integra Commander as Administrator on user logon with 5s delay</Description>
  </RegistrationInfo>
  <Triggers>
    <LogonTrigger>
      <Enabled>true</Enabled>
      <Delay>PT5S</Delay>
      <UserId>{user_id}</UserId>
    </LogonTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <UserId>{user_id}</UserId>
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>HighestAvailable</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>true</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>true</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>"{exe_path}"</Command>
    </Exec>
  </Actions>
</Task>"#,
        user_id = user_id,
        exe_path = exe_path_str,
    );


    // =========================================================
    // WRITE XML (UTF-16 LE + BOM) TO TEMP FILE
    // =========================================================

    let temp_dir = std::env::temp_dir();
    let xml_path = temp_dir.join("IntegraCommander_autorun_task.xml");

    let mut xml_bytes: Vec<u8> = vec![0xFF, 0xFE];
    for unit in task_xml.encode_utf16() {
        xml_bytes.extend_from_slice(&unit.to_le_bytes());
    }

    std::fs::write(&xml_path, &xml_bytes)
        .map_err(|e| format!("Gagal membuat file XML task: {}", e))?;


    // =========================================================
    // REGISTER TASK SCHEDULER
    // =========================================================

    let xml_path_str = xml_path.to_string_lossy().to_string();

    let output = std::process::Command::new("schtasks")
        .args([
            "/Create",
            "/F",
            "/TN",
            task_name,
            "/XML",
            &xml_path_str,
        ])
        .output()
        .map_err(|e| format!("Gagal menjalankan schtasks: {}", e))?;


    // =========================================================
    // CLEANUP TEMP XML
    // =========================================================

    let _ = std::fs::remove_file(&xml_path);


    // =========================================================
    // CHECK RESULT
    // =========================================================

    if !output.status.success() {

        let stderr = String::from_utf8_lossy(&output.stderr).to_string();

        return Err(format!(
            "Gagal mendaftarkan ke Task Scheduler: {}",
            stderr
        ));
    }


    Ok(format!(
        "Berhasil! Task: {} | Exe: {} | Trigger: ONLOGON (user: {}) + 5s delay | Run only when user is logged on (Admin)",
        task_name,
        exe_path_str,
        user_id
    ))
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
        .invoke_handler(tauri::generate_handler![shutdown, get_local_ip, is_admin, create_startup_script, create_autorun_commander])
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
