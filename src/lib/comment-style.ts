import type { CSSProperties } from "react";
import type {
  CommentPreset,
  CommentRole,
  CommentStyleConfig,
} from "@/types/config";
import type { Comment } from "@/types/comment";

/** 预设清单：id / 名称 / 说明（编辑器与文档共用同一份定义） */
export const COMMENT_PRESETS: { id: CommentPreset; label: string; desc: string }[] = [
  { id: "plain", label: "简洁", desc: "无描边无阴影，适合夜间等暗背景" },
  { id: "soft", label: "柔和阴影", desc: "单层轻微投影，中等亮度够用" },
  { id: "outline", label: "黑描边", desc: "白字加黑描边，白天亮场景首选" },
  { id: "bold", label: "双层描边", desc: "粗描边加投影，任何背景都清楚" },
  { id: "plate", label: "底板气泡", desc: "半透明深色底板，可读性最高" },
  { id: "glow", label: "发光", desc: "角色色发光配细描边，氛围感强" },
  { id: "invert", label: "反白高对比", desc: "黑字白边，极亮画面最强（忽略角色颜色）" },
];

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

/** 读预设（老配置可能没有该字段） */
function presetOf(style: CommentStyleConfig): CommentPreset {
  return style.preset ?? "plain";
}

/**
 * 预设样式 → CSS。
 *
 * 两个关键点：
 * 1. `-webkit-text-stroke` 是**居中**描边（一半在字形内），单独用会吃掉字形；
 *    必须配 `paint-order: stroke fill` 让描边先画、填充后盖，才是真正的外描边。
 *    可见宽度 ≈ 描边值 / 2，所以粗描边用 4px。
 * 2. `box-decoration-break: clone` 让多行文本**每行各有一块**圆角底板，
 *    否则换行处会连成一片。
 */
function presetExtras(preset: CommentPreset, fill: string): CSSProperties {
  switch (preset) {
    case "plain":
      return {};
    case "soft":
      return { textShadow: "0 1px 3px rgba(0,0,0,.65)" };
    case "outline":
      return {
        WebkitTextStroke: "3px rgba(0,0,0,.92)",
        paintOrder: "stroke fill",
        textShadow: "0 1px 2px rgba(0,0,0,.5)",
      };
    case "bold":
      return {
        WebkitTextStroke: "4px rgba(0,0,0,.95)",
        paintOrder: "stroke fill",
        textShadow: "0 0 1px #000, 0 2px 5px rgba(0,0,0,.75)",
      };
    case "plate":
      return {
        backgroundColor: "rgba(6,10,16,.62)",
        backdropFilter: "blur(3px)",
        padding: "1px 7px",
        borderRadius: "7px",
        boxDecorationBreak: "clone",
        textShadow: "0 1px 2px rgba(0,0,0,.4)",
      };
    case "glow":
      return {
        WebkitTextStroke: "1.5px rgba(0,0,0,.75)",
        paintOrder: "stroke fill",
        textShadow: `0 0 7px ${fill}, 0 0 2px rgba(0,0,0,.9), 0 1px 3px rgba(0,0,0,.85)`,
      };
    case "invert":
      // 反白必须换成深色字心，否则白字加白边等于没加
      return {
        color: "#0d1016",
        WebkitTextStroke: "3px rgba(255,255,255,.95)",
        paintOrder: "stroke fill",
        textShadow: "0 1px 3px rgba(0,0,0,.55)",
      };
  }
}

/** 名称样式：预设叠加在角色色之上 */
export function getNameStyle(
  comment: Comment,
  style: CommentStyleConfig,
  selfUid: number,
): CSSProperties {
  const role = getCommentRole(comment, selfUid, style.levelThreshold);
  const preset = presetOf(style);
  const color = style.roles[role].name;
  return {
    color,
    fontSize: `${Math.max(10, style.fontSize - 2)}px`,
    ...(preset === "plain"
      ? { textShadow: shadow(style) }
      : presetExtras(preset, color)),
  };
}

/** 正文样式：预设叠加在角色色之上 */
export function getMessageStyle(
  comment: Comment,
  style: CommentStyleConfig,
  selfUid: number,
): CSSProperties {
  const role = getCommentRole(comment, selfUid, style.levelThreshold);
  const preset = presetOf(style);
  const color = style.roles[role].message;
  return {
    color,
    fontSize: `${style.fontSize}px`,
    ...(preset === "plain"
      ? { textShadow: shadow(style) }
      : presetExtras(preset, color)),
  };
}
