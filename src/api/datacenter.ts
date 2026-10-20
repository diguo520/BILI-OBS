import { request } from "@/lib/api";
import { encWbi } from "@/lib/wbi";

const BASE = "https://member.bilibili.com";
const LOCALE = {
  c_locale: { language: "zh-Hans" },
  always_translate: true,
};
const DEVICE = {
  platform: "web",
  device: "pc",
  spmid: "333.1058",
  mobi_app: "web_cn",
};

function withCommon(path: string, params: Record<string, string> = {}) {
  const query = new URLSearchParams({ ...params, tmid: "", t: String(Date.now()) });
  query.set("x-bili-locale-json", JSON.stringify(LOCALE));
  query.set("x-bili-device-req-json", JSON.stringify(DEVICE));
  return request<unknown>(BASE, `${path}?${query.toString()}`, {
    headers: {
      Origin: BASE,
      Referer: "https://member.bilibili.com/platform/data-up/video/",
    },
  });
}

export interface OverviewNum {
  play: number;
  play_last: number;
  visitor: number;
  visitor_last: number;
  fan: number;
  fan_last: number;
  like: number;
  like_last: number;
  fav: number;
  fav_last: number;
  coin: number;
  coin_last: number;
  comment: number;
  comment_last: number;
  dm: number;
  dm_last: number;
  share: number;
  share_last: number;
  log_date?: number;
}

export interface TrendPoint {
  date_key: number;
  total_inc: number;
  sub_total_inc: number;
}

export interface TrendRankItem {
  title: string;
  rn: number;
  daily: number;
  bvid: string;
  cover: string;
}

export interface OverviewGraph {
  tendency: TrendPoint[];
  tendency_rank: { date_key: number; arc_ranks: TrendRankItem[] }[];
}

export interface ArchiveItem {
  aid: number;
  bvid: string;
  title: string;
  cover: string;
  ctime: number;
  pubtime: number;
  duration: number;
  stat: {
    play: number;
    fans: number | string;
    reply: number;
    full_play_ratio: number | string;
    vt: number;
    likes: number;
  } | null;
  real_stat: {
    play: number;
    fans: string;
    reply: number;
    full_play_ratio: string;
    vt: number;
    likes: number;
  } | null;
}

export interface ArchivePage {
  list: ArchiveItem[];
  pager: { pn: number; ps: number; total: number };
}

export interface FanNum {
  total_num: number;
  follow_num: number;
  unfollow_num: number;
  active_num: number;
  log_date?: number;
}

export interface FanSource {
  video?: number;
  article?: number;
  live?: number;
  space?: number;
  search?: number;
  recommend?: number;
  other?: number;
}

export interface FanPortrayal {
  fans_age?: Record<string, number> | null;
  fans_gender?: Record<string, number> | null;
  viewer_ty?: { tag_name: string; count: number }[];
}

export interface ArticleItem {
  id: number;
  title: string;
  summary: string;
  publish_time: number;
  image_urls: string[];
  stats: {
    view: number;
    favorite: number;
    like: number;
    reply: number;
    share: number;
    coin: number;
  };
}

export interface ArticlePage {
  articles: ArticleItem[];
  count: number;
}

export function getOverviewNum(period = 0, tab = 0) {
  return withCommon("/x/web/data/v2/overview/stat/num", {
    period: String(period),
    tab: String(tab),
  }) as Promise<OverviewNum>;
}

export function getOverviewGraph(period = 0, type = "play") {
  return withCommon("/x/web/data/v2/overview/stat/graph", {
    period: String(period),
    s_locale: "zh_CN",
    type,
  }) as Promise<OverviewGraph>;
}

export function getArchivePage(pn = 1, ps = 20) {
  return withCommon("/x/web/data/archive/index", {
    pn: String(pn),
    ps: String(ps),
    scene: "archive_compare",
    order: "0",
  }) as Promise<ArchivePage>;
}

export function getFanNum(period = 0) {
  return withCommon("/x/web/data/v3/fans/stat/num", {
    period: String(period),
  }) as Promise<FanNum>;
}

export function getFanSource() {
  return withCommon("/x/web/data/v2/fans/stat/source") as Promise<FanSource>;
}

export function getFanPortrayal() {
  return withCommon("/x/web/data/v3/fans/stat/portrayal", {
    period: "0",
  }) as Promise<FanPortrayal>;
}

export async function getUserArticles(
  uid: number,
  imgKey: string,
  subKey: string,
  pn = 1,
  ps = 20,
): Promise<ArticlePage> {
  const query = encWbi(
    {
      mid: uid,
      pn,
      ps,
      order: "pubdate",
      platform: "web",
      web_location: 333.976,
    },
    imgKey,
    subKey,
  );
  return request<ArticlePage>(
    "https://api.bilibili.com",
    `/x/space/wbi/article?${query}`,
    {
      headers: {
        Origin: "https://space.bilibili.com",
        Referer: `https://space.bilibili.com/${uid}/article`,
      },
    },
  );
}
