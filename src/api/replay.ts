/**
 * 直播回放接口。
 *
 * 实测结论（2026-11-03，两套独立体系，必须都读）：
 *
 * ① 云端录制（主播中心「直播回放」页）：`AnchorGetReplayList`
 *    —— 每场直播都会产生记录，但**是否生成成功**由 B 站转码决定；
 *    实测该账号 9 场全部 `alarm_info = 录像生成失败`、`getArchiveList` 为空、
 *    下载接口返回「下载服务调用出错」→ 说明生成失败时既不能看也不能下。
 *    这套记录**不会**出现在主播的空间稿件里。
 *
 * ② 已发布回放（空间稿件）：带 `is_live_playback = 1` 的普通稿件
 *    —— 只有云端录制**生成成功且发布**后才会出现，可用 playurl 取 DASH 下载。
 *
 * 早期踩坑：只读 ② 会漏掉全部云端录制（该账号 ② 最新只到 3 月，而 ① 有 9 场到昨天）；
 * `/xlive/web-room/v1/record/getRecordList` 已废弃，对任何房间都返回 count=0。
 */
import { encWbi } from "@/lib/wbi";
import { request } from "@/lib/api";

const API = "https://api.bilibili.com";
/**
 * 直播侧接口域名。实测（2026-11-03，带真实登录 Cookie）：
 *  - AnchorGetReplayList / downloadMergeVideo 只存在于 api.live.bilibili.com，
 *    打 api.bilibili.com 会返回网关 404 HTML（"出错啦! - bilibili.com"）；
 *  - 空间稿件（arc/search）、稿件详情（view）、playurl 仍在 api.bilibili.com。
 */
const LIVE_API = "https://api.live.bilibili.com";

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

/** 云端录制的一条记录（字段取自 AnchorGetReplayList 实测响应） */
export interface CloudReplay {
  replayId: number;
  title: string;
  cover: string;
  /** 开播时间（秒） */
  liveTime: number;
  /** 录像时长（秒） */
  duration: number;
  /** 1 已生成 / 2 生成失败（实测该账号 9 场全为 2） */
  replayStatus: number;
  /** 页面上的告警文案，如「录像时长远小于开播时长，请关注直播时网络状况」 */
  alertMessage?: string;
  /** 录像生成状态文案，如「录像生成失败，请稍后再试」 */
  alarmMessage?: string;
  roomId: number;
}

interface RawCloudReplay {
  replay_id?: number;
  live_info?: { title?: string; cover?: string; live_time?: number };
  video_info?: {
    replay_status?: number;
    duration?: number;
    alert_message?: string;
  };
  alarm_info?: { message?: string };
  room_id?: number;
}

/**
 * 拉取云端录制列表（主播中心「直播回放」用的就是这个接口）。
 * 返回全部记录，包括生成失败的 —— 生成失败必须让用户看见，不能静默过滤。
 */
export async function fetchCloudReplays(
  page = 1,
  pageSize = 50,
): Promise<CloudReplay[]> {
  const res = await request<{ replay_info?: RawCloudReplay[] }>(
    LIVE_API,
    `/xlive/app-blink/v1/anchorVideo/AnchorGetReplayList?page=${page}&page_size=${pageSize}`,
    {
      headers: {
        Origin: "https://link.bilibili.com",
        Referer: "https://link.bilibili.com/p/center/index",
      },
    },
  );
  const list = res?.replay_info ?? [];
  return list.map((it) => ({
    replayId: it.replay_id ?? 0,
    title: it.live_info?.title ?? "（无标题）",
    cover: it.live_info?.cover ?? "",
    liveTime: it.live_info?.live_time ?? 0,
    duration: it.video_info?.duration ?? 0,
    replayStatus: it.video_info?.replay_status ?? 0,
    alertMessage: it.video_info?.alert_message,
    alarmMessage: it.alarm_info?.message,
    roomId: it.room_id ?? 0,
  }));
}

/**
 * 取云端录制的下载地址（B 站官方合并下载接口）。
 * 生成失败时 B 站返回「下载服务调用出错」—— 这里如实抛出，由界面提示用户。
 */
export async function fetchCloudDownloadUrl(replayId: number): Promise<string> {
  const res = await request<{ url?: string; download_url?: string } | string>(
    LIVE_API,
    `/xlive/app-blink/v1/record/downloadMergeVideo?id=${replayId}`,
    {
      headers: {
        Origin: "https://link.bilibili.com",
        Referer: "https://link.bilibili.com/p/center/index",
      },
    },
  );
  if (typeof res === "string" && res.startsWith("http")) return res;
  const url = (res as { url?: string; download_url?: string })?.url ??
    (res as { download_url?: string })?.download_url;
  if (!url) throw new Error("B 站没有返回下载地址（该录像可能尚未生成成功）");
  return url;
}
