import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  getLiveVersion,
  startLive,
  stopLive,
  updateRoomTitle,
} from "@/api/live";
import { useConfigStore } from "@/store/config";
import type { Stream } from "@/types/config";

/**
 * 开播 / 停播的共用逻辑：
 * 向哔哩哔哩申请推流地址并开播，推流信息在开播设置中展示。
 */
export function useLiveControl() {
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [isQrDialogOpen, setIsQrDialogOpen] = useState(false);
  const updateConfig = useConfigStore((s) => s.updateConfig);
  const uid = useConfigStore((s) => s.config.uid);
  const { roomTitle, categoryId, areaId, isOpenLive } = useConfigStore(
    (s) => s.config,
  );

  const canStartStream = useMemo(
    () =>
      !isOpenLive &&
      roomTitle.trim() !== "" &&
      categoryId !== "" &&
      areaId !== "",
    [isOpenLive, roomTitle, categoryId, areaId],
  );

  const start = useCallback(async () => {
    if (!canStartStream) {
      toast.error("请先在开播设置中填写标题并选择分区");
      return;
    }

    try {
      await updateRoomTitle(roomTitle);

      const version = await getLiveVersion();
      const result = await startLive(version.curr_version, String(version.build));

      switch (result.code) {
        case 60024:
          setQrCodeUrl(result.data.qr);
          setIsQrDialogOpen(true);
          return;
        case 60043:
          setQrCodeUrl(
            `https://www.bilibili.com/blackboard/live/face-auth-middle.html?source_event=400&mid=${uid}`,
          );
          setIsQrDialogOpen(true);
          return;
        case 0: {
          let rtmp = 1;
          let srt = 0;
          const streams: Stream[] = [
            {
              type: "rtmp-1",
              address: result.data.rtmp.addr,
              key: result.data.rtmp.code,
            },
          ];
          result.data.protocols.forEach((item) => {
            if (item.protocol === "rtmp" && item.addr && item.code) {
              rtmp++;
              streams.push({
                type: `rtmp-${rtmp}`,
                address: item.addr,
                key: item.code,
              });
            }
            if (item.protocol === "srt" && item.addr && item.code) {
              srt++;
              streams.push({
                type: `srt-${srt}`,
                address: item.addr,
                key: item.code,
              });
            }
          });
          streams.sort((a, b) => a.type.localeCompare(b.type));

          updateConfig({
            streams,
            isOpenLive: true,
            liveStartedAt: Date.now(),
          });
          toast.success("直播已开始");
          return;
        }
        default:
          throw new Error("开始直播失败：" + result.message);
      }
    } catch (error) {
      console.error("Start Live:", error);
      toast.error((error as Error).message);
    }
  }, [
    canStartStream,
    roomTitle,
    uid,
    updateConfig,
  ]);

  const stop = useCallback(async () => {
    try {
      await stopLive();
      updateConfig({ isOpenLive: false, liveStartedAt: null });
      toast.success("直播已停止");
    } catch (error) {
      toast.error((error as Error).message);
    }
  }, [updateConfig]);

  return {
    isOpenLive,
    canStartStream,
    start,
    stop,
    qrCodeUrl,
    isQrDialogOpen,
    setIsQrDialogOpen,
  };
}
