import { useEffect, useState } from "react";
import {
  LogOut,
  MessageSquare,
  Copy,
  Check,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useConfigStore } from "@/store/config";
import { cn } from "@/lib/utils";
import {
  getAutoScrollPreference,
  setAutoScrollPreference,
} from "@/utils/preferences";
import { BrandMark } from "@/components/brand-mark";

interface MoreSettingsProps {
  onLogout: () => void;
}

export function MoreSettings({ onLogout }: MoreSettingsProps) {
  const config = useConfigStore((s) => s.config);
  const updateConfig = useConfigStore((s) => s.updateConfig);
  const [version, setVersion] = useState("");
  const [sponsorOpen, setSponsorOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [autoScroll, setAutoScroll] = useState(getAutoScrollPreference);
  const [dataDir, setDataDir] = useState("");
  const [copiedPath, setCopiedPath] = useState(false);

  useEffect(() => {
    getVersion().then(setVersion);
    invoke<string>("get_data_dir")
      .then(setDataDir)
      .catch(() => setDataDir(""));
  }, []);

  const copyDataDir = async () => {
    if (!dataDir) return;
    await navigator.clipboard.writeText(dataDir);
    setCopiedPath(true);
    setTimeout(() => setCopiedPath(false), 1500);
  };

  const openCommentsWindow = async () => {
    const commentsWindow = await WebviewWindow.getByLabel("comments");
    if (!commentsWindow) return;
    await commentsWindow.show();
    await commentsWindow.setFocus();
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <div>
        <h1 className="text-[19px] font-semibold tracking-tight">设置</h1>
        <p className="mt-0.5 text-[11.5px] text-muted-foreground">
          外观、账号与本机数据
        </p>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-3">
        <section className="flex flex-col rounded-xl border border-border bg-card p-4">
          <h3 className="mb-2.5 text-[12.5px] font-semibold text-foreground/90">
            外观
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <ThemeTile
              active={config.theme === "dark"}
              label="深色"
              variant="dark"
              onClick={() => updateConfig({ theme: "dark" })}
            />
            <ThemeTile
              active={config.theme === "light"}
              label="浅色"
              variant="light"
              onClick={() => updateConfig({ theme: "light" })}
            />
          </div>
          <p className="mt-auto pt-2 text-[10.5px] leading-relaxed text-muted-foreground">
            主题会同时应用到主窗口与弹幕悬浮窗。
          </p>
        </section>

        <section className="flex flex-col rounded-xl border border-border bg-card p-4">
          <h3 className="mb-2.5 text-[12.5px] font-semibold text-foreground/90">
            关于
          </h3>
          <div className="flex items-center gap-2.5">
            <BrandMark className="size-8" />
            <div>
              <div className="text-[12.5px] font-medium">BILI OBS</div>
              <div className="text-[10.5px] text-muted-foreground">
                v{version} · 非官方客户端
              </div>
            </div>
          </div>

          <button
            onClick={() => setSponsorOpen(true)}
            className="mt-2.5 flex items-center gap-2.5 rounded-lg border border-border bg-muted/40 p-1.5 text-left transition-colors hover:bg-muted">
            <img
              src="/sponsor-qr-square.jpg"
              alt=""
              className="size-9 rounded-md bg-white object-cover"
            />
            <span className="min-w-0 flex-1">
              <span className="block text-[11.5px] font-medium text-foreground/90">
                赞助支持
              </span>
              <span className="block text-[10px] text-muted-foreground">
                微信扫码，请作者喝杯咖啡
              </span>
            </span>
            <span className="rounded-md border border-border px-2 py-1 text-[10.5px] text-muted-foreground">
              查看
            </span>
          </button>

          <p className="mt-auto pt-2 text-[10px] leading-relaxed text-muted-foreground">
            非官方客户端，与哔哩哔哩无关联。
          </p>
        </section>

        <section className="flex flex-col rounded-xl border border-border bg-card p-4">
          <h3 className="mb-2.5 text-[12.5px] font-semibold text-foreground/90">
            账号与数据
          </h3>
          <div className="flex items-center gap-2.5">
            <Avatar className="size-8 border border-border">
              <AvatarImage src={config.avatar || "/akarin.webp"} alt="" />
              <AvatarFallback className="bg-primary/20 text-[10px] font-semibold text-primary">
                {(config.username || "user").slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="truncate text-[12.5px] font-medium">
                {config.username || "未登录"}
              </div>
              <div className="text-[10.5px] text-muted-foreground tabular-nums">
                UID {config.uid} · 房间 {config.roomId}
              </div>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2 py-1.5">
            <span className="min-w-0 flex-1 truncate font-mono text-[9.5px] text-muted-foreground">
              {dataDir || "正在读取数据目录…"}
            </span>
            <button
              onClick={() => void copyDataDir()}
              className="shrink-0 text-muted-foreground hover:text-foreground"
              title="复制数据目录">
              <HugeiconsIcon
                icon={copiedPath ? Check : Copy}
                className="size-3.5"
              />
            </button>
          </div>
          <div className="mt-auto flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 rounded-lg text-[11px]"
              onClick={() => setLogoutOpen(true)}>
              切换账号
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="flex-1 rounded-lg text-[11px]"
              onClick={() => setLogoutOpen(true)}>
              <HugeiconsIcon icon={LogOut} className="size-3.5" />
              退出登录
            </Button>
          </div>
        </section>

        <section className="flex flex-col rounded-xl border border-border bg-card p-4">
          <h3 className="mb-2.5 text-[12.5px] font-semibold text-foreground/90">
            弹幕
          </h3>
          <div className="flex items-center gap-3 border-b border-dashed border-border pb-2.5">
            <div className="min-w-0 flex-1">
              <div className="text-[11.5px] font-medium text-foreground/90">
                默认自动滚动
              </div>
              <div className="text-[10px] text-muted-foreground">
                新弹幕到达时定位到列表底部
              </div>
            </div>
            <Switch
              checked={autoScroll}
              onCheckedChange={(checked) => {
                setAutoScroll(checked);
                setAutoScrollPreference(checked);
              }}
            />
          </div>
          <div className="mt-2.5 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[11.5px] font-medium text-foreground/90">
                弹幕悬浮窗
              </div>
              <div className="text-[10px] text-muted-foreground">
                透明度可在悬浮窗内随时调整
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg text-[11px]"
              onClick={() => void openCommentsWindow()}>
              <HugeiconsIcon icon={MessageSquare} className="size-3.5" />
              打开
            </Button>
          </div>
        </section>
      </div>

      <Dialog open={sponsorOpen} onOpenChange={setSponsorOpen}>
        <DialogContent className="gap-4 rounded-2xl p-5 sm:max-w-[356px]">
          <DialogHeader>
            <DialogTitle>支持 BILI OBS</DialogTitle>
            <DialogDescription>
              如果这个工具帮到了你，可以扫码请作者喝杯咖啡。
            </DialogDescription>
          </DialogHeader>
          <div className="mx-auto w-[222px] rounded-xl bg-white p-2">
            <img
              src="/sponsor-qr-square.jpg"
              alt="微信赞助二维码"
              className="block w-full rounded-md"
            />
          </div>
          <div className="text-center text-[12px] font-medium">
            Leon / 凯爷 · 微信
          </div>
          <p className="-mt-2 text-center text-[10px] text-muted-foreground">
            赞助完全自愿，不影响任何功能
          </p>
          <DialogFooter className="flex-row">
            <Button
              className="w-full rounded-lg"
              onClick={() => setSponsorOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>退出登录？</AlertDialogTitle>
            <AlertDialogDescription>
              本机的登录凭据会被清除，需要重新扫码或粘贴 Cookie 才能继续使用。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={onLogout}>退出登录</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

function ThemeTile({
  active,
  label,
  variant,
  onClick,
}: {
  active: boolean;
  label: string;
  variant: "dark" | "light";
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-lg border p-1.5 text-left transition-colors",
        active
          ? "border-primary/50 bg-primary/5 ring-[3px] ring-primary/10"
          : "border-border bg-muted/30 hover:border-border/80",
      )}>
      <span
        className={cn(
          "relative block h-11 overflow-hidden rounded-md border border-border",
          variant === "dark"
            ? "bg-[linear-gradient(135deg,#151519,#232329)]"
            : "bg-[linear-gradient(135deg,#fbfbfc,#ececef)]",
        )}>
        <span className="absolute top-2 left-2 h-1 w-8 rounded-full bg-primary/80" />
        <span
          className={cn(
            "absolute top-[18px] left-2 h-1 w-11 rounded-full",
            variant === "dark" ? "bg-white/20" : "bg-black/15",
          )}
        />
      </span>
      <span
        className={cn(
          "mt-1 block text-[11px]",
          active ? "text-foreground" : "text-muted-foreground",
        )}>
        {label}
      </span>
    </button>
  );
}
