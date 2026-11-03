//! 回放下载：流式写盘 + 断点续传 + 备用域名自动切换。
//!
//! 为什么放在 Rust：单场回放可达十几 GB（实测 5.5 小时 @1080P60 ≈ 13.9GB），
//! 前端 fetch 会把整个响应体拿进内存；这里用 reqwest 的 chunk 流式写盘，内存占用恒定。
//!
//! reqwest 直接复用 tauri-plugin-http 的 re-export，无需新增依赖。

use std::collections::HashMap;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_http::reqwest;
use tokio::io::AsyncWriteExt;

const UA: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0";

/// 任务取消标记表：task_id → 标记
#[derive(Default)]
pub struct CancelRegistry(pub Arc<Mutex<HashMap<String, Arc<AtomicBool>>>>);

#[derive(Clone, serde::Serialize)]
pub struct DownloadProgress {
    pub task_id: String,
    pub downloaded: u64,
    pub total: u64,
    /// 瞬时速度（字节/秒）
    pub speed: u64,
    pub done: bool,
    pub canceled: bool,
    pub error: Option<String>,
}

fn emit_progress(
    app: &AppHandle,
    task_id: &str,
    downloaded: u64,
    total: u64,
    speed: u64,
    done: bool,
    canceled: bool,
    error: Option<String>,
) {
    let _ = app.emit(
        "replay-download",
        DownloadProgress {
            task_id: task_id.to_string(),
            downloaded,
            total,
            speed,
            done,
            canceled,
            error,
        },
    );
}

/// 单个地址的下载尝试（带续传）。返回最终已写入的字节数。
async fn try_download(
    app: &AppHandle,
    task_id: &str,
    url: &str,
    dest: &str,
    referer: Option<&str>,
    resume_from: u64,
    flag: &Arc<AtomicBool>,
) -> Result<u64, String> {
    let client = reqwest::Client::builder()
        .user_agent(UA)
        .timeout(Duration::from_secs(60 * 30))
        .build()
        .map_err(|e| e.to_string())?;

    let mut req = client.get(url);
    if let Some(r) = referer {
        req = req.header("Referer", r);
    }
    // 断点续传：告诉服务端从哪继续
    if resume_from > 0 {
        req = req.header("Range", format!("bytes={}-", resume_from));
    }

    let mut resp = req.send().await.map_err(|e| e.to_string())?;
    let status = resp.status();
    if status.as_u16() == 403 || status.as_u16() == 401 {
        // 直链签名过期：上层会重新取地址后再续传，这里直接放弃当前地址
        return Err(format!("地址已失效（HTTP {}）", status.as_u16()));
    }
    if !status.is_success() {
        return Err(format!("HTTP {}", status.as_u16()));
    }

    // 206 = 服务端接受了续传；200 = 从头开始（需要清掉已有内容）
    let partial = status.as_u16() == 206;
    let content_len = resp.content_length().unwrap_or(0);
    let mut downloaded = if partial { resume_from } else { 0 };
    let total = if partial { resume_from + content_len } else { content_len };

    let mut file = if partial && resume_from > 0 {
        tokio::fs::OpenOptions::new().append(true).open(dest).await.map_err(|e| e.to_string())?
    } else {
        tokio::fs::File::create(dest).await.map_err(|e| e.to_string())?
    };

    let mut last_emit = Instant::now();
    let mut window_start = Instant::now();
    let mut window_bytes: u64 = 0;
    emit_progress(app, task_id, downloaded, total, 0, false, false, None);

    while let Some(chunk) = resp.chunk().await.map_err(|e| e.to_string())? {
        if flag.load(Ordering::Relaxed) {
            file.flush().await.ok();
            emit_progress(app, task_id, downloaded, total, 0, false, true, None);
            return Err("已取消".to_string());
        }
        file.write_all(&chunk).await.map_err(|e| e.to_string())?;
        let n = chunk.len() as u64;
        downloaded += n;
        window_bytes += n;
        if last_emit.elapsed() >= Duration::from_millis(400) {
            let secs = window_start.elapsed().as_secs_f64().max(0.001);
            let speed = (window_bytes as f64 / secs) as u64;
            emit_progress(app, task_id, downloaded, total, speed, false, false, None);
            last_emit = Instant::now();
            window_start = Instant::now();
            window_bytes = 0;
        }
    }
    file.flush().await.map_err(|e| e.to_string())?;
    drop(file);
    // 校验：拿到 total 时必须一致，否则算失败（避免半截文件被当成成功）
    if total > 0 && downloaded != total {
        return Err(format!("大小不符：{}/{} 字节", downloaded, total));
    }
    emit_progress(app, task_id, downloaded, total, 0, true, false, None);
    Ok(downloaded)
}

/// 下载一个流到目标路径。urls = [主地址, 备用地址…]，前一个失败自动换下一个。
#[tauri::command]
pub async fn replay_download(
    app: AppHandle,
    registry: State<'_, CancelRegistry>,
    task_id: String,
    urls: Vec<String>,
    dest: String,
    referer: Option<String>,
) -> Result<u64, String> {
    let flag = Arc::new(AtomicBool::new(false));
    {
        let mut map = registry.0.lock().map_err(|e| e.to_string())?;
        map.insert(task_id.clone(), flag.clone());
    }
    let start = std::fs::metadata(&dest).map(|m| m.len()).unwrap_or(0);
    if let Some(parent) = Path::new(&dest).parent() {
        tokio::fs::create_dir_all(parent).await.map_err(|e| e.to_string())?;
    }

    let mut last_err = "没有可用的下载地址".to_string();
    for url in urls.iter() {
        if flag.load(Ordering::Relaxed) {
            emit_progress(&app, &task_id, start, 0, 0, false, true, None);
            registry.0.lock().ok().map(|mut m| m.remove(&task_id));
            return Err("已取消".to_string());
        }
        match try_download(&app, &task_id, url, &dest, referer.as_deref(), start, &flag).await {
            Ok(n) => {
                registry.0.lock().ok().map(|mut m| m.remove(&task_id));
                return Ok(n);
            }
            Err(e) => {
                if e.contains("已取消") {
                    registry.0.lock().ok().map(|mut m| m.remove(&task_id));
                    return Err(e);
                }
                last_err = e;
            }
        }
    }
    registry.0.lock().ok().map(|mut m| m.remove(&task_id));
    emit_progress(&app, &task_id, 0, 0, 0, false, false, Some(last_err.clone()));
    Err(last_err)
}

/// 取消下载（标记后由下载循环自行退出）
#[tauri::command]
pub fn replay_download_cancel(
    registry: State<'_, CancelRegistry>,
    task_id: String,
) -> Result<bool, String> {
    let map = registry.0.lock().map_err(|e| e.to_string())?;
    match map.get(&task_id) {
        Some(flag) => {
            flag.store(true, Ordering::Relaxed);
            Ok(true)
        }
        None => Ok(false),
    }
}

/// 本机是否有 ffmpeg（DASH 双流需要它合并）
#[tauri::command]
pub fn replay_ffmpeg_available() -> bool {
    std::process::Command::new("ffmpeg")
        .arg("-version")
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

/// 用 ffmpeg 合并视频+音频为 mp4（-c copy，不重新编码，速度快）
#[tauri::command]
pub async fn replay_merge(
    video: String,
    audio: String,
    out: String,
) -> Result<String, String> {
    if let Some(parent) = Path::new(&out).parent() {
        tokio::fs::create_dir_all(parent).await.map_err(|e| e.to_string())?;
    }
    let status = tokio::process::Command::new("ffmpeg")
        .args([
            "-y",
            "-i",
            &video,
            "-i",
            &audio,
            "-c",
            "copy",
            "-map",
            "0:v:0",
            "-map",
            "1:a:0",
            &out,
        ])
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .await
        .map_err(|e| format!("无法启动 ffmpeg：{}", e))?;
    if !status.success() {
        return Err(format!("ffmpeg 退出码 {:?}", status.code()));
    }
    Ok(out)
}

/// 合并成功后删除中间流文件（单个可达数 GB，不删会白占磁盘）
#[tauri::command]
pub fn replay_cleanup(paths: Vec<String>) -> Result<u32, String> {
    let mut removed = 0u32;
    for p in paths {
        if std::fs::remove_file(&p).is_ok() {
            removed += 1;
        }
    }
    Ok(removed)
}
