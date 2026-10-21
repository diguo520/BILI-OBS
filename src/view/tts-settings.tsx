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
      <h3 className="mb-1.5 text-[11.5px] font-semibold text-foreground/90">{title}</h3>
      {children}
    </section>
  );
}

function Line({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex h-[26px] items-center justify-between gap-1.5" title={hint}>
      <span className="truncate text-[10.5px] text-foreground/90">{label}</span>
      <span className="shrink-0">{children}</span>
    </div>
  );
}

function Knob({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between text-[10.5px]">
        <span className="truncate text-foreground/90">{label}</span>
        <span className="shrink-0 tabular-nums text-muted-foreground">{value}</span>
      </div>
      <Slider className="mt-0.5" min={min} max={max} step={step} value={[value]} onValueChange={(v) => onChange(v[0] ?? value)} />
    </div>
  );
}

const NUM = "h-6 w-[70px] px-1.5 text-[11px] tabular-nums";
const NUM_S = "h-6 w-[52px] px-1.5 text-[11px] tabular-nums";

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

  const [testText, setTestText] = useState("欢迎来到直播间");
  const [busy, setBusy] = useState(false);

  const setTts = (patch: Partial<TtsConfig>) => updateConfig({ tts: { ...tts, ...patch } });
  const setRules = (patch: Partial<TtsRules>) => updateConfig({ tts: { ...tts, rules: { ...tts.rules, ...patch } } });

  const runTest = async () => {
    if (!testText.trim() || busy) return;
    setBusy(true);
    try {
      await speakTest(testText.trim());
    } finally {
      setBusy(false);
    }
  };

  const toggles: { key: keyof TtsRules; label: string }[] = [
    { key: "chat", label: "一般弹幕" },
    { key: "gift", label: "礼物" },
    { key: "mergeGift", label: "合并礼物" },
    { key: "superchat", label: "付费留言" },
    { key: "guard", label: "上舰/会员" },
    { key: "enter", label: "进房" },
    { key: "readName", label: "读昵称" },
    { key: "guardOnly", label: "只读舰长" },
    { key: "requireMedal", label: "需徽章" },
    { key: "ignoreEmoji", label: "忽略表情" },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[16px] font-semibold tracking-tight">语音播报设置</h1>
          <p className="truncate text-[10px] text-muted-foreground">
            输出走系统默认设备 · OBS 用「桌面音频」采集 · 未填 Key 时用本地提示音联调
          </p>
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

      <div className="grid shrink-0 grid-cols-2 gap-2">
        <Card title="语音引擎">
          <div className="grid grid-cols-3 gap-2">
            <div className="min-w-0">
              <div className="text-[10px] text-muted-foreground">API Key</div>
              <Input type="password" placeholder="sk-..." className="mt-0.5 h-6 px-1.5 text-[11px]" value={tts.apiKey} onChange={(e) => setTts({ apiKey: e.target.value.trim() })} />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] text-muted-foreground">模型</div>
              <Input className="mt-0.5 h-6 px-1.5 text-[11px]" value={tts.model} onChange={(e) => setTts({ model: e.target.value.trim() })} />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] text-muted-foreground">试听</div>
              <div className="mt-0.5 flex gap-1">
                <Input className="h-6 min-w-0 flex-1 px-1.5 text-[11px]" value={testText} onChange={(e) => setTestText(e.target.value)} />
                <Button size="sm" className="h-6 shrink-0 px-2 text-[11px]" disabled={busy} onClick={runTest}>
                  <HugeiconsIcon icon={Play} className="size-3" />
                  听
                </Button>
              </div>
            </div>
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground">
            <Button size="sm" variant="outline" className="h-6 shrink-0 px-2 text-[11px]" disabled={!speaking && queueLen === 0} onClick={stopAll}>
              <HugeiconsIcon icon={Square} className="size-3" />
              停止清空
            </Button>
            <span className="truncate" title={lastError ?? undefined}>
              {lastError ? "错误：" + lastError : "跳过：" + (lastSkipReason ?? "—")}
            </span>
          </div>
        </Card>

        <Card title="播报参数">
          <div className="grid grid-cols-3 gap-x-2.5 gap-y-1">
            <Knob label="音量" value={tts.volume} min={0} max={100} step={1} onChange={(v) => setTts({ volume: v })} />
            <Knob label="语速" value={tts.speechRate} min={0.5} max={2} step={0.05} onChange={(v) => setTts({ speechRate: v })} />
            <Knob label="语调" value={tts.pitchRate} min={0.5} max={2} step={0.05} onChange={(v) => setTts({ pitchRate: v })} />
            <Line label="频控 ms" hint="两条播报之间的最小间隔">
              <Input type="number" className={NUM} value={tts.minIntervalMs} onChange={(e) => setTts({ minIntervalMs: Number(e.target.value) || 0 })} />
            </Line>
            <Line label="队列上限" hint="超出后按右侧策略丢弃">
              <div className="flex items-center gap-1.5">
                <Input type="number" className={NUM_S} value={tts.maxQueue} onChange={(e) => setTts({ maxQueue: Math.max(1, Number(e.target.value) || 1) })} />
                <span className="text-[10px] text-muted-foreground">丢最旧</span>
                <Switch checked={tts.dropOldest} onCheckedChange={(v) => setTts({ dropOldest: v })} />
              </div>
            </Line>
          </div>
        </Card>
      </div>

      <Card title={"音色（" + VOICES.length + "）"} className="shrink-0">
        <div className="grid grid-cols-5 gap-1.5">
          {VOICES.map((v) => {
            const active = tts.voice === v.officialVoice;
            return (
              <button
                key={v.officialVoice}
                type="button"
                title={v.desc + " · " + v.officialVoice}
                onClick={() => setTts({ voice: v.officialVoice, model: v.model })}
                className={cn(
                  "flex h-[26px] flex-col justify-center overflow-hidden rounded-md border px-2 text-left transition-colors",
                  active ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/40",
                )}>
                <span className="truncate text-[10.5px] leading-tight font-medium">{v.name}</span>
                <span className="truncate text-[9px] leading-tight text-muted-foreground">{v.officialVoice}</span>
              </button>
            );
          })}
        </div>
      </Card>

      <div className="grid min-h-0 flex-1 grid-cols-[1.45fr_1fr] gap-2">
        <Card title="播报规则（3 列）">
          <div className="grid grid-cols-3 gap-x-2.5">
            {toggles.map((tg) => (
              <div key={tg.key} className="flex h-[23px] items-center justify-between gap-1">
                <span className="truncate text-[10.5px] text-foreground/90">{tg.label}</span>
                <Switch
                  className="scale-90"
                  checked={tts.rules[tg.key] as boolean}
                  onCheckedChange={(v) => {
                    const patch = {} as Partial<TtsRules>;
                    (patch as Record<string, boolean>)[tg.key] = v;
                    setRules(patch);
                  }}
                />
              </div>
            ))}
            <Line label="舰长门槛" hint="0 不限；1 舰长 / 2 提督 / 3 总督">
              <Input type="number" min={0} max={3} className={NUM_S} value={tts.rules.guardMinLevel} onChange={(e) => setRules({ guardMinLevel: Math.min(3, Math.max(0, Number(e.target.value) || 0)) })} />
            </Line>
          </div>
        </Card>

        <Card title="门槛与屏蔽">
          <div className="grid grid-cols-3 gap-x-2.5">
            <Line label="礼物门槛" hint="付费礼物金额下限（元），0 = 不限">
              <Input type="number" className={NUM_S} value={tts.rules.giftMinPrice} onChange={(e) => setRules({ giftMinPrice: Number(e.target.value) || 0 })} />
            </Line>
            <Line label="SC 门槛" hint="SC 金额下限（元），0 = 不限">
              <Input type="number" className={NUM_S} value={tts.rules.scMinPrice} onChange={(e) => setRules({ scMinPrice: Number(e.target.value) || 0 })} />
            </Line>
            <Line label="最大字数" hint="单条播报超出后截断">
              <Input type="number" className={NUM_S} value={tts.rules.maxLength} onChange={(e) => setRules({ maxLength: Math.max(1, Number(e.target.value) || 1) })} />
            </Line>
          </div>
          <Textarea
            className="mt-1 min-h-0 flex-1 resize-none px-1.5 py-1 text-[10.5px] leading-snug"
            placeholder="屏蔽词，每行一个"
            value={tts.rules.blockWords.join("\n")}
            onChange={(e) => setRules({ blockWords: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
          />
        </Card>
      </div>
    </div>
  );
}
