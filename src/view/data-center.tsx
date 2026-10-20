import { useEffect, useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowDown01,
  ArrowUp01,
  Calendar,
  ChartHistogramIcon,
  Play,
  Users,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { useConfigStore } from "@/store/config";
import {
  getArchivePage,
  getFanNum,
  getFanPortrayal,
  getFanSource,
  getUserArticles,
  getOverviewGraph,
  getOverviewNum,
  type ArchiveItem,
  type FanNum,
  type FanPortrayal,
  type FanSource,
  type ArticleItem,
  type OverviewGraph,
  type OverviewNum,
} from "@/api/datacenter";

type DataTab = "overview" | "weekly" | "fans" | "archive" | "article";

const tabs: { id: DataTab; label: string }[] = [
  { id: "overview", label: "数据概览" },
  { id: "weekly", label: "数据周报" },
  { id: "archive", label: "稿件分析" },
  { id: "fans", label: "粉丝分析" },
  { id: "article", label: "专栏数据" },
];

export function DataCenter() {
  const [tab, setTab] = useState<DataTab>("overview");
  const [period, setPeriod] = useState(0);
  const [num, setNum] = useState<OverviewNum | null>(null);
  const [graph, setGraph] = useState<OverviewGraph | null>(null);
  const [archive, setArchive] = useState<ArchiveItem[]>([]);
  const [archiveTotal, setArchiveTotal] = useState(0);
  const [fanNum, setFanNum] = useState<FanNum | null>(null);
  const [fanSource, setFanSource] = useState<FanSource | null>(null);
  const [fanPortrayal, setFanPortrayal] = useState<FanPortrayal | null>(null);
  const [articles, setArticles] = useState<ArticleItem[]>([]);
  const uid = useConfigStore((s) => s.config.uid);
  const imgKey = useConfigStore((s) => s.config.img_url);
  const subKey = useConfigStore((s) => s.config.sub_url);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(false);
    Promise.all([
      getOverviewNum(period, 0),
      getOverviewNum(period, 1),
      getOverviewNum(period, 2),
      getOverviewGraph(period),
    ])
      .then(([base, engagement, interaction, graphData]) => {
        if (cancelled) return;
        setNum({
          ...base,
          like: engagement.like,
          like_last: engagement.like_last,
          fav: engagement.fav,
          fav_last: engagement.fav_last,
          coin: engagement.coin,
          coin_last: engagement.coin_last,
          comment: interaction.comment,
          comment_last: interaction.comment_last,
          dm: interaction.dm,
          dm_last: interaction.dm_last,
          share: interaction.share,
          share_last: interaction.share_last,
        });
        setGraph(graphData);
      })
      .catch((reason) => {
        console.error("Data center overview failed:", reason);
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [period]);

  useEffect(() => {
    if (tab !== "archive") return;
    let cancelled = false;
    void getArchivePage(page, 20)
      .then((data) => {
        if (cancelled) return;
        setArchive(data.list || []);
        setArchiveTotal(data.pager?.total ?? 0);
      })
      .catch((reason) => {
        console.error("Data center archive failed:", reason);
        if (!cancelled) setArchive([]);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, page]);

  useEffect(() => {
    if (tab !== "fans") return;
    let cancelled = false;
    Promise.all([getFanNum(period), getFanSource(), getFanPortrayal()])
      .then(([numData, sourceData, portrayalData]) => {
        if (cancelled) return;
        setFanNum(numData);
        setFanSource(sourceData);
        setFanPortrayal(portrayalData);
      })
      .catch((reason) => {
        console.error("Data center fans failed:", reason);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, period]);

  useEffect(() => {
    if (tab !== "article" || !uid) return;
    let cancelled = false;
    void getUserArticles(uid, imgKey, subKey)
      .then((data) => {
        if (!cancelled) setArticles(data.articles || []);
      })
      .catch((reason) => {
        console.error("Data center articles failed:", reason);
        if (!cancelled) setArticles([]);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, uid, imgKey, subKey]);

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-end gap-3">
        <div>
          <h1 className="text-[19px] font-semibold tracking-tight">数据中心</h1>
          <p className="mt-0.5 text-[11.5px] text-muted-foreground">
            播放、粉丝与稿件数据分析
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10.5px] text-muted-foreground">
            更新时间 {formatLogDate(num?.log_date)}
          </span>
          <div className="flex gap-1 rounded-md bg-card p-0.5 ring-1 ring-border">
            {[
              [0, "近7天"],
              [1, "近30天"],
            ].map(([value, label]) => (
              <button
                key={value}
                onClick={() => setPeriod(Number(value))}
                className={cn(
                  "h-6 rounded px-2.5 text-[10.5px]",
                  period === Number(value)
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground",
                )}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 gap-4 border-b border-border">
        {tabs.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={cn(
              "relative pb-2 text-[12px] transition-colors",
              tab === item.id
                ? "font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}>
            {item.label}
            {tab === item.id && (
              <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary" />
            )}
          </button>
        ))}
      </div>

      <div className="themed-scrollbar min-h-0 flex-1 overflow-y-auto pr-1">
        {loading ? (
          <div className="flex h-48 items-center justify-center text-[12px] text-muted-foreground">
            正在加载数据…
          </div>
        ) : error ? (
          <div className="flex h-48 flex-col items-center justify-center gap-1 text-[12px] text-muted-foreground">
            <span>数据加载失败</span>
            <span className="text-[10px]">请确认已登录创作中心并开通数据权限</span>
          </div>
        ) : tab === "archive" ? (
          <ArchiveTable
            items={archive}
            total={archiveTotal}
            page={page}
            onPageChange={setPage}
          />
        ) : tab === "article" ? (
          <ArticlePanel articles={articles} />
        ) : tab === "fans" ? (
          <FansPanel
            fanNum={fanNum}
            source={fanSource}
            portrayal={fanPortrayal}
          />
        ) : (
          <OverviewPanel num={num} graph={graph} weekly={tab === "weekly"} />
        )}
      </div>
    </div>
  );
}

function OverviewPanel({
  num,
  graph,
  weekly,
}: {
  num: OverviewNum | null;
  graph: OverviewGraph | null;
  weekly: boolean;
}) {
  if (!num) return <EmptyPanel text="暂无数据" />;
  const cards = [
    { key: "play", label: "播放量", icon: Play, value: num.play, last: num.play_last },
    { key: "visitor", label: "空间访客", icon: Users, value: num.visitor, last: num.visitor_last },
    { key: "fan", label: "净增粉丝", icon: ChartHistogramIcon, value: num.fan, last: num.fan_last },
    { key: "like", label: "点赞", icon: ArrowUp01, value: num.like, last: num.like_last },
    { key: "fav", label: "收藏", icon: Calendar, value: num.fav, last: num.fav_last },
    { key: "coin", label: "硬币", icon: Calendar, value: num.coin, last: num.coin_last },
    { key: "comment", label: "评论", icon: Calendar, value: num.comment, last: num.comment_last },
    { key: "dm", label: "弹幕", icon: Calendar, value: num.dm, last: num.dm_last },
    { key: "share", label: "分享", icon: Calendar, value: num.share, last: num.share_last },
  ];

  return (
    <div className="space-y-3">
      <section className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center">
          <h2 className="text-[13px] font-semibold">
            {weekly ? "近 7 天数据周报" : "核心数据概览"}
          </h2>
          <span className="ml-auto text-[10px] text-muted-foreground">
            更新至 {formatLogDate(num.log_date)}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {cards.map((card, index) => (
            <div
              key={card.key}
              className={cn(
                "rounded-lg border border-border px-3 py-2.5",
                index === 0 ? "bg-primary/10" : "bg-muted/40",
              )}>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <HugeiconsIcon icon={card.icon} className="size-3" />
                {card.label}
              </div>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span
                  className={cn(
                    "text-[18px] font-semibold tabular-nums",
                    index === 0 && "text-primary",
                  )}>
                  {card.value}
                </span>
                <Delta value={card.value} last={card.last} />
              </div>
            </div>
          ))}
        </div>
        {weekly && <WeeklySummary points={graph?.tendency ?? []} />}
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <div className="mb-2 flex items-center gap-3">
          <h2 className="text-[13px] font-semibold">近 7 天播放量</h2>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <i className="h-0.5 w-4 rounded bg-[#ff5c93]" />
            总播放量
          </span>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <i className="h-0.5 w-4 rounded bg-[#00aeec]" />
            粉丝播放量
          </span>
        </div>
        <TrendChart graph={graph} />
      </section>
    </div>
  );
}

function TrendChart({ graph }: { graph: OverviewGraph | null }) {
  const [hover, setHover] = useState<number | null>(null);
  const points = useMemo(
    () => [...(graph?.tendency ?? [])].sort((a, b) => a.date_key - b.date_key),
    [graph],
  );
  if (points.length < 2) {
    return <EmptyPanel text="暂无趋势数据" />;
  }
  const width = 660;
  const height = 210;
  const pad = { left: 42, right: 18, top: 12, bottom: 24 };
  const max = Math.max(...points.map((p) => Math.max(p.total_inc, p.sub_total_inc)), 1);
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const x = (index: number) => pad.left + (plotW * index) / (points.length - 1);
  const y = (value: number) => pad.top + plotH - (value / max) * plotH;
  const totalLine = points.map((p, i) => `${x(i)},${y(p.total_inc)}`).join(" ");
  const subLine = points.map((p, i) => `${x(i)},${y(p.sub_total_inc)}`).join(" ");
  const ranks =
    hover !== null
      ? graph?.tendency_rank.find((r) => r.date_key === points[hover].date_key)
      : undefined;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        onMouseLeave={() => setHover(null)}>
        {[0, 1, 2, 3].map((step) => {
          const value = (max * step) / 3;
          const yy = y(value);
          return (
            <g key={step}>
              <line
                x1={pad.left}
                y1={yy}
                x2={width - pad.right}
                y2={yy}
                stroke="currentColor"
                className="text-border"
                strokeDasharray="3 4"
              />
              <text x={pad.left - 8} y={yy + 3} textAnchor="end" fontSize="9" fill="currentColor" className="text-muted-foreground">
                {Math.round(value)}
              </text>
            </g>
          );
        })}
        <polyline points={totalLine} fill="none" stroke="#ff5c93" strokeWidth="2" />
        <polyline points={subLine} fill="none" stroke="#00aeec" strokeWidth="2" />
        {points.map((point, index) => (
          <g key={point.date_key}>
            <rect
              x={x(index) - plotW / (points.length * 2)}
              y={pad.top}
              width={plotW / points.length}
              height={plotH}
              fill="transparent"
              onMouseEnter={() => setHover(index)}
            />
            <circle cx={x(index)} cy={y(point.total_inc)} r={hover === index ? 4 : 2.5} fill="#ff5c93" />
            <circle cx={x(index)} cy={y(point.sub_total_inc)} r={hover === index ? 4 : 2.5} fill="#00aeec" />
            {index === 0 || index === points.length - 1 || index === Math.floor(points.length / 2) ? (
              <text x={x(index)} y={height - 6} textAnchor="middle" fontSize="9" fill="currentColor" className="text-muted-foreground">
                {formatDate(point.date_key)}
              </text>
            ) : null}
          </g>
        ))}
      </svg>

      {hover !== null && (
        <div
          className="pointer-events-none absolute top-4 w-56 rounded-lg border border-border bg-popover p-2.5 text-popover-foreground shadow-xl"
          style={{ left: `${Math.min(70, (x(hover) / width) * 100)}%` }}>
          <div className="text-[10px] text-muted-foreground">{formatDate(points[hover].date_key)}</div>
          <div className="mt-1 flex gap-3 text-[10.5px]">
            <span><i className="mr-1 inline-block size-1.5 rounded-full bg-[#ff5c93]" />总播放 {points[hover].total_inc}</span>
            <span><i className="mr-1 inline-block size-1.5 rounded-full bg-[#00aeec]" />粉丝播放 {points[hover].sub_total_inc}</span>
          </div>
          {ranks?.arc_ranks?.length ? (
            <div className="mt-2 space-y-1.5 border-t border-border pt-2">
              <div className="text-[9.5px] text-muted-foreground">当日播放来源 Top3</div>
              {ranks.arc_ranks.slice(0, 3).map((item) => (
                <div key={item.bvid} className="flex items-center gap-2">
                  <img src={item.cover} alt="" className="h-6 w-10 rounded object-cover" />
                  <span className="min-w-0 flex-1 truncate text-[9.5px]">{item.title}</span>
                  <span className="text-[9.5px] text-primary">{item.daily}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function WeeklySummary({ points }: { points: { total_inc: number; sub_total_inc: number }[] }) {
  const total = points.reduce((sum, p) => sum + p.total_inc, 0);
  const fans = points.reduce((sum, p) => sum + p.sub_total_inc, 0);
  const best = points.reduce(
    (top, p) => (p.total_inc > top.total_inc ? p : top),
    points[0] ?? { total_inc: 0, sub_total_inc: 0 },
  );
  return (
    <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3">
      <div className="text-[10.5px] text-muted-foreground">
        周播放总量 <span className="ml-1 text-[13px] font-semibold text-foreground">{total}</span>
      </div>
      <div className="text-[10.5px] text-muted-foreground">
        周粉丝播放 <span className="ml-1 text-[13px] font-semibold text-foreground">{fans}</span>
      </div>
      <div className="text-[10.5px] text-muted-foreground">
        单日最高 <span className="ml-1 text-[13px] font-semibold text-foreground">{best.total_inc}</span>
      </div>
    </div>
  );
}

function FansPanel({
  fanNum,
  source,
  portrayal,
}: {
  fanNum: FanNum | null;
  source: FanSource | null;
  portrayal: FanPortrayal | null;
}) {
  return (
    <div className="space-y-3">
      <section className="grid grid-cols-4 gap-3">
        {[
          ["粉丝总量", fanNum?.total_num ?? "--"],
          ["新增关注", fanNum?.follow_num ?? "--"],
          ["取消关注", fanNum?.unfollow_num ?? "--"],
          ["活跃粉丝", fanNum?.active_num ?? "--"],
        ].map(([label, value], index) => (
          <div key={label} className="rounded-xl border border-border bg-card p-3">
            <div className="text-[10.5px] text-muted-foreground">{label}</div>
            <div className={cn("mt-1 text-[22px] font-semibold tabular-nums", index === 0 && "text-primary")}>
              {value}
            </div>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-2 text-[12px] font-semibold">粉丝来源</h3>
          <Distribution data={source ?? {}} />
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-2 text-[12px] font-semibold">粉丝兴趣</h3>
          {portrayal?.viewer_ty?.length ? (
            <div className="space-y-1.5">
              {portrayal.viewer_ty.slice(0, 6).map((tag) => (
                <div key={tag.tag_name} className="flex items-center gap-2 text-[10px]">
                  <span className="w-14 truncate text-muted-foreground">{tag.tag_name}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full bg-primary"
                      style={{ width: `${Math.min(100, (tag.count / (portrayal.viewer_ty?.[0]?.count || 1)) * 100)}%` }}
                    />
                  </span>
                  <span className="w-12 text-right tabular-nums text-muted-foreground">{tag.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10.5px] text-muted-foreground">暂无画像数据</p>
          )}
        </div>
      </section>
    </div>
  );
}

function Distribution({ data }: { data: FanSource }) {
  const labels: Record<string, string> = {
    video: "视频",
    live: "直播",
    article: "专栏",
    search: "搜索",
    space: "个人空间",
    recommend: "推荐",
    other: "其他",
  };
  const entries = Object.entries(data)
    .filter(([key, value]) => key !== "article" && (value ?? 0) > 0)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));
  const total = entries.reduce((sum, [, value]) => sum + (value ?? 0), 0);
  if (!total) return <p className="text-[10.5px] text-muted-foreground">暂无来源数据</p>;
  return (
    <div className="space-y-1.5">
      {entries.map(([key, value]) => (
        <div key={key} className="flex items-center gap-2 text-[10px]">
          <span className="w-14 text-muted-foreground">{labels[key] ?? key}</span>
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <span
              className="block h-full rounded-full bg-[#00aeec]"
              style={{ width: `${((value ?? 0) / total) * 100}%` }}
            />
          </span>
          <span className="w-10 text-right tabular-nums text-muted-foreground">{value}</span>
        </div>
      ))}
    </div>
  );
}

function ArchiveTable({
  items,
  total,
  page,
  onPageChange,
}: {
  items: ArchiveItem[];
  total: number;
  page: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="grid grid-cols-[1fr_70px_70px_70px_70px] gap-2 border-b border-border px-3 py-2 text-[10px] text-muted-foreground">
          <span>稿件</span><span className="text-right">播放</span><span className="text-right">点赞</span><span className="text-right">涨粉</span><span className="text-right">发布日期</span>
        </div>
        <div className="divide-y divide-border">
          {items.map((item) => (
            <div key={item.bvid} className="grid grid-cols-[1fr_70px_70px_70px_70px] items-center gap-2 px-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <img src={item.cover} alt="" className="h-7 w-12 rounded object-cover" />
                <span className="truncate text-[11px]">{item.title}</span>
              </div>
              <span className="text-right text-[11px] tabular-nums">{item.real_stat?.play ?? item.stat?.play ?? 0}</span>
              <span className="text-right text-[11px] tabular-nums">{item.real_stat?.likes ?? item.stat?.likes ?? 0}</span>
              <span className="text-right text-[11px] tabular-nums">{item.real_stat?.fans || item.stat?.fans || 0}</span>
              <span className="text-right text-[10px] text-muted-foreground">{formatTimestamp(item.pubtime)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 text-[10.5px] text-muted-foreground">
        <span>共 {total} 条</span>
        <button
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="rounded border border-border px-2 py-1 disabled:opacity-40">
          上一页
        </button>
        <button
          disabled={page * 20 >= total}
          onClick={() => onPageChange(page + 1)}
          className="rounded border border-border px-2 py-1 disabled:opacity-40">
          下一页
        </button>
      </div>
    </div>
  );
}

function Delta({ value, last }: { value: number; last: number }) {
  const diff = value - last;
  if (diff === 0) {
    return <span className="text-[9.5px] text-muted-foreground">较上期持平</span>;
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[9.5px]",
        diff >= 0 ? "text-success" : "text-destructive",
      )}
      title={`较上期${diff >= 0 ? "增加" : "减少"} ${Math.abs(diff)}`}>
      <HugeiconsIcon
        icon={diff >= 0 ? ArrowUp01 : ArrowDown01}
        className="size-2.5"
      />
      较上期 {diff >= 0 ? "+" : "-"}{Math.abs(diff)}
    </span>
  );
}

function ArticlePanel({ articles }: { articles: ArticleItem[] }) {
  if (!articles.length) {
    return <EmptyPanel text="暂无专栏文章" />;
  }
  const totals = articles.reduce(
    (sum, article) => ({
      view: sum.view + article.stats.view,
      reply: sum.reply + article.stats.reply,
      favorite: sum.favorite + article.stats.favorite,
      like: sum.like + article.stats.like,
      share: sum.share + article.stats.share,
      coin: sum.coin + article.stats.coin,
    }),
    { view: 0, reply: 0, favorite: 0, like: 0, share: 0, coin: 0 },
  );
  const maxView = Math.max(...articles.map((article) => article.stats.view), 1);

  return (
    <div className="space-y-3">
      <section className="grid grid-cols-6 gap-2">
        {[
          ["阅读量", totals.view],
          ["评论数", totals.reply],
          ["收藏数", totals.favorite],
          ["点赞数", totals.like],
          ["分享数", totals.share],
          ["硬币数", totals.coin],
        ].map(([label, value], index) => (
          <div
            key={label}
            className={cn(
              "rounded-xl border border-border p-3",
              index === 0 ? "border-[#00aeec]/30 bg-[#00aeec]/10" : "bg-card",
            )}>
            <div className="text-[10px] text-muted-foreground">{label}</div>
            <div className={cn("mt-1 text-[20px] font-semibold tabular-nums", index === 0 && "text-[#00aeec]")}>
              {value}
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center">
          <h3 className="text-[12px] font-semibold">文章阅读分布</h3>
          <span className="ml-auto text-[10px] text-muted-foreground">
            共 {articles.length} 篇
          </span>
        </div>
        <div className="space-y-2">
          {articles.map((article) => (
            <div key={article.id} className="flex items-center gap-3">
              <span className="w-48 truncate text-[10.5px] text-muted-foreground">
                {article.title}
              </span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <span
                  className="block h-full rounded-full bg-[#00aeec]"
                  style={{ width: `${(article.stats.view / maxView) * 100}%` }}
                />
              </span>
              <span className="w-12 text-right text-[10.5px] text-foreground tabular-nums">
                {article.stats.view}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="grid grid-cols-[1fr_60px_60px_60px_60px] gap-2 border-b border-border px-3 py-2 text-[10px] text-muted-foreground">
          <span>文章</span>
          <span className="text-right">阅读</span>
          <span className="text-right">评论</span>
          <span className="text-right">点赞</span>
          <span className="text-right">发布</span>
        </div>
        <div className="divide-y divide-border">
          {articles.map((article) => (
            <div
              key={article.id}
              className="grid grid-cols-[1fr_60px_60px_60px_60px] items-center gap-2 px-3 py-2">
              <span className="truncate text-[11px]">{article.title}</span>
              <span className="text-right text-[10.5px] tabular-nums">{article.stats.view}</span>
              <span className="text-right text-[10.5px] tabular-nums">{article.stats.reply}</span>
              <span className="text-right text-[10.5px] tabular-nums">{article.stats.like}</span>
              <span className="text-right text-[10px] text-muted-foreground">
                {formatTimestamp(article.publish_time)}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return (
    <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border text-[11px] text-muted-foreground">
      {text}
    </div>
  );
}

function formatLogDate(value?: number): string {
  if (!value) return "--";
  const text = String(value);
  return `${text.slice(4, 6)}-${text.slice(6, 8)}`;
}

function formatDate(unix: number): string {
  const d = new Date(unix * 1000);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatTimestamp(unix: number): string {
  const d = new Date(unix * 1000);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}
