import { useConfigStore } from "@/store/config";
import type { AppCookie } from "@/types/config";
import { fetch } from "@tauri-apps/plugin-http";
import { appSign } from "@/lib/app-sign";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0";

const COMMON_HEADERS = {
  accept: "*/*",
  "user-agent": USER_AGENT,
  "sec-ch-ua": `"Microsoft Edge";v="143", "Chromium";v="143", "Not A(Brand";v="24"`,
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": `"Windows"`,
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-site",
};

export async function request<T>(
  base_url: string,
  endpoint: string,
  options: RequestInit & {
    data?: Record<string, string>;
  } = {},
  requireSign: boolean = false,
  raw: boolean = false,
): Promise<T> {
  const state = useConfigStore.getState();
  const url = `${base_url}${endpoint}`;
  const method = options.method?.toUpperCase() || "GET";
  console.log(`Url (${method}): ${url}`);

  const headers: HeadersInit = {
    ...COMMON_HEADERS,
    ...options.headers,
    cookie: state.getCookieString(),
  };

  const fetchOptions: RequestInit = {
    ...options,
    method,
    headers,
  };

  if (options.data && method !== "GET") {
    (headers as Record<string, string>)["Content-Type"] =
      "application/x-www-form-urlencoded; charset=UTF-8";
    if (requireSign) {
      fetchOptions.body = appSign(options.data);
    } else {
      const urlSP = new URLSearchParams(options.data);
      fetchOptions.body = urlSP.toString();
    }
    console.log(fetchOptions.body);
  }
  const response = await fetch(url, fetchOptions);
  const cookieHeader = response.headers.get("set-cookie");
  if (cookieHeader) {
    const cookies: AppCookie[] = [];
    cookieHeader.split(",").forEach((cookie: string) => {
      const [name, value] = cookie.split(";")[0].split("=");
      if (name && value) {
        cookies.push({ name: name.trim(), value: value.trim() } as AppCookie);
      }
    });

    const sessdata = cookies.find((c) => c.name === "SESSDATA");
    const biliJct = cookies.find((c) => c.name === "bili_jct");

    if (sessdata && biliJct) {
      state.setCookies(cookies);
    }
  }

  /*
   * 网络层错误防护（2026-11 实测）：B 站网关对部分接口（如回放 AnchorGetReplayList）
   * 在未登录/Cookie 失效/风控时直接回 HTML 页面（404/412 挑战页）。
   * 以前直接 response.json() 会抛 "Unexpected token '<', '<!DOCTYPE '..."，
   * 并连带触发插件的 "ReadableStreamDefaultController.close" 次生错误 —— 用户完全看不懂。
   * 现在先取文本再判断：非 JSON 一律抛带状态码与片段的可读错误。
   */
  const text = await response.text();
  const looksJson =
    response.headers.get("content-type")?.toLowerCase().includes("json") ||
    /^[\s]*[[{]/.test(text);
  if (!looksJson) {
    const titleMatch = text.match(/<title>([^<]*)<\/title>/i);
    const hint = titleMatch?.[1]?.trim() || text.slice(0, 60).replace(/\s+/g, " ");
    let reason: string;
    if (response.status === 401 || response.status === 403) {
      reason = "登录态已失效，请重新扫码登录";
    } else if (response.status === 412) {
      reason = "请求被 B 站风控拦截（412），请稍后重试或重新登录";
    } else if (response.status === 404) {
      reason = "接口不存在或当前账号无权限（404）";
    } else {
      reason = "服务返回了网页而不是数据（HTTP " + response.status + "）";
    }
    throw new Error(
      "请求失败：" + reason + "（" + hint + "）",
    );
  }
  const data = JSON.parse(text);
  console.log(data);

  if (raw) {
    return data;
  }
  if (data.code !== 0 || data.data === null) {
    throw new Error(
      `API Request Error: ${data.message || "Unknown Error"} (${data.code})`,
    );
  }
  return data.data;
}
