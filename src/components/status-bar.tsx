import { Flame, Users, Check } from "@hugeicons/core-free-icons";
import { useWsStore } from "@/store/ws";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function StatusBar() {
  const [copied, setCopied] = useState(false);
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
      <button
        type="button"
        // 官方加群直达链接需要群主在 QQ 客户端生成的 key；没有 key 时复制群号最可靠。
        // 如果以后拿到 key，把这里换回 openUrl("https://qm.qq.com/cgi-bin/qm/qr?k=<KEY>") 即可一键加群。
        onClick={() => {
          void navigator.clipboard.writeText("26954908");
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        title="点击复制群号 26954908，再到 QQ 中搜索加入"
        className="-my-0.5 inline-flex shrink-0 items-center gap-1.5 rounded-md bg-[#12b7f5] px-2 py-0.5 text-[10.5px] font-bold text-white shadow-sm shadow-[#12b7f5]/40 transition-colors hover:bg-[#0fa6de]">
        <svg viewBox="0 0 24 24" className="size-3.5 shrink-0" fill="currentColor" aria-hidden="true">
          <path d="M12 2C7.58 2 4 5.13 4 9c0 1.74.71 3.33 1.89 4.56-.19.72-.55 1.79-1.11 2.61-.26.38.02.89.47.83 1.07-.14 2.24-.53 3.1-.9A8.6 8.6 0 0 0 12 16c4.42 0 8-3.13 8-7s-3.58-7-8-7zm-3.1 6.2a1.07 1.07 0 1 1 0 2.13 1.07 1.07 0 0 1 0-2.13zm6.2 0a1.07 1.07 0 1 1 0 2.13 1.07 1.07 0 0 1 0-2.13zM8.4 14.6c.9-.55 2.2-.85 3.6-.85s2.7.3 3.6.85c.34.2.3.72-.07.86-.95.38-2.16.54-3.53.54s-2.58-.16-3.53-.54c-.37-.14-.41-.66-.07-.86z"/>
        </svg>
        {copied ? "群号已复制 ✓" : "QQ 群 26954908"}
      </button>
    </footer>
  );
}
