import { useEffect } from "react";
import type { CommentStyleConfig } from "@/types/config";

const KEY = "bili-obs-comment-style";

export function broadcastCommentStyle(style: CommentStyleConfig) {
  localStorage.setItem(
    KEY,
    JSON.stringify({ style, at: Date.now() }),
  );
}

/** 两个窗口共享 localStorage，通过 storage 事件实时同步样式。 */
export function useCommentStyleSync(
  onChange: (style: CommentStyleConfig) => void,
) {
  useEffect(() => {
    const handler = (event: StorageEvent) => {
      if (event.key !== KEY || !event.newValue) return;
      try {
        const parsed = JSON.parse(event.newValue) as {
          style: CommentStyleConfig;
        };
        if (parsed.style) onChange(parsed.style);
      } catch {
        // ignore malformed payload
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [onChange]);
}
