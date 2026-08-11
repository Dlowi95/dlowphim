"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Heart, Info, LoaderCircle, Play } from "lucide-react";
import HalftoneOverlay from "@/components/HalftoneOverlay";
import MovieLanguageBadges from "@/components/MovieLanguageBadges";
import MovieQualityBadge from "@/components/MovieQualityBadge";
import { useAuth } from "@/context/AuthContext";
import { getProxyUrl, MOVIE_API_DOMAIN } from "@/utils/api";
import { fetchMovieDiscovery } from "@/utils/movieDiscovery";
import { cleanMovieName, cleanSlug, getBestMovieImage, getImageUrl } from "@/utils/movieUtils";
import { fetchMovieArtwork, LOCAL_MOVIE_IMAGE_FALLBACK } from "@/utils/movieArtwork";

interface Movie {
  _id?: string;
  name: string;
  slug: string;
  origin_name: string;
  poster_url?: string;
  thumb_url?: string;
  year?: number;
  quality?: string;
  lang?: string;
  time?: string;
  category?: Array<{ name?: string; slug?: string }>;
}

interface AnimeFeature {
  movie: Movie;
  details: any | null;
  imageUrl: string;
}

const FALLBACK_IMAGE = LOCAL_MOVIE_IMAGE_FALLBACK;

const MOBILE_ANIME_LIMIT = 15;
const MOBILE_INITIAL_PRELOAD_COUNT = 6;

const FALLBACK_ANIME: Movie[] = [
  {
    _id: "anime-fallback-1",
    name: "Đứa Con Của Thời Tiết",
    slug: "dua-con-cua-thoi-tiet",
    origin_name: "Weathering with You",
    year: 2019,
    quality: "FHD",
    lang: "Vietsub + Lồng tiếng",
    time: "112 phút",
  },
  {
    _id: "anime-fallback-2",
    name: "Thám Tử Lừng Danh Conan",
    slug: "tham-tu-lung-danh-conan",
    origin_name: "Detective Conan",
    year: 1996,
    quality: "HD",
    lang: "Vietsub",
    time: "24 phút/tập",
  },
];

const stripHtmlTags = (html?: string) =>
  (html || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

const getAgeRating = (name: string, categories: Movie["category"] = []) => {
  const slugs = categories?.map((category) => category.slug || "") || [];
  if (slugs.some((slug) => ["kinh-di", "toi-pham", "18"].includes(slug))) return "T18";
  if (slugs.some((slug) => ["hanh-dong", "hinh-su", "giat-gan", "tam-ly"].includes(slug))) return "T16";
  if (slugs.some((slug) => ["vien-tuong", "phieu-luu", "co-trang", "than-thoai"].includes(slug))) return "T13";
  return name.length % 2 === 0 ? "T13" : "P";
};

const preloadImage = (url: string) =>
  new Promise<boolean>((resolve) => {
    if (typeof window === "undefined" || !url) {
      resolve(false);
      return;
    }

    const image = new window.Image();
    let settled = false;
    const finish = (loaded: boolean) => {
      if (settled) return;
      settled = true;
      resolve(loaded);
    };

    const timeout = window.setTimeout(() => finish(false), 5000);
    image.onload = async () => {
      window.clearTimeout(timeout);
      try {
        await image.decode?.();
      } catch {}
      finish(true);
    };
    image.onerror = () => {
      window.clearTimeout(timeout);
      finish(false);
    };
    image.src = url;
  });

export default function AnimeRow() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [feature, setFeature] = useState<AnimeFeature | null>(null);
  const [preparedFeatures, setPreparedFeatures] = useState<Record<string, AnimeFeature>>({});
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [mobileDragX, setMobileDragX] = useState(0);
  const [isMobileDragging, setIsMobileDragging] = useState(false);

  const featureCacheRef = useRef(new Map<string, AnimeFeature>());
  const featureInflightRef = useRef(new Map<string, Promise<AnimeFeature>>());
  const requestIdRef = useRef(0);
  const featureRef = useRef<AnimeFeature | null>(null);
  const activeFeatureControllerRef = useRef<AbortController | null>(null);
  const featureControllersRef = useRef(new Set<AbortController>());
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef({ dragging: false, moved: false, startX: 0, scrollLeft: 0 });
  const mobileSwipeRef = useRef({
    tracking: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
  });

  const router = useRouter();
  const { user, toggleFavorite: toggleFavoriteCtx } = useAuth();
  const activeMovie = feature?.movie || null;
  const isFavorite = Boolean(activeMovie && user?.favorites?.includes(activeMovie.slug));

  useEffect(() => {
    featureRef.current = feature;
  }, [feature]);

  useEffect(() => () => {
    featureControllersRef.current.forEach((controller) => controller.abort());
    featureControllersRef.current.clear();
    activeFeatureControllerRef.current = null;
  }, []);

  const loadFeature = useCallback(async (movie: Movie, signal?: AbortSignal) => {
    const cached = featureCacheRef.current.get(movie.slug);
    if (cached) return cached;
    const inflight = featureInflightRef.current.get(movie.slug);
    if (inflight) return inflight;

    const request = (async () => {

    let details: any | null = null;
    try {
      const detailResponse = await fetch(
        getProxyUrl(`${MOVIE_API_DOMAIN}/phim/${movie.slug}`),
        { signal },
      );
      if (detailResponse.ok) {
        const payload = await detailResponse.json();
        details = payload.movie || payload.data?.item || null;
      }
    } catch (error: any) {
      if (error?.name === "AbortError") throw error;
    }

    const mergedMovie: Movie = { ...movie, ...(details || {}), slug: movie.slug };
    let finalImage = getBestMovieImage(mergedMovie, "thumb") || getBestMovieImage(movie, "thumb");

    try {
      const tmdbId = details?.tmdb?.id || "";
      const tmdbType = details?.tmdb?.type || "tv";
      const tmdb = await fetchMovieArtwork({
        slug: movie.slug,
        title: details?.origin_name || details?.name || movie.origin_name || movie.name,
        tmdbId,
        tmdbType,
      });
      if (tmdb) {
        finalImage = tmdb.backdropUrl || tmdb.posterUrl || finalImage;
        if (details) {
          details = {
            ...details,
            poster_url: tmdb.posterUrl || details.poster_url,
            thumb_url: tmdb.backdropUrl || details.thumb_url,
          };
        }
      }
    } catch (error: any) {
      if (error?.name === "AbortError") throw error;
    }

    finalImage = getImageUrl(finalImage) || FALLBACK_IMAGE;
    const imageLoaded = await preloadImage(finalImage);
    if (!imageLoaded) {
      const sourceFallback = getBestMovieImage(movie, "thumb");
      finalImage = sourceFallback ? getImageUrl(sourceFallback) : FALLBACK_IMAGE;
      await preloadImage(finalImage);
    }

    const nextFeature = { movie: mergedMovie, details, imageUrl: finalImage };
    featureCacheRef.current.set(movie.slug, nextFeature);
    setPreparedFeatures((current) =>
      current[movie.slug] ? current : { ...current, [movie.slug]: nextFeature },
    );
    return nextFeature;
    })();

    featureInflightRef.current.set(movie.slug, request);
    try {
      return await request;
    } finally {
      if (featureInflightRef.current.get(movie.slug) === request) {
        featureInflightRef.current.delete(movie.slug);
      }
    }
  }, []);

  const activateMovie = useCallback(
    async (movie: Movie, options: { initial?: boolean; prefetchOnly?: boolean } = {}) => {
      if (!options.prefetchOnly && movie.slug === featureRef.current?.movie.slug) return;

      const requestId = options.prefetchOnly ? requestIdRef.current : ++requestIdRef.current;
      if (!options.prefetchOnly) activeFeatureControllerRef.current?.abort();
      const controller = new AbortController();
      featureControllersRef.current.add(controller);
      if (!options.prefetchOnly) activeFeatureControllerRef.current = controller;
      if (!options.prefetchOnly) setPendingSlug(movie.slug);

      try {
        const nextFeature = await loadFeature(movie, controller.signal);
        if (options.prefetchOnly) return;
        if (requestId !== requestIdRef.current) return;

        if (!options.initial && featureRef.current) {
          setIsTransitioning(true);
          await new Promise((resolve) => window.setTimeout(resolve, 140));
          if (requestId !== requestIdRef.current) return;
        }

        setFeature(nextFeature);
        window.requestAnimationFrame(() =>
          window.requestAnimationFrame(() => setIsTransitioning(false)),
        );
      } catch (error: any) {
        if (error?.name !== "AbortError") {
          console.error("Không thể chuẩn bị Anime nổi bật:", error);
        }
      } finally {
        featureControllersRef.current.delete(controller);
        if (activeFeatureControllerRef.current === controller) {
          activeFeatureControllerRef.current = null;
        }
        if (!options.prefetchOnly && requestId === requestIdRef.current) {
          setPendingSlug(null);
        }
      }
    },
    [loadFeature],
  );

  useEffect(() => {
    const controller = new AbortController();

    async function fetchAnime() {
      setLoadingList(true);
      try {
        const data = await fetchMovieDiscovery(
          { kind: "list", slug: "hoat-hinh", page: 1, limit: 18 },
          { signal: controller.signal, timeoutMs: 6500 },
        );

        const sourceItems = data.status === true && data.items?.length ? data.items : FALLBACK_ANIME;
        const seen = new Set<string>();
        const uniqueItems = sourceItems
          .filter((item: Movie) => {
            const slug = cleanSlug(item.slug);
            if (!slug || seen.has(slug)) return false;
            seen.add(slug);
            return true;
          })
          .slice(0, 15);

        setMovies(uniqueItems);
        if (uniqueItems[0]) await activateMovie(uniqueItems[0], { initial: true });

        // Prepare only the first mobile slides ahead of interaction. The remaining
        // slides load lazily from the neighbor-prefetch effect as the user swipes.
        const mobileCandidates = uniqueItems.slice(1, MOBILE_INITIAL_PRELOAD_COUNT);
        void (async () => {
          for (let index = 0; index < mobileCandidates.length; index += 2) {
            await Promise.all(
              mobileCandidates
                .slice(index, index + 2)
                .map((candidate) => loadFeature(candidate, controller.signal).catch(() => null)),
            );
          }
        })();
      } catch (error: any) {
        if (error?.name !== "AbortError") {
          setMovies(FALLBACK_ANIME);
          await activateMovie(FALLBACK_ANIME[0], { initial: true });
        }
      } finally {
        if (!controller.signal.aborted) setLoadingList(false);
      }
    }

    void fetchAnime();
    return () => controller.abort();
  }, [activateMovie, loadFeature]);

  useEffect(() => {
    if (!feature || movies.length < 2) return;
    const currentIndex = movies.findIndex((movie) => movie.slug === feature.movie.slug);
    const neighbors = [movies[currentIndex + 1], movies[currentIndex + 2]].filter(Boolean);

    const idleId = window.setTimeout(() => {
      neighbors.forEach((movie) => {
        if (!featureCacheRef.current.has(movie.slug)) {
          void activateMovie(movie, { prefetchOnly: true });
        }
      });
    }, 450);

    return () => window.clearTimeout(idleId);
  }, [activateMovie, feature, movies]);

  const handleMouseDown = (event: React.MouseEvent) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    dragStateRef.current = {
      dragging: true,
      moved: false,
      startX: event.pageX - container.offsetLeft,
      scrollLeft: container.scrollLeft,
    };
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    const container = scrollContainerRef.current;
    const drag = dragStateRef.current;
    if (!container || !drag.dragging) return;
    event.preventDefault();
    const walk = (event.pageX - container.offsetLeft - drag.startX) * 1.4;
    if (Math.abs(walk) > 5) drag.moved = true;
    container.scrollLeft = drag.scrollLeft - walk;
  };

  const endDrag = () => {
    dragStateRef.current.dragging = false;
    window.setTimeout(() => {
      dragStateRef.current.moved = false;
    }, 60);
  };

  const beginMobileSwipe = (
    target: EventTarget | null,
    clientX: number,
    clientY: number,
  ) => {
    if ((target as HTMLElement | null)?.closest?.("button, a")) {
      mobileSwipeRef.current.tracking = false;
      return;
    }

    mobileSwipeRef.current = {
      tracking: true,
      startX: clientX,
      startY: clientY,
      currentX: clientX,
      currentY: clientY,
    };
    setMobileDragX(0);
    setIsMobileDragging(true);
  };

  const resetMobileSwipe = () => {
    mobileSwipeRef.current.tracking = false;
    setMobileDragX(0);
    setIsMobileDragging(false);
  };

  const trackMobileSwipe = (
    clientX: number,
    clientY: number,
    viewportWidth: number,
  ) => {
    if (!mobileSwipeRef.current.tracking) return false;

    mobileSwipeRef.current.currentX = clientX;
    mobileSwipeRef.current.currentY = clientY;

    const deltaX = clientX - mobileSwipeRef.current.startX;
    const deltaY = clientY - mobileSwipeRef.current.startY;
    if (Math.abs(deltaX) <= Math.abs(deltaY)) return false;

    const mobileMovies = movies.slice(0, MOBILE_ANIME_LIMIT);
    const currentIndex = mobileMovies.findIndex(
      (item) => item.slug === featureRef.current?.movie.slug,
    );
    const pullingPastEdge =
      (currentIndex <= 0 && deltaX > 0) ||
      (currentIndex >= mobileMovies.length - 1 && deltaX < 0);
    const trackedDelta = pullingPastEdge ? deltaX * 0.22 : deltaX * 0.92;

    setMobileDragX(
      Math.max(-viewportWidth, Math.min(viewportWidth, trackedDelta)),
    );
    return true;
  };

  const finishMobileSwipe = (clientX: number, clientY: number) => {
    const swipe = { ...mobileSwipeRef.current };
    resetMobileSwipe();
    const mobileMovies = movies.slice(0, MOBILE_ANIME_LIMIT);
    if (!swipe.tracking || pendingSlug || mobileMovies.length < 2) return;

    const deltaX = clientX - swipe.startX;
    const deltaY = clientY - swipe.startY;

    if (Math.abs(deltaX) < 32 || Math.abs(deltaX) <= Math.abs(deltaY)) return;

    const currentIndex = mobileMovies.findIndex(
      (item) => item.slug === featureRef.current?.movie.slug,
    );
    const nextIndex =
      deltaX < 0
        ? Math.min(currentIndex + 1, mobileMovies.length - 1)
        : Math.max(currentIndex - 1, 0);

    if (nextIndex === currentIndex) return;

    const nextMovie = mobileMovies[nextIndex];
    if (!nextMovie) return;

    const prepared = featureCacheRef.current.get(nextMovie.slug);
    if (prepared) {
      requestIdRef.current += 1;
      setPendingSlug(null);
      setIsTransitioning(false);
      setFeature(prepared);
      return;
    }

    void activateMovie(nextMovie);
  };

  const handleMobileTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (touch) beginMobileSwipe(event.target, touch.clientX, touch.clientY);
  };

  const handleMobileTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch || !mobileSwipeRef.current.tracking) return;
    const isHorizontalSwipe = trackMobileSwipe(
      touch.clientX,
      touch.clientY,
      event.currentTarget.clientWidth || 360,
    );
    if (isHorizontalSwipe && event.cancelable) event.preventDefault();
  };

  const handleMobileTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.changedTouches[0];
    finishMobileSwipe(
      touch?.clientX ?? mobileSwipeRef.current.currentX,
      touch?.clientY ?? mobileSwipeRef.current.currentY,
    );
  };

  const handleMobileMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    beginMobileSwipe(event.target, event.clientX, event.clientY);
  };

  const handleMobileMouseUp = (event: React.MouseEvent<HTMLDivElement>) => {
    finishMobileSwipe(event.clientX, event.clientY);
  };

  const handleMobileMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!mobileSwipeRef.current.tracking) return;
    trackMobileSwipe(
      event.clientX,
      event.clientY,
      event.currentTarget.clientWidth || 360,
    );
  };

  if (loadingList || !feature) return <AnimeSkeleton />;
  if (!movies.length) return null;

  const movie = feature.movie;
  const details = feature.details;
  const title = cleanMovieName(movie.name);
  const originName = cleanMovieName(movie.origin_name);
  const categories = details?.category || movie.category || [];
  const genreNames = categories
    .map((category: { name?: string }) => category.name)
    .filter(Boolean)
    .slice(0, 4);
  const description = stripHtmlTags(details?.content) || "Khám phá câu chuyện, nhân vật và thế giới hoạt hình đặc sắc trong bộ phim này.";
  const imdbScore = details?.imdb?.vote_average || details?.tmdb?.vote_average || "7.5";
  const year = details?.year || movie.year || "—";
  const duration = details?.time || movie.time || "24 phút/tập";
  const quality = details?.quality || movie.quality || "HD";
  const language = details?.lang || movie.lang || "Vietsub";
  const ageRating = getAgeRating(title, categories);

  const toggleFavorite = async (event: React.MouseEvent) => {
    event.stopPropagation();
    await toggleFavoriteCtx(movie.slug);
  };

  const mobileMovies = movies.slice(0, MOBILE_ANIME_LIMIT);
  const activeMobileIndex = Math.max(
    0,
    mobileMovies.findIndex((item) => item.slug === movie.slug),
  );

  const selectMobileMovie = (item: Movie) => {
    const prepared = featureCacheRef.current.get(item.slug);
    if (prepared) {
      requestIdRef.current += 1;
      setPendingSlug(null);
      setIsTransitioning(false);
      setFeature(prepared);
      return;
    }

    void activateMovie(item);
  };

  return (
    <section className="container mx-auto mt-10 max-w-[1400px] select-none px-4 text-left md:mt-12">
      <div className="mb-5 flex items-center gap-2 md:mb-6">
        <h3 className="text-[21px] font-black uppercase leading-tight tracking-tight text-zinc-100 md:text-2xl">
          Kho Tàng Anime Mới Nhất
        </h3>
        <Link
          href="/the-loai/hoat-hinh"
          aria-label="Xem toàn bộ Anime"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900/60 transition-colors hover:border-pink-500 hover:text-pink-500"
        >
          <ChevronRight size={16} />
        </Link>
      </div>

      <div
        className={`transition-[opacity,transform,filter] duration-300 ease-out ${
          isTransitioning ? "scale-[0.992] opacity-30 blur-[1px]" : "scale-100 opacity-100 blur-0"
        }`}
      >
        <div
          onTouchStart={handleMobileTouchStart}
          onTouchMove={handleMobileTouchMove}
          onTouchEnd={handleMobileTouchEnd}
          onTouchCancel={resetMobileSwipe}
          onMouseDown={handleMobileMouseDown}
          onMouseMove={handleMobileMouseMove}
          onMouseUp={handleMobileMouseUp}
          onMouseLeave={resetMobileSwipe}
          onDragStart={(event) => event.preventDefault()}
          style={{ touchAction: "pan-y", overscrollBehaviorX: "contain" }}
          className="cursor-grab overflow-hidden rounded-[22px] border border-white/[0.07] bg-[#171925] shadow-[0_20px_60px_rgba(0,0,0,0.35)] active:cursor-grabbing md:hidden"
        >
          <div
            className={`flex will-change-transform ${
              isMobileDragging
                ? "transition-none"
                : "transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
            }`}
            style={{
              transform: `translate3d(calc(${-activeMobileIndex * 100}% + ${mobileDragX}px), 0, 0)`,
            }}
          >
            {mobileMovies.map((item, index) => {
              const prepared = preparedFeatures[item.slug];
              return (
                <div key={item._id || item.slug} className="w-full min-w-full">
                  {prepared ? (
                    <MobileAnimeFeatureCard
                      feature={prepared}
                      isActive={index === activeMobileIndex}
                      isPending={pendingSlug === item.slug}
                      isFavorite={Boolean(user?.favorites?.includes(item.slug))}
                      onFavorite={async (event) => {
                        event.stopPropagation();
                        await toggleFavoriteCtx(item.slug);
                      }}
                      onWatch={() => router.push(`/watch/${item.slug}`)}
                      onInfo={() => router.push(`/movie/${item.slug}`)}
                    />
                  ) : (
                    <MobileAnimeSlideSkeleton />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="relative hidden w-full overflow-hidden rounded-3xl border border-zinc-800/40 bg-[#111219] p-8 shadow-2xl md:flex md:flex-col lg:p-10">
          <DesktopAnimeFeature
            feature={feature}
            title={title}
            originName={originName}
            imdbScore={imdbScore}
            ageRating={ageRating}
            year={year}
            duration={duration}
            quality={quality}
            language={language}
            genres={genreNames}
            description={description}
            isFavorite={isFavorite}
            onFavorite={toggleFavorite}
            onWatch={() => router.push(`/watch/${movie.slug}`)}
            onInfo={() => router.push(`/movie/${movie.slug}`)}
          />

          <div className="relative z-20 w-full border-t border-zinc-800/40 pt-6">
            <div
              ref={scrollContainerRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={endDrag}
              onMouseLeave={endDrag}
              className="no-scrollbar grid w-full cursor-grab grid-cols-[repeat(15,minmax(0,1fr))] gap-2.5 overflow-visible pb-1"
            >
              {movies.map((item) => (
                <AnimeThumbCard
                  key={item._id || item.slug}
                  movie={item}
                  isActive={item.slug === movie.slug}
                  isPending={item.slug === pendingSlug}
                  onClick={() => {
                    if (!dragStateRef.current.moved) void activateMovie(item);
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-2 md:hidden" aria-label="Chọn Anime nổi bật">
        {mobileMovies.map((item) => {
          const active = item.slug === (pendingSlug || movie.slug);
          const pending = item.slug === pendingSlug;
          return (
            <button
              key={item._id || item.slug}
              onClick={() => selectMobileMovie(item)}
              aria-label={`Hiển thị ${cleanMovieName(item.name)}`}
              aria-current={active ? "true" : undefined}
              className={`h-2 rounded-full transition-all duration-300 ${
                active
                  ? pending
                    ? "w-6 animate-pulse bg-pink-300"
                    : "w-6 bg-pink-500"
                  : "w-2 bg-zinc-600 hover:bg-zinc-400"
              }`}
            />
          );
        })}
      </div>

    </section>
  );
}

function MobileAnimeFeatureCard(props: {
  feature: AnimeFeature;
  isActive: boolean;
  isPending: boolean;
  isFavorite: boolean;
  onFavorite: (event: React.MouseEvent) => void;
  onWatch: () => void;
  onInfo: () => void;
}) {
  const movie = props.feature.movie;
  const details = props.feature.details;
  const title = cleanMovieName(movie.name);
  const originName = cleanMovieName(movie.origin_name);
  const categories = details?.category || movie.category || [];
  const genres = categories
    .map((category: { name?: string }) => category.name)
    .filter(Boolean)
    .slice(0, 4);
  const description =
    stripHtmlTags(details?.content) ||
    "Khám phá câu chuyện, nhân vật và thế giới hoạt hình đặc sắc trong bộ phim này.";
  const imdbScore = details?.imdb?.vote_average || details?.tmdb?.vote_average || "7.5";
  const year = details?.year || movie.year || "—";
  const duration = details?.time || movie.time || "24 phút/tập";
  const quality = details?.quality || movie.quality || "HD";
  const language = details?.lang || movie.lang || "Vietsub";
  const ageRating = getAgeRating(title, categories);

  return (
    <article className="w-full overflow-hidden bg-[#171925]">
      <div className="relative aspect-[16/10] overflow-hidden bg-zinc-900">
        <img
          src={props.feature.imageUrl}
          alt={title}
          draggable={false}
          loading={props.isActive ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={props.isActive ? "high" : "low"}
          className="h-full w-full object-cover [transform:translateZ(0)]"
          onError={(event) => {
            event.currentTarget.src = FALLBACK_IMAGE;
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#171925] via-transparent to-black/5" />
        <HalftoneOverlay />
        {props.isPending && (
          <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-black/65 px-2.5 py-1 text-[10px] font-bold text-zinc-200 backdrop-blur-md">
            <LoaderCircle size={12} className="animate-spin text-pink-400" />
            Đang chuẩn bị
          </div>
        )}
      </div>

      <div className="relative z-10 -mt-6 min-w-0 px-4 pb-4">
        <h4 className="block overflow-hidden text-ellipsis whitespace-nowrap text-[20px] font-black leading-tight text-white" title={title}>
          {title}
        </h4>
        <p className="mt-1 block overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-bold text-pink-400" title={originName}>
          {originName}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-zinc-300">
          <span className="rounded-md border border-amber-400/70 bg-amber-400/10 px-1.5 py-0.5 text-amber-300">
            IMDb {imdbScore}
          </span>
          <span className="rounded-md border border-white/15 bg-white/5 px-1.5 py-0.5">{ageRating}</span>
          <span className="rounded-md border border-white/15 bg-white/5 px-1.5 py-0.5">{year}</span>
          <span className="rounded-md border border-white/15 bg-white/5 px-1.5 py-0.5">{duration}</span>
          <MovieQualityBadge quality={quality} className="ml-0.5" />
        </div>

        <MovieLanguageBadges lang={language} className="mt-2 flex flex-wrap gap-1" />

        {!!genres.length && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {genres.map((genre: string) => (
              <span key={genre} className="rounded-md bg-white/[0.07] px-2 py-1 text-[10px] font-semibold text-zinc-300">
                {genre}
              </span>
            ))}
          </div>
        )}

        <p className="mt-3 line-clamp-3 text-[12px] font-medium leading-5 text-zinc-400">
          {description}
        </p>

        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            onClick={props.onWatch}
            className="flex h-9 items-center justify-center gap-1.5 rounded-lg bg-pink-500 px-4 text-[11px] font-black text-white shadow-[0_8px_22px_rgba(236,72,153,0.25)] active:scale-[0.98]"
          >
            <Play size={13} className="fill-current" /> Xem phim
          </button>
          <div className="flex items-center gap-2">
            <button onClick={props.onFavorite} aria-label="Yêu thích" className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.05] text-zinc-300">
              <Heart size={15} className={props.isFavorite ? "fill-pink-500 text-pink-500" : ""} />
            </button>
            <button onClick={props.onInfo} aria-label="Thông tin phim" className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.05] text-zinc-300">
              <Info size={15} />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function MobileAnimeSlideSkeleton() {
  return (
    <div className="w-full bg-[#171925]">
      <div className="aspect-[16/10] animate-pulse bg-zinc-900" />
      <div className="space-y-3 px-4 pb-4 pt-3">
        <div className="h-6 w-3/4 animate-pulse rounded bg-zinc-800" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-zinc-800" />
        <div className="h-16 w-full animate-pulse rounded bg-zinc-800/70" />
      </div>
    </div>
  );
}

function DesktopAnimeFeature(props: {
  feature: AnimeFeature;
  title: string;
  originName: string;
  imdbScore: string | number;
  ageRating: string;
  year: string | number;
  duration: string;
  quality: string;
  language: string;
  genres: string[];
  description: string;
  isFavorite: boolean;
  onFavorite: (event: React.MouseEvent) => void;
  onWatch: () => void;
  onInfo: () => void;
}) {
  return (
    <div className="relative z-10 mb-8 flex min-h-[380px] w-full items-center overflow-hidden lg:mb-10">
      <div className="pointer-events-none absolute inset-y-0 right-0 z-0 h-full w-[65%] overflow-hidden rounded-r-3xl">
        <img src={props.feature.imageUrl} alt={props.title} className="h-full w-full object-cover object-center" />
        <HalftoneOverlay />
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-[72%] bg-gradient-to-r from-[#111219] via-[#111219] via-55% to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-1/4 bg-gradient-to-t from-[#111219] to-transparent" />

      <div className="relative z-10 flex w-[52%] flex-col pr-4">
        <h4
          title={props.title}
          className="block max-w-full truncate whitespace-nowrap text-3xl font-black leading-tight text-zinc-100"
        >
          {props.title}
        </h4>
        <p className="mt-1.5 line-clamp-1 text-[13px] font-bold text-pink-500">{props.originName}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] font-bold text-zinc-300">
          <span className="rounded border border-amber-500/50 bg-amber-500/10 px-1.5 py-0.5 text-amber-400">IMDb {props.imdbScore}</span>
          <span className="rounded border border-zinc-700 bg-zinc-800/60 px-1.5 py-0.5">{props.ageRating}</span>
          <span>{props.year}</span><span>•</span><span>{props.duration}</span>
          <MovieQualityBadge quality={props.quality} />
        </div>
        <MovieLanguageBadges lang={props.language} className="mt-2 flex gap-1" />
        {!!props.genres.length && <p className="mt-3 text-[11px] font-bold uppercase tracking-wide text-zinc-500">{props.genres.join(" • ")}</p>}
        <p className="mt-4 line-clamp-4 max-w-[92%] text-sm font-medium leading-relaxed text-zinc-400">{props.description}</p>
        <div className="mt-6 flex items-center gap-4">
          <button onClick={props.onWatch} className="flex h-14 w-14 items-center justify-center rounded-full bg-pink-500 text-white transition-transform hover:scale-105">
            <Play size={20} className="ml-0.5 fill-current" />
          </button>
          <button onClick={props.onFavorite} className="flex h-12 w-12 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900/50 text-zinc-300">
            <Heart size={17} className={props.isFavorite ? "fill-pink-500 text-pink-500" : ""} />
          </button>
          <button onClick={props.onInfo} className="flex h-12 w-12 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900/50 text-zinc-300"><Info size={17} /></button>
        </div>
      </div>
    </div>
  );
}

function AnimeThumbCard({ movie, isActive, isPending, onClick }: { movie: Movie; isActive: boolean; isPending: boolean; onClick: () => void }) {
  const [imgSrc, setImgSrc] = useState(() => getBestMovieImage(movie, "poster"));

  useEffect(() => {
    setImgSrc(getBestMovieImage(movie, "poster"));
  }, [movie]);

  return (
    <button
      onClick={onClick}
      aria-label={`Hiển thị ${cleanMovieName(movie.name)}`}
      className={`relative aspect-[2/3] w-auto overflow-hidden rounded-xl border transition-all duration-300 ${
        isActive
          ? "scale-105 border-2 border-pink-500 shadow-[0_0_15px_rgba(236,72,153,0.5)]"
          : "border-zinc-800/60 hover:border-pink-500/50"
      } ${isPending ? "animate-pulse" : ""}`}
    >
      <img
        src={imgSrc}
        alt={cleanMovieName(movie.name)}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover object-top"
        onError={() => setImgSrc(movie.poster_url ? getImageUrl(movie.poster_url) : FALLBACK_IMAGE)}
      />
    </button>
  );
}

function AnimeSkeleton() {
  return (
    <section className="container mx-auto mt-10 max-w-[1400px] select-none px-4 md:mt-12">
      <div className="mb-5 h-7 w-64 animate-pulse rounded-lg bg-zinc-800" />
      <div className="overflow-hidden rounded-[22px] border border-white/[0.06] bg-[#171925] md:rounded-3xl">
        <div className="aspect-[16/10] animate-pulse bg-zinc-900 md:h-[390px] md:aspect-auto" />
        <div className="space-y-3 p-4 md:hidden">
          <div className="h-6 w-3/4 animate-pulse rounded bg-zinc-800" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-zinc-800" />
          <div className="h-16 w-full animate-pulse rounded bg-zinc-800/70" />
        </div>
      </div>
    </section>
  );
}
