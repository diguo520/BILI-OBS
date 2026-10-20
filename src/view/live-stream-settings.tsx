import { useCallback, useEffect, useMemo, useState } from "react";
import { Play, Square, Copy, Check } from "@hugeicons/core-free-icons";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useConfigStore } from "@/store/config";
import type { Area } from "@/types/config";
import { toast } from "sonner";
import { LoadingButton } from "@/components/loading-button";
import {
  updateRoomAnnouncement,
  updateRoomArea,
  getCoverHistory,
  setHistoryCover,
  updateRoomTitle,
  type CoverHistoryItem,
} from "@/api/live";
import { HugeiconsIcon } from "@hugeicons/react";
import { LiveVerifyDialog } from "@/components/live-verify-dialog";
import { useLiveControl } from "@/hooks/use-live-control";
import { cn } from "@/lib/utils";

export function LiveStreamSettings() {
  const updateConfig = useConfigStore((s) => s.updateConfig);
  const areaList = useConfigStore((s) => s.config.areaList);
  const {
    roomTitle,
    roomAnnouncement,
    categoryId,
    areaId,
    streams,
  } = useConfigStore((s) => s.config);
  const {
    isOpenLive,
    canStartStream,
    start,
    stop,
    qrCodeUrl,
    isQrDialogOpen,
    setIsQrDialogOpen,
  } = useLiveControl();
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [protocol, setProtocol] = useState("rtmp-1");
  const [covers, setCovers] = useState<CoverHistoryItem[]>([]);
  const [coverLoading, setCoverLoading] = useState(false);

  const selectedParent = useMemo(
    () => areaList.find((p) => p.id === categoryId),
    [areaList, categoryId],
  );
  const childAreas: Area[] = useMemo(
    () => selectedParent?.list ?? [],
    [selectedParent],
  );
  const activeStream =
    streams.find((s) => s.type === protocol) ?? streams[0] ?? null;

  const handleCopy = useCallback(async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  }, []);

  const handleUpdateTitle = async () => {
    try {
      await updateRoomTitle(roomTitle);
      toast.success("直播间标题更新成功");
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleUpdateArea = async () => {
    try {
      await updateRoomArea(areaId);
      toast.success("直播间分区更新成功");
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleUpdateAnnouncement = async () => {
    try {
      await updateRoomAnnouncement(roomAnnouncement);
      toast.success("主播公告已更新");
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const loadCovers = useCallback(async () => {
    setCoverLoading(true);
    try {
      const list = await getCoverHistory();
      setCovers(list);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setCoverLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCovers();
  }, [loadCovers]);

  const handleUseCover = async (cover: CoverHistoryItem) => {
    try {
      await setHistoryCover(cover.cover_url);
      toast.success("直播封面已切换");
      await loadCovers();
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-end gap-2.5">
        <div>
          <h1 className="text-[19px] font-semibold tracking-tight">开播设置</h1>
          <p className="mt-0.5 text-[11.5px] text-muted-foreground">
            配置直播间信息与推流方式
          </p>
        </div>
        <span
          className={cn(
            "mb-0.5 inline-flex h-5 items-center gap-1.5 rounded-full border px-2 text-[10.5px]",
            isOpenLive
              ? "border-success/30 bg-success/10 text-success"
              : "border-border bg-card text-muted-foreground",
          )}>
          <span
            className={cn(
              "size-1.5 rounded-full",
              isOpenLive ? "bg-success" : "bg-muted-foreground/60",
            )}
          />
          {isOpenLive ? "直播中" : "未开播"}
        </span>
        <div className="ml-auto flex gap-2">
          {!isOpenLive ? (
            <LoadingButton
              onClickAsync={start}
              disabled={!canStartStream}
              className="h-8 rounded-lg px-3 text-[12px]">
              <HugeiconsIcon icon={Play} className="size-3.5" />
              开始直播
            </LoadingButton>
          ) : (
            <>
              <LoadingButton
                variant="outline"
                disabled
                className="h-8 rounded-lg px-3 text-[12px]">
                <HugeiconsIcon icon={Play} className="size-3.5" />
                直播中
              </LoadingButton>
              <LoadingButton
                variant="destructive"
                onClickAsync={stop}
                className="h-8 rounded-lg px-3 text-[12px]">
                <HugeiconsIcon icon={Square} className="size-3.5" />
                停止直播
              </LoadingButton>
            </>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-3">
        <section className="themed-scrollbar flex flex-[1.25] flex-col gap-3 overflow-y-auto rounded-xl border border-border bg-card p-4">
          <div className="space-y-1.5">
            <Label
              htmlFor="stream-title"
              className="text-[11px] text-muted-foreground">
              直播间标题
            </Label>
            <div className="flex gap-2">
              <Input
                id="stream-title"
                value={roomTitle}
                onChange={(e) => updateConfig({ roomTitle: e.target.value })}
                placeholder="请输入直播标题……"
                maxLength={40}
                className="h-9 flex-1 rounded-lg text-[12.5px]"
              />
              <LoadingButton
                variant="outline"
                onClickAsync={handleUpdateTitle}
                disabled={roomTitle.trim() === ""}
                className="h-9 rounded-lg px-3 text-[12px]">
                更新标题
              </LoadingButton>
            </div>
            <div className="text-right text-[10px] text-muted-foreground/70 tabular-nums">
              {roomTitle.length} / 40
            </div>
          </div>

          <div className="h-px bg-border" />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] text-muted-foreground">
                直播分区
              </Label>
              <LoadingButton
                variant="ghost"
                size="sm"
                disabled={areaId === ""}
                onClickAsync={handleUpdateArea}
                className="h-7 rounded-lg px-2 text-[11px]">
                更新分区
              </LoadingButton>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <Select
                value={categoryId}
                onValueChange={(value) =>
                  updateConfig({ categoryId: value, areaId: "" })
                }>
                <SelectTrigger className="h-9 w-full rounded-lg text-[12.5px]">
                  <SelectValue placeholder="选择分类" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {areaList.map((parent) => (
                      <SelectItem key={parent.id} value={parent.id}>
                        {parent.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Select
                value={areaId}
                onValueChange={(value) => updateConfig({ areaId: value })}
                disabled={categoryId === ""}>
                <SelectTrigger className="h-9 w-full rounded-lg text-[12.5px]">
                  <SelectValue placeholder="选择分区" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {childAreas.map((area) => (
                      <SelectItem key={area.id} value={area.id}>
                        <img
                          src={area.pic}
                          alt=""
                          className="size-5 rounded-sm object-cover"
                        />
                        {area.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] text-muted-foreground">
                主播公告
              </Label>
              <LoadingButton
                variant="ghost"
                size="sm"
                onClickAsync={handleUpdateAnnouncement}
                className="h-7 rounded-lg px-2 text-[11px]">
                保存公告
              </LoadingButton>
            </div>
            <Textarea
              value={roomAnnouncement}
              onChange={(e) =>
                updateConfig({ roomAnnouncement: e.target.value.slice(0, 60) })
              }
              placeholder="说说下次开播的时间和内容吧～"
              rows={2}
              className="min-h-14 resize-none rounded-lg text-[12px]"
            />
            <div className="text-right text-[10px] text-muted-foreground/70 tabular-nums">
              {roomAnnouncement.length} / 60
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] text-muted-foreground">
                直播封面
              </Label>
              <Button
                variant="ghost"
                size="sm"
                disabled={coverLoading}
                onClick={() => void loadCovers()}
                className="h-7 rounded-lg px-2 text-[11px]">
                {coverLoading ? "同步中…" : "同步封面"}
              </Button>
            </div>
            {covers.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {covers.map((cover) => {
                  const active = cover.use_status === 1;
                  return (
                    <div
                      key={cover.cover_url}
                      className={cn(
                        "overflow-hidden rounded-lg border",
                        active ? "border-primary/50" : "border-border",
                      )}>
                      <img
                        src={cover.cover_url}
                        alt="直播封面"
                        className="aspect-video w-full object-cover"
                      />
                      <div className="flex items-center gap-2 bg-muted/30 px-2 py-1.5">
                        <span
                          className={cn(
                            "text-[10px]",
                            active ? "text-primary" : "text-muted-foreground",
                          )}>
                          {active ? (
                            "使用中"
                          ) : (
                            <>
                              评分{" "}
                              <span style={{ color: cover.score_color }}>
                                {Math.floor(cover.score)}
                              </span>
                            </>
                          )}
                        </span>
                        {!active && (
                          <Button
                            size="xs"
                            className="ml-auto h-6 rounded px-2 text-[10px]"
                            onClick={() => void handleUseCover(cover)}>
                            立即使用
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-[10.5px] text-muted-foreground">
                {coverLoading ? "正在同步 B 站封面…" : "暂无历史封面"}
              </div>
            )}
          </div>

          <p className="mt-auto text-[10.5px] leading-relaxed text-muted-foreground">
            修改后会同步到哔哩哔哩直播间。开始直播前请确认标题和分区已填写完整。
          </p>
        </section>

        {isOpenLive ? (
        <section className="flex flex-1 flex-col gap-2.5 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <h3 className="text-[12.5px] font-semibold text-foreground/90">
              推流信息
            </h3>
            {streams.length > 0 && (
              <div className="ml-auto flex gap-1 rounded-md bg-muted p-0.5">
                {streams.map((stream) => (
                  <button
                    key={stream.type}
                    onClick={() => setProtocol(stream.type)}
                    className={cn(
                      "h-5 rounded px-2 text-[10px] transition-colors",
                      activeStream?.type === stream.type
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}>
                    {stream.type.toUpperCase()}
                  </button>
                ))}
              </div>
            )}
          </div>

          {activeStream ? (
            <div className="flex flex-col gap-2.5">
              <div className="space-y-1">
                <div className="text-[10.5px] text-muted-foreground">
                  服务器地址
                </div>
                <div className="flex items-center gap-1.5 rounded-lg bg-muted/50 px-2.5 py-1.5">
                  <code className="min-w-0 flex-1 truncate font-mono text-[10.5px] text-foreground/85">
                    {activeStream.address}
                  </code>
                  <button
                    onClick={() => handleCopy(activeStream.address, "address")}
                    className="text-muted-foreground hover:text-foreground"
                    title="复制地址">
                    <HugeiconsIcon
                      icon={copiedField === "address" ? Check : Copy}
                      className="size-3.5"
                    />
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-[10.5px] text-muted-foreground">
                  串流密钥
                </div>
                <StreamKey
                  value={activeStream.key}
                  copied={copiedField === "key"}
                  onCopy={() => handleCopy(activeStream.key, "key")}
                />
              </div>
              <p className="mt-auto text-[10.5px] leading-relaxed text-muted-foreground">
                OBS → 设置 → 推流 → 服务选择“自定义”
              </p>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
              <p className="text-[12px] text-muted-foreground">
                开始直播后生成推流地址
              </p>
              <p className="max-w-52 text-[10.5px] leading-relaxed text-muted-foreground/70">
                生成后可在本页复制 RTMP / SRT 地址与密钥
              </p>
            </div>
          )}
        </section>
        ) : (
          <section className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card/50 p-4 text-center">
            <p className="text-[12px] text-muted-foreground">
              点击“开始直播”后显示推流信息
            </p>
            <p className="max-w-52 text-[10.5px] leading-relaxed text-muted-foreground/70">
              开播成功后会在这里生成 RTMP / SRT 地址与串流密钥
            </p>
          </section>
        )}
      </div>

      <LiveVerifyDialog
        open={isQrDialogOpen}
        onOpenChange={setIsQrDialogOpen}
        qrCodeUrl={qrCodeUrl}
      />
    </div>
  );
}

function StreamKey({
  value,
  copied,
  onCopy,
}: {
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="flex items-center gap-1.5 rounded-lg bg-muted/50 px-2.5 py-1.5">
      <code className="min-w-0 flex-1 truncate font-mono text-[10.5px] text-foreground/85">
        {revealed ? value : "•".repeat(Math.min(24, value.length || 12))}
      </code>
      <button
        onClick={() => setRevealed((v) => !v)}
        className="text-[10px] text-muted-foreground hover:text-foreground">
        {revealed ? "隐藏" : "显示"}
      </button>
      <button
        onClick={onCopy}
        className="text-muted-foreground hover:text-foreground"
        title="复制密钥">
        <HugeiconsIcon
          icon={copied ? Check : Copy}
          className="size-3.5"
        />
      </button>
    </div>
  );
}
