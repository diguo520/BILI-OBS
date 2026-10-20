import { useState } from "react";
import { AlertCircle } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useConfigStore } from "@/store/config";
import { Spinner } from "@/components/ui/spinner";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@/lib/utils";

interface CookieLoginProps {
  onLoginSuccess: () => void;
}

export function CookieLogin({ onLoginSuccess }: CookieLoginProps) {
  const [cookie, setCookie] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parseCookie = (value: string): Record<string, string> => {
    const result: Record<string, string> = {};
    value
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach((pair) => {
        const eqIndex = pair.indexOf("=");
        if (eqIndex === -1) return;
        const key = pair.slice(0, eqIndex).trim();
        const val = pair.slice(eqIndex + 1).trim();
        if (key && val) result[key] = val;
      });
    return result;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cookie.trim()) {
      setError("请先粘贴 Cookie。");
      return;
    }

    setIsLoading(true);
    setError(null);

    const parsed = parseCookie(cookie);
    const missing = ["SESSDATA", "bili_jct"].filter((key) => !parsed[key]);
    if (missing.length > 0) {
      setError(`Cookie 缺少 ${missing.join("、")}，请复制完整内容。`);
      setIsLoading(false);
      return;
    }

    const state = useConfigStore.getState();
    state.setCookies(
      Object.entries(parsed).map(([name, value]) => ({ name, value })),
    );
    onLoginSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Textarea
        id="cookie"
        value={cookie}
        onChange={(e) => {
          setCookie(e.target.value);
          setError(null);
        }}
        placeholder="SESSDATA=...; bili_jct=...; DedeUserID=..."
        rows={4}
        aria-invalid={Boolean(error)}
        className={cn(
          "field-sizing-fixed resize-none rounded-lg font-mono text-[10.5px] leading-relaxed",
          error && "border-destructive/60",
        )}
      />

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-2.5 py-2 text-[10.5px] leading-relaxed text-destructive">
          <HugeiconsIcon icon={AlertCircle} className="mt-px size-3.5 shrink-0" />
          {error}
        </div>
      )}

      <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5">
        <div className="mb-1 text-[10.5px] font-medium text-foreground/85">
          如何获取 Cookie
        </div>
        <ol className="list-inside list-decimal space-y-0.5 text-[10px] leading-relaxed text-muted-foreground">
          <li>在浏览器登录哔哩哔哩网页版</li>
          <li>打开开发者工具 Network，选中任意 api.bilibili.com 请求</li>
          <li>复制请求头中的完整 Cookie 内容</li>
        </ol>
      </div>

      <Button
        type="submit"
        disabled={isLoading || !cookie.trim()}
        className="h-8 w-full rounded-lg text-[11.5px]">
        {isLoading ? (
          <>
            <Spinner />
            正在验证…
          </>
        ) : (
          "验证并登录"
        )}
      </Button>
    </form>
  );
}
