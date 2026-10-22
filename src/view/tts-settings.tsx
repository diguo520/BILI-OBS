import { useState } from "react";
import { Play, Square } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useConfigStore } from "@/store/config";
import { useTtsStore } from "@/store/tts";
import { VOICES } from "@/data/voices";
import { DEFAULT_TTS_CONFIG, type TtsConfig, type TtsRules } from "@/types/tts";
import { cn } from "@/lib/utils";

function Card({ title, className, children }: { title: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={cn("flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card p-2.5", className)}>
      <h3 className="mb-2 text-[12px] font-semibold text-foreground/90">{title}</h3>
      {children}
    </section>
  );
}

function Line({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex h-[28px] items-center justify-between gap-2" title={hint}>
      <span className="truncate text-[11px] text-foreground/90">{label}</span>
      <span className="shrink-0">{children}</span>
    </div>
  );
}

function Knob({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between text-[11px]">
        <span className="truncate text-foreground/90">{label}</span>
        <span className="shrink-0 tabular-nums text-muted-foreground">{value}</span>
      </div>
      <Slider className="mt-1.5" min={min} max={max} step={step} value={[value]} onValueChange={(v) => onChange(v[0] ?? value)} />
    </div>
  );
}

/** 所有数字输入框统一尺寸，避免同一页出现多种宽度 */
const NUM = "h-7 w-[68px] px-2 text-[11.5px] tabular-nums";

export function TtsSettings() {
  const tts = useConfigStore((s) => s.config.tts ?? DEFAULT_TTS_CONFIG);
  const updateConfig = useConfigStore((s) => s.updateConfig);
  const speaking = useTtsStore((s) => s.speaking);
  const queueLen = useTtsStore((s) => s.queue.length);
  const spokenCount = useTtsStore((s) => s.spokenCount);
  const skippedCount = useTtsStore((s) => s.skippedCount);
  const droppedCount = useTtsStore((s) => s.droppedCount);
  const lastError = useTtsStore((s) => s.lastError);
  const lastSkipReason = useTtsStore((s) => s.lastSkipReason);
  const speakTest = useTtsStore((s) => s.speakTest);
  const stopAll = useTtsStore((s) => s.stopAll);

  const [busy, setBusy] = useState(false);

  const setTts = (patch: Partial<TtsConfig>) => updateConfig({ tts: { ...tts, ...patch } });
  const setRules = (patch: Partial<TtsRules>) => updateConfig({ tts: { ...tts, rules: { ...tts.rules, ...patch } } });

  /** 试听固定读这一句，界面不提供自定义文本 */
  const TEST_TEXT = "欢迎使用BILI OBS";

  const runTest = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await speakTest(TEST_TEXT);
    } finally {
      setBusy(false);
    }
  };

  /** 规则按类别分三列：列内自上而下语义连贯，横向对照也整齐 */
  const ruleColumns: { key: keyof TtsRules; label: string }[][] = [
    [
      { key: "chat", label: "一般弹幕" },
      { key: "guardOnly", label: "只读舰长" },
      { key: "requireMedal", label: "需徽章" },
      { key: "ignoreEmoji", label: "忽略表情" },
    ],
    [
      { key: "gift", label: "礼物" },
      { key: "mergeGift", label: "合并礼物" },
      { key: "superchat", label: "付费留言" },
    ],
    [
      { key: "guard", label: "上舰/会员" },
      { key: "enter", label: "进房" },
      { key: "readName", label: "读昵称" },
    ],
  ];

  const toggleRule = (key: keyof TtsRules, v: boolean) => {
    const patch = {} as Partial<TtsRules>;
    (patch as Record<string, boolean>)[key] = v;
    setRules(patch);
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5 overflow-hidden">
      <div className="flex shrink-0 items-center justify-between gap-3 pr-0.5">
        <div className="flex min-w-0 items-baseline gap-2.5">
          <h1
            className="shrink-0 text-[16px] font-semibold tracking-tight"
            title="输出走系统默认设备；OBS 用「桌面音频」采集即可让观众听见；未填 Key 时用本地提示音联调">
            语音播报设置
          </h1>
          <span className="truncate text-[10.5px] text-muted-foreground">
            系统默认输出 · OBS 桌面音频采集
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px] tabular-nums">
            {"播" + spokenCount + " 跳" + skippedCount + " 丢" + droppedCount}
          </Badge>
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px] tabular-nums">
            {"队列" + queueLen}
          </Badge>
          {!tts.apiKey && (
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
              无 Key
            </Badge>
          )}
          <Switch checked={tts.enabled} onCheckedChange={(v) => setTts({ enabled: v })} aria-label="播报总开关" />
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-2.5">
        <Card title="语音引擎">
          <div className="grid grid-cols-3 gap-2.5">
            <div className="min-w-0">
              <div className="text-[10.5px] text-muted-foreground">API Key</div>
              <Input type="password" placeholder="sk-..." className="mt-1 h-7 px-2 text-[11.5px]" value={tts.apiKey} onChange={(e) => setTts({ apiKey: e.target.value.trim() })} />
            </div>
            <div className="min-w-0">
              <div className="text-[10.5px] text-muted-foreground">模型</div>
              <Input className="mt-1 h-7 px-2 text-[11.5px]" value={tts.model} onChange={(e) => setTts({ model: e.target.value.trim() })} />
            </div>
            <div className="min-w-0">
              <div className="text-[10.5px] text-muted-foreground">试听</div>
              <Button
                size="sm"
                className="mt-1 h-7 w-full px-2 py-0 text-[11.5px]"
                disabled={busy}
                title="固定朗读：欢迎使用 BILI OBS"
                onClick={runTest}>
                <HugeiconsIcon icon={Play} className="size-3" />
                试听
              </Button>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2 text-[10.5px] text-muted-foreground">
            <Button size="sm" variant="outline" className="h-6 shrink-0 px-2 py-0 text-[11px]" disabled={!speaking && queueLen === 0} onClick={stopAll}>
              <HugeiconsIcon icon={Square} className="size-3" />
              停止清空
            </Button>
            <span className="truncate" title={lastError ?? undefined}>
              {lastError ? "错误：" + lastError : "跳过：" + (lastSkipReason ?? "—")}
            </span>
          </div>
        </Card>

        <Card title="播报参数">
          <div className="grid grid-cols-3 gap-x-3 gap-y-2">
            <Knob label="音量" value={tts.volume} min={0} max={100} step={1} onChange={(v) => setTts({ volume: v })} />
            <Knob label="语速" value={tts.speechRate} min={0.5} max={2} step={0.05} onChange={(v) => setTts({ speechRate: v })} />
            <Knob label="语调" value={tts.pitchRate} min={0.5} max={2} step={0.05} onChange={(v) => setTts({ pitchRate: v })} />
            <Line label="频控" hint="两条播报之间的最小间隔（毫秒）">
              <Input type="number" className={NUM} value={tts.minIntervalMs} onChange={(e) => setTts({ minIntervalMs: Number(e.target.value) || 0 })} />
            </Line>
            <Line label="队列" hint="队列上限：排队超过该条数时按右侧策略丢弃">
              <Input type="number" className={NUM} value={tts.maxQueue} onChange={(e) => setTts({ maxQueue: Math.max(1, Number(e.target.value) || 1) })} />
            </Line>
            <Line label="丢最旧" hint="队列满时丢弃最旧的一条，而不是最新的">
              <Switch checked={tts.dropOldest} onCheckedChange={(v) => setTts({ dropOldest: v })} />
            </Line>
          </div>
        </Card>
      </div>

      <Card title={"音色（" + VOICES.length + "）"} className="shrink-0">
        <div className="grid grid-cols-5 gap-1.5 pb-0.5">
          {VOICES.map((v) => {
            const active = tts.voice === v.officialVoice;
            return (
              <button
                key={v.officialVoice}
                type="button"
                title={v.desc + " · " + v.officialVoice}
                onClick={() => setTts({ voice: v.officialVoice, model: v.model })}
                className={cn(
                  "flex h-[28px] flex-col justify-between overflow-hidden rounded-md border px-2.5 py-[3px] text-left transition-colors",
                  active ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/40",
                )}>
                <span className="truncate text-[10.5px] leading-tight font-medium">{v.name}</span>
                <span className="truncate text-[9px] leading-tight text-muted-foreground">{v.officialVoice}</span>
              </button>
            );
          })}
        </div>
      </Card>

      <div className="grid min-h-0 flex-1 grid-cols-[1.45fr_1fr] gap-2.5">
        <Card title="播报规则（3 列）" className="p-3">
          <div className="grid flex-1 grid-cols-3 gap-x-4">
            {ruleColumns.map((col, ci) => (
              <div key={ci} className="flex flex-col justify-between">
                {col.map((tg) => (
                  <div key={tg.key} className="flex h-[28px] items-center justify-between gap-2">
                    <span className="truncate text-[11.5px] text-foreground/90">{tg.label}</span>
                    <Switch checked={tts.rules[tg.key] as boolean} onCheckedChange={(v) => toggleRule(tg.key, v)} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Card>

        <Card title="门槛与屏蔽">
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            <Line label="礼物门槛" hint="付费礼物金额下限（元），0 = 不限">
              <Input type="number" className={NUM} value={tts.rules.giftMinPrice} onChange={(e) => setRules({ giftMinPrice: Number(e.target.value) || 0 })} />
            </Line>
            <Line label="SC 门槛" hint="SC 金额下限（元），0 = 不限">
              <Input type="number" className={NUM} value={tts.rules.scMinPrice} onChange={(e) => setRules({ scMinPrice: Number(e.target.value) || 0 })} />
            </Line>
            <Line label="最大字数" hint="单条播报超出后截断">
              <Input type="number" className={NUM} value={tts.rules.maxLength} onChange={(e) => setRules({ maxLength: Math.max(1, Number(e.target.value) || 1) })} />
            </Line>
            <Line label="舰长门槛" hint="0 不限；1 舰长 / 2 提督 / 3 总督">
              <Input type="number" min={0} max={3} className={NUM} value={tts.rules.guardMinLevel} onChange={(e) => setRules({ guardMinLevel: Math.min(3, Math.max(0, Number(e.target.value) || 0)) })} />
            </Line>
          </div>
          <Textarea
            className="mt-2 min-h-0 flex-1 resize-none px-3 py-2 text-[11px] leading-relaxed"
            placeholder="屏蔽词，每行一个"
            value={tts.rules.blockWords.join("\n")}
            onChange={(e) => setRules({ blockWords: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
          />
        </Card>
      </div>
    </div>
  );
}
