mod commands;
mod connection;
mod tts;
mod utils;

use crate::commands::{comment_connect, comment_disconnect, comment_is_connected};
use crate::tts::tts_synthesize;
use std::sync::Arc;
use std::path::PathBuf;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, PhysicalPosition, RunEvent, WindowEvent,
};
use tokio::sync::Mutex;

pub struct ConnectionState {
    handle: Option<tokio::task::JoinHandle<()>>,
}

pub type AppState = Arc<Mutex<ConnectionState>>;

fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn portable_data_dir() -> PathBuf {
    let base = std::env::current_exe()
        .ok()
        .and_then(|path| path.parent().map(|parent| parent.to_path_buf()))
        .or_else(|| std::env::current_dir().ok())
        .unwrap_or_default();
    base.join("_User Data")
}

fn ensure_portable_data_dir() -> PathBuf {
    let dir = portable_data_dir();
    let _ = std::fs::create_dir_all(dir.join("WebView2"));
    dir
}

#[tauri::command]
fn get_data_dir(_app: AppHandle) -> Result<String, String> {
    Ok(ensure_portable_data_dir().display().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Keep both app config and WebView2 cache next to the executable.
    let data_dir = ensure_portable_data_dir();
    std::env::set_var(
        "WEBVIEW2_USER_DATA_FOLDER",
        data_dir.join("WebView2"),
    );

    let app = tauri::Builder::default()
        .manage(AppState::new(Mutex::new(ConnectionState { handle: None })))
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            if let Some(window) = app.get_webview_window("comments") {
                if let Some(monitor) = window.primary_monitor()? {
                    let monitor_position = monitor.position();
                    let monitor_size = monitor.size();
                    let window_size = window.outer_size()?;
                    let margin = 20_i32;
                    let available_width =
                        monitor_size.width.saturating_sub(window_size.width) as i32;
                    let x = monitor_position.x + (available_width - margin).max(0);
                    let y = monitor_position.y + margin;
                    window.set_position(PhysicalPosition::new(x, y))?;
                }
            }

            let show_item =
                MenuItem::with_id(app, "show", "显示 BILI OBS", true, None::<&str>)?;
            // 鼠标穿透的逃生出口：穿透后悬浮窗点不到，用托盘菜单关回来
            let passthrough_item = MenuItem::with_id(
                app,
                "comments-interactive",
                "关闭弹幕窗鼠标穿透",
                true,
                None::<&str>,
            )?;
            let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &passthrough_item, &quit_item])?;

            let mut tray_builder = TrayIconBuilder::with_id("bili-obs-tray")
                .menu(&menu)
                .tooltip("BILI OBS")
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => show_main_window(app),
                    "comments-interactive" => {
                        if let Some(window) = app.get_webview_window("comments") {
                            let _ = window.set_ignore_cursor_events(false);
                            // 通知前端同步开关状态
                            let _ = window.emit("comments-passthrough", false);
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main_window(tray.app_handle());
                    }
                });

            if let Some(icon) = app.default_window_icon() {
                tray_builder = tray_builder.icon(icon.clone());
            }
            app.manage(tray_builder.build(app)?);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            comment_connect,
            comment_disconnect,
            comment_is_connected,
            tts_synthesize,
            get_data_dir
        ])
        .build(tauri::generate_context!())
        .expect("error while running tauri application");

    app.run(move |_app_handle, _event| match &_event {
        RunEvent::WindowEvent {
            label,
            event: WindowEvent::CloseRequested { api, .. },
            ..
        } if label == "main" => {
            // 关闭主窗口时留在托盘，避免误关导致直播中断。
            api.prevent_close();
            if let Some(window) = _app_handle.get_webview_window("main") {
                let _ = window.hide();
            }
        }
        RunEvent::ExitRequested { .. } => {
            let app_state = _app_handle.state::<AppState>();
            tauri::async_runtime::block_on(async {
                let mut conn_state = app_state.lock().await;
                if let Some(handle) = conn_state.handle.take() {
                    handle.abort();
                    println!("Connection task aborted");
                }
            });
        }
        _ => (),
    });
}
