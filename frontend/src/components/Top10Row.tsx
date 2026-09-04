"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import MovieHoverPopup from "@/components/MovieHoverPopup";
import ProgressiveImage from "@/components/ProgressiveImage";
import MovieLanguageBadges from "@/components/MovieLanguageBadges";
import { cleanMovieName, getImageUrl } from "@/utils/movieUtils";
import { fetchMovieDiscovery } from "@/utils/movieDiscovery";
import { canTriggerHoverPopup, isFineHoverCapability, isTouchOrPenInteraction, recordTouchInteraction, subscribeToFineHoverCapability } from "@/utils/hoverCardGuard";

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

// Hai hình poster đối xứng tạo nhịp ziczac. Các điểm quanh bốn góc giữ
// đường cắt mềm, thay vì dùng polygon bốn điểm khiến card trông thô cứng.
const ODD_POSTER_SHAPE =
  "polygon(94.239% 100%,5.761% 100%,4.826% 99.95%,3.94% 99.803%,3.113% 99.569%,2.358% 99.256%,1.687% 98.87%,1.111% 98.421%,.643% 97.915%,.294% 97.362%,.075% 96.768%,0 96.142%,0 3.858%,.087% 3.185%,.338% 2.552%,.737% 1.968%,1.269% 1.442%,1.92% .984%,2.672% .602%,3.512% .306%,4.423% .105%,5.391% .008%,6.4% .024%,94.879% 6.625%,95.731% 6.732%,96.532% 6.919%,97.272% 7.178%,97.942% 7.503%,98.533% 7.887%,99.038% 8.323%,99.445% 8.805%,99.747% 9.326%,99.935% 9.88%,100% 10.459%,100% 96.142%,99.925% 96.768%,99.706% 97.362%,99.357% 97.915%,98.889% 98.421%,98.313% 98.87%,97.642% 99.256%,96.887% 99.569%,96.06% 99.803%,95.174% 99.95%)";

const EVEN_POSTER_SHAPE =
  "polygon(5.761% 100%,94.239% 100%,95.174% 99.95%,96.06% 99.803%,96.887% 99.569%,97.642% 99.256%,98.313% 98.87%,98.889% 98.421%,99.357% 97.915%,99.706% 97.362%,99.925% 96.768%,100% 96.142%,100% 3.858%,99.913% 3.185%,99.662% 2.552%,99.263% 1.968%,98.731% 1.442%,98.08% .984%,97.328% .602%,96.488% .306%,95.577% .105%,94.609% .008%,93.6% .024%,5.121% 6.625%,4.269% 6.732%,3.468% 6.919%,2.728% 7.178%,2.058% 7.503%,1.467% 7.887%,.962% 8.323%,.555% 8.805%,.253% 9.326%,.065% 9.88%,0 10.459%,0 96.142%,.075% 96.768%,.294% 97.362%,.643% 97.915%,1.111% 98.421%,1.687% 98.87%,2.358% 99.256%,3.113% 99.569%,3.94% 99.803%,4.826% 99.95%)";

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
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
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

  useEffect(() => {
    const row = rowRef.current;
    if (!row || loading || error) return;
    const updateScrollButtons = () => {
      setCanScrollLeft(row.scrollLeft > 8);
      setCanScrollRight(row.scrollLeft + row.clientWidth < row.scrollWidth - 8);
    };
    updateScrollButtons();
    row.addEventListener("scroll", updateScrollButtons, { passive: true });
    const observer = new ResizeObserver(updateScrollButtons);
    observer.observe(row);
    return () => {
      row.removeEventListener("scroll", updateScrollButtons);
      observer.disconnect();
    };
  }, [loading, error, movies.length]);

  const scroll = (direction: -1 | 1) => {
    const row = rowRef.current;
    if (!row) return;
    const firstCard = row.firstElementChild as HTMLElement | null;
    if (!firstCard) return;

    const styles = window.getComputedStyle(row);
    const gap = Number.parseFloat(styles.columnGap || styles.gap || "0") || 0;
    const cardStep = firstCard.getBoundingClientRect().width + gap;

    row.scrollBy({ left: direction * cardStep, behavior: "smooth" });
  };

  if (!loading && !error && movies.length === 0) return null;

  return (
    <section className="relative mt-10 overflow-hidden bg-[#191b24] py-7 sm:mt-14 sm:py-10 md:py-12" aria-labelledby="top-series-title">
      <div className="mx-auto max-w-[1920px] px-4 sm:px-5 md:px-8">
        <h2 id="top-series-title" className="mb-5 text-[22px] font-semibold tracking-tight text-white sm:mb-6 sm:text-[26px] md:mb-7 md:text-[32px]">
          Top 10 phim bộ hôm nay
        </h2>

      {loading ? (
        <div className="flex gap-2.5 overflow-hidden pb-7 pt-1 md:gap-4 md:pb-10">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="w-[calc((100%_-_10px)/2)] shrink-0 md:w-[calc((100%_-_32px)/3)] min-[1025px]:w-[calc((100%_-_48px)/4)] xl:w-[calc((100%_-_64px)/5)] min-[1600px]:w-[calc((100%_-_80px)/6)]">
              <div className="aspect-[2/3] animate-pulse bg-white/5" />
              <div className="mt-4 h-6 w-4/5 animate-pulse rounded bg-zinc-900" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-white/10 bg-black/15 px-6 py-10 text-center">
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
        <div className="relative">
          <div
            ref={rowRef}
            className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-2 no-scrollbar md:gap-4"
          >
            {movies.map((movie, index) => (
              <Top10MovieCard key={movie._id || movie.slug} movie={movie} index={index} />
            ))}
          </div>
          <button
            type="button"
            onClick={() => scroll(-1)}
            disabled={!canScrollLeft}
            aria-label="Xem các phim phía trước"
            className="absolute -left-1.5 top-[38%] z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-[#191b24]/95 text-zinc-200 shadow-[0_0_18px_4px_rgba(0,0,0,0.28)] transition hover:border-white/40 hover:text-white disabled:pointer-events-none disabled:opacity-30 sm:-left-2 sm:top-[40%] sm:h-10 sm:w-10"
          >
            <ChevronLeft size={20} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            onClick={() => scroll(1)}
            disabled={!canScrollRight}
            aria-label="Xem các phim tiếp theo"
            className="absolute -right-1.5 top-[38%] z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-[#191b24]/95 text-zinc-200 shadow-[0_0_18px_4px_rgba(0,0,0,0.28)] transition hover:border-white/40 hover:text-white disabled:pointer-events-none disabled:opacity-30 sm:-right-2 sm:top-[40%] sm:h-10 sm:w-10"
          >
            <ChevronRight size={20} strokeWidth={1.8} />
          </button>
        </div>
      )}
      </div>
    </section>
  );
}

function Top10MovieCard({ movie, index }: { movie: Movie; index: number }) {
  const router = useRouter();
  const cardRef = useRef<HTMLAnchorElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [popupMounted, setPopupMounted] = useState(false);
  const [popupVisible, setPopupVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const [image, setImage] = useState(getImageUrl(movie.poster_url || movie.thumb_url));
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    setImage(getImageUrl(movie.poster_url || movie.thumb_url));
    const unsubscribe = subscribeToFineHoverCapability((hasCapability) => {
      if (!hasCapability) {
        if (hoverTimer.current) clearTimeout(hoverTimer.current);
        if (closeTimer.current) clearTimeout(closeTimer.current);
        setPopupVisible(false);
        setPopupMounted(false);
      }
    });
    return () => {
      unsubscribe();
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
      if (closeTimer.current) clearTimeout(closeTimer.current);
      if (navTimer.current) clearTimeout(navTimer.current);
    };
  }, [movie.slug, movie.poster_url, movie.thumb_url]);

  const cancelPopupAndTimers = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setPopupVisible(false);
    setPopupMounted(false);
  };

  const handlePointerEnter = (e: React.PointerEvent<HTMLAnchorElement>) => {
    if (!canTriggerHoverPopup(e)) {
      cancelPopupAndTimers();
      return;
    }
    if (closeTimer.current) clearTimeout(closeTimer.current);

    try {
      router.prefetch(`/movie/${movie.slug}`);
    } catch {}

    hoverTimer.current = setTimeout(() => {
      if (!isFineHoverCapability()) {
        cancelPopupAndTimers();
        return;
      }
      const rect = cardRef.current?.getBoundingClientRect();
      if (!rect) return;
      const cardCenter = rect.left + rect.width / 2;
      const availableHalfWidth = Math.max(
        rect.width / 2,
        Math.min(cardCenter - 14, window.innerWidth - cardCenter - 14),
      );
      const preferredWidth = Math.min(370, Math.max(310, rect.width * 1.35));
      const width = Math.max(rect.width, Math.min(preferredWidth, availableHalfWidth * 2));
      const left = cardCenter - width / 2;
      setPosition({ top: rect.top + window.scrollY - 24, left, width });
      setPopupMounted(true);
      setPopupVisible(true);
    }, 650);
  };

  const handlePointerLeave = (e: React.PointerEvent<HTMLAnchorElement>) => {
    if (isTouchOrPenInteraction(e)) {
      cancelPopupAndTimers();
      return;
    }
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    closeTimer.current = setTimeout(() => {
      setPopupVisible(false);
      setPopupMounted(false);
    }, 180);
  };

  const handlePopupLeave = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    closeTimer.current = setTimeout(() => {
      setPopupVisible(false);
      setPopupMounted(false);
    }, 180);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLAnchorElement>) => {
    if (isTouchOrPenInteraction(e)) {
      recordTouchInteraction();
      cancelPopupAndTimers();
    }
  };

  const handleTouchStart = () => {
    recordTouchInteraction();
    cancelPopupAndTimers();
  };

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      return;
    }
    if (isNavigating) {
      e.preventDefault();
      return;
    }
    setIsNavigating(true);
    if (navTimer.current) clearTimeout(navTimer.current);
    navTimer.current = setTimeout(() => setIsNavigating(false), 3500);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLAnchorElement>) => {
    if (e.key === " ") {
      e.preventDefault();
      if (!isNavigating) {
        setIsNavigating(true);
        if (navTimer.current) clearTimeout(navTimer.current);
        navTimer.current = setTimeout(() => setIsNavigating(false), 3500);
        router.push(`/movie/${movie.slug}`);
      }
    }
  };

  const metadata = [movie.year, movie.episode_current].filter(Boolean).join(" · ");
  const fanShape = index % 2 === 0 ? ODD_POSTER_SHAPE : EVEN_POSTER_SHAPE;

  return (
    <Link
      ref={cardRef}
      href={`/movie/${movie.slug}`}
      data-testid="top10-card"
      data-movie-slug={movie.slug}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onPointerDown={handlePointerDown}
      onTouchStart={handleTouchStart}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label={`Xem thông tin phim ${cleanMovieName(movie.name)}`}
      aria-busy={isNavigating}
      className={`group relative block w-[calc((100%_-_10px)/2)] shrink-0 snap-start cursor-pointer transition-opacity duration-200 outline-none focus-visible:ring-2 focus-visible:ring-pink-500 md:w-[calc((100%_-_32px)/3)] min-[1025px]:w-[calc((100%_-_48px)/4)] xl:w-[calc((100%_-_64px)/5)] min-[1600px]:w-[calc((100%_-_80px)/6)] ${isNavigating ? "opacity-70" : ""}`}
    >
      <div
        className="relative aspect-[2/3] overflow-hidden bg-white/5 shadow-[0_0_10px_5px_rgba(0,0,0,0.1)] transition-colors duration-300 group-hover:bg-pink-500"
        style={{ clipPath: fanShape }}
      >
        <div
          className="absolute inset-0 transition-all duration-300 group-hover:inset-1"
          style={{ clipPath: fanShape }}
        >
          <ProgressiveImage
            src={image}
            alt={movie.name}
            className="h-full w-full object-cover"
            onError={() => {
              const fallback = getImageUrl(movie.thumb_url);
              if (fallback !== image) setImage(fallback);
            }}
          />
        </div>
        <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-black/20 via-transparent to-black/5" />
        <MovieLanguageBadges
          lang={movie.lang}
          className="absolute bottom-2 right-2 z-[2] flex max-w-[92%] flex-wrap justify-end gap-1 sm:bottom-3 sm:right-3"
          badgeClassName="px-2 py-1 text-[9px] sm:text-[10px]"
        />
      </div>

      <div className="relative mt-2.5 min-h-[76px] pl-[47px] text-left sm:mt-3 sm:min-h-[88px] sm:pl-[62px]">
        <span className="absolute -left-0.5 -top-0.5 w-[40px] bg-gradient-to-tr from-[#fecf59] to-[#fff1cc] bg-clip-text text-center text-[3.25rem] font-extrabold italic leading-none text-transparent sm:left-0 sm:top-0 sm:w-[48px] sm:text-[4rem]">
          {index + 1}
        </span>
        <div className="min-w-0 pt-0.5">
          <h3 className="truncate text-[13px] font-semibold leading-5 text-white transition group-hover:text-[#ffdc7b] sm:text-[14px] md:text-[15px]">
            {cleanMovieName(movie.name)}
          </h3>
          <p className="mt-0.5 truncate text-[11px] leading-4 text-zinc-400 sm:mt-1 sm:text-[12px]">{cleanMovieName(movie.origin_name || "")}</p>
          {metadata && <p className="mt-1.5 truncate text-[11px] font-semibold leading-4 text-zinc-200 sm:mt-2 sm:text-[12px]">{metadata}</p>}
        </div>
      </div>

      {popupMounted && (
        <MovieHoverPopup
          movie={movie}
          position={position}
          aspect="landscape"
          isVisible={popupVisible}
          onMouseEnter={() => closeTimer.current && clearTimeout(closeTimer.current)}
          onMouseLeave={handlePopupLeave}
        />
      )}
    </Link>
  );
}
