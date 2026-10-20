import { Flame, Users, Check } from "@hugeicons/core-free-icons";
import { useWsStore } from "@/store/ws";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@/lib/utils";

export function StatusBar() {
  const { onlineCount, watchedUser, connected } = useWsStore((s) => s);

  const formatNumber = (num: number) => {
    if (num >= 10000) return (num / 10000).toFixed(1) + "w";
    if (num >= 1000) return (num / 1000).toFixed(1) + "k";
    return num.toString();
  };

  return (
    <footer className="flex h-[26px] shrink-0 items-center gap-3.5 border-t border-border bg-sidebar px-3.5 text-[10.5px] text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <HugeiconsIcon icon={Flame} className="size-3 text-warning" />
        已观看 <b className="font-semibold text-foreground/90">{formatNumber(watchedUser)}</b>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <HugeiconsIcon icon={Users} className="size-3" />
        在线 <b className="font-semibold text-foreground/90">{formatNumber(onlineCount || 0)}</b>
      </span>
      <span
        className={cn(
          "inline-flex items-center gap-1.5",
          connected ? "text-success" : "text-muted-foreground",
        )}>
        <span
          className={cn(
            "size-1.5 rounded-full",
            connected ? "bg-success" : "bg-muted-foreground/50",
          )}
        />
        {connected ? "弹幕已连接" : "弹幕未连接"}
      </span>
      <span className="ml-auto inline-flex items-center gap-1.5 text-muted-foreground/70">
        <HugeiconsIcon icon={Check} className="size-3" />
        数据每 5 秒刷新
      </span>
    </footer>
  );
}
