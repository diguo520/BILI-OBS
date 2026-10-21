import {
  User,
  Radio,
  Shield,
  MessageSquare,
  Settings,
  ChartHistogramIcon,
  Megaphone01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useConfigStore } from "@/store/config";
import { useWsStore } from "@/store/ws";

type TabType =
  | "overview"
  | "stream"
  | "manager"
  | "comments"
  | "data"
  | "tts"
  | "settings";

const tabs = [
  { id: "overview" as const, label: "概览", icon: User },
  { id: "stream" as const, label: "开播设置", icon: Radio },
  { id: "manager" as const, label: "房间管理", icon: Shield },
  { id: "comments" as const, label: "弹幕", icon: MessageSquare },
  { id: "tts" as const, label: "语音播报设置", icon: Megaphone01Icon },
  { id: "data" as const, label: "数据中心", icon: ChartHistogramIcon },
];

interface AppSidebarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  onLogout: () => void;
}

export function AppSidebar({ activeTab, onTabChange }: AppSidebarProps) {
  const username = useConfigStore((s) => s.config.username);
  const avatar = useConfigStore((s) => s.config.avatar);
  const messageCount = useWsStore((s) => s.regularMessages.length);

  return (
    <aside className="flex h-full w-16 shrink-0 flex-col items-center border-r border-border bg-sidebar py-2.5">
      <nav className="flex flex-1 flex-col items-center gap-1">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <Button
              key={tab.id}
              variant="ghost"
              title={tab.label}
              aria-label={tab.label}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "relative size-9 rounded-lg p-0",
                active
                  ? "bg-primary/10 text-primary hover:bg-primary/15"
                  : "text-muted-foreground hover:bg-card hover:text-foreground",
              )}>
              <HugeiconsIcon icon={tab.icon} className="size-4.5" />
              {tab.id === "comments" && messageCount > 0 && (
                <span className="absolute top-1 right-1 size-1.5 rounded-full bg-primary" />
              )}
            </Button>
          );
        })}
      </nav>

      <div className="my-1 h-px w-7 bg-border" />

      <Button
        variant="ghost"
        title="设置"
        aria-label="设置"
        onClick={() => onTabChange("settings")}
        className={cn(
          "size-9 rounded-lg p-0",
          activeTab === "settings"
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-card hover:text-foreground",
        )}>
        <HugeiconsIcon icon={Settings} className="size-4.5" />
      </Button>

      <Avatar className="mt-2 size-8 border border-border" title={username || "未登录"}>
        <AvatarImage src={avatar || "/akarin.webp"} alt={username || "user"} />
        <AvatarFallback className="bg-primary/20 text-[10px] font-semibold text-primary">
          {(username || "user").slice(0, 1).toUpperCase()}
        </AvatarFallback>
      </Avatar>
    </aside>
  );
}

export type { TabType };
