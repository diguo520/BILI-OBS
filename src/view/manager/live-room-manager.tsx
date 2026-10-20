import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserX, CommentBlockIcon, Crown } from "@hugeicons/core-free-icons";
import { LiveRoomManagerAdmins } from "@/view/manager/live-room-manager-admins";
import { LiveRoomManagerMute } from "@/view/manager/live-room-manager-mute";
import { LiveRoomManagerBlockedWords } from "@/view/manager/live-room-manager-blocked-words";
import { HugeiconsIcon } from "@hugeicons/react";
import { useConfigStore } from "@/store/config";

export function LiveRoomManager() {
  const [activeSection, setActiveSection] = useState<
    "admin" | "mute" | "blocked"
  >("admin");
  const roomId = useConfigStore((s) => s.config.roomId);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex items-end gap-2.5">
        <div>
          <h1 className="text-[19px] font-semibold tracking-tight">
            房间管理
          </h1>
          <p className="mt-0.5 text-[11.5px] text-muted-foreground">
            房管、禁言与屏蔽词设置
          </p>
        </div>
        <span className="mb-0.5 ml-auto rounded-full border border-border bg-card px-2.5 py-0.5 text-[10.5px] text-muted-foreground tabular-nums">
          房间 {roomId}
        </span>
      </div>

      <Tabs
        value={activeSection}
        onValueChange={(v) => setActiveSection(v as typeof activeSection)}
        className="flex min-h-0 flex-1 flex-col">
        <TabsList className="h-8 w-fit shrink-0 gap-1 rounded-lg border border-border bg-card p-[3px]">
          <TabsTrigger
            value="admin"
            className="h-6 rounded-md px-3 text-[11.5px]">
            <HugeiconsIcon icon={Crown} className="size-3.5" />
            房管
          </TabsTrigger>
          <TabsTrigger
            value="mute"
            className="h-6 rounded-md px-3 text-[11.5px]">
            <HugeiconsIcon icon={UserX} className="size-3.5" />
            禁言
          </TabsTrigger>
          <TabsTrigger
            value="blocked"
            className="h-6 rounded-md px-3 text-[11.5px]">
            <HugeiconsIcon icon={CommentBlockIcon} className="size-3.5" />
            屏蔽词
          </TabsTrigger>
        </TabsList>

        <div className="mt-3 min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-card p-4">
          <TabsContent
            value="admin"
            className="m-0 flex h-full flex-col gap-3 data-[state=inactive]:hidden">
            <LiveRoomManagerAdmins />
          </TabsContent>
          <TabsContent
            value="mute"
            className="m-0 flex h-full flex-col gap-3 data-[state=inactive]:hidden">
            <LiveRoomManagerMute />
          </TabsContent>
          <TabsContent
            value="blocked"
            className="m-0 flex h-full flex-col gap-3 data-[state=inactive]:hidden">
            <LiveRoomManagerBlockedWords />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
