import { request } from "@/lib/api";

const API = "https://api.bilibili.com";
const HEADERS = {
  Origin: "https://member.bilibili.com",
  Referer: "https://member.bilibili.com/york/income/",
};

export interface IncomeSummary {
  date?: {
    datex?: number;
    yr_ago?: number;
    thirty_days_ago?: number;
  };
  /** 收入来源明细（6 类，实测字段名就是 detail） */
  detail?: IncomeDetail[];
  summary?: {
    state?: number;
    /** 当日收益（分） */
    daily_amt?: number;
    annual_amt?: number;
    thirty_days_amt?: number;
    /** 上一个 30 日 */
    last_thirty_days_amt?: number;
    over_last_day_amt?: number;
    over_last_thirty_days_amt?: number;
    over_last_year_amt?: number;
    daily1_amt?: number;
    annual1_amt?: number;
  };
}

/** 收入来源明细的一项（实测返回中的 detail 数组元素） */
export interface IncomeDetail {
  /** 来源类型：8 直播 / 6 创作激励 / 2 花火商单 / 3 悬赏带货 / 11 包月充电 / 10 自定义充电 */
  enum?: number;
  /** 99 = 已更新，0 = 待更新 */
  state?: number;
  daily_amt?: number;
  thirty_days_amt?: number;
  annual_amt?: number;
  last_thirty_days_amt?: number;
  daily1_amt?: number;
  annual1_amt?: number;
}

/** 来源类型 → 名称（与创作中心「收入来源明细」顺序一致：直播/创作激励/花火商单/悬赏带货/包月充电/自定义充电） */
export const INCOME_SOURCE_NAMES: Record<number, string> = {
  8: "直播",
  6: "创作激励",
  2: "花火商单",
  3: "悬赏带货",
  11: "包月充电",
  10: "自定义充电",
};

export interface WithdrawSummary {
  withdraw_total?: number;
  withdraw_info?: {
    enum: number;
    withdraw_money: number;
  }[];
}

export function getIncomeSummary() {
  return request<IncomeSummary>(API, "/x/earnings/up/index/income", {
    headers: HEADERS,
  });
}

export function getWithdrawSummary() {
  return request<WithdrawSummary>(
    API,
    "/x/earnings/up/index/income/withdraw",
    { headers: HEADERS },
  );
}

/** 收益接口金额以分为单位。 */
export function formatCny(cents?: number): string {
  if (typeof cents !== "number" || Number.isNaN(cents)) return "--";
  return (cents / 100).toFixed(2);
}
