import { useId } from "react";
import { cn } from "@/lib/utils";

/** 与桌面图标完全一致的品牌标记。 */
export function BrandMark({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("block shrink-0", className)}
      aria-hidden="true">
      <defs>
        <linearGradient id={`bg-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#17121d" />
          <stop offset="1" stopColor="#0a0a0d" />
        </linearGradient>
        <linearGradient id={`pink-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffa0c0" />
          <stop offset="0.55" stopColor="#fb5b91" />
          <stop offset="1" stopColor="#e83d72" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14.5" fill={`url(#bg-${id})`} />
      <circle
        cx="32"
        cy="32"
        r="18"
        fill="none"
        stroke={`url(#pink-${id})`}
        strokeWidth="3.4"
      />
      <path d="M28.4 23.6 L42 32 L28.4 40.4 Z" fill="#ffffff" />
      <circle cx="48" cy="16" r="3.4" fill="#ff5c93" />
    </svg>
  );
}
