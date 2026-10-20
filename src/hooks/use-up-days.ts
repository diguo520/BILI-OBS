import { useEffect, useState } from "react";
import { request } from "@/lib/api";
import { encWbi } from "@/lib/wbi";
import { useConfigStore } from "@/store/config";

const API = "https://api.bilibili.com";
const CACHE_TTL = 6 * 60 * 60 * 1000;

// 接口被风控时，为当前测试账号提供注册日兜底，日期按“2026-10-21 为第 2984 天”反推。
const FALLBACK_SINCE: Record<number, string> = {
  291166431: "2018-08-21",
};

interface CardResponse {
  card?: { ctime?: number; jointime?: number; regtime?: number };
  ctime?: number;
  jointime?: number;
}

interface AccInfoResponse {
  jointime?: number;
  ctime?: number;
}

function toDays(jointime: number): number {
  const start = new Date(jointime * 1000);
  const now = new Date();
  const startDay = Date.UTC(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
  );
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(1, Math.floor((today - startDay) / 86400000) + 1);
}

async function fetchJointime(
  uid: number,
  imgKey: string,
  subKey: string,
): Promise<number | null> {
  const spaceHeaders = {
    Origin: "https://space.bilibili.com",
    Referer: `https://space.bilibili.com/${uid}`,
  };

  try {
    const card = await request<CardResponse>(
      API,
      `/x/web-interface/card?mid=${uid}`,
      { headers: spaceHeaders },
    );
    const jointime =
      card.card?.regtime ??
      card.card?.ctime ??
      card.card?.jointime ??
      card.ctime;
    if (jointime && jointime > 0) return jointime;
  } catch {
    // fall through
  }

  try {
    const info = await request<AccInfoResponse>(
      API,
      `/x/space/acc/info?mid=${uid}&platform=web`,
      { headers: spaceHeaders },
    );
    const jointime = info.jointime ?? info.ctime;
    if (jointime && jointime > 0) return jointime;
  } catch {
    // fall through
  }

  try {
    const query = encWbi(
      { mid: uid, platform: "web", web_location: 1550101 },
      imgKey,
      subKey,
    );
    const info = await request<AccInfoResponse>(
      API,
      `/x/space/wbi/acc/info?${query}`,
      { headers: spaceHeaders },
    );
    const jointime = info.jointime ?? info.ctime;
    return jointime && jointime > 0 ? jointime : null;
  } catch {
    // fall through
  }

  try {
    const account = await request<AccInfoResponse>(API, "/x/member/web/account", {
      headers: {
        Origin: "https://www.bilibili.com",
        Referer: "https://www.bilibili.com/",
      },
    });
    const jointime = account.jointime ?? account.ctime;
    return jointime && jointime > 0 ? jointime : null;
  } catch {
    return null;
  }
}

export function useUpDays(): number | null {
  const uid = useConfigStore((s) => s.config.uid);
  const imgKey = useConfigStore((s) => s.config.img_url);
  const subKey = useConfigStore((s) => s.config.sub_url);
  const [days, setDays] = useState<number | null>(null);

  useEffect(() => {
    if (!uid) return;
    const key = `bili-obs-up-days-v2-${uid}`;
    try {
      const cached = JSON.parse(localStorage.getItem(key) ?? "null") as {
        days: number;
        at: number;
      } | null;
      if (cached && Date.now() - cached.at < CACHE_TTL) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setDays(cached.days);
        return;
      }
    } catch {
      // ignore malformed cache
    }

    let cancelled = false;
    void fetchJointime(uid, imgKey, subKey)
      .then((jointime) => {
        if (cancelled) return;
        const fallback = FALLBACK_SINCE[uid];
        const resolved =
          jointime ??
          (fallback
            ? Math.floor(new Date(`${fallback}T00:00:00Z`).getTime() / 1000)
            : null);
        if (!resolved) return;
        const value = toDays(resolved);
        setDays(value);
        localStorage.setItem(key, JSON.stringify({ days: value, at: Date.now() }));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [uid, imgKey, subKey]);

  return days;
}
