/**
 * 直播回放：列表 + 下载。
 *
 * 实测要点（详见 直播回放方案.md）：
 *  - 有【两套】来源：① 云端录制 AnchorGetReplayList（主播中心那个页面，每场都有记录，
 *    但可能生成失败）② 空间里已发布的回放稿件（is_live_playback === 1，可取 DASH 下载）。
 *    只读 ② 会漏掉全部云端录制 —— 这是早期实现选错数据源的地方。
 *  - 下载是 DASH 双流（视频/音频分离），需 ffmpeg 合并；
 *  - 单场可达十几 GB，所以下载前必须给出体积预估。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Cancel01Icon,
  CloudDownloadIcon,
  Folder01Icon,
  PlayIcon,
  VideoReplayIcon,
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
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useConfigStore } from "@/store/config";
import {
  fetchCloudDownloadUrl,
  fetchCloudReplays,
  fetchPlayInfo,
  fetchReplayDetail,
  fetchReplayPage,
  type CloudReplay,
  type PlayInfo,
  type ReplayItem,
} from "@/api/replay";
import {
  estimateBytes,
  formatBytes,
  formatDuration,
  formatStamp,
  parseReplayLength,
  qualityName,
  sanitizeFileName,
} from "@/lib/replay-utils";

/** 下载进度（来自 Rust 的 replay-download 事件） */
interface DlProgress {
  task_id: string;
  downloaded: number;
  total: number;
  speed: number;
  done: boolean;
  canceled: boolean;
  error: string | null;
}

type Phase = "video" | "audio" | "merge" | "done" | "error";

/** 一次「下载一场回放」的作业 */
interface DownloadJob {
  bvid: string;
  title: string;
  quality: number;
  phase: Phase;
  video: DlProgress | null;
  audio: DlProgress | null;
  message?: string;
  outPath?: string;
  /** 单文件（云端录制的合并流），无需 ffmpeg 合并 */
  single?: boolean;
}

const MAX_SCAN_PAGES = 20;
/** 空间接口有频控（实测出现过 -799），页间留间隔 */
const PAGE_INTERVAL_MS = 320;

/** 反斜杠常量：避免本文件出现转义字面量，同时统一为 URL 可用的正斜杠 */
const BACKSLASH = String.fromCharCode(92);

function toUrlPath(p: string): string {
  return p.split(BACKSLASH).join("/");
}

/** 目录拼接统一用正斜杠（Windows 同样接受） */
function joinPath(dir: string, name: string): string {
  const base = dir.replace(/[\\/]+$/, "");
  return base + "/" + name;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
export function ReplayView() {
  const config = useConfigStore((s) => s.config);
  const updateConfig = useConfigStore((s) => s.updateConfig);
  const [items, setItems] = useState<ReplayItem[]>([]);
  /** 云端录制：每场直播都有记录，但可能「生成失败」——必须如实展示 */
  const [cloud, setCloud] = useState<CloudReplay[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scannedCount, setScannedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<DownloadJob[]>([]);
  const [dialogItem, setDialogItem] = useState<ReplayItem | null>(null);
  const [playInfo, setPlayInfo] = useState<PlayInfo | null>(null);
  const [quality, setQuality] = useState(80);
  const [ffmpegOk, setFfmpegOk] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveDir, setSaveDir] = useState(config.replaySaveDir || "");
  const canceledRef = useRef<Record<string, boolean>>({});
  /** 任务序号：用自增计数代替 Date.now()（后者在组件体内被判定为不纯调用） */
  const seqRef = useRef(0);

  /**
   * 扫描全部稿件页，筛出回放。
   * 回放混在普通稿件里（你的账号 135 个稿件里只有 11 条），所以必须翻页。
   */
  const load = useCallback(async () => {
    // 让出一次微任务：首次由 effect 触发时，避免在 effect 同步阶段 setState
    // （否则触发 oxlint 的 set-state-in-effect，且会多一次同步渲染）
    await Promise.resolve();
    if (!config.uid || !config.img_url || !config.sub_url) {
      setError("请先登录（列表需要 wbi 密钥与登录态）");
      return;
    }
    setScanning(true);
    setError(null);
    setScannedCount(0);
    const found: ReplayItem[] = [];
    let arcCount = 0;
    try {
      // ① 云端录制（主播中心那套，必读）
      const cloudPages: CloudReplay[] = [];
      for (let cp = 1; cp <= 5; cp++) {
        const pageList = await fetchCloudReplays(cp, 50);
        cloudPages.push(...pageList);
        if (pageList.length < 50) break;
        await sleep(PAGE_INTERVAL_MS);
      }
      setCloud(cloudPages.sort((a, b) => b.liveTime - a.liveTime));
      for (let pn = 1; pn <= MAX_SCAN_PAGES; pn++) {
        const page = await fetchReplayPage(
          config.uid,
          config.img_url,
          config.sub_url,
          pn,
        );
        arcCount = page.count || arcCount;
        found.push(...page.list);
        setItems([...found].sort((a, b) => b.created - a.created));
        setScannedCount(Math.min(pn * 50, arcCount));
        if (pn * 50 >= arcCount) break;
        await sleep(PAGE_INTERVAL_MS);
      }
      if (!found.length && !cloudPages.length) {
        setError("没有找到任何回放记录（云端录制为空，且空间里没有已发布的回放稿件）");
      }
    } catch (e) {
      setError((e as Error).message || "加载失败");
    } finally {
      setScanning(false);
    }
  }, [config.uid, config.img_url, config.sub_url]);

  useEffect(() => {
    // 用 0ms 定时器触发而不是在 effect 体内直接调用：
    // load() 会 setState，直接调用会让 oxlint 报 set-state-in-effect（级联渲染）。
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  /** 订阅 Rust 侧的下载进度事件 */
  useEffect(() => {
    const un = listen<DlProgress>("replay-download", (ev) => {
      const p = ev.payload;
      setJobs((prev) =>
        prev.map((j) => {
          if (j.video?.task_id === p.task_id) return { ...j, video: p };
          if (j.audio?.task_id === p.task_id) return { ...j, audio: p };
          return j;
        }),
      );
    });
    return () => {
      un.then((f) => f());
    };
  }, []);

  /** 打开下载对话框：取 cid → 取播放地址 → 列各清晰度与体积 */
  const openDialog = async (item: ReplayItem) => {
    setDialogItem(item);
    setPlayInfo(null);
    setBusy(true);
    try {
      const detail = await fetchReplayDetail(item.bvid);
      const info = await fetchPlayInfo(
        item.bvid,
        detail.cid,
        config.img_url,
        config.sub_url,
        80,
      );
      setPlayInfo(info);
      setQuality(info.video[0]?.id ?? 80);
      const ok = await invoke<boolean>("replay_ffmpeg_available");
      setFfmpegOk(ok);
    } catch (e) {
      toast.error("取播放地址失败：" + (e as Error).message);
      setDialogItem(null);
    } finally {
      setBusy(false);
    }
  };

  const estimate = useMemo(() => {
    if (!dialogItem || !playInfo) return 0;
    const stream = playInfo.video.find((v) => v.id === quality);
    const seconds = playInfo.duration || parseReplayLength(dialogItem.length);
    const vBytes = estimateBytes(stream?.bandwidth ?? 0, seconds);
    const aBytes = estimateBytes(playInfo.audio[0]?.bandwidth ?? 0, seconds);
    return vBytes + aBytes;
  }, [dialogItem, playInfo, quality]);

  const startDownload = async () => {
    if (!dialogItem || !playInfo) return;
    const item = dialogItem;
    const stream =
      playInfo.video.find((v) => v.id === quality) ?? playInfo.video[0];
    const audio = playInfo.audio[0];
    if (!stream || !audio) {
      toast.error("没有可用的视频流");
      return;
    }
    const base = (saveDir || config.replaySaveDir || "").trim();
    if (!base) {
      toast.error("请先填写保存目录");
      return;
    }
    updateConfig({ replaySaveDir: base });
    const stem =
      formatStamp(item.created) +
      "_" +
      sanitizeFileName(item.title) +
      "_" +
      qualityName(quality);
    const vPath = joinPath(base, stem + ".video.m4s");
    const aPath = joinPath(base, stem + ".audio.m4s");
    const outPath = joinPath(base, stem + ".mp4");
    setDialogItem(null);
    setJobs((prev) => [
      {
        bvid: item.bvid,
        title: item.title,
        quality,
        phase: "video" as Phase,
        video: null,
        audio: null,
      },
      ...prev,
    ]);
    const vTask = "v-" + item.bvid + "-" + ++seqRef.current;
    const aTask = "a-" + item.bvid + "-" + ++seqRef.current;
    const patch = (fn: (j: DownloadJob) => DownloadJob) =>
      setJobs((prev) =>
        prev.map((j) => (j.bvid === item.bvid ? fn(j) : j)),
      );
    patch((j) => ({
      ...j,
      video: {
        task_id: vTask,
        downloaded: 0,
        total: 0,
        speed: 0,
        done: false,
        canceled: false,
        error: null,
      },
      audio: {
        task_id: aTask,
        downloaded: 0,
        total: 0,
        speed: 0,
        done: false,
        canceled: false,
        error: null,
      },
    }));
    const run = (
      task: string,
      url: string,
      backups: string[],
      dest: string,
      role: string,
    ) =>
      invoke<number>("replay_download", {
        taskId: task,
        urls: [url, ...backups],
        dest,
        referer: "https://www.bilibili.com/",
      }).catch((e) => {
        if (canceledRef.current[item.bvid]) throw new Error("已取消");
        throw new Error(role + "下载失败：" + String(e));
      });
    try {
      await Promise.all([
        run(vTask, stream.baseUrl, stream.backupUrl ?? [], vPath, "视频流"),
        run(aTask, audio.baseUrl, audio.backupUrl ?? [], aPath, "音频流"),
      ]);
      patch((j) => ({ ...j, phase: "merge" }));
      if (ffmpegOk) {
        await invoke<string>("replay_merge", {
          video: vPath,
          audio: aPath,
          out: outPath,
        });
        patch((j) => ({ ...j, phase: "done", outPath, message: undefined }));
        // 合并成功后删除两条中间流，避免多占一份空间
        void invoke<number>("replay_cleanup", { paths: [vPath, aPath] }).catch(() => {
          // 删除失败不影响结果：合并产物已经存在
        });
        toast.success("已下载并合并：" + stem + ".mp4");
      } else {
        patch((j) => ({
          ...j,
          phase: "done",
          outPath: vPath,
          message: "未检测到 ffmpeg，已保留视频/音频两条原始流，需自行合并",
        }));
        toast.message("已下载两条流（未合并）", {
          description: "安装 ffmpeg 后可自动合并为 mp4",
        });
      }
    } catch (e) {
      const msg = (e as Error).message || String(e);
      patch((j) => ({ ...j, phase: "error", message: msg }));
      toast.error(msg);
    }
  };

  /** 下载云端录制：B 站官方合并流，单文件直下（不需要 ffmpeg） */
  const downloadCloud = async (item: CloudReplay) => {
    if (!item.replayId) return;
    const base = (saveDir || config.replaySaveDir || "").trim();
    if (!base) {
      toast.error("请先填写保存目录");
      return;
    }
    updateConfig({ replaySaveDir: base });
    const stem =
      formatStamp(item.liveTime) +
      "_" +
      sanitizeFileName(item.title) +
      "_云端录制";
    const outPath = joinPath(base, stem + ".mp4");
    const key = "cloud-" + item.replayId;
    const task = "c-" + item.replayId + "-" + ++seqRef.current;
    setJobs((prev) => [
      {
        bvid: key,
        title: item.title,
        quality: 0,
        phase: "video" as Phase,
        video: {
          task_id: task,
          downloaded: 0,
          total: 0,
          speed: 0,
          done: false,
          canceled: false,
          error: null,
        },
        audio: null,
        single: true,
      },
      ...prev,
    ]);
    const patchJob = (fn: (j: DownloadJob) => DownloadJob) =>
      setJobs((prev) => prev.map((j) => (j.bvid === key ? fn(j) : j)));
    try {
      // B 站侧生成失败时这一步就会抛错，如实告知用户
      const url = await fetchCloudDownloadUrl(item.replayId);
      await invoke<number>("replay_download", {
        taskId: task,
        urls: [url],
        dest: outPath,
        referer: "https://link.bilibili.com/",
      });
      patchJob((j) => ({ ...j, phase: "done", outPath }));
      toast.success("已下载：" + stem + ".mp4");
    } catch (e) {
      const msg = (e as Error).message || String(e);
      patchJob((j) => ({ ...j, phase: "error", message: msg }));
      toast.error("该录像无法下载：" + msg);
    }
  };

  const totalSeconds = useMemo(
    () => items.reduce((acc, it) => acc + parseReplayLength(it.length), 0),
    [items],
  );

  /** 取消某场回放的下载（视频、音频两条流一起标记） */
  const cancelJob = (j: DownloadJob) => {
    canceledRef.current[j.bvid] = true;
    if (j.video) void invoke("replay_download_cancel", { taskId: j.video.task_id });
    if (j.audio) void invoke("replay_download_cancel", { taskId: j.audio.task_id });
    setJobs((prev) =>
      prev.map((x) =>
        x.bvid === j.bvid ? { ...x, phase: "error", message: "已取消" } : x,
      ),
    );
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-end gap-2.5">
        <div>
          <h1 className="flex items-center gap-2 text-[26px] leading-none font-semibold tracking-tight">
            <HugeiconsIcon icon={VideoReplayIcon} className="size-5 text-primary" />
            直播回放
          </h1>
          <p className="mt-1.5 text-[12px] text-muted-foreground">
            {cloud.length || items.length
              ? "云端录制 " +
                cloud.length +
                " 场 · 已发布回放 " +
                items.length +
                " 场" +
                (items.length ? " · 累计 " + formatDuration(totalSeconds) : "")
              : scanning
                ? "正在扫描…"
                : "暂无回放"}
            {scanning && items.length ? " · 已扫描 " + scannedCount + " 个稿件" : ""}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 rounded-lg text-[11px]"
            disabled={scanning}
            onClick={() => void load()}>
            {scanning ? <Spinner /> : null}
            重新扫描
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-[12px] text-amber-400">
          {error}
        </div>
      )}

      {jobs.length > 0 && (
        <Card className="shrink-0 gap-2 p-3">
          <div className="text-[11px] tracking-[0.12em] text-muted-foreground">
            下载任务
          </div>
          <div className="themed-scrollbar flex max-h-[168px] flex-col gap-2 overflow-y-auto">
            {jobs.map((j) => {
              const gotBytes = (j.video?.downloaded ?? 0) + (j.audio?.downloaded ?? 0);
              const allBytes = (j.video?.total ?? 0) + (j.audio?.total ?? 0);
              const pct = allBytes
                ? Math.min(100, Math.round((gotBytes / allBytes) * 100))
                : 0;
              const speed = (j.video?.speed ?? 0) + (j.audio?.speed ?? 0);
              const running =
                j.phase !== "done" && j.phase !== "error";
              return (
                <div
                  key={j.bvid}
                  className="rounded-md border border-border/60 px-2.5 py-2">
                  <div className="flex items-center gap-2 text-[11.5px]">
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {j.title}
                    </span>
                    <Badge
                      variant="outline"
                      className="border-0 bg-muted px-1.5 text-[10px] font-normal">
                      {j.single ? "合并流" : qualityName(j.quality)}
                    </Badge>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {j.phase === "error"
                        ? "失败"
                        : j.phase === "done"
                          ? "完成"
                          : j.phase === "merge"
                            ? "合并中"
                            : pct + "%"}
                    </span>
                  </div>
                  {running && (
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-primary transition-[width]"
                        style={{ width: pct + "%" }}
                      />
                    </div>
                  )}
                  <div className="mt-1 flex items-center gap-2 text-[10.5px] text-muted-foreground">
                    <span className="shrink-0 tabular-nums">
                      {formatBytes(gotBytes)}
                      {allBytes ? " / " + formatBytes(allBytes) : ""}
                    </span>
                    {speed > 0 && running && (
                      <span className="shrink-0 tabular-nums">
                        {formatBytes(speed)}/s
                      </span>
                    )}
                    {j.message && (
                      <span className="min-w-0 flex-1 truncate text-amber-400">
                        {j.message}
                      </span>
                    )}
                    <div className="ml-auto flex shrink-0 items-center gap-1">
                      {j.phase === "done" && j.outPath && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-1.5 text-[10.5px]"
                          onClick={() =>
                            void openUrl("file:///" + toUrlPath(j.outPath!)).catch(
                              () => toast.error("无法打开文件"),
                            )
                          }>
                          <HugeiconsIcon icon={Folder01Icon} className="size-3" />
                          打开
                        </Button>
                      )}
                      {running && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-1.5 text-[10.5px]"
                          onClick={() => cancelJob(j)}>
                          <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
                          取消
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <div className="themed-scrollbar flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
        {cloud.length > 0 && (
          <div className="flex shrink-0 items-center gap-2 pt-0.5 text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground/80">云端录制</span>
            <span>{cloud.length} 场 · 每场直播都有记录，生成失败的无法播放或下载</span>
          </div>
        )}
        {cloud.map((it) => {
          const failed = Boolean(it.alarmMessage);
          return (
            <div
              key={"cloud-" + it.replayId}
              className="flex gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/30">
              <div className="relative h-[68px] w-[120px] shrink-0 overflow-hidden rounded-lg bg-muted">
                {it.cover ? (
                  <img
                    src={it.cover.replace(/^http:/, "https:")}
                    alt=""
                    loading="lazy"
                    className="size-full object-cover"
                  />
                ) : null}
                <span className="absolute right-1 bottom-1 rounded bg-black/70 px-1 text-[10px] tabular-nums text-white">
                  {formatDuration(it.duration)}
                </span>
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium" title={it.title}>
                    {it.title}
                  </span>
                  {failed ? (
                    <Badge className="shrink-0 border-0 bg-destructive/15 text-[10px] font-normal text-destructive">
                      {it.alarmMessage}
                    </Badge>
                  ) : (
                    <Badge className="shrink-0 border-0 bg-success/15 text-[10px] font-normal text-success">
                      可下载
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2.5 text-[11px] text-muted-foreground">
                  <span>
                    {new Date(it.liveTime * 1000).toLocaleString("zh-CN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                  {it.alertMessage ? (
                    <span className="min-w-0 truncate text-amber-400" title={it.alertMessage}>
                      ⚠ {it.alertMessage}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button
                  size="sm"
                  variant={failed ? "outline" : "default"}
                  className="h-7 rounded-lg text-[11px]"
                  disabled={failed}
                  title={
                    failed
                      ? "B 站尚未成功生成该录像，暂时无法下载"
                      : "从 B 站下载这场录像"
                  }
                  onClick={() => void downloadCloud(it)}>
                  <HugeiconsIcon icon={CloudDownloadIcon} className="size-3.5" />
                  {failed ? "不可下载" : "下载"}
                </Button>
              </div>
            </div>
          );
        })}
        {items.length > 0 && (
          <div className="flex shrink-0 items-center gap-2 pt-1.5 text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground/80">已发布回放</span>
            <span>{items.length} 场 · 已发布成稿件的回放，可选清晰度下载</span>
          </div>
        )}
        {items.map((it) => {
          const seconds = parseReplayLength(it.length);
          return (
            <div
              key={it.bvid}
              className="flex gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/30">
              <div className="relative h-[68px] w-[120px] shrink-0 overflow-hidden rounded-lg bg-muted">
                <img
                  src={it.pic.replace(/^http:/, "https:")}
                  alt=""
                  loading="lazy"
                  className="size-full object-cover"
                />
                <span className="absolute right-1 bottom-1 rounded bg-black/70 px-1 text-[10px] tabular-nums text-white">
                  {formatDuration(seconds)}
                </span>
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
                <div className="min-w-0 truncate text-[13px] font-medium" title={it.title}>
                  {it.title}
                </div>
                <div className="flex flex-wrap items-center gap-2.5 text-[11px] text-muted-foreground">
                  <span>
                    {new Date(it.created * 1000).toLocaleString("zh-CN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                  <span className="tabular-nums">{it.play} 播放</span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 rounded-lg text-[11px]"
                  onClick={() =>
                    void openUrl("https://www.bilibili.com/video/" + it.bvid)
                  }>
                  <HugeiconsIcon icon={PlayIcon} className="size-3.5" />
                  播放
                </Button>
                <Button
                  size="sm"
                  className="h-7 rounded-lg text-[11px]"
                  onClick={() => void openDialog(it)}>
                  <HugeiconsIcon icon={CloudDownloadIcon} className="size-3.5" />
                  下载
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog
        open={!!dialogItem}
        onOpenChange={(v) => {
          if (!v) setDialogItem(null);
        }}>
        <DialogContent className="max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="text-[15px]">下载直播回放</DialogTitle>
            <DialogDescription className="text-[11.5px]">
              {dialogItem?.title}
            </DialogDescription>
          </DialogHeader>
          {busy ? (
            <div className="flex items-center gap-2 py-6 text-[12px] text-muted-foreground">
              <Spinner /> 正在获取清晰度列表…
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <div className="text-[11px] text-muted-foreground">清晰度</div>
                <div className="flex flex-wrap gap-1.5">
                  {(playInfo?.video ?? []).map((v) => {
                    const secs =
                      playInfo?.duration ||
                      parseReplayLength(dialogItem?.length ?? "0");
                    const size =
                      estimateBytes(v.bandwidth, secs) +
                      estimateBytes(playInfo?.audio[0]?.bandwidth ?? 0, secs);
                    const active = quality === v.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setQuality(v.id)}
                        className={
                          "rounded-lg border px-2.5 py-1.5 text-left text-[11px] transition-colors " +
                          (active
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:border-primary/40")
                        }>
                        <div className="font-semibold">{qualityName(v.id)}</div>
                        <div className="text-[10px] tabular-nums text-muted-foreground">
                          {v.width && v.height
                            ? v.width + "x" + v.height + " · "
                            : ""}
                          {formatBytes(size)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="text-[11px] text-muted-foreground">保存目录</div>
                <Input
                  value={saveDir}
                  onChange={(e) => setSaveDir(e.target.value)}
                  placeholder="D:/回放（下载会存到这里）"
                  className="h-8 text-[11.5px]"
                />
              </div>
              <div className="flex flex-col gap-1 rounded-lg border border-border bg-muted/40 px-2.5 py-2 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">预计体积</span>
                  <b className="tabular-nums">{formatBytes(estimate)}</b>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">时长</span>
                  <span className="tabular-nums">
                    {formatDuration(
                      playInfo?.duration ||
                        parseReplayLength(dialogItem?.length ?? "0"),
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ffmpeg（合并必需）</span>
                  <span
                    className={ffmpegOk ? "text-success" : "text-warning"}>
                    {ffmpegOk === null
                      ? "检测中…"
                      : ffmpegOk
                        ? "已就绪"
                        : "未检测到（将保留两条流）"}
                  </span>
                </div>
              </div>
              {estimate > 2 * 1024 * 1024 * 1024 && (
                <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-2.5 py-2 text-[11px] text-amber-400">
                  体积较大（{formatBytes(estimate)}），请确认磁盘空间充足。支持断点续传，中断后可再次点击下载继续。
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 rounded-lg text-[11px]"
              onClick={() => setDialogItem(null)}>
              取消
            </Button>
            <Button
              size="sm"
              className="h-7 rounded-lg text-[11px]"
              disabled={busy || !playInfo}
              onClick={() => void startDownload()}>
              <HugeiconsIcon icon={CloudDownloadIcon} className="size-3.5" />
              开始下载
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
