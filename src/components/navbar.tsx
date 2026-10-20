import {
  Minus,
  X,
  Minimize,
  Maximize,
  Message,
  Pin,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { getVersion } from "@tauri-apps/api/app";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { useConfigStore } from "@/store/config";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/brand-mark";

export function Navbar() {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [version, setVersion] = useState("");
  const isOpenLive = useConfigStore((s) => s.config.isOpenLive);

  useEffect(() => {
    getVersion().then(setVersion);

    const unlisten = getCurrentWindow().onResized(async () => {
      setIsMaximized(await getCurrentWindow().isMaximized());
    });

    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  const handleMaximizeToggle = async () => {
    if (isMaximized) {
      await getCurrentWindow().unmaximize();
    } else {
      await getCurrentWindow().maximize();
    }
    setIsMaximized(!isMaximized);
  };

  const handlePinToggle = async () => {
    const next = !isPinned;
    await getCurrentWindow().setAlwaysOnTop(next);
    setIsPinned(next);
  };

  const handleShowComments = async () => {
    const commentsWindow = await WebviewWindow.getByLabel("comments");
    if (!commentsWindow) return;
    await commentsWindow.show();
    await commentsWindow.setFocus();
  };

  return (
    <header
      data-tauri-drag-region
      className="flex h-12 shrink-0 items-center gap-2.5 border-b border-border bg-sidebar/90 px-3.5">
      <div className="flex items-center gap-2">
        <BrandMark className="size-6 rounded-lg" />
        <h1 className="text-[13.5px] font-semibold text-foreground">
          BILI OBS
        </h1>
        <span className="rounded-full border border-border px-1.5 py-px text-[10px] tracking-tight text-muted-foreground tabular-nums">
          v{version}
        </span>
      </div>

      <span className="mx-0.5 h-4 w-px bg-border" />

      <span
        className={cn(
          "inline-flex h-[22px] items-center gap-1.5 rounded-full border px-2.5 text-[11px]",
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

      <div className="ml-auto flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon-sm"
          title="弹幕悬浮窗"
          aria-label="弹幕悬浮窗"
          onClick={() => void handleShowComments()}>
          <HugeiconsIcon icon={Message} />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title={isPinned ? "取消置顶" : "窗口置顶"}
          aria-label={isPinned ? "取消置顶" : "窗口置顶"}
          className={cn(isPinned && "text-primary")}
          onClick={() => void handlePinToggle()}>
          <HugeiconsIcon icon={Pin} />
        </Button>
        <span className="mx-1 h-4 w-px bg-border" />
        <Button
          variant="ghost"
          size="icon-sm"
          title="最小化"
          aria-label="最小化"
          onClick={() => getCurrentWindow().minimize()}>
          <HugeiconsIcon icon={Minus} />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title={isMaximized ? "还原" : "最大化"}
          aria-label={isMaximized ? "还原" : "最大化"}
          onClick={handleMaximizeToggle}>
          {isMaximized ? (
            <HugeiconsIcon icon={Minimize} />
          ) : (
            <HugeiconsIcon icon={Maximize} />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title="关闭"
          aria-label="关闭"
          className="hover:bg-destructive hover:text-white"
          onClick={() => getCurrentWindow().close()}>
          <HugeiconsIcon icon={X} />
        </Button>
      </div>
    </header>
  );
}
