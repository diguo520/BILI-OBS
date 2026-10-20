import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { LiveRoomManagerMuteUser } from "@/view/manager/live-room-manager-mute-user";
import { LiveRoomManagerMuteGlobal } from "@/view/manager/live-room-manager-mute-global";

export function LiveRoomManagerMute() {
  const [muteTab, setMuteTab] = useState<"list" | "global">("list");
  return (
    <Tabs
      value={muteTab}
      onValueChange={(v) => setMuteTab(v as "list" | "global")}
      className="flex min-h-0 flex-1 flex-col">
      <TabsList className="h-7 w-fit shrink-0 rounded-lg border border-border bg-muted/40 p-[3px]">
        <TabsTrigger value="list" className="h-5 rounded-md px-3 text-[11px]">
          禁言名单
        </TabsTrigger>
        <TabsTrigger
          value="global"
          className="h-5 rounded-md px-3 text-[11px]">
          全局禁言
        </TabsTrigger>
      </TabsList>
      <TabsContent
        value="list"
        className="mt-2 flex min-h-0 flex-1 flex-col gap-3 data-[state=inactive]:hidden">
        <LiveRoomManagerMuteUser />
      </TabsContent>
      <TabsContent
        value="global"
        className="mt-2 min-h-0 flex-1 overflow-y-auto data-[state=inactive]:hidden">
        <LiveRoomManagerMuteGlobal />
      </TabsContent>
    </Tabs>
  );
}
