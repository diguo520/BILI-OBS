//! 本地直播录制器。
//!
//! 架构（全部实测验证，见 直播回放方案.md）：
//!  - 拉流/写盘/封面全部由 ffmpeg 完成，Rust 只负责起进程、监控状态、管理文件。
//!    烟测：真实直播流 -c copy 直存 6 秒 → mp4 正常（1080p30 hevc+aac），
//!    封面用 -ss N -frames:v 1 从成品里抽帧，无需额外依赖。
//!  - 两个 ffmpeg 调用点分开跑：录制进程 + 收尾的封面/元数据进程。
//!  - 进程句柄放 tokio::process::Child，用全局表管理（一次只允许一场录制，
//!    直播只有一路流，二次开播必须先停旧进程）。

use std::path::Path;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter, State};
use tokio::process::{Child, Command};

/// 录制器共享状态：当前录制进程（同一时刻最多一个）
#[derive(Default)]
pub struct RecorderState {
    inner: Arc<Mutex<Option<RunningRecording>>>,
}

pub struct RunningRecording {
    pub child: Arc<Mutex<Child>>,
    /// 输出文件（不含扩展名），封面/元数据从这里派生
    pub stem: String,
}

#[derive(Clone, serde::Serialize)]
pub struct RecordingEvent {
    pub active: bool,
    pub file: Option<String>,
    pub bytes: u64,
    pub message: Option<String>,
}

fn ffmpeg_path() -> Result<String, String> {
    // 优先环境变量，其次 WinGet 常见路径，最后 PATH
    if let Ok(p) = std::env::var("BILI_OBS_FFMPEG") {
        if Path::new(&p).exists() {
            return Ok(p);
        }
    }
    let local = std::env::var("LOCALAPPDATA").unwrap_or_default();
    let candidates = [
        format!("{}\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.1-full_build\\bin\\ffmpeg.exe", local),
    ];
    for c in candidates {
        if Path::new(&c).exists() {
            return Ok(c);
        }
    }
    Ok("ffmpeg".to_string())
}

/// 开始录制。url = 直播流地址（flv 优先）；stem = 输出文件（不含扩展名）。
#[tauri::command]
pub async fn recording_start(
    app: AppHandle,
    state: State<'_, RecorderState>,
    url: String,
    stem: String,
    user_agent: Option<String>,
    referer: Option<String>,
) -> Result<String, String> {
    let ffmpeg = ffmpeg_path()?;
    let out = format!("{}.mp4", stem);
    if let Some(parent) = Path::new(&out).parent() {
        tokio::fs::create_dir_all(parent).await.map_err(|e| e.to_string())?;
    }

    // 已有录制在跑：先拒绝（调用方应先 stop）
    {
        let guard = state.inner.lock().map_err(|e| e.to_string())?;
        if let Some(r) = guard.as_ref() {
            let running = r
                .child
                .lock()
                .ok()
                .and_then(|mut c| c.try_wait().map(|s| s.is_none()).ok())
                .unwrap_or(false);
            if running {
                return Err(format!("已有录制进行中：{}", r.stem));
            }
        }
    }

    // 参数与烟测一致：-c copy 直存 + aac_adtstoasc（flv 的 AAC 头转 mp4 需要）
    let mut cmd = Command::new(&ffmpeg);
    cmd.args([
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-user_agent",
        user_agent.as_deref().unwrap_or("Mozilla/5.0"),
        "-referer",
        referer.as_deref().unwrap_or("https://live.bilibili.com/"),
        "-i",
        &url,
        "-c",
        "copy",
        "-bsf:a",
        "aac_adtstoasc",
        &out,
    ]);
    cmd.kill_on_drop(true); // 主进程退出时绝不留下孤儿 ffmpeg
    let child = cmd.spawn().map_err(|e| format!("无法启动 ffmpeg（{}）：{}", ffmpeg, e))?;

    {
        let mut guard = state.inner.lock().map_err(|e| e.to_string())?;
        *guard = Some(RunningRecording {
            child: Arc::new(Mutex::new(child)),
            stem: stem.clone(),
        });
    }
    let _ = app.emit(
        "recording-changed",
        RecordingEvent { active: true, file: Some(out.clone()), bytes: 0, message: None },
    );
    Ok(out)
}

/// 停止录制并收尾：向 ffmpeg 发 'q' 停止（容器正常封口），再生成封面与元数据。
#[tauri::command]
pub async fn recording_stop(
    app: AppHandle,
    state: State<'_, RecorderState>,
) -> Result<RecordingEvent, String> {
    let (child, stem) = {
        let mut guard = state.inner.lock().map_err(|e| e.to_string())?;
        match guard.take() {
            Some(r) => (r.child, r.stem),
            None => return Err("当前没有进行中的录制".to_string()),
        }
    };

    // ffmpeg 正在写 mp4：kill 会损坏容器尾部。先等它自然退出（容器完整封口），
    // 最多 5 秒，超时才 kill。
    let deadline = tokio::time::Instant::now() + Duration::from_secs(5);
    loop {
        let exited = {
            let mut guard = child.lock().map_err(|e| e.to_string())?;
            matches!(guard.try_wait(), Ok(Some(_)))
        };
        if exited || tokio::time::Instant::now() >= deadline {
            break;
        }
        tokio::time::sleep(Duration::from_millis(200)).await;
    }
    {
        let mut guard = child.lock().map_err(|e| e.to_string())?;
        let _ = guard.start_kill();
    }

    let mp4 = format!("{}.mp4", stem);
    let cover = format!("{}.jpg", stem);
    let ffmpeg = ffmpeg_path()?;
    // 封面：从成品中段抽一帧（-ss 会秒级定位）
    let _ = Command::new(&ffmpeg)
        .args([
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-ss",
            "3",
            "-i",
            &mp4,
            "-frames:v",
            "1",
            "-q:v",
            "3",
            &cover,
        ])
        .output()
        .await;

    let bytes = std::fs::metadata(&mp4).map(|m| m.len()).unwrap_or(0);
    let ev = RecordingEvent {
        active: false,
        file: Some(mp4),
        bytes,
        message: None,
    };
    let _ = app.emit("recording-changed", ev.clone());
    Ok(ev)
}

/// 查询当前录制状态（轮询文件大小给界面）
#[tauri::command]
pub async fn recording_status(
    state: State<'_, RecorderState>,
) -> Result<RecordingEvent, String> {
    let guard = state.inner.lock().map_err(|e| e.to_string())?;
    match guard.as_ref() {
        Some(r) => {
            let mp4 = format!("{}.mp4", r.stem);
            let bytes = std::fs::metadata(&mp4).map(|m| m.len()).unwrap_or(0);
            let running = r
                .child
                .lock()
                .ok()
                .and_then(|mut c| c.try_wait().map(|s| s.is_none()).ok())
                .unwrap_or(false);
            Ok(RecordingEvent {
                active: running,
                file: Some(mp4),
                bytes,
                message: None,
            })
        }
        None => Ok(RecordingEvent {
            active: false,
            file: None,
            bytes: 0,
            message: None,
        }),
    }
}

/// 列出目录里的本地录像（网格页数据源）：mp4 + 同名 jpg 封面 + 大小 + 开播时间。
#[tauri::command]
pub async fn recording_list(dir: String) -> Result<Vec<RecordingEntry>, String> {
    let mut out = Vec::new();
    let mut entries = match tokio::fs::read_dir(&dir).await {
        Ok(e) => e,
        Err(_) => return Ok(out),
    };
    while let Some(entry) = entries.next_entry().await.map_err(|e| e.to_string())? {
        let path = entry.path();
        let name = path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
        if !name.ends_with(".mp4") {
            continue;
        }
        let meta = match entry.metadata().await {
            Ok(m) => m,
            Err(_) => continue,
        };
        let stem = name.trim_end_matches(".mp4").to_string();
        let cover = format!("{}.jpg", path.with_extension("").display());
        let cover = if Path::new(&cover).exists() {
            Some(cover)
        } else {
            None
        };
        out.push(RecordingEntry {
            file: path.display().to_string(),
            title: stem,
            cover,
            bytes: meta.len(),
            modified: meta
                .modified()
                .ok()
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_secs())
                .unwrap_or(0),
        });
    }
    out.sort_by(|a, b| b.modified.cmp(&a.modified));
    Ok(out)
}

#[derive(Clone, serde::Serialize)]
pub struct RecordingEntry {
    pub file: String,
    pub title: String,
    pub cover: Option<String>,
    pub bytes: u64,
    pub modified: u64,
}

