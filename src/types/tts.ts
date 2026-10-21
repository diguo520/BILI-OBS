/** 弹幕播报 —— 类型定义 */

/** 音色（来自 OBH /api/voice/listConfig 的 CosyVoice 通道） */
export interface TtsVoice {
  /** OBH 音色 id */
  id: number;
  /** 显示名 */
  name: string;
  /** 风格副标题 */
  desc: string;
  /** OBH 音色标识（用于对照） */
  voice: string;
  /** 阿里云百炼官方音色 ID（实际传给合成接口的值） */
  officialVoice: string;
  /** 建议模型 */
  model: string;
  sampleRate: number;
  defaults: { speechRate: number; pitchRate: number; volume: number };
  icon: string;
}

/** 分类播报规则 */
export interface TtsRules {
  /** 播报一般弹幕 */
  chat: boolean;
  /** 播报付费留言（SC） */
  superchat: boolean;
  /** 播报礼物 */
  gift: boolean;
  /** 播报进房 */
  enter: boolean;
  /** 播报上舰 / 钻粉 / 订阅 / 会员 */
  guard: boolean;
  /** 读昵称 */
  readName: boolean;
  /** 只读舰长 / 钻粉 */
  guardOnly: boolean;
  /** 佩戴徽章才会读 */
  requireMedal: boolean;
  /** 舰长等级门槛（0 = 不限；1 = 舰长，2 = 提督，3 = 总督） */
  guardMinLevel: number;
  /** 忽略表情弹幕（纯 [表情] 内容的弹幕不播报） */
  ignoreEmoji: boolean;
  /** 合并礼物（短时间内同一礼物合并成一条） */
  mergeGift: boolean;
  /** 付费礼物门槛（元，0 = 不限制） */
  giftMinPrice: number;
  /** SC 金额门槛（元，0 = 不限制） */
  scMinPrice: number;
  /** 屏蔽词 */
  blockWords: string[];
  /** 单条播报最大字数（超出截断） */
  maxLength: number;
}

/** 播报配置（持久化在 AppConfig.tts） */
export interface TtsConfig {
  enabled: boolean;
  /** 阿里云百炼 API Key（sk- 开头） */
  apiKey: string;
  /** 选中的官方音色 ID */
  voice: string;
  /** 合成模型 */
  model: string;
  /** 音量 0-100 */
  volume: number;
  /** 语速，1 = 正常 */
  speechRate: number;
  /** 语调，1 = 正常 */
  pitchRate: number;
  sampleRate: number;
  /** 频控：两条播报之间的最小间隔（毫秒） */
  minIntervalMs: number;
  /** 队列上限 */
  maxQueue: number;
  /** 队列满时丢弃最旧的（否则丢弃最新的） */
  dropOldest: boolean;
  rules: TtsRules;
}

export const DEFAULT_TTS_RULES: TtsRules = {
  chat: true,
  superchat: true,
  gift: true,
  enter: false,
  guard: true,
  readName: true,
  guardOnly: false,
  requireMedal: false,
  guardMinLevel: 0,
  ignoreEmoji: true,
  mergeGift: true,
  giftMinPrice: 0,
  scMinPrice: 0,
  blockWords: [],
  maxLength: 60,
};

export const DEFAULT_TTS_CONFIG: TtsConfig = {
  enabled: false,
  apiKey: "",
  voice: "longqiang_v3",
  model: "cosyvoice-v3-flash",
  volume: 100,
  speechRate: 1,
  pitchRate: 1,
  sampleRate: 16000,
  minIntervalMs: 300,
  maxQueue: 8,
  dropOldest: true,
  rules: DEFAULT_TTS_RULES,
};

/** 队列项 */
export interface TtsQueueItem {
  id: string;
  text: string;
  /** 来源消息类型，用于调试与统计 */
  kind: "chat" | "superchat" | "gift" | "enter" | "guard" | "test";
  username: string;
  /** 礼物合并用：礼物名与累计数量 */
  giftName?: string;
  giftCount?: number;
  at: number;
}

/** Rust tts_synthesize 的返回 */
export interface TtsAudio {
  /** base64 编码的 PCM（16-bit 小端、单声道） */
  pcmBase64: string;
  sampleRate: number;
  /** true 表示未配置 API Key，返回的是本地提示音 */
  mock: boolean;
}

/** 规则判定结果 */
export interface TtsDecision {
  speak: boolean;
  /** 不播报的原因（便于排查“为什么没读”） */
  reason?: string;
  /** 最终要朗读的文本 */
  text?: string;
}
