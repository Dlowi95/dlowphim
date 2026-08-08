"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Flame } from "lucide-react";
import { useRouter } from "next/navigation";
import MovieHoverPopup from "@/components/MovieHoverPopup";
import ProgressiveImage from "@/components/ProgressiveImage";
import { cleanMovieName, getImageUrl } from "@/utils/movieUtils";
import { fetchMovieDiscovery } from "@/utils/movieDiscovery";

interface Movie {
  _id: string;
  name: string;
  slug: string;
  origin_name: string;
  poster_url?: string;
  thumb_url?: string;
  year?: number;
  quality?: string;
  lang?: string;
  episode_current?: string;
  time?: string;
  tmdb?: { vote_count?: number; vote_average?: number };
}

function uniqueMovies(items: Movie[]) {
  const seen = new Set<string>();
  return items.filter((movie) => {
    if (!movie?.slug || seen.has(movie.slug)) return false;
    seen.add(movie.slug);
    return true;
  });
}

function rankByAvailableSignals(items: Movie[]) {
  const hasTmdbSignals = items.some(
    (movie) => Number(movie.tmdb?.vote_count) > 0 || Number(movie.tmdb?.vote_average) > 0,
  );
  if (!hasTmdbSignals) return items;
  return [...items].sort((left, right) => {
    const voteCount = Number(right.tmdb?.vote_count || 0) - Number(left.tmdb?.vote_count || 0);
    if (voteCount !== 0) return voteCount;
    return Number(right.tmdb?.vote_average || 0) - Number(left.tmdb?.vote_average || 0);
  });
}

export default function Top10Row() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    fetchMovieDiscovery(
      { kind: "list", slug: "phim-bo", page: 1, limit: 24 },
      { signal: controller.signal, timeoutMs: 7000 },
    )
      .then((result) =>
        setMovies(rankByAvailableSignals(uniqueMovies(result.items || [])).slice(0, 10)),
      )
      .catch((requestError) => {
        if (!controller.signal.aborted) {
          console.error("Unable to load featured series:", requestError);
          setError(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [retry]);

  const scroll = (direction: -1 | 1) => {
    const row = rowRef.current;
    if (!row) return;
    row.scrollBy({ left: direction * row.clientWidth * 0.82, behavior: "smooth" });
  };

  if (!loading && !error && movies.length === 0) return null;

  return (
    <section className="container mx-auto mt-14 max-w-7xl px-6" aria-labelledby="top-series-title">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.18em] text-amber-400">
            <Flame size={15} fill="currentColor" /> Tuyển chọn nổi bật
          </div>
          <h2 id="top-series-title" className="text-2xl font-black tracking-tight text-white md:text-3xl">
            Top 10 phim bộ
          </h2>
          <p className="mt-1 text-sm text-zinc-500">Những bộ phim đáng chú ý vừa cập nhật trên DlowPhim.</p>
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <button
            type="button"
            onClick={() => scroll(-1)}
            aria-label="Xem các phim phía trước"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-zinc-300 transition hover:border-amber-400/50 hover:bg-amber-400/10 hover:text-amber-300"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            onClick={() => scroll(1)}
            aria-label="Xem các phim tiếp theo"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-zinc-300 transition hover:border-amber-400/50 hover:bg-amber-400/10 hover:text-amber-300"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex gap-4 overflow-hidden pb-10 pt-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="w-[220px] shrink-0 md:w-[250px]">
              <div className="aspect-[2/3] animate-pulse rounded-3xl bg-zinc-900" />
              <div className="mt-4 h-6 w-4/5 animate-pulse rounded bg-zinc-900" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.025] px-6 py-10 text-center">
          <p className="text-sm font-semibold text-zinc-400">Chưa tải được bảng phim bộ nổi bật.</p>
          <button
            type="button"
            onClick={() => setRetry((value) => value + 1)}
            className="mt-4 rounded-full border border-amber-400/30 px-4 py-2 text-xs font-extrabold text-amber-300 transition hover:bg-amber-400/10"
          >
            Thử lại
          </button>
        </div>
      ) : (
        <div ref={rowRef} className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-12 pt-3 no-scrollbar">
          {movies.map((movie, index) => (
            <Top10MovieCard key={movie._id || movie.slug} movie={movie} index={index} />
          ))}
        </div>
      )}
    </section>
  );
}

function Top10MovieCard({ movie, index }: { movie: Movie; index: number }) {
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [popupMounted, setPopupMounted] = useState(false);
  const [popupVisible, setPopupVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const [image, setImage] = useState(getImageUrl(movie.poster_url || movie.thumb_url));

  useEffect(() => {
    setImage(getImageUrl(movie.poster_url || movie.thumb_url));
    return () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, [movie.slug, movie.poster_url, movie.thumb_url]);

  const openPopup = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    hoverTimer.current = setTimeout(() => {
      const rect = cardRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(370, Math.max(310, rect.width * 1.35));
      const left = Math.min(
        window.innerWidth - width - 14,
        Math.max(14, rect.left - (width - rect.width) / 2),
      );
      setPosition({ top: rect.top + window.scrollY - 24, left, width });
      setPopupMounted(true);
      setPopupVisible(true);
    }, 650);
  };

  const closePopup = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    closeTimer.current = setTimeout(() => {
      setPopupVisible(false);
      setPopupMounted(false);
    }, 180);
  };

  const metadata = [movie.year, movie.episode_current].filter(Boolean).join(" · ");

  return (
    <article
      ref={cardRef}
      onMouseEnter={openPopup}
      onMouseLeave={closePopup}
      onClick={() => router.push(`/movie/${movie.slug}`)}
      className="group relative w-[210px] shrink-0 snap-start cursor-pointer sm:w-[230px] lg:w-[250px]"
    >
      <div
        className={`relative aspect-[2/3] overflow-hidden rounded-[1.6rem] border border-white/10 bg-zinc-900 shadow-[0_22px_55px_rgba(0,0,0,0.48)] transition duration-300 group-hover:-translate-y-1.5 group-hover:rotate-0 group-hover:border-amber-300/50 ${index % 2 === 0 ? "-rotate-1" : "rotate-1"}`}
      >
        <ProgressiveImage
          src={image}
          alt={movie.name}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.035]"
          onError={() => {
            const fallback = getImageUrl(movie.thumb_url);
            if (fallback !== image) setImage(fallback);
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/10" />
        <div className="absolute bottom-3 right-3 flex max-w-[85%] flex-wrap justify-end gap-1.5">
          {movie.quality && (
            <span className="rounded-md bg-white/90 px-2 py-1 text-[9px] font-black uppercase text-black">
              {movie.quality}
            </span>
          )}
          {movie.lang && (
            <span className="max-w-full truncate rounded-md bg-pink-500 px-2 py-1 text-[9px] font-black uppercase text-white">
              {movie.lang}
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-start gap-3 px-1">
        <span className="-mt-1 shrink-0 text-5xl font-black italic leading-none tracking-tighter text-amber-300 md:text-6xl">
          {index + 1}
        </span>
        <div className="min-w-0 pt-0.5">
          <h3 className="truncate text-sm font-extrabold text-white transition group-hover:text-amber-300">
            {cleanMovieName(movie.name)}
          </h3>
          <p className="mt-1 truncate text-xs text-zinc-500">{cleanMovieName(movie.origin_name || "")}</p>
          {metadata && <p className="mt-1.5 truncate text-[11px] font-semibold text-zinc-400">{metadata}</p>}
        </div>
      </div>

      {popupMounted && (
        <MovieHoverPopup
          movie={movie}
          position={position}
          aspect="landscape"
          isVisible={popupVisible}
          onMouseEnter={() => closeTimer.current && clearTimeout(closeTimer.current)}
          onMouseLeave={closePopup}
        />
      )}
    </article>
  );
}
