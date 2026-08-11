"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Film } from "lucide-react";
import { cleanMovieName, getBestMovieImage } from "@/utils/movieUtils";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const TIME_ZONE = "Asia/Ho_Chi_Minh";
const DAY_IN_MS = 86_400_000;

type ScheduleMovie = {
  slug: string;
  name: string;
  origin_name?: string;
  poster_url?: string;
  thumb_url?: string;
  episode_current?: string;
  quality?: string;
  lang?: string;
  modified?: { time?: string };
  modifiedAt?: string;
  air_date?: string;
  scheduled?: boolean;
};

type ScheduleResult = {
  status: boolean;
  availability: "ready" | "empty";
  date: string;
  source?: string;
  items: ScheduleMovie[];
};

function vietnamDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function dateFromKey(key: string) {
  return new Date(`${key}T12:00:00+07:00`);
}

function shiftDate(key: string, days: number) {
  return vietnamDateKey(new Date(dateFromKey(key).getTime() + days * DAY_IN_MS));
}

function weekdayLabel(key: string) {
  const label = new Intl.DateTimeFormat("vi-VN", {
    timeZone: TIME_ZONE,
    weekday: "long",
  }).format(dateFromKey(key));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function shortDate(key: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
  }).format(dateFromKey(key));
}

function weekInMonthLabel(key: string) {
  const date = dateFromKey(key);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const firstDay = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const leadingDays = (firstDay + 6) % 7;
  const week = Math.floor((date.getUTCDate() - 1 + leadingDays) / 7) + 1;
  return `Tuần ${week} Tháng ${month + 1}`;
}

function ScheduleSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-label="Đang tải lịch chiếu">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="h-[116px] animate-pulse rounded-2xl border border-white/5 bg-zinc-900/70" />
      ))}
    </div>
  );
}

export default function ScheduleClient() {
  const today = useMemo(() => vietnamDateKey(new Date()), []);
  const [selectedDate, setSelectedDate] = useState(today);
  const [result, setResult] = useState<ScheduleResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const cache = useRef(new Map<string, ScheduleResult>());
  const dateStripRef = useRef<HTMLDivElement>(null);

  const dates = useMemo(() => {
    const dayOfWeek = dateFromKey(today).getUTCDay();
    const mondayOffset = -((dayOfWeek + 6) % 7);
    const monday = shiftDate(today, mondayOffset);
    return Array.from({ length: 7 }, (_, index) => shiftDate(monday, index));
  }, [today]);
  const weekLabel = useMemo(() => weekInMonthLabel(dates[0]), [dates]);

  const loadSchedule = useCallback(async (date: string, signal?: AbortSignal) => {
    const cached = cache.current.get(date);
    if (cached) {
      setResult(cached);
      setLoading(false);
      setError("");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/movies/showtimes?date=${date}&limit=60`, { signal });
      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.status === false) throw new Error(payload?.message || "Không tải được lịch chiếu");
      const seen = new Set<string>();
      const uniqueItems = (Array.isArray(payload.items) ? payload.items : []).filter((movie: ScheduleMovie) => {
        if (!movie?.slug || seen.has(movie.slug)) return false;
        seen.add(movie.slug);
        return true;
      });
      const normalized = { ...payload, items: uniqueItems } as ScheduleResult;
      cache.current.set(date, normalized);
      setResult(normalized);
    } catch (requestError) {
      if ((requestError as Error).name !== "AbortError") {
        setError((requestError as Error).message || "Nguồn phim đang tạm gián đoạn");
        setResult(null);
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadSchedule(selectedDate, controller.signal);
    return () => controller.abort();
  }, [loadSchedule, selectedDate]);

  useEffect(() => {
    dateStripRef.current
      ?.querySelector<HTMLElement>(`[data-date="${selectedDate}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [selectedDate]);

  return (
    <main className="mx-auto min-h-[calc(100vh-5rem)] w-full max-w-[1500px] px-4 pb-28 pt-24 sm:px-6 md:pb-14 md:pt-28 lg:px-8">
      <header className="mb-6 grid gap-5 md:mb-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:gap-10">
        <div>
          <div className="flex items-center gap-3 text-pink-400">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-pink-500/10 ring-1 ring-pink-400/15">
              <CalendarDays size={20} aria-hidden="true" />
            </span>
            <p className="text-xs font-black uppercase tracking-[0.24em]">Lịch chiếu DlowPhim</p>
          </div>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">Phim mới theo từng ngày</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
            Phim đã cập nhật và lịch tập sắp phát trong tuần hiện tại.
          </p>
        </div>
        <div className="border-l-2 border-pink-500/40 pl-4 md:min-w-[210px] md:pl-6 md:text-right">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-600">Lịch tuần này</p>
          <p className="mt-1 text-2xl font-black text-white sm:text-3xl">{weekLabel}</p>
        </div>
      </header>

      <section aria-label="Chọn ngày chiếu" className="relative border-y border-white/10 py-3 md:py-4">
        <div ref={dateStripRef} className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="grid min-w-[784px] grid-cols-7 gap-2">
            {dates.map((date) => {
              const active = date === selectedDate;
              return (
                <button
                  key={date}
                  data-date={date}
                  type="button"
                  onClick={() => setSelectedDate(date)}
                  aria-pressed={active}
                  className={`snap-start rounded-xl border px-4 py-3 text-left transition md:rounded-2xl md:py-4 ${
                    active
                      ? "border-pink-400/60 bg-pink-500/10 shadow-[inset_0_2px_0_#ec4899]"
                      : "border-white/5 bg-zinc-950/80 hover:border-white/15 hover:bg-zinc-900"
                  }`}
                >
                  <span className={`block text-xs font-semibold ${active ? "text-pink-300" : "text-zinc-500"}`}>
                    {date === today ? "Hôm nay" : shortDate(date)}
                  </span>
                  <span className={`mt-1 block whitespace-nowrap text-sm font-bold md:text-base ${active ? "text-white" : "text-zinc-300"}`}>
                    {weekdayLabel(date)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mt-6 md:mt-8" aria-live="polite">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs font-bold tracking-[0.12em] text-zinc-500">{shortDate(selectedDate)}</p>
            <h2 className="mt-1 text-xl font-black text-white sm:text-2xl">{weekdayLabel(selectedDate)}</h2>
          </div>
          {!loading && result?.items.length ? (
            <p className="text-xs font-semibold text-zinc-500">
              {result.items.length} phim {selectedDate > today ? "sắp chiếu" : "đã cập nhật"}
            </p>
          ) : null}
        </div>

        {loading ? <ScheduleSkeleton /> : null}

        {!loading && error ? (
          <div className="flex min-h-56 flex-col items-center justify-center rounded-3xl border border-red-400/15 bg-red-500/5 px-5 text-center">
            <Film className="text-red-300" size={30} />
            <p className="mt-3 font-bold text-white">Chưa tải được lịch chiếu</p>
            <p className="mt-1 text-sm text-zinc-500">{error}</p>
            <button type="button" onClick={() => void loadSchedule(selectedDate)} className="mt-4 rounded-full bg-white px-4 py-2 text-sm font-bold text-black">
              Thử lại
            </button>
          </div>
        ) : null}

        {!loading && !error && result?.items.length === 0 ? (
          <div className="flex min-h-56 flex-col items-center justify-center rounded-3xl border border-white/10 bg-zinc-950/70 px-5 text-center">
            <CalendarDays className="text-zinc-600" size={32} />
            <p className="mt-3 font-bold text-white">Ngày này chưa có lịch được công bố</p>
            <p className="mt-1 max-w-md text-sm leading-6 text-zinc-500">Nguồn phim và TMDB chưa có dữ liệu phát sóng cho ngày đã chọn.</p>
          </div>
        ) : null}

        {!loading && !error && result?.items.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {result.items.map((movie) => (
              <article
                key={movie.slug}
                className="flex min-h-[116px] overflow-hidden rounded-2xl border border-white/10 bg-[#111118] p-2"
              >
                <div className="relative w-[72px] shrink-0 overflow-hidden rounded-xl bg-zinc-900 sm:w-[78px]">
                  <img
                    src={getBestMovieImage(movie, "poster")}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-center px-3 py-1">
                  <h3 className="line-clamp-2 text-sm font-bold leading-5 text-zinc-100">
                    {cleanMovieName(movie.name)}
                  </h3>
                  <p className="mt-1 truncate text-xs font-semibold text-pink-400">
                    {movie.episode_current || "Mới cập nhật"}
                  </p>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}
