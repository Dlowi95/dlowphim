"use client";

import { useState } from "react";
import { Film, Loader2, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { cleanMovieName } from "@/utils/movieUtils";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function PersonMovieCard({ movie }: { movie: any }) {
  const router = useRouter();
  const [resolving, setResolving] = useState(false);
  const [message, setMessage] = useState("");

  const findPlayableMovie = async () => {
    if (resolving) return;
    setResolving(true);
    setMessage("");
    const query = new URLSearchParams({
      title: movie.name || "",
      originTitle: movie.origin_name || "",
      year: String(movie.year || ""),
      tmdbId: String(movie.tmdb?.id || ""),
    });

    try {
      for (const source of ["active", "fallback"]) {
        query.set("source", source);
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 7000);
        try {
          const response = await fetch(
            `${API_URL}/movies/resolved-detail/${encodeURIComponent(movie.slug)}?${query.toString()}`,
            { signal: controller.signal },
          );
          if (!response.ok) continue;
          const detail = await response.json();
          const episodes = detail.episodes || detail.movie?.episodes || [];
          const playable = episodes.some((server: any) =>
            (server.server_data || []).some((episode: any) => episode.link_m3u8 || episode.link_embed),
          );
          if (playable) {
            router.push(`/movie/${detail._resolvedSlug || detail.movie?.slug || movie.slug}`);
            return;
          }
        } catch {
          // Nguồn chính chậm hoặc lỗi thì chuyển ngay sang nguồn dự phòng.
        } finally {
          window.clearTimeout(timeoutId);
        }
      }
      setMessage("Chưa có bản xem");
    } catch {
      setMessage("Nguồn phim đang gián đoạn");
    } finally {
      setResolving(false);
    }
  };

  const handlePosterError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const fallback = "/images/movie-placeholder.svg";
    const currentSrc = e.currentTarget.src;
    if (currentSrc && (currentSrc.endsWith(fallback) || currentSrc === fallback)) {
      return;
    }
    e.currentTarget.src = fallback;
  };

  return (
    <button type="button" onClick={findPlayableMovie} className="group w-full text-left" aria-label={`Tìm bản xem ${movie.name}`}>
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-zinc-900">
        {movie.poster_url ? (
          <img src={movie.poster_url} alt={movie.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" loading="lazy" onError={handlePosterError} />
        ) : (
          <div className="flex h-full items-center justify-center text-zinc-700"><Film size={36} /></div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/45">
          <span className="flex h-11 w-11 scale-75 items-center justify-center rounded-full bg-pink-500 text-white opacity-0 shadow-lg shadow-pink-500/30 transition group-hover:scale-100 group-hover:opacity-100">
            {resolving ? <Loader2 className="animate-spin" size={19} /> : <Play size={18} fill="currentColor" />}
          </span>
        </div>
        {movie.character && <span className="absolute bottom-2 left-2 max-w-[90%] truncate rounded-md bg-black/75 px-2 py-1 text-[9px] font-bold text-zinc-200">Vai {movie.character}</span>}
      </div>
      <h3 className="mt-2.5 truncate text-sm font-bold text-zinc-100 transition group-hover:text-pink-500">{cleanMovieName(movie.name)}</h3>
      <p className="mt-0.5 truncate text-[11px] text-zinc-500">{movie.year || "Chưa rõ năm"} • {movie.tmdb?.type === "tv" ? "Phim bộ" : "Phim lẻ"}</p>
      {message && <p className="mt-1 text-[11px] font-semibold text-amber-400">{message}</p>}
    </button>
  );
}
