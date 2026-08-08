"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, History, Play, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import ProgressiveImage from "@/components/ProgressiveImage";
import { cleanMovieName, getImageUrl } from "@/utils/movieUtils";
import {
  getUserMovieSummaries,
  UserMovieSummary,
} from "@/utils/userMovieSummaries";

interface HistoryItem {
  movieSlug: string;
  movieName: string;
  episodeName?: string;
  episodeKey?: string;
  currentTime?: number;
  duration?: number;
  progressMode?: "exact" | "embed";
  updatedAt?: string;
}

function mergeHistory(serverItems: HistoryItem[], localItems: HistoryItem[]) {
  const byMovie = new Map<string, HistoryItem>();
  [...serverItems, ...localItems].forEach((item) => {
    if (!item?.movieSlug) return;
    const existing = byMovie.get(item.movieSlug);
    const incomingTime = new Date(item.updatedAt || 0).getTime();
    const existingTime = new Date(existing?.updatedAt || 0).getTime();
    if (!existing || incomingTime >= existingTime) byMovie.set(item.movieSlug, item);
  });
  return Array.from(byMovie.values())
    .sort(
      (a, b) =>
        new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime(),
    )
    .slice(0, 8);
}

function formatMinutes(seconds = 0) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  return `${Math.max(1, Math.floor(seconds / 60))} phút`;
}

export default function ContinueWatchingRow() {
  const { user, deleteHistoryItem, showToast } = useAuth();
  const { confirm, confirmDialog } = useConfirmDialog();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [summaries, setSummaries] = useState<Record<string, UserMovieSummary>>({});

  useEffect(() => {
    let localItems: HistoryItem[] = [];
    try {
      localItems = JSON.parse(localStorage.getItem("dlowphim_history") || "[]");
    } catch {
      localItems = [];
    }
    setItems(mergeHistory(user?.watchHistory || [], localItems));
  }, [user]);

  useEffect(() => {
    if (items.length === 0) {
      setSummaries({});
      return;
    }
    const controller = new AbortController();
    getUserMovieSummaries(
      items.map((item) => item.movieSlug),
      controller.signal,
    )
      .then((result) => {
        setSummaries(Object.fromEntries(result.map((movie) => [movie.slug, movie])));
      })
      .catch((error) => {
        if (!controller.signal.aborted) console.error("Unable to load continue watching:", error);
      });
    return () => controller.abort();
  }, [items.map((item) => item.movieSlug).join(",")]);

  const visibleItems = useMemo(
    () => items.filter((item) => summaries[item.movieSlug]),
    [items, summaries],
  );

  const removeItem = async (event: React.MouseEvent, item: HistoryItem) => {
    event.preventDefault();
    event.stopPropagation();
    const accepted = await confirm({
      title: "Xóa phim khỏi Xem tiếp?",
      message: `Tiến trình gần nhất của “${item.movieName}” sẽ bị xóa khỏi lịch sử xem.`,
      confirmLabel: "Xóa khỏi Xem tiếp",
      tone: "danger",
    });
    if (!accepted) return;
    if (await deleteHistoryItem(item.movieSlug)) {
      setItems((current) => current.filter((entry) => entry.movieSlug !== item.movieSlug));
      showToast("Đã xóa phim khỏi Xem tiếp", "success");
    }
  };

  if (items.length === 0 || visibleItems.length === 0) return null;

  return (
    <section className="container mx-auto mt-12 max-w-7xl px-6" aria-labelledby="continue-watching-title">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.18em] text-pink-500">
            <History size={15} /> Tiến trình của bạn
          </div>
          <h2 id="continue-watching-title" className="text-2xl font-black tracking-tight text-white md:text-3xl">
            Xem tiếp
          </h2>
        </div>
        <Link
          href="/user/history"
          className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-bold text-zinc-300 transition hover:border-pink-500/40 hover:text-pink-400"
        >
          Tất cả <ArrowRight size={15} />
        </Link>
      </div>

      <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 no-scrollbar">
        {visibleItems.map((item) => {
          const movie = summaries[item.movieSlug];
          const progress =
            item.progressMode === "embed" || !item.duration
              ? 0
              : Math.min(100, Math.max(0, ((item.currentTime || 0) / item.duration) * 100));
          const episode = item.episodeName || "Tập gần nhất";
          const href = `/watch/${item.movieSlug}?ep=${encodeURIComponent(item.episodeKey || episode)}`;
          return (
            <article
              key={item.movieSlug}
              className="group relative w-[172px] shrink-0 snap-start sm:w-[190px] lg:w-[205px]"
            >
              <Link href={href} className="block">
              <div className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 shadow-[0_16px_40px_rgba(0,0,0,0.35)] transition duration-300 group-hover:-translate-y-1 group-hover:border-pink-500/45">
                <ProgressiveImage
                  src={getImageUrl(movie.poster_url || movie.thumb_url)}
                  alt={movie.name || item.movieName}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                  onError={(event) => {
                    event.currentTarget.src = getImageUrl(movie.thumb_url);
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/5 to-transparent" />
                <span className="absolute bottom-4 left-4 flex h-10 w-10 items-center justify-center rounded-full bg-pink-500 text-white opacity-0 shadow-lg shadow-pink-500/25 transition group-hover:opacity-100">
                  <Play size={17} fill="currentColor" />
                </span>
                {progress > 0 && (
                  <div className="absolute inset-x-3 bottom-2 h-1 overflow-hidden rounded-full bg-white/20">
                    <div className="h-full rounded-full bg-pink-500" style={{ width: `${progress}%` }} />
                  </div>
                )}
              </div>
              <div className="mt-3 min-w-0">
                <p className="truncate text-sm font-extrabold text-white transition group-hover:text-pink-400">
                  {cleanMovieName(movie.name || item.movieName)}
                </p>
                <p className="mt-1 truncate text-xs font-medium text-zinc-500">
                  {episode}
                  {item.progressMode !== "embed" && item.currentTime ? ` · ${formatMinutes(item.currentTime)}` : ""}
                </p>
              </div>
              </Link>
              <button
                type="button"
                onClick={(event) => removeItem(event, item)}
                aria-label={`Xóa ${item.movieName} khỏi Xem tiếp`}
                className="absolute right-2 top-2 z-10 rounded-full bg-black/70 p-1.5 text-zinc-300 backdrop-blur transition hover:bg-red-500 hover:text-white"
              >
                <X size={15} />
              </button>
            </article>
          );
        })}
      </div>
      {confirmDialog}
    </section>
  );
}
