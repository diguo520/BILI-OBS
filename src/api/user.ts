import { request } from "@/lib/api";

const BASE_URL = "https://api.bilibili.com";

export interface UserLevelInfo {
  /** 当前等级 0-6 */
  current_level: number;
  /** 当前等级所需的最低经验 */
  current_min: number;
  /** 当前经验 */
  current_exp: number;
  /** 升到下一级所需经验（6 级时为 "-"） */
  next_exp: number | string;
}

export interface UserInfo {
  mid: number;
  uname: string;
  face: string;
  wbi_img: {
    img_url: string;
    sub_url: string;
  };
  /** 等级与经验 */
  level_info?: UserLevelInfo;
  /** 硬币数 */
  money?: number;
  /** B币等钱包数据（部分账号不返回） */
  wallet?: {
    bcoin_balance?: number;
    bcoin?: number;
  };
}

interface FanStat {
  mid: number;
  following: number;
  follower: number;
}

export async function getUserInfo(): Promise<UserInfo> {
  return request<UserInfo>(BASE_URL, "/x/web-interface/nav", {
    headers: {
      Origin: BASE_URL,
    },
  });
}

export async function getFanStat(uid: number): Promise<FanStat> {
  return request<FanStat>(BASE_URL, `/x/relation/stat?vmid=${uid}`, {
    headers: {
      Origin: BASE_URL,
    },
  });
}
