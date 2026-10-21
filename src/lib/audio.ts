/** 弹幕播报 —— PCM 音频播放器（WebAudio）
 *
 * 与 OBH 的实现同构：服务端返回 16-bit 小端单声道 PCM，
 * 前端转成 Float32 后用 AudioBufferSourceNode 顺序播放。
 * 输出走系统默认设备，OBS 用「桌面音频」即可采集。
 */

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

/** 16-bit 小端 PCM -> Float32 [-1, 1] */
function pcmToFloat32(bytes: Uint8Array): Float32Array {
  const samples = Math.floor(bytes.byteLength / 2);
  const view = new DataView(bytes.buffer, bytes.byteOffset, samples * 2);
  const out = new Float32Array(samples);
  for (let i = 0; i < samples; i += 1) {
    out[i] = view.getInt16(i * 2, true) / 32768;
  }
  return out;
}

class PcmPlayer {
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private current: AudioBufferSourceNode | null = null;

  private ac(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.gain = this.ctx.createGain();
      this.gain.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  /** 在用户手势中调用：创建并恢复 AudioContext，规避自动播放策略 */
  unlock(): void {
    const ctx = this.ac();
    if (ctx.state === "suspended") {
      void ctx.resume();
    }
  }

  /** 播放一段 base64 PCM；resolve 表示播放完毕（用于串行化队列） */
  async play(pcmBase64: string, volume = 1, sampleRate = 16000): Promise<void> {
    const bytes = base64ToBytes(pcmBase64);
    const samples = pcmToFloat32(bytes);
    if (samples.length === 0) return;
    const ctx = this.ac();
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {
        /* 忽略：某些环境不允许自动恢复 */
      }
    }
    const buffer = ctx.createBuffer(1, samples.length, sampleRate);
    // 用 getChannelData().set() 而非 copyToChannel：避免 TS 对 Float32Array 泛型的严格校验
    buffer.getChannelData(0).set(samples);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    if (this.gain) this.gain.gain.value = Math.min(1, Math.max(0, volume));
    src.connect(this.gain ?? ctx.destination);
    this.current = src;
    await new Promise<void>((resolve) => {
      src.onended = () => {
        if (this.current === src) this.current = null;
        resolve();
      };
      src.start();
    });
  }

  /** 立即停止当前播放（队列由调用方清理） */
  stop(): void {
    if (this.current) {
      try {
        this.current.stop();
      } catch {
        /* 已经结束 */
      }
      this.current = null;
    }
  }
}

export const pcmPlayer = new PcmPlayer();

let audioUnlocked = false;

/**
 * 首次用户交互时解锁 AudioContext。
 * 浏览器的自动播放策略默认拦截「无手势」的播放，
 * 不做这一步的话，只有点「试听」能出声、弹幕自动播报会静音。
 */
export function installAudioUnlock(): () => void {
  const handler = () => {
    if (audioUnlocked) return;
    audioUnlocked = true;
    pcmPlayer.unlock();
  };
  window.addEventListener("pointerdown", handler);
  window.addEventListener("keydown", handler);
  return () => {
    window.removeEventListener("pointerdown", handler);
    window.removeEventListener("keydown", handler);
  };
}
