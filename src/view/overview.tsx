import { useEffect, useMemo, useState } from "react";
import {
  Play,
  Square,
  ArrowUpRight,
  Clock,
  Users,
  AlertCircle,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useConfigStore } from "@/store/config";
import { useWsStore } from "@/store/ws";
import { useLiveControl } from "@/hooks/use-live-control";
import { useUpDays } from "@/hooks/use-up-days";
import { LiveVerifyDialog } from "@/components/live-verify-dialog";
import { cn } from "@/lib/utils";
import type { TabType } from "@/components/app-sidebar";
import { getFanStat } from "@/api/user";
import {
  getViolationRecords,
  type ViolationRecord,
} from "@/api/live";
import { INCOME_SOURCE_NAMES, type IncomeDetail } from "@/api/earnings";
import {
  formatCny,
  getIncomeSummary,
  getWithdrawSummary,
} from "@/api/earnings";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface OverviewProps {
  onNavigate: (tab: TabType) => void;
}

interface RevenueState {
  /** 当日收益（分） */
  daily: number;
  /** 较前一日（分） */
  diffDay: number;
  /** 较前一年（分） */
  diffYear: number;
  thirty: number;
  diff: number;
  withdraw: number;
  annual: number;
}

export function Overview({ onNavigate }: OverviewProps) {
  const {
    username,
    avatar,
    uid,
    roomId,
    categoryId,
    areaId,
    areaList,
    liveStartedAt,
  } = useConfigStore((s) => s.config);
  const { onlineCount, watchedUser, connected, regularMessages } = useWsStore(
    (s) => s,
  );
  const {
    isOpenLive,
    canStartStream,
    start,
    stop,
    qrCodeUrl,
    isQrDialogOpen,
    setIsQrDialogOpen,
  } = useLiveControl();

  const [now, setNow] = useState(() => Date.now());
  const [fans, setFans] = useState<number | null>(null);
  const [fanDelta, setFanDelta] = useState(0);
  const [violations, setViolations] = useState<ViolationRecord[] | null>(null);
  const [violationOpen, setViolationOpen] = useState(false);
  const [revenue, setRevenue] = useState<RevenueState | null>(null);
  /** 收入来源明细（detail），有返回时才渲染 */
  const [incomeDetails, setIncomeDetails] = useState<IncomeDetail[]>([]);
  /** 收益接口原始返回，供「原始数据」按钮复制核对字段 */
  const [incomeRaw, setIncomeRaw] = useState<unknown>(null);
  const [revenueError, setRevenueError] = useState(false);
  const [period, setPeriod] = useState<"day" | "30d" | "1y">("30d");
  const upDays = useUpDays();

  useEffect(() => {
    if (!isOpenLive) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isOpenLive]);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    const load = async () => {
      try {
        const result = await getFanStat(uid);
        if (cancelled) return;
        const key = `bili-obs-fans-baseline-${uid}`;
        const stored = Number(localStorage.getItem(key));
        const baseline =
          Number.isFinite(stored) && stored > 0 ? stored : result.follower;
        if (!Number.isFinite(stored) || stored <= 0) {
          localStorage.setItem(key, String(baseline));
        }
        setFans(result.follower);
        setFanDelta(result.follower - baseline);
      } catch {
        // keep previous value
      }
    };
    void load();
    const timer = setInterval(() => void load(), 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [uid]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const result = await getViolationRecords(1, 20);
        if (!cancelled) setViolations(result.violations_record ?? []);
      } catch {
        if (!cancelled) setViolations(null);
      }
    };
    void load();
    const timer = setInterval(() => void load(), 5 * 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [income, withdraw] = await Promise.all([
          getIncomeSummary(),
          getWithdrawSummary(),
        ]);
        if (cancelled) return;
        const summary = income.summary;
        setRevenue({
          daily: summary?.daily_amt ?? 0,
          diffDay: summary?.over_last_day_amt ?? 0,
          diffYear: summary?.over_last_year_amt ?? 0,
          thirty: summary?.thirty_days_amt ?? 0,
          diff: summary?.over_last_thirty_days_amt ?? 0,
          annual: summary?.annual_amt ?? 0,
          withdraw: withdraw.withdraw_total ?? 0,
        });
        setIncomeRaw(income);
        // 收入来源明细：实测字段为 detail，拿不到就不渲染该区块
        setIncomeDetails(Array.isArray(income.detail) ? income.detail : []);
        setRevenueError(false);
      } catch {
        if (!cancelled) setRevenueError(true);
      }
    };
    void load();
    const timer = setInterval(() => void load(), 5 * 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const areaName = useMemo(() => {
    const parent = areaList.find((p) => p.id === categoryId);
    const child = parent?.list.find((a) => a.id === areaId);
    return [parent?.name, child?.name].filter(Boolean).join(" · ");
  }, [areaList, categoryId, areaId]);

  const duration = liveStartedAt
    ? Math.max(0, Math.floor((now - liveStartedAt) / 1000))
    : 0;
  const durationText = liveStartedAt
    ? [
        Math.floor(duration / 3600),
        Math.floor((duration % 3600) / 60),
        duration % 60,
      ]
        .map((value) => String(value).padStart(2, "0"))
        .join(":")
    : "--:--:--";

  return (
    <div className="flex h-full flex-col gap-3">
      <section className="relative flex shrink-0 gap-4 rounded-2xl border border-border bg-card px-5 py-4">
        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-linear-to-br from-primary/10 via-transparent to-transparent" />
        <div className="relative flex min-w-0 flex-1 flex-col justify-center">
          <div className="text-[10.5px] tracking-[0.12em] text-muted-foreground">
            直播状态
          </div>
          <div className="mt-1 flex items-center gap-2.5">
            <span
              className={cn(
                "size-2 rounded-full",
                isOpenLive ? "bg-success" : "bg-muted-foreground/50",
              )}
            />
            <h1 className="text-[26px] leading-none font-semibold tracking-tight">
              {isOpenLive ? "直播中" : "未开播"}
            </h1>
          </div>
          <p className="mt-2 text-[12px] text-muted-foreground">
            {isOpenLive
              ? "直播进行中，数据会随直播间实时更新。"
              : canStartStream
                ? "推流地址已就绪，打开 OBS 即可开始直播。"
                : "请先在开播设置中填写标题，并选择直播分区。"}
          </p>
          <div className="mt-3 flex gap-2">
            {!isOpenLive ? (
              <Button
                onClick={() => void start()}
                disabled={!canStartStream}
                className="h-9 rounded-lg px-4 text-[12.5px]">
                <HugeiconsIcon icon={Play} className="size-4" />
                开始直播
              </Button>
            ) : (
              <Button
                variant="destructive"
                onClick={() => void stop()}
                className="h-9 rounded-lg px-4 text-[12.5px]">
                <HugeiconsIcon icon={Square} className="size-4" />
                停止直播
              </Button>
            )}
            {!isOpenLive && !canStartStream && (
              <Button
                variant="link"
                className="h-9 px-1 text-[11.5px]"
                onClick={() => onNavigate("stream")}>
                去完善
              </Button>
            )}
          </div>
        </div>

        <div className="relative flex w-52 shrink-0 flex-col justify-center gap-2.5 border-l border-border pl-4">
          <div className="flex items-center gap-2.5">
            <Avatar className="size-9 border border-border">
              <AvatarImage src={avatar || "/akarin.webp"} alt={username || ""} />
              <AvatarFallback className="bg-primary/20 text-[11px] font-semibold text-primary">
                {(username || "user").slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold">
                {username || "未登录"}
              </div>
              <div className="text-[10.5px] text-muted-foreground tabular-nums">
                UID {uid}
              </div>
            </div>
          </div>
          <div className="text-[10px] leading-4 text-muted-foreground">
            {upDays ? (
              <>
                成为UP主的第{" "}
                <span className="font-medium text-warning">{upDays}</span> 天
              </>
            ) : (
              "已登录"
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10.5px] text-muted-foreground">
              房间 {roomId}
            </span>
          </div>
        </div>
      </section>

      <div className="flex shrink-0 gap-3">
        <section className="flex min-w-0 flex-[1.6] flex-col rounded-xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center">
            <h3 className="text-[12.5px] font-semibold text-foreground/90">
              直播数据
            </h3>
            <span className="ml-auto text-[10.5px] text-muted-foreground">
              粉丝每 60 秒刷新
            </span>
          </div>
          <div className="grid flex-1 grid-cols-3 gap-2">
            <DataTile
              icon={Clock}
              label="本场时长"
              value={durationText}
              accent={isOpenLive}
            />
            <DataTile
              icon={Users}
              label="粉丝数量"
              value={fans === null ? "--" : fans.toLocaleString()}
              sub={
                fanDelta === 0
                  ? "本次无变化"
                  : `${fanDelta > 0 ? "+" : ""}${fanDelta} 本次`
              }
              subTone={fanDelta > 0 ? "up" : fanDelta < 0 ? "down" : "flat"}
            />
            <DataTile
              icon={AlertCircle}
              label="违规信息"
              value={
                violations === null
                  ? "暂不可用"
                  : violations.length === 0
                    ? "暂无违规"
                    : `${violations.length} 条记录`
              }
              sub={
                violations && violations.length > 0
                  ? "点击查看完整记录"
                  : "状态正常"
              }
              onClick={
                violations && violations.length > 0
                  ? () => setViolationOpen(true)
                  : undefined
              }
            />
          </div>
        </section>

        <section className="flex flex-1 flex-col rounded-xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center">
            <h3 className="text-[12.5px] font-semibold text-foreground/90">
              实时数据
            </h3>
            <span className="ml-auto text-[10.5px] text-muted-foreground">
              每 5 秒刷新
            </span>
          </div>
          <div className="grid flex-1 grid-cols-2 gap-2">
            <Metric label="在线观众" value={String(onlineCount || 0)} />
            <Metric label="累计观看" value={String(watchedUser || 0)} />
            <Metric label="本次弹幕" value={String(regularMessages.length)} />
            <div className="flex flex-col justify-center rounded-lg border border-border bg-muted/40 px-2.5 py-2">
              <span
                className={cn(
                  "text-[13px] font-semibold",
                  connected ? "text-success" : "text-muted-foreground",
                )}>
                {connected ? "已连接" : "未连接"}
              </span>
              <span className="mt-0.5 text-[10.5px] text-muted-foreground">
                弹幕通道
              </span>
            </div>
          </div>
        </section>
      </div>

      <section className="flex min-h-[104px] flex-1 items-center gap-5 rounded-xl border border-border bg-card px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2">
            <h3 className="text-[12.5px] font-semibold text-foreground/90">
              收益数据概览
            </h3>
            <span className="text-[10px] text-muted-foreground">
              {areaName || "未选择分区"} · 直播间 {roomId}
            </span>
            <button
              className="ml-auto text-[10px] text-muted-foreground hover:text-foreground"
              title="复制收益接口原始返回，便于核对字段"
              onClick={() =>
                void navigator.clipboard.writeText(JSON.stringify(incomeRaw, null, 2))
              }>
              原始数据
            </button>
            <div className="flex gap-1 rounded-md bg-muted p-0.5">
              <button
                onClick={() => setPeriod("day")}
                className={cn(
                  "h-5 rounded px-2 text-[10px]",
                  period === "day"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground",
                )}>
                当日
              </button>
              <button
                onClick={() => setPeriod("30d")}
                className={cn(
                  "h-5 rounded px-2 text-[10px]",
                  period === "30d"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground",
                )}>
                近30日
              </button>
              <button
                onClick={() => setPeriod("1y")}
                className={cn(
                  "h-5 rounded px-2 text-[10px]",
                  period === "1y"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground",
                )}>
                近1年
              </button>
            </div>
          </div>

          {revenueError ? (
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              收益数据暂不可用，请确认账号已开通创作激励
              <Button
                variant="link"
                className="h-auto p-0 text-[11px]"
                onClick={() =>
                  void openUrl("https://member.bilibili.com/york/income/")
                }>
                前往创作中心
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-end gap-8">
                <RevenueMetric
                  label={
                    period === "day"
                      ? "当日收益"
                      : period === "30d"
                        ? "近30日总收益"
                        : "近1年总收益"
                  }
                  value={formatCny(
                    period === "day"
                      ? revenue?.daily
                      : period === "30d"
                        ? revenue?.thirty
                        : revenue?.annual,
                  )}
                  big
                />
                <RevenueMetric
                  label={
                    period === "day"
                      ? "较前一日"
                      : period === "30d"
                        ? "较前30日"
                        : "较前一年"
                  }
                  value={
                    !revenue
                      ? "--"
                      : `${(period === "day"
                          ? revenue.diffDay
                          : period === "30d"
                            ? revenue.diff
                            : revenue.diffYear) >= 0
                          ? "+"
                          : ""
                        }${formatCny(
                          period === "day"
                            ? revenue.diffDay
                            : period === "30d"
                              ? revenue.diff
                              : revenue.diffYear,
                        )}`
                  }
                  tone="up"
                />
                <RevenueMetric
                  label="可提现收益"
                  value={formatCny(revenue?.withdraw)}
                />
              </div>
              {incomeDetails.length > 0 && (
                <div className="mt-3 flex flex-wrap items-start gap-x-4 gap-y-2">
                  {incomeDetails.map((item) => (
                    <div
                      key={item.enum}
                      className="flex min-w-[52px] flex-col gap-0.5"
                      title={item.state === 0 ? "待更新" : "已更新"}>
                      <span className="text-[10.5px] text-muted-foreground">
                        {INCOME_SOURCE_NAMES[item.enum ?? -1] ?? "其他"}
                      </span>
                      <span className="text-[12px] leading-tight font-semibold tabular-nums">
                        {formatCny(
                          period === "day"
                            ? item.daily_amt
                            : period === "30d"
                              ? item.thirty_days_amt
                              : item.annual_amt,
                        )}
                      </span>
                      <span className="text-[9.5px] leading-tight text-muted-foreground">
                        {item.state === 0 ? "待更新" : "已更新"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        <Button
          className="h-8 shrink-0 rounded-lg px-4 text-[11.5px]"
          onClick={() =>
            void openUrl("https://member.bilibili.com/york/income/")
          }>
          去提现
          <HugeiconsIcon icon={ArrowUpRight} className="size-3.5" />
        </Button>
      </section>

      <LiveVerifyDialog
        open={isQrDialogOpen}
        onOpenChange={setIsQrDialogOpen}
        qrCodeUrl={qrCodeUrl}
      />

      <Dialog open={violationOpen} onOpenChange={setViolationOpen}>
        <DialogContent className="themed-scrollbar max-h-[80vh] gap-3 overflow-y-auto rounded-2xl p-5 sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>违规记录</DialogTitle>
            <DialogDescription>
              共 {violations?.length ?? 0} 条记录，数据来自哔哩哔哩主播中心。
            </DialogDescription>
          </DialogHeader>
          <div className="divide-y divide-border">
            {violations?.map((record, index) => (
              <div key={record.violation_id ?? record.id ?? index} className="py-3">
                <div className="text-[12px] font-medium text-foreground">
                  {String(
                    record.reason ??
                      record.violation_reason ??
                      record.violations_reason ??
                      record.title ??
                      record.content ??
                      "未提供违规原因",
                  )}
                </div>
                <div className="mt-1 text-[10.5px] text-muted-foreground">
                  处罚结果：
                  {String(
                    record.punish_result ??
                      record.result ??
                      record.penalty_reason ??
                      "暂无处罚结果",
                  )}
                </div>
                <div className="mt-0.5 text-[10px] text-muted-foreground/80 tabular-nums">
                  处罚时间：
                  {String(
                    record.punish_time ??
                      record.break_time ??
                      record.ctime ??
                      record.time ??
                      "--",
                  )}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DataTile({
  icon,
  label,
  value,
  sub,
  subTone = "flat",
  accent = false,
  onClick,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
  sub?: string;
  subTone?: "up" | "down" | "flat";
  accent?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "flex flex-col justify-center rounded-lg border border-border bg-muted/40 px-2.5 py-2",
        onClick && "cursor-pointer transition-colors hover:bg-muted/70",
      )}>
      <div className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
        <HugeiconsIcon
          icon={icon}
          className={cn("size-3", accent ? "text-primary" : "")}
        />
        {label}
      </div>
      <span
        className={cn(
          "mt-1 text-[16px] leading-none font-semibold tabular-nums",
          accent && "text-primary",
        )}>
        {value}
      </span>
      {sub && (
        <span
          className={cn(
            "mt-1 text-[10px]",
            subTone === "up"
              ? "text-success"
              : subTone === "down"
                ? "text-destructive"
                : "text-muted-foreground",
          )}>
          {sub}
        </span>
      )}
    </div>
  );
}

function RevenueMetric({
  label,
  value,
  tone = "flat",
  big = false,
}: {
  label: string;
  value: string;
  tone?: "flat" | "up";
  big?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div
        className={cn(
          "mt-1 font-semibold tabular-nums",
          big ? "text-[20px] leading-none" : "text-[16px] leading-none",
          tone === "up" ? "text-success" : "text-foreground",
        )}>
        {value}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col justify-center rounded-lg border border-border bg-muted/40 px-2.5 py-2">
      <span className="text-[18px] leading-none font-semibold tabular-nums">
        {value}
      </span>
      <span className="mt-1 text-[10.5px] text-muted-foreground">{label}</span>
    </div>
  );
}
