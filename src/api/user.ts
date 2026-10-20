import { request } from "@/lib/api";

const BASE_URL = "https://api.bilibili.com";

interface UserInfo {
  mid: number;
  uname: string;
  face: string;
  wbi_img: {
    img_url: string;
    sub_url: string;
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
