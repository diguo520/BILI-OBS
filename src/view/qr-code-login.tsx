import { useState, useEffect, useCallback } from "react";
import { RefreshCw, CheckCircle, XCircle } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";
import { getLoginQrcode, pollQrCodeStatus } from "@/api/passport";
import { Spinner } from "@/components/ui/spinner";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@/lib/utils";

interface QRCodeLoginProps {
  onLoginSuccess: () => void;
}

type QRStatus =
  | "loading"
  | "pending"
  | "scanned"
  | "confirmed"
  | "expired"
  | "error";

const QR_TTL = 180;

export function QRCodeLogin({ onLoginSuccess }: QRCodeLoginProps) {
  const [qrStatus, setQrStatus] = useState<QRStatus>("loading");
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [qrCodeKey, setQrCodeKey] = useState("");
  const [remaining, setRemaining] = useState(QR_TTL);

  const generateQRCode = useCallback(async () => {
    setQrStatus("loading");
    setRemaining(QR_TTL);
    try {
      const qrcode = await getLoginQrcode();
      setQrCodeUrl(qrcode.url);
      setQrCodeKey(qrcode.qrcode_key);
      setQrStatus("pending");
    } catch (error) {
      console.error("Failed to generate QR code:", error);
      setQrStatus("error");
    }
  }, []);

  useEffect(() => {
    // 首次进入登录页时生成二维码
    // eslint-disable-next-line react-hooks/set-state-in-effect
    generateQRCode();
  }, [generateQRCode]);

  useEffect(() => {
    if (qrStatus !== "pending" && qrStatus !== "scanned") return;

    const pollInterval = setInterval(async () => {
      try {
        const data = await pollQrCodeStatus(qrCodeKey);

        switch (data.code) {
          case 0:
            setQrStatus("confirmed");
            clearInterval(pollInterval);
            onLoginSuccess();
            break;
          case 86038:
            setQrStatus("expired");
            clearInterval(pollInterval);
            break;
          case 86090:
            setQrStatus("scanned");
            break;
        }
      } catch (error) {
        console.error("Polling error:", error);
      }
    }, 1000);

    return () => clearInterval(pollInterval);
  }, [qrStatus, qrCodeKey, onLoginSuccess]);

  useEffect(() => {
    if (qrStatus !== "pending" && qrStatus !== "scanned") return;
    const timer = setInterval(() => {
      setRemaining((value) => {
        if (value <= 1) {
          setQrStatus("expired");
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [qrStatus]);

  const statusText =
    qrStatus === "loading"
      ? "生成二维码中…"
      : qrStatus === "pending"
        ? "等待扫码"
        : qrStatus === "scanned"
          ? "已扫码，请在手机上确认"
          : qrStatus === "confirmed"
            ? "登录成功"
            : qrStatus === "expired"
              ? "二维码已失效"
              : "二维码加载失败";

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  return (
    <div className="space-y-3">
      <div className="relative mx-auto flex size-[168px] items-center justify-center overflow-hidden rounded-xl bg-white p-2">
        {qrStatus === "loading" ? (
          <Spinner className="size-7 text-muted-foreground" />
        ) : qrStatus === "expired" || qrStatus === "error" ? (
          <div className="flex flex-col items-center gap-2">
            <HugeiconsIcon
              icon={XCircle}
              className="size-7 text-destructive"
            />
            <Button
              variant="link"
              size="sm"
              onClick={generateQRCode}
              className="h-auto gap-1 p-0 text-[11px]">
              <HugeiconsIcon icon={RefreshCw} className="size-3.5" />
              刷新二维码
            </Button>
          </div>
        ) : (
          <>
            <QRCodeSVG size={152} value={qrCodeUrl} />
            {qrStatus === "scanned" && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/85">
                <HugeiconsIcon
                  icon={CheckCircle}
                  className="size-10 text-success"
                />
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
        <span
          className={cn(
            "size-1.5 rounded-full",
            qrStatus === "scanned"
              ? "bg-success"
              : qrStatus === "expired" || qrStatus === "error"
                ? "bg-destructive"
                : "bg-warning",
          )}
        />
        <span>{statusText}</span>
        {(qrStatus === "pending" || qrStatus === "scanned") && (
          <span className="tabular-nums text-muted-foreground/70">
            · {minutes}:{String(seconds).padStart(2, "0")}
          </span>
        )}
      </div>

      <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5">
        <Step index="1" text="打开哔哩哔哩 App，进入右上角扫一扫" />
        <Step index="2" text="扫描上方二维码" />
        <Step index="3" text="在手机上确认登录，本页会自动继续" />
      </div>

      {(qrStatus === "pending" || qrStatus === "scanned") && (
        <Button
          variant="outline"
          onClick={generateQRCode}
          className="h-8 w-full rounded-lg text-[11.5px]">
          <HugeiconsIcon icon={RefreshCw} className="size-3.5" />
          刷新二维码
        </Button>
      )}
    </div>
  );
}

function Step({ index, text }: { index: string; text: string }) {
  return (
    <div className="flex items-start gap-2 py-0.5 text-[10.5px] leading-relaxed text-muted-foreground">
      <span className="mt-px flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[9px] font-semibold text-primary">
        {index}
      </span>
      {text}
    </div>
  );
}
