import { useState } from "react";
import { Play, Square } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useConfigStore } from "@/store/config";
import { useTtsStore } from "@/store/tts";
import { VOICES } from "@/data/voices";
import { DEFAULT_TTS_CONFIG, type TtsConfig, type TtsRules } from "@/types/tts";
import { cn } from "@/lib/utils";

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h3 className="mb-2.5 text-[12.5px] font-semibold text-foreground/90">
        {title}
      </h3>
      {children}
      {hint && (
        <p className="mt-2.5 text-[10.5px] leading-relaxed text-muted-foreground">
          {hint}
        </p>
      )}
    </section>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <div className="min-w-0">
        <div className="text-[12px]">{label}</div>
        {hint && (
          <div className="text-[10px] leading-snug text-muted-foreground">
            {hint}
          </div>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

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

  const setTts = (patch: Partial<TtsConfig>) =>
    updateConfig({ tts: { ...tts, ...patch } });
  const setRules = (patch: Partial<TtsRules>) =>
    updateConfig({ tts: { ...tts, rules: { ...tts.rules, ...patch } } });

  const runTest = async () => {
    if (!testText.trim() || busy) return;
    setBusy(true);
    try {
      await speakTest(testText.trim());
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="themed-scrollbar flex h-full flex-col gap-3 overflow-y-auto">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[19px] font-semibold tracking-tight">弹幕播报</h1>
          <p className="mt-0.5 text-[11.5px] text-muted-foreground">
            按规则朗读弹幕、礼物、SC 与上舰；音频走系统默认输出，OBS 用「桌面音频」采集
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!tts.apiKey && <Badge variant="secondary">未配置 Key</Badge>}
          {tts.apiKey && !tts.enabled && <Badge variant="secondary">已暂停</Badge>}
          {tts.enabled && <Badge>播报中</Badge>}
          <Switch
            checked={tts.enabled}
            onCheckedChange={(v) => setTts({ enabled: v })}
            aria-label="播报总开关"
          />
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Section
          title="语音引擎"
          hint="填写你自己的阿里云百炼 API Key。留空时使用本地提示音，便于先联调整条链路。">
          <div className="space-y-2">
            <div>
              <Label className="text-[11px]">API Key</Label>
              <Input
                type="password"
                placeholder="sk-..."
                value={tts.apiKey}
                onChange={(e) => setTts({ apiKey: e.target.value.trim() })}
              />
            </div>
            <div>
              <Label className="text-[11px]">模型</Label>
              <Input
                value={tts.model}
                onChange={(e) => setTts({ model: e.target.value.trim() })}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Input
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                placeholder="试听文本"
              />
              <Button size="sm" disabled={busy} onClick={runTest}>
                <HugeiconsIcon icon={Play} className="size-3.5" />
                试听
              </Button>
            </div>
          </div>
        </Section>

        <Section title="运行状态">
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { k: "已播报", v: spokenCount },
              { k: "已跳过", v: skippedCount },
              { k: "已丢弃", v: droppedCount },
            ].map((it) => (
              <div key={it.k} className="rounded-lg border border-border/70 py-2">
                <div className="text-[17px] font-semibold tabular-nums">
                  {it.v}
                </div>
                <div className="text-[10px] text-muted-foreground">{it.k}</div>
              </div>
            ))}
          </div>
          <Separator className="my-3" />
          <div className="space-y-1 text-[10.5px] text-muted-foreground">
            <div>队列中：{queueLen} 条</div>
            <div className="truncate">
              最近跳过原因：{lastSkipReason ?? "—"}
            </div>
            {lastError && (
              <div className="text-destructive">最近错误：{lastError}</div>
            )}
          </div>
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!speaking && queueLen === 0}
              onClick={stopAll}>
              <HugeiconsIcon icon={Square} className="size-3.5" />
              停止并清空队列
            </Button>
          </div>
        </Section>
      </div>

      <Section title={"音色（" + VOICES.length + " 个）"} hint="音色 ID 与阿里云百炼官方一致，官方另有 _v3 版本音质更好。">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-6">
          {VOICES.map((v) => {
            const active = tts.voice === v.officialVoice;
            return (
              <button
                key={v.officialVoice}
                type="button"
                onClick={() => setTts({ voice: v.officialVoice, model: v.model })}
                className={cn(
                  "flex flex-col items-start gap-0.5 rounded-lg border px-2.5 py-2 text-left transition-colors",
                  active
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card hover:border-primary/40",
                )}>
                <span className="text-[12px] font-medium">{v.name}</span>
                <span className="truncate text-[10px] text-muted-foreground">
                  {v.desc} · {v.officialVoice}
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      <div className="grid gap-3 lg:grid-cols-2">
        <Section title="播报参数">
          <Row label="音量" hint={String(tts.volume) + "%"}>
            <Slider
              className="w-40"
              min={0}
              max={100}
              step={1}
              value={[tts.volume]}
              onValueChange={(v) => setTts({ volume: v[0] ?? 100 })}
            />
          </Row>
          <Row label="语速" hint={String(tts.speechRate)}>
            <Slider
              className="w-40"
              min={0.5}
              max={2}
              step={0.05}
              value={[tts.speechRate]}
              onValueChange={(v) => setTts({ speechRate: v[0] ?? 1 })}
            />
          </Row>
          <Row label="语调" hint={String(tts.pitchRate)}>
            <Slider
              className="w-40"
              min={0.5}
              max={2}
              step={0.05}
              value={[tts.pitchRate]}
              onValueChange={(v) => setTts({ pitchRate: v[0] ?? 1 })}
            />
          </Row>
          <Row label="频控间隔" hint="两条播报之间至少间隔，防刷屏">
            <Input
              className="w-24"
              type="number"
              value={tts.minIntervalMs}
              onChange={(e) =>
                setTts({ minIntervalMs: Number(e.target.value) || 0 })
              }
            />
          </Row>
          <Row label="队列上限" hint="超出后按下方策略丢弃">
            <div className="flex items-center gap-2">
              <Input
                className="w-20"
                type="number"
                value={tts.maxQueue}
                onChange={(e) =>
                  setTts({ maxQueue: Math.max(1, Number(e.target.value) || 1) })
                }
              />
              <label className="flex items-center gap-1 text-[10.5px] text-muted-foreground">
                <Switch
                  checked={tts.dropOldest}
                  onCheckedChange={(v) => setTts({ dropOldest: v })}
                />
                丢最旧
              </label>
            </div>
          </Row>
        </Section>

        <Section title="播报规则">
          <Row label="播报一般弹幕">
            <Switch
              checked={tts.rules.chat}
              onCheckedChange={(v) => setRules({ chat: v })}
            />
          </Row>
          <Row label="播报礼物">
            <Switch
              checked={tts.rules.gift}
              onCheckedChange={(v) => setRules({ gift: v })}
            />
          </Row>
          <Row label="播报付费留言（SC）">
            <Switch
              checked={tts.rules.superchat}
              onCheckedChange={(v) => setRules({ superchat: v })}
            />
          </Row>
          <Row label="播报上舰 / 会员">
            <Switch
              checked={tts.rules.guard}
              onCheckedChange={(v) => setRules({ guard: v })}
            />
          </Row>
          <Row label="播报进房">
            <Switch
              checked={tts.rules.enter}
              onCheckedChange={(v) => setRules({ enter: v })}
            />
          </Row>
          <Separator className="my-2" />
          <Row label="读昵称">
            <Switch
              checked={tts.rules.readName}
              onCheckedChange={(v) => setRules({ readName: v })}
            />
          </Row>
          <Row label="只读舰长 / 钻粉">
            <Switch
              checked={tts.rules.guardOnly}
              onCheckedChange={(v) => setRules({ guardOnly: v })}
            />
          </Row>
          <Row label="佩戴徽章才会读">
            <Switch
              checked={tts.rules.requireMedal}
              onCheckedChange={(v) => setRules({ requireMedal: v })}
            />
          </Row>
          <Row label="忽略表情弹幕">
            <Switch
              checked={tts.rules.ignoreEmoji}
              onCheckedChange={(v) => setRules({ ignoreEmoji: v })}
            />
          </Row>
        </Section>
      </div>

      <Section title="门槛与屏蔽">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label className="text-[11px]">付费礼物门槛（元，0 = 不限）</Label>
            <Input
              type="number"
              value={tts.rules.giftMinPrice}
              onChange={(e) =>
                setRules({ giftMinPrice: Number(e.target.value) || 0 })
              }
            />
          </div>
          <div>
            <Label className="text-[11px]">SC 金额门槛（元，0 = 不限）</Label>
            <Input
              type="number"
              value={tts.rules.scMinPrice}
              onChange={(e) =>
                setRules({ scMinPrice: Number(e.target.value) || 0 })
              }
            />
          </div>
          <div>
            <Label className="text-[11px]">单条最大字数</Label>
            <Input
              type="number"
              value={tts.rules.maxLength}
              onChange={(e) =>
                setRules({ maxLength: Math.max(1, Number(e.target.value) || 1) })
              }
            />
          </div>
        </div>
        <div className="mt-3">
          <Label className="text-[11px]">屏蔽词（每行一个，用换行分隔）</Label>
          <Textarea
            rows={3}
            value={tts.rules.blockWords.join("\n")}
            onChange={(e) =>
              setRules({
                blockWords: e.target.value
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
          />
        </div>
      </Section>
    </div>
  );
}
