//! 弹幕播报 —— 语音合成（阿里云百炼 CosyVoice 流式 WebSocket 协议）
//!
//! 只负责「文本 -> PCM」。音频播放交给前端的 WebAudio，
//! 这样输出天然走系统默认设备，OBS 用「桌面音频」即可采集。

use base64::Engine;
use futures::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::tungstenite::Message;

/// DashScope 北京地域默认流式端点
const DEFAULT_WS_URL: &str = "wss://dashscope.aliyuncs.com/api-ws/v1/inference";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TtsRequest {
    pub text: String,
    pub voice: String,
    pub model: String,
    pub api_key: String,
    pub volume: i32,
    pub speech_rate: f64,
    pub pitch_rate: f64,
    pub sample_rate: i32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TtsAudio {
    /// base64 编码的 PCM 原始字节（16-bit 小端、单声道）
    pub pcm_base64: String,
    pub sample_rate: i32,
    /// true 表示未配置 API Key，返回的是本地合成音（用于联调）
    pub mock: bool,
}

fn now_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

fn task_id() -> String {
    format!("tts-{}", now_ms())
}

/// 未配置 Key 时返回一段可辨识的提示音，保证整条链路可联调
fn mock_pcm(text_len: usize, sample_rate: i32) -> Vec<u8> {
    let sr = sample_rate.max(8000) as f64;
    let secs = (0.12 * (text_len.max(1) as f64) / 3.0).clamp(0.18, 1.6);
    let total = (sr * secs) as usize;
    let mut out = Vec::with_capacity(total * 2);
    for i in 0..total {
        let t = i as f64 / sr;
        // 两段不同音高，听起来像“滴滴”提示音
        let freq = if (t * 4.0) as i32 % 2 == 0 { 660.0 } else { 880.0 };
        let env = 1.0 - (i as f64 / total as f64);
        let v = (f64::sin(2.0 * std::f64::consts::PI * freq * t) * env * 0.28 * 32767.0) as i16;
        out.extend_from_slice(&v.to_le_bytes());
    }
    out
}

/// 调用百炼流式合成，返回完整 PCM
async fn synthesize_ws(req: &TtsRequest) -> Result<Vec<u8>, String> {
    let url = std::env::var("REA_TTS_WS_URL").unwrap_or_else(|_| DEFAULT_WS_URL.to_string());
    let mut request = url
        .into_client_request()
        .map_err(|e| format!("构造请求失败: {e}"))?;
    request.headers_mut().insert(
        "Authorization",
        format!("bearer {}", req.api_key)
            .parse()
            .map_err(|_| "API Key 含非法字符".to_string())?,
    );
    request
        .headers_mut()
        .insert("X-DashScope-DataInspection", "enable".parse().unwrap());

    let (mut ws, _resp) = tokio_tungstenite::connect_async(request)
        .await
        .map_err(|e| format!("WebSocket 连接失败: {e}"))?;

    let tid = task_id();
    let run_task = json!({
        "header": { "action": "run-task", "task_id": tid, "streaming": "duplex" },
        "payload": {
            "task_group": "audio",
            "task": "tts",
            "function": "SpeechSynthesizer",
            "model": req.model,
            "parameters": {
                "text_type": "PlainText",
                "voice": req.voice,
                "format": "pcm",
                "sample_rate": req.sample_rate,
                "volume": req.volume.clamp(0, 100),
                "rate": req.speech_rate.clamp(0.5, 2.0),
                "pitch": req.pitch_rate.clamp(0.5, 2.0)
            },
            "input": {}
        }
    });
    ws.send(Message::Text(run_task.to_string().into()))
        .await
        .map_err(|e| format!("发送 run-task 失败: {e}"))?;

    let mut pcm: Vec<u8> = Vec::new();
    let engine = base64::engine::general_purpose::STANDARD;
    let mut started = false;
    let mut sent_text = false;

    while let Some(msg) = ws.next().await {
        let msg = msg.map_err(|e| format!("接收失败: {e}"))?;
        let text = match msg {
            Message::Text(t) => t.to_string(),
            Message::Close(_) => break,
            _ => continue,
        };
        let v: serde_json::Value = match serde_json::from_str(&text) {
            Ok(v) => v,
            Err(_) => continue,
        };
        let event = v["header"]["event"].as_str().unwrap_or("");
        match event {
            "task-started" => {
                started = true;
                let cont = json!({
                    "header": { "action": "continue-task", "task_id": tid, "streaming": "duplex" },
                    "payload": { "input": { "text": req.text } }
                });
                ws.send(Message::Text(cont.to_string().into()))
                    .await
                    .map_err(|e| format!("发送 continue-task 失败: {e}"))?;
                sent_text = true;
                let fin = json!({
                    "header": { "action": "finish-task", "task_id": tid, "streaming": "duplex" },
                    "payload": { "input": {} }
                });
                ws.send(Message::Text(fin.to_string().into()))
                    .await
                    .map_err(|e| format!("发送 finish-task 失败: {e}"))?;
            }
            "result-generated" => {
                if let Some(b64) = v["payload"]["output"]["audio"]["data"].as_str() {
                    if let Ok(bytes) = engine.decode(b64) {
                        pcm.extend_from_slice(&bytes);
                    }
                }
            }
            "task-finished" => break,
            "task-failed" => {
                let msg = v["header"]["error_message"]
                    .as_str()
                    .unwrap_or("未知错误")
                    .to_string();
                let code = v["header"]["error_code"].as_str().unwrap_or("");
                return Err(format!("合成失败 [{code}]: {msg}"));
            }
            _ => {}
        }
    }

    if !started {
        return Err("服务未返回 task-started（检查 API Key、模型与音色是否匹配）".to_string());
    }
    if !sent_text {
        return Err("文本未发送成功".to_string());
    }
    if pcm.is_empty() {
        return Err("未收到音频数据".to_string());
    }
    Ok(pcm)
}

/// 合成一段文本，返回 PCM（base64）。未配置 Key 时返回本地提示音。
#[tauri::command]
pub async fn tts_synthesize(req: TtsRequest) -> Result<TtsAudio, String> {
    if req.text.trim().is_empty() {
        return Err("文本为空".to_string());
    }
    let sample_rate = if req.sample_rate > 0 { req.sample_rate } else { 16000 };
    if req.api_key.trim().is_empty() {
        let pcm = mock_pcm(req.text.chars().count(), sample_rate);
        return Ok(TtsAudio {
            pcm_base64: base64::engine::general_purpose::STANDARD.encode(&pcm),
            sample_rate,
            mock: true,
        });
    }
    let pcm = synthesize_ws(&req).await?;
    Ok(TtsAudio {
        pcm_base64: base64::engine::general_purpose::STANDARD.encode(&pcm),
        sample_rate,
        mock: false,
    })
}
