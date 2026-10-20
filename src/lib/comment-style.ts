import type { CSSProperties } from "react";
import type {
  CommentRole,
  CommentStyleConfig,
} from "@/types/config";
import type { Comment } from "@/types/comment";

export function getCommentRole(
  comment: Comment,
  selfUid: number,
  levelThreshold: number,
): CommentRole {
  if (selfUid > 0 && comment.uid === selfUid) return "anchor";
  if (comment.isAdmin) return "admin";
  if ((comment.guardLevel ?? 0) > 0) return "guard";
  if ((comment.level ?? 0) >= levelThreshold) return "level";
  return "normal";
}

function shadow(style: CommentStyleConfig): string | undefined {
  if (!style.shadow.enabled) return undefined;
  return `${style.shadow.offsetX}px ${style.shadow.offsetY}px ${style.shadow.blur}px ${style.shadow.color}`;
}

export function getNameStyle(
  comment: Comment,
  style: CommentStyleConfig,
  selfUid: number,
): CSSProperties {
  const role = getCommentRole(comment, selfUid, style.levelThreshold);
  return {
    color: style.roles[role].name,
    fontSize: `${Math.max(10, style.fontSize - 2)}px`,
    textShadow: shadow(style),
  };
}

export function getMessageStyle(
  comment: Comment,
  style: CommentStyleConfig,
  selfUid: number,
): CSSProperties {
  const role = getCommentRole(comment, selfUid, style.levelThreshold);
  return {
    color: style.roles[role].message,
    fontSize: `${style.fontSize}px`,
    textShadow: shadow(style),
  };
}
