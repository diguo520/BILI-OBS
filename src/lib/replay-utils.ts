/** 回放相关的纯函数工具（无副作用，便于单测） */

/**
 * 解析 B 站时长字符串。实测样例："334:00"（分:秒）、"01:15"、"1:02:03"（时:分:秒）。
 * 注意不是固定两段 —— 超过 1 小时会变三段。
 */
export function parseReplayLength(length: string): number {
  const parts = String(length ?? "")
    .split(":")
    .map((x) => Number(x.trim()))
    .filter((x) => Number.isFinite(x));
  if (!parts.length) return 0;
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[parts.length - 3] * 3600 + parts[parts.length - 2] * 60 + parts[parts.length - 1];
}

/** 秒 → HH:MM:SS（超过 24 小时也正确） */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((x) => String(x).padStart(2, "0")).join(":");
}

/**
 * 按带宽与时长估算体积（带宽单位 kbps，返回字节）。
 * 实测 1080P60 = 5837kbps，5.5 小时 ≈ 13.9GB —— 下载前必须让用户看到这个数字。
 */
export function estimateBytes(bandwidthKbps: number, seconds: number): number {
  if (!bandwidthKbps || !seconds) return 0;
  return Math.round(((bandwidthKbps * 1000) / 8) * seconds);
}

export function formatBytes(bytes: number): string {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return v.toFixed(v >= 100 || i === 0 ? 0 : 1) + " " + units[i];
}

/** 文件名清洗：去掉 Windows 非法字符并截断，避免下载失败 */
export function sanitizeFileName(name: string, max = 80): string {
  const cleaned = String(name ?? "")
    .replace(/[\\/:*?"<>|\r\n\t]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  const safe = cleaned || "replay";
  return safe.length > max ? safe.slice(0, max) : safe;
}

/** 时间戳（秒）→ YYYYMMDD-HHmm（文件名用） */
export function formatStamp(seconds: number): string {
  const d = new Date(seconds * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    d.getFullYear() +
    p(d.getMonth() + 1) +
    p(d.getDate()) +
    "-" +
    p(d.getHours()) +
    p(d.getMinutes())
  );
}

/** 清晰度 id → 展示名（取自实测 accept_description） */
export const QUALITY_NAMES: Record<number, string> = {
  116: "1080P60",
  112: "1080P+",
  80: "1080P",
  64: "720P",
  32: "480P",
  16: "360P",
};

export function qualityName(id: number): string {
  return QUALITY_NAMES[id] ?? String(id);
}
