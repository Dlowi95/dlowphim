"use client";

import { useCallback, useEffect, useState } from "react";
import { Film, Loader2, RefreshCw } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import MovieCard from "@/components/MovieCard";
import Pagination from "@/components/Pagination";
import DiscoverySourceNotice from "@/components/discovery/DiscoverySourceNotice";
import { cleanSlug } from "@/utils/movieUtils";
import { fetchMovieDiscovery } from "@/utils/movieDiscovery";

interface Props {
  kind: "genre" | "country";
  slug: string;
  label: string;
}

export default function MovieDiscoveryPage({ kind, slug, label }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const [movies, setMovies] = useState<any[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [sourceState, setSourceState] = useState<{ fallback: boolean; stale: boolean; savedAt?: string | null }>({ fallback: false, stale: false });

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError("");
      setSourceState({ fallback: false, stale: false });
      try {
        const data = await fetchMovieDiscovery(
          { kind, slug, page, limit: 24 },
          { signal: controller.signal, timeoutMs: 9000 },
        );
        const items = data.items || [];
        const seen = new Set<string>();
        setMovies(items.filter((movie: any) => {
          const key = cleanSlug(movie.slug);
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        }));
        setTotalPages(Math.max(1, Number(data.pagination?.totalPages) || 1));
        setSourceState({ fallback: Boolean(data.fallback?.used), stale: Boolean(data.stale?.used), savedAt: data.stale?.savedAt });
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setMovies([]);
          setError(loadError instanceof Error ? loadError.message : "Không thể tải danh sách phim");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [kind, slug, page, reloadKey]);

  const changePage = useCallback((nextPage: number) => {
    router.push(`/${kind === "genre" ? "the-loai" : "quoc-gia"}/${slug}?page=${nextPage}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [kind, router, slug]);

  return (
    <main className="min-h-screen bg-black px-5 pb-20 pt-28 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 border-b border-zinc-900 pb-5">
          <p className="mb-2 text-xs font-black uppercase tracking-[0.25em] text-pink-500">
            {kind === "genre" ? "Khám phá theo thể loại" : "Điện ảnh theo quốc gia"}
          </p>
          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black uppercase md:text-4xl">{label}</h1>
              <p className="mt-2 text-sm text-zinc-500">Trang {page} / {totalPages}</p>
            </div>
            {!loading && <span className="rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-400">{movies.length} phim</span>}
          </div>
        </header>

        {!loading && !error && <DiscoverySourceNotice fallbackUsed={sourceState.fallback} staleUsed={sourceState.stale} savedAt={sourceState.savedAt} />}

        {loading ? (
          <div className="flex min-h-[45vh] flex-col items-center justify-center gap-3 text-zinc-500">
            <Loader2 className="animate-spin text-pink-500" size={38} />
            <p className="text-sm">Đang tải kho phim...</p>
          </div>
        ) : error ? (
          <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 rounded-3xl border border-zinc-900 bg-zinc-950 text-center">
            <RefreshCw className="text-pink-500" />
            <div><p className="font-bold">{error}</p><p className="mt-1 text-sm text-zinc-500">Bạn thử tải lại sau một chút nhé.</p></div>
            <button onClick={() => setReloadKey((value) => value + 1)} className="rounded-xl bg-pink-500 px-5 py-2 text-sm font-bold">Thử lại</button>
          </div>
        ) : movies.length === 0 ? (
          <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 rounded-3xl border border-zinc-900 bg-zinc-950 text-zinc-500">
            <Film size={36} /><p className="font-semibold">Chưa có phim phù hợp trong mục này</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7">
            {movies.map((movie) => <MovieCard key={movie._id || movie.slug} movie={movie} aspect="portrait" />)}
          </div>
        )}
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={changePage} />
      </div>
    </main>
  );
}
