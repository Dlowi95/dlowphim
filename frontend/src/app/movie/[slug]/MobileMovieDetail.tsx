"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  BellRing,
  Check,
  ChevronDown,
  Clock3,
  Compass,
  Heart,
  Image as ImageIcon,
  Info,
  Loader2,
  ListVideo,
  MessageSquare,
  Play,
  Plus,
  Share2,
  Star,
  Tv,
  Users,
  X,
} from "lucide-react";
import CommentRatingSection from "@/components/CommentRatingSection";
import MovieCard from "@/components/MovieCard";
import ProgressiveImage from "@/components/ProgressiveImage";
import HalftoneOverlay from "@/components/HalftoneOverlay";
import { getImageUrl } from "@/utils/movieUtils";
import { getEpisodeBatchRange, normalizeEpisodeKey } from "@/utils/episodeUtils";
import type { MovieDetail, Server } from "./MovieDetailClient";
import { LOCAL_MOVIE_IMAGE_FALLBACK } from "@/utils/movieArtwork";

interface PlaylistItem {
  id: string;
  name: string;
  movies?: string[];
}

export type MobileMovieSection = "episodes" | "actors" | "gallery" | "recommendations";

interface MobileMovieDetailProps {
  movie: MovieDetail;
  slug: string;
  cleanedName: string;
  cleanedOrigin: string;
  backdropSrc: string;
  posterSrc: string;
  movieScore: number;
  movieAgeRating: string;
  isTrailerOnly: boolean;
  isFavorite: boolean;
  reminderActive: boolean;
  reminderLoading: boolean;
  shareCopied: boolean;
  currentEpisodeName?: string;
  continueLabel: string;
  playlists?: PlaylistItem[];
  playlistBusyId: string | null;
  newPlaylistName: string;
  isCreatingPlaylist: boolean;
  tmdbCredits: any[];
  loadingCredits: boolean;
  relatedMovies: any[];
  loadingRelated: boolean;
  activeSection: MobileMovieSection;
  showComments: boolean;
  onWatchNow: () => void;
  onWatchServer: (server: Server) => void;
  onWatchEpisode: (episodeName: string) => void;
  onToggleFavorite: () => void;
  onToggleReminder: () => void;
  onShare: () => void;
  onTogglePlaylist: (playlistId: string) => void;
  onCreatePlaylistSubmit: (event: React.FormEvent) => void;
  onNewPlaylistNameChange: (value: string) => void;
  onCreatingPlaylistChange: (value: boolean) => void;
  onCategory: (slug: string) => void;
  onActor: (name: string) => void;
  onSectionChange: (section: MobileMovieSection) => void;
  onRatingChange: (average: number) => void;
}

const stripHtml = (value = "") => value
  .replace(/<[^>]*>/g, "")
  .replace(/&nbsp;/g, " ")
  .replace(/&amp;/g, "&")
  .trim();

const getAudioTrack = (serverName = "") => {
  const normalized = serverName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .toLowerCase();
  if (normalized.includes("thuyet minh")) return "Thuyết minh";
  if (normalized.includes("long tieng")) return "Lồng tiếng";
  return "Vietsub";
};

export default function MobileMovieDetail({
  movie,
  slug,
  cleanedName,
  cleanedOrigin,
  backdropSrc,
  posterSrc,
  movieScore,
  movieAgeRating,
  isTrailerOnly,
  isFavorite,
  reminderActive,
  reminderLoading,
  shareCopied,
  currentEpisodeName,
  continueLabel,
  playlists,
  playlistBusyId,
  newPlaylistName,
  isCreatingPlaylist,
  tmdbCredits,
  loadingCredits,
  relatedMovies,
  loadingRelated,
  activeSection,
  showComments,
  onWatchNow,
  onWatchServer,
  onWatchEpisode,
  onToggleFavorite,
  onToggleReminder,
  onShare,
  onTogglePlaylist,
  onCreatePlaylistSubmit,
  onNewPlaylistNameChange,
  onCreatingPlaylistChange,
  onCategory,
  onActor,
  onSectionChange,
  onRatingChange,
}: MobileMovieDetailProps) {
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const [showStickyWatch, setShowStickyWatch] = useState(false);
  const [episodeBatches, setEpisodeBatches] = useState<Record<number, number>>({});
  const primaryActionRef = useRef<HTMLButtonElement | null>(null);
  const description = stripHtml(movie.content) || "Chưa có thông tin giới thiệu cho bộ phim này.";
  const trailerUrl = movie.trailer_url || "";

  useEffect(() => {
    const button = primaryActionRef.current;
    if (!button || isTrailerOnly) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowStickyWatch(!entry.isIntersecting),
      { threshold: 0.15, rootMargin: "-72px 0px 0px 0px" },
    );
    observer.observe(button);
    return () => observer.disconnect();
  }, [isTrailerOnly]);

  useEffect(() => {
    setEpisodeBatches({});
    setPlaylistOpen(false);
  }, [slug]);

  useEffect(() => {
    if (!playlistOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [playlistOpen]);

  const handleMovieImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const fallback = LOCAL_MOVIE_IMAGE_FALLBACK;
    if (!e.currentTarget.src.endsWith(fallback)) {
      e.currentTarget.src = fallback;
    }
  };

  const handleActorImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const fallback = "/images/avatars/default.png";
    if (!e.currentTarget.src.endsWith(fallback)) {
      e.currentTarget.src = fallback;
    }
  };

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const selectSection = (section: MobileMovieSection) => {
    onSectionChange(section);
    window.requestAnimationFrame(() => scrollTo("mobile-movie-tabs"));
  };

  const getYoutubeEmbedUrl = (url: string) => {
    if (!url) return "";
    if (url.includes("embed/")) return url;
    const videoId = url.includes("v=")
      ? url.split("v=")[1]?.split("&")[0]
      : url.split("youtu.be/")[1]?.split("?")[0];
    return videoId ? `https://www.youtube.com/embed/${videoId}` : "";
  };

  const actions = [
    {
      label: isFavorite ? "Đã thích" : "Yêu thích",
      icon: <Heart size={19} className={isFavorite ? "fill-pink-500 text-pink-500" : ""} />,
      onClick: onToggleFavorite,
      active: isFavorite,
    },
    {
      label: "Thêm vào",
      icon: <Plus size={20} />,
      onClick: () => setPlaylistOpen(true),
      active: false,
    },
    {
      label: shareCopied ? "Đã chép" : "Chia sẻ",
      icon: shareCopied ? <Check size={19} /> : <Share2 size={19} />,
      onClick: onShare,
      active: shareCopied,
    },
    {
      label: "Bình luận",
      icon: <MessageSquare size={19} />,
      onClick: () => scrollTo("mobile-movie-comments"),
      active: false,
    },
  ];

  return (
    <main className="md:hidden w-full overflow-x-hidden bg-[#07070a] pb-[calc(7.5rem+env(safe-area-inset-bottom))] text-white">
      <section className="relative h-[clamp(20.5rem,45dvh,24rem)] overflow-hidden bg-zinc-950">
        <ProgressiveImage
          src={backdropSrc}
          alt={cleanedName}
          referrerPolicy="no-referrer"
          priority
          onError={handleMovieImageError}
          className="h-full w-full object-cover object-center opacity-80"
        />
        <HalftoneOverlay />
        <div className="absolute inset-0 bg-gradient-to-t from-[#07070a] via-[#07070a]/35 to-black/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/35 via-transparent to-black/5" />
        {isTrailerOnly && (
          <div className="absolute bottom-5 left-4 rounded-full border border-amber-300/30 bg-black/70 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-amber-300 backdrop-blur-md">
            {movie.availability?.label || "Sắp phát hành"}
          </div>
        )}
      </section>

      <div className="relative z-10 -mt-14 px-4">
        <section className="flex min-w-0 items-end gap-3.5">
          <div className="relative aspect-[2/3] w-[96px] shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 shadow-[0_18px_45px_rgba(0,0,0,0.75)] min-[410px]:w-[104px]">
            <img
              src={posterSrc}
              alt={cleanedName}
              referrerPolicy="no-referrer"
              loading="eager"
              fetchPriority="high"
              decoding="async"
              onError={handleMovieImageError}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="min-w-0 flex-1 pb-1">
            <h1 className="line-clamp-2 text-[19px] font-black leading-[1.15] tracking-tight text-white min-[410px]:text-[21px]">
              {cleanedName}
            </h1>
            {cleanedOrigin && (
              <p className="mt-1 line-clamp-1 text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                {cleanedOrigin}
              </p>
            )}
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[10px] font-extrabold">
              {movieScore > 0 && (
                <span className="flex items-center gap-1 rounded-md border border-amber-400/50 bg-amber-400/10 px-2 py-1 text-amber-300">
                  <Star size={10} className="fill-current" /> {movieScore.toFixed(1)}
                </span>
              )}
              {movieAgeRating && <span className="rounded-md border border-zinc-800 bg-zinc-950/80 px-2 py-1 text-zinc-300">{movieAgeRating}</span>}
              <span className="rounded-md border border-zinc-800 bg-zinc-950/80 px-2 py-1 text-zinc-300">{movie.year}</span>
              {movie.time && <span className="rounded-md border border-zinc-800 bg-zinc-950/80 px-2 py-1 text-zinc-300">{movie.time}</span>}
            </div>
          </div>
        </section>

        <section className="mt-5 flex gap-2.5">
          <button
            ref={primaryActionRef}
            type="button"
            onClick={isTrailerOnly ? () => selectSection("episodes") : onWatchNow}
            className="flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 px-4 text-sm font-black shadow-[0_10px_30px_rgba(236,72,153,0.24)] active:scale-[0.98]"
          >
            <Play size={17} className="shrink-0 fill-white" />
            <span className="truncate">{isTrailerOnly ? (trailerUrl ? "Xem trailer" : "Xem thông tin") : continueLabel}</span>
          </button>
          {isTrailerOnly && movie.tmdb?.id ? (
            <button
              type="button"
              onClick={onToggleReminder}
              disabled={reminderLoading}
              className={`flex h-12 min-w-[94px] items-center justify-center gap-1.5 rounded-2xl border px-3 text-xs font-black active:scale-[0.98] disabled:opacity-50 ${reminderActive ? "border-amber-400/45 bg-amber-400/10 text-amber-300" : "border-zinc-800 bg-zinc-900/80 text-zinc-200"}`}
            >
              {reminderLoading ? <Loader2 size={16} className="animate-spin" /> : <BellRing size={16} />}
              {reminderActive ? "Đã nhắc" : "Nhắc tôi"}
            </button>
          ) : null}
        </section>

        <section className="mt-4 grid grid-cols-4 rounded-2xl border border-white/[0.07] bg-[#101117] p-2">
          {actions.map((action) => (
            <button
              type="button"
              key={action.label}
              onClick={action.onClick}
              className={`flex min-h-[58px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl text-[10px] font-bold transition-colors active:bg-white/[0.06] ${action.active ? "text-pink-400" : "text-zinc-400"}`}
            >
              <span className="flex h-5 items-center justify-center">{action.icon}</span>
              <span className="max-w-full truncate px-1">{action.label}</span>
            </button>
          ))}
        </section>

        {movie.category?.length > 0 && (
          <div className="-mx-4 mt-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 no-scrollbar touch-pan-x">
            {movie.category.map((category) => (
              <button
                type="button"
                key={category.slug}
                onClick={() => onCategory(category.slug)}
                className="min-h-9 shrink-0 snap-start rounded-full border border-zinc-800 bg-zinc-950/70 px-3 text-[11px] font-bold text-zinc-300 active:border-pink-500 active:text-pink-400"
              >
                {category.name}
              </button>
            ))}
          </div>
        )}

        <section className="mt-5 border-t border-white/[0.07] pt-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide">
              <Info size={17} className="text-pink-500" /> Giới thiệu
            </h2>
            <button type="button" onClick={() => setShowFullDescription(!showFullDescription)} className="flex min-h-9 items-center gap-1 text-[11px] font-bold text-pink-400">
              {showFullDescription ? "Thu gọn" : "Xem thêm"}
              <ChevronDown size={14} className={`transition-transform ${showFullDescription ? "rotate-180" : ""}`} />
            </button>
          </div>
          <p className={`mt-2.5 text-[13px] font-medium leading-6 text-zinc-400 ${showFullDescription ? "" : "line-clamp-3"}`}>
            {description}
          </p>
          {showFullDescription && (
            <div className="mt-4 grid grid-cols-[92px_1fr] gap-x-3 gap-y-2.5 rounded-2xl border border-white/[0.06] bg-[#0d0e13] p-4 text-[11px] leading-5">
              <span className="font-bold text-zinc-600">Trạng thái</span><span className="font-semibold text-zinc-300">{movie.episode_current || "Đang cập nhật"}</span>
              <span className="font-bold text-zinc-600">Quốc gia</span><span className="font-semibold text-zinc-300">{movie.country?.map((item) => item.name).join(", ") || "Đang cập nhật"}</span>
              <span className="font-bold text-zinc-600">Đạo diễn</span><span className="font-semibold text-zinc-300">{movie.director?.filter(Boolean).join(", ") || "Đang cập nhật"}</span>
              <span className="font-bold text-zinc-600">Diễn viên</span><span className="font-semibold text-zinc-300">{movie.actor?.filter(Boolean).slice(0, 6).join(", ") || "Đang cập nhật"}</span>
            </div>
          )}
        </section>

        <nav id="mobile-movie-tabs" className="sticky top-[4.05rem] z-30 -mx-4 mt-6 flex scroll-mt-20 gap-1 overflow-x-auto border-y border-white/[0.07] bg-[#07070a]/92 px-4 py-2 backdrop-blur-xl no-scrollbar">
          {[
            ["episodes", isTrailerOnly ? "Tập phim" : "Tập phim", Tv],
            ["actors", "Diễn viên", Users],
            ["gallery", "Ảnh", ImageIcon],
            ["recommendations", "Đề xuất", Compass],
          ].map(([section, label, Icon]) => (
            <button
              type="button"
              key={section as string}
              onClick={() => selectSection(section as MobileMovieSection)}
              aria-pressed={activeSection === section}
              className={`relative flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl px-3 text-[11px] font-extrabold outline-none transition-colors focus:outline-none ${activeSection === section ? "bg-pink-500/10 text-pink-400" : "text-zinc-500 active:bg-white/[0.04] active:text-zinc-200"}`}
            >
              {React.createElement(Icon as React.ElementType, { size: 14 })}{label as string}
              {activeSection === section && <span className="absolute inset-x-3 -bottom-2 h-0.5 rounded-full bg-pink-500" />}
            </button>
          ))}
        </nav>

        {activeSection === "episodes" && (
        <section id="mobile-movie-episodes" className="pt-6">
          <h2 className="flex items-center gap-2 text-base font-black uppercase tracking-tight">
            <Tv size={18} className="text-pink-500" /> {isTrailerOnly ? "Thông tin phát hành" : "Tập phim"}
          </h2>
          {isTrailerOnly ? (
            trailerUrl ? (
              <div className="mt-4 aspect-video overflow-hidden rounded-2xl border border-zinc-800 bg-black">
                <iframe src={getYoutubeEmbedUrl(trailerUrl)} title={`${cleanedName} - Trailer`} allowFullScreen className="h-full w-full" />
              </div>
            ) : (
              <div className="mt-4 flex min-h-40 flex-col items-center justify-center gap-2 rounded-2xl border border-zinc-800 bg-[#0d0e13] px-6 text-center">
                <Clock3 size={25} className="text-zinc-600" />
                <p className="text-sm font-black text-zinc-300">Chưa có lịch phát hành chính thức</p>
                <p className="text-xs leading-5 text-zinc-500">DlowPhim sẽ cập nhật khi nguồn phim hoặc trailer sẵn sàng.</p>
              </div>
            )
          ) : (
            <div className="mt-4 space-y-4">
              {movie.episodes?.map((server, serverIndex) => {
                const episodes = server.server_data || [];
                const track = getAudioTrack(server.server_name);
                const selectedEpisodeBatch = episodeBatches[serverIndex] || 0;
                return (
                  <article key={`${server.server_name}-${serverIndex}`} className="rounded-2xl border border-white/[0.07] bg-[#0d0e13] p-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <span className="text-[9px] font-black uppercase tracking-widest text-pink-400">Bản {track}</span>
                        <p className="mt-0.5 truncate text-xs font-extrabold text-zinc-200">{server.server_name}</p>
                      </div>
                      <button type="button" onClick={() => onWatchServer(server)} className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl bg-pink-500 px-3 text-[10px] font-black text-white active:scale-[0.97]">
                        <Play size={12} className="fill-white" /> Xem bản này
                      </button>
                    </div>
                    {episodes.length > 1 && (
                      <div data-testid={`mobile-episode-picker-${serverIndex}`} className="mt-4 space-y-3">
                        <div data-testid={`mobile-episode-batch-selector-${serverIndex}`} className="space-y-3 rounded-2xl border border-pink-500/20 bg-gradient-to-br from-pink-500/[0.09] via-[#12131b] to-[#0b0c11] p-3 shadow-[0_12px_30px_rgba(0,0,0,0.22)]">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-pink-500/25 bg-pink-500/10 text-pink-400"><ListVideo size={15} /></span>
                            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-100">Chọn tập phim</p>
                          </div>
                          {episodes.length > 50 && (
                            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar touch-pan-x">
                              {Array.from({ length: Math.ceil(episodes.length / 50) }).map((_, batch) => {
                                const range = getEpisodeBatchRange(episodes, batch, 50);
                                return (
                                  <button type="button" key={batch} onClick={() => setEpisodeBatches((current) => ({ ...current, [serverIndex]: batch }))} className={`min-h-10 shrink-0 rounded-xl border px-3 text-[10px] font-extrabold transition-colors ${selectedEpisodeBatch === batch ? "border-pink-400 bg-pink-500 text-white shadow-md shadow-pink-500/20" : "border-white/[0.06] bg-zinc-900 text-zinc-400"}`}>
                                    {range.start}–{range.end}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        <div className="grid grid-cols-4 gap-2 min-[410px]:grid-cols-5">
                          {episodes.slice(selectedEpisodeBatch * 50, (selectedEpisodeBatch + 1) * 50).map((episode, episodeIndex) => {
                            const active = currentEpisodeName && normalizeEpisodeKey(episode.name) === normalizeEpisodeKey(currentEpisodeName);
                            return (
                              <button
                                type="button"
                                key={`${episode.slug}-${episodeIndex}`}
                                onClick={() => onWatchEpisode(episode.name)}
                                className={`min-h-10 truncate rounded-xl px-1 text-[10px] font-extrabold transition-colors ${active ? "border border-pink-400 bg-pink-500/15 text-pink-300" : "border border-transparent bg-[#1a1b24] text-zinc-300 active:bg-pink-500 active:text-white"}`}
                              >
                                {episode.name.toLowerCase().includes("tập") ? episode.name : `Tập ${episode.name}`}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
        )}

        {activeSection === "actors" && (
        <section id="mobile-movie-actors" className="pt-6">
          <h2 className="flex items-center gap-2 text-base font-black uppercase tracking-tight"><Users size={18} className="text-pink-500" /> Diễn viên</h2>
          {loadingCredits ? (
            <div className="flex min-h-28 items-center justify-center"><Loader2 size={22} className="animate-spin text-pink-500" /></div>
          ) : (
            <div className="-mx-4 mt-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 no-scrollbar touch-pan-x">
              {(tmdbCredits.length ? tmdbCredits : movie.actor?.filter(Boolean).map((name, index) => ({ id: index, name }))).slice(0, 14).map((actor: any, index: number) => (
                <button type="button" key={actor.id || `${actor.name}-${index}`} onClick={() => onActor(actor.name)} className="w-[84px] shrink-0 snap-start text-center">
                  <div className="mx-auto h-[72px] w-[72px] overflow-hidden rounded-full border-2 border-zinc-800 bg-zinc-900">
                    {actor.profileUrl ? <img src={actor.profileUrl} alt={actor.name} decoding="async" onError={handleActorImageError} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-pink-500/30 to-violet-500/20 text-lg font-black text-pink-300">{actor.name?.[0]?.toUpperCase() || "?"}</div>}
                  </div>
                  <p className="mt-2 line-clamp-2 text-[10px] font-extrabold leading-4 text-zinc-300">{actor.name}</p>
                  {actor.character && <p className="line-clamp-1 text-[9px] text-zinc-600">{actor.character}</p>}
                </button>
              ))}
            </div>
          )}
        </section>
        )}

        {activeSection === "gallery" && (
        <section id="mobile-movie-gallery" className="pt-6">
          <h2 className="flex items-center gap-2 text-base font-black uppercase tracking-tight"><ImageIcon size={18} className="text-pink-500" /> Gallery</h2>
          <div className="-mx-4 mt-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 no-scrollbar touch-pan-x">
            {[backdropSrc, getImageUrl(movie.poster_url || movie.thumb_url), posterSrc].filter((value, index, list) => value && list.indexOf(value) === index).map((image, index) => (
              <div key={`${image}-${index}`} className="aspect-[16/10] w-[78vw] max-w-[330px] shrink-0 snap-center overflow-hidden rounded-2xl border border-white/[0.08] bg-zinc-900">
                <img src={image} alt={`${cleanedName} ${index + 1}`} decoding="async" onError={handleMovieImageError} className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        </section>
        )}

        {activeSection === "recommendations" && (
        <section id="mobile-movie-related" className="pt-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-base font-black uppercase tracking-tight"><Compass size={18} className="text-pink-500" /> Có thể bạn thích</h2>
            {relatedMovies.length > 0 && <span className="text-[10px] font-bold text-zinc-600">{relatedMovies.length} phim</span>}
          </div>
          {loadingRelated ? (
            <div className="flex min-h-40 items-center justify-center"><Loader2 size={22} className="animate-spin text-pink-500" /></div>
          ) : relatedMovies.length ? (
            <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-5">
              {relatedMovies.map((item) => <MovieCard key={item._id || item.slug} movie={item} aspect="portrait" />)}
            </div>
          ) : (
            <p className="mt-4 rounded-2xl border border-zinc-900 bg-[#0d0e13] px-4 py-8 text-center text-xs font-bold text-zinc-600">Chưa có đề xuất phù hợp.</p>
          )}
        </section>
        )}

        <section id="mobile-movie-comments" className="mt-7 border-t border-white/[0.07] pt-2 scroll-mt-28">
          {showComments && <CommentRatingSection slug={slug} isTrailerOnly={isTrailerOnly} onRatingChange={onRatingChange} mobileCompact />}
        </section>
      </div>

      {!isTrailerOnly && showStickyWatch && (
        <div className="fixed inset-x-3 bottom-[calc(5.7rem+env(safe-area-inset-bottom))] z-[60] mx-auto flex max-w-md items-center gap-2.5 rounded-2xl border border-white/10 bg-[#11121a]/95 p-2 shadow-2xl backdrop-blur-xl">
          <img src={posterSrc} alt="" decoding="async" onError={handleMovieImageError} className="h-11 w-8 shrink-0 rounded-lg object-cover" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-black text-zinc-100">{cleanedName}</p>
            <p className="truncate text-[9px] font-bold text-zinc-600">{currentEpisodeName ? continueLabel : "Sẵn sàng xem phim"}</p>
          </div>
          <button type="button" onClick={onWatchNow} className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl bg-pink-500 px-3 text-[10px] font-black text-white active:scale-[0.97]"><Play size={12} className="fill-white" /> Xem</button>
        </div>
      )}

      {playlistOpen && (
        <div className="fixed inset-0 z-[90] flex items-end bg-black/65 px-3 pb-[calc(6rem+env(safe-area-inset-bottom))] backdrop-blur-sm" onClick={() => setPlaylistOpen(false)}>
          <section className="w-full rounded-[1.75rem] border border-white/10 bg-[#12131b] p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div><h2 className="text-base font-black">Thêm vào danh sách</h2><p className="mt-1 text-[11px] text-zinc-500">Lưu phim để xem lại sau</p></div>
              <button type="button" onClick={() => setPlaylistOpen(false)} aria-label="Đóng" className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-zinc-400"><X size={18} /></button>
            </div>
            <div className="mt-4 max-h-52 space-y-2 overflow-y-auto">
              {playlists?.length ? playlists.map((playlist) => {
                const selected = playlist.movies?.includes(movie.slug);
                return (
                  <button type="button" key={playlist.id} disabled={Boolean(playlistBusyId)} onClick={() => onTogglePlaylist(playlist.id)} className="flex min-h-12 w-full items-center justify-between rounded-xl bg-zinc-900/70 px-3 text-left disabled:opacity-60">
                    <span className="min-w-0 truncate text-xs font-bold text-zinc-200">{playlist.name}</span>
                    {playlistBusyId === playlist.id ? <Loader2 size={15} className="animate-spin text-pink-500" /> : selected ? <Check size={16} className="text-pink-500" /> : <Plus size={16} className="text-zinc-600" />}
                  </button>
                );
              }) : <p className="py-5 text-center text-xs font-bold text-zinc-600">Bạn chưa có danh sách phim nào.</p>}
            </div>
            <div className="mt-4 border-t border-white/[0.07] pt-4">
              {isCreatingPlaylist ? (
                <form onSubmit={onCreatePlaylistSubmit} className="flex gap-2">
                  <input value={newPlaylistName} onChange={(event) => onNewPlaylistNameChange(event.target.value)} autoFocus maxLength={40} placeholder="Tên danh sách mới" className="h-11 min-w-0 flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-xs font-semibold outline-none focus:border-pink-500" />
                  <button type="submit" disabled={!newPlaylistName.trim() || playlistBusyId === "creating"} className="min-w-20 rounded-xl bg-pink-500 px-3 text-xs font-black disabled:bg-zinc-800 disabled:text-zinc-600">{playlistBusyId === "creating" ? <Loader2 size={15} className="mx-auto animate-spin" /> : "Tạo"}</button>
                </form>
              ) : (
                <button type="button" onClick={() => onCreatingPlaylistChange(true)} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-zinc-800 text-xs font-black text-zinc-300"><Plus size={15} /> Tạo danh sách mới</button>
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
