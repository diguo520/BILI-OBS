/** 音色头像加载器
 *
 * OBH 的图标挂在阿里云 OSS 上并启用了防盗链（要求 Referer: https://obh.live/），
 * 直接用 <img src> 会被 403。这里通过 tauri 的 http 插件带上 Referer 抓取，
 * 转成 blob URL 后缓存，避免重复下载。
 */
import { fetch } from "@tauri-apps/plugin-http";

const REFERER = "https://obh.live/";
const cache = new Map<string, string>();
const pending = new Map<string, Promise<string | null>>();

async function fetchIcon(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { Referer: REFERER } });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.size) return null;
    const objectUrl = URL.createObjectURL(blob);
    cache.set(url, objectUrl);
    return objectUrl;
  } catch {
    // 网络不可用或权限未放开时静默降级为首字色块
    return null;
  }
}

/** 取音色头像的 object URL；失败返回 null（调用方用文字兜底） */
export function loadVoiceIcon(url: string): Promise<string | null> {
  if (!url) return Promise.resolve(null);
  const hit = cache.get(url);
  if (hit) return Promise.resolve(hit);
  const inflight = pending.get(url);
  if (inflight) return inflight;
  const task = fetchIcon(url).finally(() => pending.delete(url));
  pending.set(url, task);
  return task;
}
