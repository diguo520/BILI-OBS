/** 弹幕播报 —— 规则引擎 + 播报队列 + 消息桥接 */
import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { useConfigStore } from "@/store/config";
import { useWsStore } from "@/store/ws";
import { pcmPlayer } from "@/lib/audio";
import type { Comment } from "@/types/comment";
import {
  DEFAULT_TTS_CONFIG,
  TTS_MODEL,
  type TtsAudio,
  type TtsConfig,
  type TtsDecision,
  type TtsQueueItem,
} from "@/types/tts";

/** 去掉弹幕里的 [表情] 片段（不依赖正则，避免转义问题） */
export function stripEmotes(input: string): string {
  let out = "";
  let depth = 0;
  for (const ch of input) {
    if (ch === "[") {
      depth += 1;
      continue;
    }
    if (ch === "]") {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (depth === 0) out += ch;
  }
  return out.split(/\s+/).filter(Boolean).join(" ");
}

function hitBlockWord(text: string, words: string[]): string | null {
  const lower = text.toLowerCase();
  for (const w of words) {
    const kw = w.trim().toLowerCase();
    if (kw && lower.includes(kw)) return w.trim();
  }
  return null;
}

/** 组装礼物播报文本（礼物合并时复用） */
export function giftText(
  name: string,
  count: number,
  giftName: string,
  readName: boolean,
): string {
  const who = readName ? name + "送出 " : "送出 ";
  return who + count + " 个 " + (giftName || "礼物");
}

/** 构造朗读文本；返回空串表示无可读内容 */
export function buildText(c: Comment, cfg: TtsConfig): string {
  const r = cfg.rules;
  const name = c.username || "观众";
  if (c.type === "chat") {
    const raw = c.message ?? "";
    const body = (r.ignoreEmoji ? stripEmotes(raw) : raw).trim();
    if (!body) return "";
    return r.readName ? name + "说 " + body : body;
  }
  if (c.type === "gift") {
    return giftText(name, c.giftCount ?? 1, c.giftName ?? "", r.readName);
  }
  if (c.type === "superchat") {
    const body = stripEmotes(c.message ?? "").trim();
    return name + "的付费留言：" + (body || "感谢支持");
  }
  if (c.type === "guard") {
    return name + " " + (c.message || "上舰");
  }
  if (c.type === "enter") return name + "进入直播间";
  return c.message ?? "";
}

/** 规则判定：是否播报、播报什么、不播报的原因 */
export function decide(c: Comment, cfg: TtsConfig): TtsDecision {
  const r = cfg.rules;
  if (!cfg.enabled) return { speak: false, reason: "总开关未开启" };
  if (c.type === "chat" && !r.chat) return { speak: false, reason: "弹幕播报已关闭" };
  if (c.type === "superchat" && !r.superchat) return { speak: false, reason: "SC 播报已关闭" };
  if (c.type === "gift" && !r.gift) return { speak: false, reason: "礼物播报已关闭" };
  if (c.type === "enter" && !r.enter) return { speak: false, reason: "进房播报已关闭" };
  if (c.type === "guard" && !r.guard) return { speak: false, reason: "上舰播报已关闭" };
  if (r.guardOnly && (c.guardLevel ?? 0) <= 0 && !c.isAdmin)
    return { speak: false, reason: "已开启只读舰长/钻粉" };
  if (r.guardMinLevel > 0 && (c.guardLevel ?? 0) < r.guardMinLevel && !c.isAdmin)
    return { speak: false, reason: "未达舰长等级门槛" };
  if (r.requireMedal && !c.badge) return { speak: false, reason: "已开启需佩戴徽章" };
  if (c.type === "gift" && r.giftMinPrice > 0 && (c.giftPrice ?? 0) < r.giftMinPrice)
    return { speak: false, reason: "未达付费礼物门槛" };
  if (c.type === "superchat" && r.scMinPrice > 0 && (c.amount ?? 0) < r.scMinPrice)
    return { speak: false, reason: "未达 SC 金额门槛" };
  const hit = hitBlockWord(c.message ?? "", r.blockWords);
  if (hit) return { speak: false, reason: "命中屏蔽词「" + hit + "」" };
  let text = buildText(c, cfg).trim();
  if (!text) return { speak: false, reason: "无可读内容（纯表情或空消息）" };
  if (text.length > r.maxLength) text = text.slice(0, r.maxLength) + "…";
  return { speak: true, text };
}

async function synthesize(text: string): Promise<TtsAudio> {
  const cfg = useConfigStore.getState().config.tts ?? DEFAULT_TTS_CONFIG;
  return invoke<TtsAudio>("tts_synthesize", {
    req: {
      text,
      voice: cfg.voice,
      // 固定模型，忽略历史配置里可能残留的错误值（例如 v3.5 系列）
      model: TTS_MODEL,
      apiKey: cfg.apiKey,
      volume: cfg.volume,
      speechRate: cfg.speechRate,
      pitchRate: cfg.pitchRate,
      sampleRate: cfg.sampleRate,
    },
  });
}

interface TtsState {
  queue: TtsQueueItem[];
  current: TtsQueueItem | null;
  speaking: boolean;
  bridged: boolean;
  mockMode: boolean;
  spokenCount: number;
  skippedCount: number;
  droppedCount: number;
  lastError: string | null;
  lastSkipReason: string | null;
  lastAt: number;
  lastText: string | null;

  startBridge: () => () => void;
  onComment: (c: Comment) => void;
  dequeue: () => void;
  clearQueue: () => void;
  stopAll: () => void;
  speakTest: (text: string) => Promise<void>;
}

function getTtsConfig(): TtsConfig {
  const cfg = useConfigStore.getState().config;
  return cfg.tts ?? DEFAULT_TTS_CONFIG;
}

let seq = 0;

export const useTtsStore = create<TtsState>((set, get) => ({
  queue: [],
  current: null,
  speaking: false,
  bridged: false,
  mockMode: false,
  spokenCount: 0,
  skippedCount: 0,
  droppedCount: 0,
  lastError: null,
  lastSkipReason: null,
  lastAt: 0,
  lastText: null,

  /** 订阅弹幕流：只观察消息数组增长，不改动 ws.ts 的解析逻辑 */
  startBridge: () => {
    if (get().bridged) return () => {};
    set({ bridged: true });
    let prevRegular = useWsStore.getState().regularMessages.length;
    let prevSuper = useWsStore.getState().superChats.length;
    const unsub = useWsStore.subscribe((state) => {
      if (state.regularMessages.length < prevRegular) prevRegular = 0;
      if (state.superChats.length < prevSuper) prevSuper = 0;
      if (state.regularMessages.length > prevRegular) {
        const fresh = state.regularMessages.slice(prevRegular);
        prevRegular = state.regularMessages.length;
        for (const c of fresh) get().onComment(c);
      }
      if (state.superChats.length > prevSuper) {
        const fresh = state.superChats.slice(prevSuper);
        prevSuper = state.superChats.length;
        for (const c of fresh) get().onComment(c);
      }
    });
    return () => {
      unsub();
      set({ bridged: false });
    };
  },

  onComment: (c) => {
    const cfg = getTtsConfig();
    const d = decide(c, cfg);
    if (!d.speak || !d.text) {
      set((s) => ({
        skippedCount: s.skippedCount + 1,
        lastSkipReason: d.reason ?? null,
      }));
      return;
    }
    const item: TtsQueueItem = {
      id: String(++seq),
      text: d.text,
      kind: c.type,
      username: c.username ?? "",
      giftName: c.giftName,
      giftCount: c.giftCount,
      at: Date.now(),
    };
    set((s) => {
      // 礼物合并：同一人、同一礼物在队列里累加，而不是各播一条
      if (cfg.rules.mergeGift && c.type === "gift" && s.queue.length > 0) {
        const who = c.username ?? "";
        const gname = c.giftName ?? "";
        const idx = s.queue.findIndex(
          (q) => q.kind === "gift" && q.username === who && q.giftName === gname,
        );
        if (idx >= 0) {
          const merged = [...s.queue];
          const prev = merged[idx];
          const total = (prev.giftCount ?? 0) + (c.giftCount ?? 1);
          merged[idx] = {
            ...prev,
            giftCount: total,
            at: Date.now(),
            text: giftText(who, total, gname, cfg.rules.readName),
          };
          return { queue: merged };
        }
      }
      let q = [...s.queue, item];
      let dropped = s.droppedCount;
      if (q.length > cfg.maxQueue) {
        const over = q.length - cfg.maxQueue;
        q = cfg.dropOldest ? q.slice(over) : q.slice(0, cfg.maxQueue);
        dropped += over;
      }
      return { queue: q, droppedCount: dropped };
    });
    get().dequeue();
  },

  dequeue: () => {
    const s = get();
    if (s.speaking) return;
    const item = s.queue[0];
    if (!item) return;
    const cfg = getTtsConfig();
    const gap = Date.now() - s.lastAt;
    const wait = Math.max(0, cfg.minIntervalMs - gap);
    set({ speaking: true, current: item, lastAt: Date.now(), lastText: item.text });
    const run = async () => {
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      try {
        const audio = await synthesize(item.text);
        set({ mockMode: audio.mock });
        await pcmPlayer.play(audio.pcmBase64, cfg.volume / 100, audio.sampleRate);
        set((st) => ({
          spokenCount: st.spokenCount + 1,
          lastError: null,
          queue: st.queue.slice(1),
          current: null,
          speaking: false,
        }));
      } catch (err) {
        console.error("播报失败", err);
        set((st) => ({
          lastError: String(err),
          queue: st.queue.slice(1),
          current: null,
          speaking: false,
        }));
      }
      if (get().queue.length > 0) get().dequeue();
    };
    void run();
  },

  clearQueue: () => set({ queue: [], current: null }),

  stopAll: () => {
    pcmPlayer.stop();
    set({ queue: [], current: null, speaking: false });
  },

  speakTest: async (text) => {
    const cfg = getTtsConfig();
    // 连点多个音色时打断上一次试听，避免叠加
    pcmPlayer.stop();
    const audio = await synthesize(text);
    set({ mockMode: audio.mock });
    await pcmPlayer.play(audio.pcmBase64, cfg.volume / 100, audio.sampleRate);
  },
}));
