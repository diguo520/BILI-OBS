/**
 * 本地直播录制（替代云端回放方案 —— B 站云录制 9 场全部生成失败，实测不可依赖）。
 *
 * 设计（烟测验证过）：开播且开关打开 → ffmpeg -c copy 拉流直存 mp4；
 * 停播 → 优雅停止 + 从成品第 3 秒抽帧做封面；本页以网格展示所有本地录像。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  VideoReplayIcon,
  Folder01Icon,
  RefreshIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { useConfigStore } from "@/store/config";
import { useLiveControl } from "@/hooks/use-live-control";
import { formatBytes } from "@/lib/replay-utils";

interface RecordingEntry {
  file: string;
  title: string;
  cover: string | null;
  bytes: number;
  modified: number;
}

interface RecordingEvent {
  active: boolean;
  file: string | null;
  bytes: number;
  message: string | null;
}

const BACKSLASH = String.fromCharCode(92);

function toUrlPath(p: string): string {
  return p.split(BACKSLASH).join("/");
}

function coverUrl(p: string): string {
  return "https://asset.localhost/" + encodeURIComponent(toUrlPath(p));
}

export function ReplayView() {
  const config = useConfigStore((s) => s.config);
  const updateConfig = useConfigStore((s) => s.updateConfig);
  const { isOpenLive } = useLiveControl();
  const [entries, setEntries] = useState<RecordingEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState<RecordingEvent | null>(null);
  const [saveDir, setSaveDir] = useState(config.recordingSaveDir || "");
  const [autoRecord, setAutoRecord] = useState(config.autoRecord ?? false);
  const startAttempted = useRef(false);

  const dir = (saveDir || config.recordingSaveDir || "").trim();

  const refresh = useCallback(async () => {
    if (!dir) {
      setEntries([]);
      return;
    }
    setLoading(true);
    try {
      const list = await invoke<RecordingEntry[]>("recording_list", { dir });
      setEntries(list);
    } catch (e) {
      toast.error("读取录像失败：" + (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [dir]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  useEffect(() => {
    const un = listen<RecordingEvent>("recording-changed", (ev) => {
      setRecording(ev.payload);
    });
    return () => {
      un.then((f) => f());
    };
  }, []);

  // 开播联动：开关打开 → 开播即录、停播即停
  useEffect(() => {
    if (!autoRecord || !dir) return;
    if (isOpenLive && !recording?.active && !startAttempted.current) {
      startAttempted.current = true;
      void (async () => {
        try {
          await invoke<string>("recording_start", {
            url: config.recordingStreamUrl,
            stem: dir + "/" + Date.now() + "_" + (config.roomTitle || "直播录制"),
            userAgent: navigator.userAgent,
            referer: "https://live.bilibili.com/",
          });
          toast.success("已开始本地录制");
        } catch (e) {
          toast.error("开始录制失败：" + (e as Error).message);
        }
      })();
    }
    if (!isOpenLive && recording?.active) {
      startAttempted.current = false;
      void invoke("recording_stop").catch((e) =>
        toast.error("停止录制失败：" + String(e)),
      );
    }
  }, [autoRecord, dir, isOpenLive, recording?.active, config.recordingStreamUrl, config.roomTitle]);

  const totalBytes = useMemo(
    () => entries.reduce((acc, e) => acc + e.bytes, 0),
    [entries],
  );

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-end gap-2.5">
        <div>
          <h1 className="flex items-center gap-2 text-[26px] leading-none font-semibold tracking-tight">
            <HugeiconsIcon icon={VideoReplayIcon} className="size-5 text-primary" />
            直播录制
          </h1>
          <p className="mt-1.5 text-[12px] text-muted-foreground">
            {entries.length
              ? "共 " + entries.length + " 个录像 · " + formatBytes(totalBytes)
              : "本地录制，不依赖 B 站云端"}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {recording?.active && (
            <Badge className="animate-pulse border-0 bg-destructive/15 text-[10.5px] font-normal text-destructive">
              录制中 {formatBytes(recording.bytes)}
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-7 rounded-lg text-[11px]"
            disabled={loading}
            onClick={() => void refresh()}>
            {loading ? <Spinner /> : <HugeiconsIcon icon={RefreshIcon} className="size-3.5" />}
            刷新
          </Button>
        </div>
      </div>

      <Card className="shrink-0 p-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2">
            <Switch
              id="auto-record"
              checked={autoRecord}
              onCheckedChange={(v) => {
                setAutoRecord(v);
                updateConfig({ autoRecord: v });
                if (!v && recording?.active) {
                  void invoke("recording_stop").catch(() => {});
                }
              }}
            />
            <Label htmlFor="auto-record" className="text-[12px]">
              开播时自动录制
            </Label>
          </div>
          <div className="flex min-w-[260px] flex-1 items-center gap-2">
            <Label className="shrink-0 text-[12px] text-muted-foreground">
              保存到
            </Label>
            <Input
              value={saveDir}
              onChange={(e) => setSaveDir(e.target.value)}
              onBlur={() => updateConfig({ recordingSaveDir: saveDir.trim() })}
              placeholder="例如 D:/直播录像（录完自动生成 mp4 + 封面）"
              className="h-8 text-[11.5px]"
            />
          </div>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {autoRecord
            ? isOpenLive
              ? "直播中 · 正在自动录制，停播后自动完成并生成封面"
              : "已开启 · 下次开播自动录制"
            : "已关闭 · 开播不会录制"}
        </p>
      </Card>

      <div className="themed-scrollbar grid min-h-0 flex-1 auto-rows-min grid-cols-3 gap-2.5 overflow-y-auto pr-1">
        {entries.map((e) => (
          <div
            key={e.file}
            className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/30">
            <div className="relative aspect-video w-full shrink-0 overflow-hidden bg-muted">
              {e.cover ? (
                <img
                  src={coverUrl(e.cover)}
                  alt={e.title}
                  loading="lazy"
                  className="size-full object-cover"
                />
              ) : (
                <div className="flex size-full items-center justify-center text-muted-foreground">
                  <HugeiconsIcon icon={VideoReplayIcon} className="size-7 opacity-40" />
                </div>
              )}
            </div>
            <div className="flex min-w-0 flex-col gap-1 p-2.5">
              <div className="min-w-0 truncate text-[12px] font-medium" title={e.title}>
                {e.title}
              </div>
              <div className="flex items-center gap-2 text-[10.5px] text-muted-foreground">
                <span className="tabular-nums">{formatBytes(e.bytes)}</span>
                <span>
                  {new Date(e.modified * 1000).toLocaleString("zh-CN", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto h-6 px-1.5 text-[10.5px]"
                  onClick={() =>
                    void openUrl("file:///" + toUrlPath(e.file)).catch(() =>
                      toast.error("无法打开文件"),
                    )
                  }>
                  <HugeiconsIcon icon={Folder01Icon} className="size-3" />
                  打开
                </Button>
              </div>
            </div>
          </div>
        ))}
        {!entries.length && !loading && (
          <div className="col-span-3 flex flex-1 items-center justify-center rounded-xl border border-dashed border-border py-16 text-[12px] text-muted-foreground">
            {dir
              ? "还没有录像 · 开启自动录制后，开播即自动录制"
              : "先在上面填写保存目录"}
          </div>
        )}
      </div>
    </div>
  );
}