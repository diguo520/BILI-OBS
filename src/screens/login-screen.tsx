import { useState } from "react";
import {
  QrCode,
  Cookie,
  Radio,
  MessageSquare,
  Shield,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import { QRCodeLogin } from "@/view/qr-code-login";
import { CookieLogin } from "@/view/cookie-login";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/brand-mark";

type LoginMethod = "qr" | "cookie";

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

const features = [
  { icon: Radio, label: "开播与推流信息管理" },
  { icon: MessageSquare, label: "实时弹幕与醒目留言" },
  { icon: Shield, label: "房管、禁言与屏蔽词" },
];

export function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [loginMethod, setLoginMethod] = useState<LoginMethod>("qr");

  return (
    <div className="flex min-h-0 flex-1 bg-linear-to-br from-primary/[0.07] via-transparent to-transparent">
      <aside className="flex w-[336px] shrink-0 flex-col border-r border-border bg-sidebar px-8 py-9">
        <BrandMark className="size-11" />
        <h1 className="mt-4 text-[24px] font-semibold tracking-tight">
          BILI OBS
        </h1>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
          轻量、跨平台的哔哩哔哩直播控制台。
        </p>

        <ul className="mt-6 flex flex-col gap-3">
          {features.map(({ icon, label }) => (
            <li
              key={label}
              className="flex items-center gap-2.5 text-[12px] text-foreground/85">
              <span className="flex size-7 items-center justify-center rounded-lg border border-border bg-card text-primary">
                <HugeiconsIcon icon={icon} className="size-3.5" />
              </span>
              {label}
            </li>
          ))}
        </ul>

        <p className="mt-auto text-[10.5px] leading-relaxed text-muted-foreground/80">
          非官方客户端。登录凭据仅保存在本机，不会上传到第三方服务器。
        </p>
      </aside>

      <section className="flex flex-1 items-center justify-center p-6">
        <div className="w-[368px] rounded-2xl border border-border bg-card p-5 shadow-2xl">
          <h2 className="text-[18px] font-semibold">登录账号</h2>
          <p className="mt-1 text-[11.5px] text-muted-foreground">
            使用哔哩哔哩 App 扫码，或粘贴浏览器 Cookie。
          </p>

          <div className="mt-3.5 grid grid-cols-2 gap-1 rounded-lg border border-border bg-background p-[3px]">
            <Button
              variant="ghost"
              onClick={() => setLoginMethod("qr")}
              className={cn(
                "h-7 rounded-md text-[11.5px] font-normal",
                loginMethod === "qr" &&
                  "bg-card text-foreground shadow-sm hover:bg-card",
              )}>
              <HugeiconsIcon icon={QrCode} className="size-3.5" />
              扫码登录
            </Button>
            <Button
              variant="ghost"
              onClick={() => setLoginMethod("cookie")}
              className={cn(
                "h-7 rounded-md text-[11.5px] font-normal",
                loginMethod === "cookie" &&
                  "bg-card text-foreground shadow-sm hover:bg-card",
              )}>
              <HugeiconsIcon icon={Cookie} className="size-3.5" />
              Cookie 登录
            </Button>
          </div>

          <div className="mt-3">
            {loginMethod === "qr" ? (
              <QRCodeLogin onLoginSuccess={onLoginSuccess} />
            ) : (
              <CookieLogin onLoginSuccess={onLoginSuccess} />
            )}
          </div>

          <p className="mt-2.5 text-center text-[10px] text-muted-foreground/80">
            登录即表示你同意哔哩哔哩用户协议 · 本工具不收集账号数据
          </p>
        </div>
      </section>
    </div>
  );
}
