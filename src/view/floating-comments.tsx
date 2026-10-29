import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  Award,
  Medal,
  Message,
  Send,
  Sparkles,
  Settings,
  TransparencyIcon,
  Trophy,
  Users,
  VerticalScrollPointIcon,
  X,
  MousePointerOffIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { PhysicalPosition, PhysicalSize } from "@tauri-apps/api/dpi";
import { emit } from "@tauri-apps/api/event";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/spinner";
import { getContributionRank, sendComment } from "@/api/live";
import { cn } from "@/lib/utils";
import { useConfigStore } from "@/store/config";
import { useWsStore } from "@/store/ws";
import type { Comment } from "@/types/comment";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getAutoScrollPreference,
  setAutoScrollPreference,
} from "@/utils/preferences";
import { getMessageStyle, getNameStyle } from "@/lib/comment-style";
import {
  DEFAULT_COMMENT_STYLE,
  type CommentStyleConfig,
} from "@/types/config";
import { CommentStyleEditor } from "@/components/comment-style-editor";
import {
  broadcastCommentStyle,
  useCommentStyleSync,
} from "@/utils/comment-style-sync";

type Feed = "comments" | "superchats" | "audience";

const OPACITY_STORAGE_KEY = "comments-window-opacity";

async function dockCommentsWindow() {
  await emit("comments-window-docked");
  await getCurrentWindow().hide();
}

function CommentRow({
  comment,
  style,
  selfUid,
}: {
  comment: Comment;
  style: CommentStyleConfig;
  selfUid: number;
}) {
  if (comment.type === "enter") {
    return (
      <div className="px-3 py-1.5 text-xs text-muted-foreground">
        <span
          className="font-medium"
          style={getNameStyle(comment, style, selfUid)}>
          {comment.username}
        </span>{" "}
        <span style={getMessageStyle(comment, style, selfUid)}>
          {comment.message}
        </span>
      </div>
    );
  }

  if (comment.type === "gift") {
    return (
      <div className="mx-2 my-1 rounded-md border border-primary/15 bg-primary/10 px-2.5 py-2 text-sm">
        <span
          className="font-medium"
          style={getNameStyle(comment, style, selfUid)}>
          {comment.username}
        </span>
        <span className="text-muted-foreground"> 送出 </span>
        <span style={getMessageStyle(comment, style, selfUid)}>
          {comment.giftName} x{comment.giftCount}
        </span>
      </div>
    );
  }

  return (
    <div className="flex gap-2 px-3 py-2 hover:bg-white/5">
      <Avatar className="mt-0.5 size-6 shrink-0">
        <AvatarImage src={comment.avatar || "/akarin.webp"} />
        <AvatarFallback className="text-[10px]">
          {comment.username.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span
            className="min-w-0 truncate text-xs font-medium"
            style={getNameStyle(comment, style, selfUid)}>
            {comment.username}
          </span>
          <time className="ml-auto shrink-0 text-[10px] text-muted-foreground">
            {comment.timestamp.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </time>
        </div>
        <p
          className="leading-5 wrap-break-word"
          style={getMessageStyle(comment, style, selfUid)}>
          {comment.message}
        </p>
      </div>
    </div>
  );
}

function SuperChatRow({
  comment,
  style,
  selfUid,
}: {
  comment: Comment;
  style: CommentStyleConfig;
  selfUid: number;
}) {
  return (
    <div className="mx-2 my-2 overflow-hidden rounded-md border border-amber-400/35 bg-amber-400/10">
      <div className="flex items-center gap-2 border-b border-amber-400/20 px-2.5 py-2">
        <Avatar className="size-6">
          <AvatarImage src={comment.avatar || "/akarin.webp"} />
          <AvatarFallback className="text-[10px]">
            {comment.username.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span
          className="min-w-0 flex-1 truncate text-xs font-semibold"
          style={getNameStyle(comment, style, selfUid)}>
          {comment.username}
        </span>
        <Badge className="border-0 bg-amber-500 text-white">
          ¥{comment.amount || 0}
        </Badge>
      </div>
      <p
        className="px-2.5 py-2 leading-5 wrap-break-word"
        style={getMessageStyle(comment, style, selfUid)}>
        {comment.message}
      </p>
    </div>
  );
}

export function FloatingComments() {
  const [feed, setFeed] = useState<Feed>("comments");
  const [autoScroll, setAutoScroll] = useState(getAutoScrollPreference);
  const [showOpacity, setShowOpacity] = useState(false);
  const [showStyle, setShowStyle] = useState(false);
  const [opacity, setOpacity] = useState(() => {
    const savedOpacity = Number(localStorage.getItem(OPACITY_STORAGE_KEY));
    return savedOpacity >= 0 && savedOpacity <= 100 ? savedOpacity : 80;
  });
  /** 鼠标穿透开关：开启后整个窗口忽略鼠标事件，点击落到下层（游戏） */
  const [passthrough, setPassthrough] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const originalBounds = useRef<{
    width: number;
    height: number;
    x: number;
    y: number;
  } | null>(null);
  const attemptedCredentials = useRef<string | null>(null);
  const config = useConfigStore((state) => state.config);
  const updateConfig = useConfigStore((state) => state.updateConfig);
  const commentStyle = config.commentStyle ?? DEFAULT_COMMENT_STYLE;
  useCommentStyleSync((next) => updateConfig({ commentStyle: next }));

  const handleStyleChange = (next: CommentStyleConfig) => {
    updateConfig({ commentStyle: next });
    broadcastCommentStyle(next);
  };

  const toggleStylePanel = async () => {
    const win = getCurrentWindow();
    if (!showStyle) {
      const [size, position] = await Promise.all([
        win.innerSize(),
        win.outerPosition(),
      ]);
      originalBounds.current = {
        width: size.width,
        height: size.height,
        x: position.x,
        y: position.y,
      };
      await win.setSize(new PhysicalSize(size.width + 340, size.height));
      await win.setPosition(
        new PhysicalPosition(Math.max(0, position.x - 340), position.y),
      );
      setShowStyle(true);
    } else {
      setShowStyle(false);
      const original = originalBounds.current;
      if (original) {
        await win.setSize(new PhysicalSize(original.width, original.height));
        await win.setPosition(new PhysicalPosition(original.x, original.y));
      }
    }
  };

  const styleSample: Comment = {
    id: "style-preview",
    username: config.username || "波坤大叔",
    uid: config.uid,
    message: "弹幕样式预览，修改会立即生效。",
    timestamp: new Date(),
    type: "chat",
    level: 30,
  };
  const reloadConfig = useConfigStore((state) => state.init);
  const { connected, connecting, connect } = useWsStore((state) => state);
  const comments = useWsStore((state) => state.regularMessages);
  const superChats = useWsStore((state) => state.superChats);
  const activeItems =
    feed === "comments" ? comments : feed === "superchats" ? superChats : [];
  const {
    data: rank = [],
    isLoading: rankLoading,
    isError: rankError,
  } = useQuery({
    queryKey: ["contribution-rank"],
    queryFn: getContributionRank,
    enabled: feed === "audience",
    refetchInterval: feed === "audience" ? 5000 : false,
    refetchOnWindowFocus: false,
    select: (data) => data.item ?? [],
    staleTime: 0,
  });

  const handleSendMessage = async () => {
    const message = newMessage.trim();
    if (!message || isSending) return;

    setIsSending(true);
    try {
      await sendComment(message);
      setNewMessage("");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setIsSending(false);
    }
  };

  const togglePassthrough = async () => {
    const next = !passthrough;
    try {
      await getCurrentWindow().setIgnoreCursorEvents(next);
      setPassthrough(next);
      if (next) {
        toast("已开启鼠标穿透 · 关不掉时用托盘菜单「关闭弹幕窗鼠标穿透」");
      }
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  useEffect(() => {
    document.body.classList.add("floating-window");
    return () => document.body.classList.remove("floating-window");
  }, []);

  useEffect(() => {
    // 每次挂载都从「可交互」开始：穿透状态不持久化，避免残留导致点不到界面
    void getCurrentWindow().setIgnoreCursorEvents(false);
    // 托盘菜单「关闭弹幕窗鼠标穿透」会发这个事件，把 UI 状态同步回来
    const unlisten = getCurrentWindow().listen<boolean>(
      "comments-passthrough",
      (event) => setPassthrough(Boolean(event.payload)),
    );
    return () => {
      unlisten.then((dispose) => dispose());
    };
  }, []);

  useEffect(() => {
    const unlisten = getCurrentWindow().onCloseRequested((event) => {
      event.preventDefault();
      void dockCommentsWindow();
    });
    return () => {
      unlisten.then((dispose) => dispose());
    };
  }, []);

  useEffect(() => {
    if (config.uid && config.roomId && config.roomToken) return;
    const timer = window.setInterval(() => void reloadConfig(), 3000);
    return () => window.clearInterval(timer);
  }, [config.roomId, config.roomToken, config.uid, reloadConfig]);

  useEffect(() => {
    localStorage.setItem(OPACITY_STORAGE_KEY, String(opacity));
  }, [opacity]);

  useEffect(() => {
    if (
      connected ||
      connecting ||
      !config.uid ||
      !config.roomId ||
      !config.roomToken
    ) {
      return;
    }

    const credentials = `${config.uid}:${config.roomId}:${config.roomToken}`;
    if (attemptedCredentials.current === credentials) return;

    attemptedCredentials.current = credentials;
    void connect(config.uid, config.roomId, config.roomToken);
  }, [
    config.roomId,
    config.roomToken,
    config.uid,
    connect,
    connected,
    connecting,
  ]);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeItems.length, autoScroll]);

  return (
    <div
      className={cn(
        "relative flex h-screen flex-col overflow-hidden rounded-lg border border-white/15 text-foreground shadow-xl backdrop-blur-sm",
        showStyle && "pr-[340px]",
      )}
      style={{
        backgroundColor: `color-mix(in oklch, var(--background) ${opacity}%, transparent)`,
        "--window-opacity": `${opacity}%`,
      } as CSSProperties}>
      <header
        data-tauri-drag-region
        className="flex h-11 shrink-0 items-center gap-2 border-b border-white/10 bg-card/45 px-2">
        <span
          className={cn(
            "size-2 rounded-full",
            connected
              ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
              : connecting
                ? "animate-pulse bg-amber-400"
                : "bg-white/30",
          )}
        />
        <strong data-tauri-drag-region className="text-sm font-semibold">
          直播弹幕
        </strong>
        <span data-tauri-drag-region className="text-xs text-muted-foreground">
          {connected ? "实时" : connecting ? "连接中" : "等待直播间"}
        </span>
        <div className="ml-auto flex items-center gap-0.5">
          <Button
            title="弹幕样式"
            aria-label="弹幕样式"
            variant="ghost"
            size="icon"
            className={cn("size-7 rounded-sm", showStyle && "text-primary")}
            onClick={() => void toggleStylePanel()}>
            <HugeiconsIcon icon={Settings} />
          </Button>
          <Button
            title="调整透明度"
            aria-label="调整透明度"
            variant="ghost"
            size="icon"
            className={cn("size-7 rounded-sm", showOpacity && "text-primary")}
            onClick={() => setShowOpacity((value) => !value)}>
            <HugeiconsIcon icon={TransparencyIcon} />
          </Button>
          <Button
            title={autoScroll ? "暂停自动滚动" : "恢复自动滚动"}
            aria-label={autoScroll ? "暂停自动滚动" : "恢复自动滚动"}
            variant="ghost"
            size="icon"
            className={cn("size-7 rounded-sm", autoScroll && "text-primary")}
            onClick={() =>
              setAutoScroll((value) => {
                setAutoScrollPreference(!value);
                return !value;
              })
            }>
            <HugeiconsIcon icon={VerticalScrollPointIcon} />
          </Button>
          <Button
            title={
              passthrough
                ? "鼠标穿透：开（界面不可点击，用托盘菜单关闭）"
                : "鼠标穿透：关（开启后点击会穿透到下层）"
            }
            aria-label="鼠标穿透开关"
            variant="ghost"
            size="icon"
            className={cn("size-7 rounded-sm", passthrough && "text-primary")}
            onClick={() => void togglePassthrough()}>
            <HugeiconsIcon icon={MousePointerOffIcon} />
          </Button>
          <Button
            title="隐藏悬浮窗"
            aria-label="隐藏悬浮窗"
            variant="ghost"
            size="icon"
            className="size-7 rounded-sm hover:bg-destructive hover:text-white"
            onClick={() => void dockCommentsWindow()}>
            <HugeiconsIcon icon={X} />
          </Button>
        </div>
      </header>

      {passthrough && (
        <div className="flex shrink-0 items-center gap-1.5 border-b border-amber-400/25 bg-amber-400/10 px-2.5 py-1.5 text-[11px] leading-4 text-amber-400">
          <HugeiconsIcon icon={MousePointerOffIcon} className="size-3.5 shrink-0" />
          <span className="min-w-0 flex-1">
            鼠标穿透已开启 · 恢复：右键任务栏托盘图标 →「关闭弹幕窗鼠标穿透」，或到主窗口「弹幕」页点「穿透 开/关」
          </span>
        </div>
      )}

      {showOpacity && (
        <div className="absolute top-10 right-9 z-20 w-44 rounded-md border border-white/15 bg-popover p-3 text-popover-foreground shadow-lg">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span>透明度</span>
            <span className="text-muted-foreground tabular-nums">
              {opacity}%
            </span>
          </div>
          <Slider
            aria-label="悬浮窗透明度"
            value={[opacity]}
            min={0}
            max={100}
            step={5}
            onValueChange={(value) => setOpacity(value[0])}
          />
        </div>
      )}

      {showStyle && (
        <div className="themed-scrollbar absolute top-0 right-0 z-30 h-full w-[340px] overflow-y-auto border-l border-white/10 bg-popover p-3 text-popover-foreground">
          <div className="mb-2 flex items-center">
            <span className="text-[11px] font-medium">弹幕样式</span>
            <button
              className="ml-auto text-muted-foreground hover:text-foreground"
              onClick={() => setShowStyle(false)}
              aria-label="关闭弹幕样式设置">
              <HugeiconsIcon icon={X} className="size-3.5" />
            </button>
          </div>
          <CommentStyleEditor
            style={commentStyle}
            onChange={handleStyleChange}
            sample={styleSample}
            selfUid={config.uid}
          />
        </div>
      )}

      <div className="grid h-9 shrink-0 grid-cols-3 border-b border-white/10 bg-card/25 p-1">
        <button
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-sm text-xs transition-colors",
            feed === "comments"
              ? "bg-white/10 text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => setFeed("comments")}>
          <HugeiconsIcon icon={Message} className="size-3.5" />
          弹幕 {comments.length}
        </button>
        <button
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-sm text-xs transition-colors",
            feed === "superchats"
              ? "bg-white/10 text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => setFeed("superchats")}>
          <HugeiconsIcon icon={Sparkles} className="size-3.5" />
          醒目留言
        </button>
        <button
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-sm text-xs transition-colors",
            feed === "audience"
              ? "bg-white/10 text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => setFeed("audience")}>
          <HugeiconsIcon icon={Users} className="size-3.5" />
          在线榜
        </button>
      </div>

      <div
        ref={scrollRef}
        className="themed-scrollbar min-h-0 flex-1 overflow-y-auto py-1">
        {feed === "audience" ? (
          rankLoading ? (
            <div className="flex h-full items-center justify-center">
              <Spinner />
            </div>
          ) : rankError ? (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
              在线榜加载失败，稍后将自动重试
            </div>
          ) : rank.length === 0 ? (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
              暂无在线榜数据
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {rank.map((user, index) => (
                <div
                  key={user.uid}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-white/5">
                  <div className="flex w-5 shrink-0 items-center justify-center">
                    {index === 0 ? (
                      <HugeiconsIcon
                        icon={Trophy}
                        className="size-4 text-yellow-500"
                      />
                    ) : index === 1 ? (
                      <HugeiconsIcon
                        icon={Medal}
                        className="size-4 text-slate-400"
                      />
                    ) : index === 2 ? (
                      <HugeiconsIcon
                        icon={Award}
                        className="size-4 text-amber-600"
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {index + 1}
                      </span>
                    )}
                  </div>
                  <Avatar className="size-7 shrink-0">
                    <AvatarImage src={user.face || "/akarin.webp"} />
                    <AvatarFallback className="text-[10px]">
                      {user.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {user.name}
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-primary">
                    {user.score}
                  </span>
                </div>
              ))}
            </div>
          )
        ) : activeItems.length === 0 ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
            {connected ? "等待新弹幕" : "登录后将自动连接直播间"}
          </div>
        ) : feed === "comments" ? (
          comments.map((comment) => (
            <CommentRow
              key={comment.id}
              comment={comment}
              style={config.commentStyle}
              selfUid={config.uid}
            />
          ))
        ) : (
          superChats.map((comment) => (
            <SuperChatRow
              key={comment.id}
              comment={comment}
              style={config.commentStyle}
              selfUid={config.uid}
            />
          ))
        )}
      </div>

      <div className="flex shrink-0 gap-1.5 border-t border-white/10 bg-card/35 p-2">
        <Input
          aria-label="发送弹幕"
          placeholder="发送弹幕"
          value={newMessage}
          disabled={isSending}
          onChange={(event) => setNewMessage(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void handleSendMessage();
            }
          }}
          className="h-8 flex-1 bg-background/45 text-sm"
        />
        <Button
          title="发送弹幕"
          aria-label="发送弹幕"
          size="icon"
          className="size-8 rounded-md"
          disabled={!newMessage.trim() || isSending}
          onClick={() => void handleSendMessage()}>
          {isSending ? <Spinner /> : <HugeiconsIcon icon={Send} />}
        </Button>
      </div>
    </div>
  );
}
