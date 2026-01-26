// Prevents additional console window on Windows in release
#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::sync::{Mutex, atomic::{AtomicBool, Ordering}};
use tauri::{Manager, RunEvent};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandChild;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

const BACKEND_PORT: u16 = 8765;

// Store the backend process so we can kill it on exit
struct BackendProcess {
    child: Mutex<Option<CommandChild>>,
    pid: Mutex<Option<u32>>,
    cleaned_up: AtomicBool,
}

/// Kill a process and its entire tree on Windows
#[cfg(target_os = "windows")]
fn kill_process_tree(pid: u32) {
    let output = std::process::Command::new("taskkill")
        .args(["/F", "/T", "/PID", &pid.to_string()])
        .creation_flags(0x08000000) // CREATE_NO_WINDOW
        .output();

    match output {
        Ok(o) if o.status.success() => {
            println!("[tauri] killed process tree (PID: {})", pid);
        }
        Ok(o) => {
            let stderr = String::from_utf8_lossy(&o.stderr);
            // Not an error if process already exited
            if !stderr.contains("not found") {
                eprintln!("[tauri] taskkill warning: {}", stderr.trim());
            }
        }
        Err(e) => {
            eprintln!("[tauri] failed to run taskkill: {}", e);
        }
    }
}

#[cfg(not(target_os = "windows"))]
fn kill_process_tree(pid: u32) {
    unsafe {
        libc::kill(-(pid as i32), libc::SIGKILL);
    }
}

/// Fallback: kill any process listening on the backend port
#[cfg(target_os = "windows")]
fn kill_by_port(port: u16) {
    // Find PIDs using the port via netstat
    let output = std::process::Command::new("cmd")
        .args(["/C", &format!("netstat -ano | findstr :{} | findstr LISTENING", port)])
        .creation_flags(0x08000000)
        .output();

    if let Ok(output) = output {
        let text = String::from_utf8_lossy(&output.stdout);
        for line in text.lines() {
            // netstat output: TCP  0.0.0.0:8765  0.0.0.0:0  LISTENING  <PID>
            if let Some(pid_str) = line.split_whitespace().last() {
                if let Ok(pid) = pid_str.parse::<u32>() {
                    println!("[tauri] killing orphaned process on port {} (PID: {})", port, pid);
                    kill_process_tree(pid);
                }
            }
        }
    }
}

#[cfg(not(target_os = "windows"))]
fn kill_by_port(port: u16) {
    let output = std::process::Command::new("sh")
        .args(["-c", &format!("lsof -ti:{}", port)])
        .output();

    if let Ok(output) = output {
        let text = String::from_utf8_lossy(&output.stdout);
        for pid_str in text.lines() {
            if let Ok(pid) = pid_str.trim().parse::<u32>() {
                println!("[tauri] killing orphaned process on port {} (PID: {})", port, pid);
                kill_process_tree(pid);
            }
        }
    }
}

/// Cleanup the backend process — guarded against double invocation
fn cleanup_backend(state: &BackendProcess) {
    if state.cleaned_up.swap(true, Ordering::SeqCst) {
        return;
    }

    println!("[tauri] shutting down backend...");

    // Step 1: Kill process tree FIRST while the tree structure is still intact.
    //         This must happen before child.kill() which would orphan child processes.
    if let Some(pid) = state.pid.lock().unwrap().take() {
        kill_process_tree(pid);
    }

    // Step 2: Drop the child handle (process is already dead, just release the resource)
    let _ = state.child.lock().unwrap().take();

    // Step 3: Fallback — kill anything still listening on the backend port.
    //         Handles edge cases where the process tree kill missed orphaned children.
    kill_by_port(BACKEND_PORT);

    println!("[tauri] backend shutdown complete");
}

/// Parse Python log level from a log line.
/// Python logging format: "HH:MM:SS | LEVEL    | module - message"
fn parse_log_level(line: &str) -> &str {
    // Check for standard Python logging levels in the message
    if line.contains("| ERROR") || line.contains("| CRITICAL") {
        "ERROR"
    } else if line.contains("| WARNING") || line.contains("| WARN") {
        "WARN"
    } else if line.contains("| DEBUG") {
        "DEBUG"
    } else {
        "INFO"
    }
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// Get the backend API URL
#[tauri::command]
fn get_backend_url() -> String {
    format!("http://127.0.0.1:{}", BACKEND_PORT)
}

/// Check if the backend is running
#[tauri::command]
fn is_backend_running(state: tauri::State<BackendProcess>) -> bool {
    state.child.lock().unwrap().is_some()
}

fn main() {
    let app = tauri::Builder::default()
        .manage(BackendProcess {
            child: Mutex::new(None),
            pid: Mutex::new(None),
            cleaned_up: AtomicBool::new(false),
        })
        .invoke_handler(tauri::generate_handler![greet, get_backend_url, is_backend_running])
        .plugin(tauri_plugin_app::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let shell = app.shell();

            match shell.sidecar("fault-backend") {
                Ok(command) => {
                    match command.spawn() {
                        Ok((mut rx, child)) => {
                            let pid = child.pid();

                            let state = app.state::<BackendProcess>();
                            *state.child.lock().unwrap() = Some(child);
                            *state.pid.lock().unwrap() = Some(pid);

                            println!("[tauri] backend started (PID: {})", pid);

                            // Forward backend output with parsed log levels
                            tauri::async_runtime::spawn(async move {
                                use tauri_plugin_shell::process::CommandEvent;
                                while let Some(event) = rx.recv().await {
                                    match event {
                                        CommandEvent::Stdout(line) => {
                                            let msg = String::from_utf8_lossy(&line);
                                            println!("[backend] {}", msg);
                                        }
                                        CommandEvent::Stderr(line) => {
                                            let msg = String::from_utf8_lossy(&line);
                                            let level = parse_log_level(&msg);
                                            match level {
                                                "ERROR" => eprintln!("[backend:error] {}", msg),
                                                "WARN" => eprintln!("[backend:warn]  {}", msg),
                                                "DEBUG" => println!("[backend:debug] {}", msg),
                                                _ => println!("[backend] {}", msg),
                                            }
                                        }
                                        CommandEvent::Terminated(payload) => {
                                            println!(
                                                "[backend] process exited (code: {})",
                                                payload.code.map_or("unknown".to_string(), |c| c.to_string())
                                            );
                                            break;
                                        }
                                        _ => {}
                                    }
                                }
                            });
                        }
                        Err(e) => {
                            eprintln!("[tauri] failed to spawn backend: {}", e);
                        }
                    }
                }
                Err(e) => {
                    eprintln!("[tauri] backend sidecar not found: {}", e);
                }
            }

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        match event {
            RunEvent::ExitRequested { .. } | RunEvent::Exit => {
                let state = app_handle.state::<BackendProcess>();
                cleanup_backend(state.inner());
            }
            _ => {}
        }
    });
}
