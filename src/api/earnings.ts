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
  summary?: {
    state?: number;
    daily_amt?: number;
    annual_amt?: number;
    thirty_days_amt?: number;
    over_last_day_amt?: number;
    over_last_thirty_days_amt?: number;
  };
}

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
