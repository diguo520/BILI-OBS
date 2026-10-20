import { QRCodeSVG } from "qrcode.react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface LiveVerifyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  qrCodeUrl: string;
}

export function LiveVerifyDialog({
  open,
  onOpenChange,
  qrCodeUrl,
}: LiveVerifyDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>需要身份验证</DialogTitle>
          <DialogDescription>
            本次开播需要验证身份，请使用哔哩哔哩 App
            扫码完成。验证后请关闭此对话框并再次开始直播。
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center rounded-xl bg-white p-3">
          <QRCodeSVG value={qrCodeUrl} size={220} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
