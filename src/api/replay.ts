/**
 * 直播回放接口。
 *
 * 实测结论（2026-11-03）：B 站的直播回放不是独立体系，而是自动发布到主播账号下的
 * 普通稿件，并带 `is_live_playback = 1` 标记。因此列表走空间搜索接口并按该字段过滤。
 *
 * 已废弃：`/xlive/web-room/v1/record/getRecordList` —— 实测对任何房间都返回 count=0。
 */
import { encWbi } from "@/lib/wbi";
import { request } from "@/lib/api";

const API = "https://api.bilibili.com";

/** 空间稿件中的一条回放（字段取自实测响应） */
export interface ReplayItem {
  bvid: string;
  aid: number;
  title: string;
  /** 封面（http 开头，需带 Referer 加载） */
  pic: string;
  /** 时长字符串，形如 "334:00" 或 "1:02:03" */
  length: string;
  /** 发布时间（秒） */
  created: number;
  play: number;
  is_live_playback: number;
}

export interface ReplayPage {
  count: number;
  list: ReplayItem[];
}

interface SpaceArcSearchResponse {
  page?: { count?: number };
  list?: { vlist?: ReplayItem[] };
}

/**
 * 拉取某一页稿件并筛出直播回放。
 * 注意：回放混在全部稿件里，单页可能一条都没有，因此需要按页翻（调用方循环）。
 */
export async function fetchReplayPage(
  mid: number,
  imgKey: string,
  subKey: string,
  pn = 1,
  ps = 50,
): Promise<ReplayPage> {
  const query = encWbi(
    { mid, pn, ps, order: "pubdate", platform: "web", web_location: 1550101 },
    imgKey,
    subKey,
  );
  const res = await request<SpaceArcSearchResponse>(
    API,
    `/x/space/wbi/arc/search?${query}`,
    {
      headers: {
        Origin: "https://space.bilibili.com",
        Referer: `https://space.bilibili.com/${mid}/video`,
      },
    },
  );
  const vlist = res?.list?.vlist ?? [];
  return {
    count: res?.page?.count ?? vlist.length,
    list: vlist.filter((v) => v?.is_live_playback === 1),
  };
}

export interface ReplayDetail {
  cid: number;
  aid: number;
  pic: string;
  duration: number;
  pages?: { cid: number; page: number; part: string; duration: number }[];
}

/** 取稿件的 cid（下载必须）与分P信息 */
export async function fetchReplayDetail(bvid: string): Promise<ReplayDetail> {
  const res = await request<{
    cid?: number;
    aid?: number;
    pic?: string;
    duration?: number;
    pages?: ReplayDetail["pages"];
  }>(API, `/x/web-interface/view?bvid=${bvid}`, {
    headers: {
      Origin: "https://www.bilibili.com",
      Referer: `https://www.bilibili.com/video/${bvid}`,
    },
  });
  return {
    cid: res?.cid ?? res?.pages?.[0]?.cid ?? 0,
    aid: res?.aid ?? 0,
    pic: res?.pic ?? "",
    duration: res?.duration ?? 0,
    pages: res?.pages,
  };
}

/** DASH 单条流（实测字段） */
export interface DashStream {
  id: number;
  baseUrl: string;
  backupUrl?: string[];
  bandwidth: number;
  width?: number;
  height?: number;
  codecs?: string;
  mimeType?: string;
}

export interface PlayInfo {
  quality: number;
  acceptQuality: number[];
  acceptDescription: string[];
  duration: number;
  video: DashStream[];
  audio: DashStream[];
}

interface RawPlayUrl {
  quality?: number;
  accept_quality?: number[];
  accept_description?: string[];
  timelength?: number;
  dash?: {
    duration?: number;
    video?: DashStream[];
    audio?: DashStream[];
  };
}

/**
 * 取播放地址（DASH 双流）。qn 传入目标清晰度 id（116/80/64/32/16）。
 * fnval=4048 才是 DASH；返回的视频流按带宽降序，audio 单独一条。
 */
export async function fetchPlayInfo(
  bvid: string,
  cid: number,
  imgKey: string,
  subKey: string,
  qn = 80,
): Promise<PlayInfo> {
  const query = encWbi(
    { bvid, cid, qn, fnval: 4048, fourk: 1, fnver: 0 },
    imgKey,
    subKey,
  );
  const res = await request<RawPlayUrl>(API, `/x/player/wbi/playurl?${query}`, {
    headers: {
      Origin: "https://www.bilibili.com",
      Referer: `https://www.bilibili.com/video/${bvid}`,
    },
  });
  const video = (res?.dash?.video ?? []).slice().sort((a, b) => b.bandwidth - a.bandwidth);
  const audio = (res?.dash?.audio ?? []).slice().sort((a, b) => b.bandwidth - a.bandwidth);
  return {
    quality: res?.quality ?? qn,
    acceptQuality: res?.accept_quality ?? [],
    acceptDescription: res?.accept_description ?? [],
    duration: res?.dash?.duration ?? Math.round((res?.timelength ?? 0) / 1000),
    video,
    audio,
  };
}
