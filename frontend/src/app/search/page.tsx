"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Film, Loader2, Search, ShieldAlert } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import MovieCard from "@/components/MovieCard";
import Pagination from "@/components/Pagination";
import DiscoverySourceNotice from "@/components/discovery/DiscoverySourceNotice";
import { cleanSlug } from "@/utils/movieUtils";
import { searchMovies } from "@/utils/movieSearch";
import { fetchMovieDiscovery } from "@/utils/movieDiscovery";
import { useIsMobileViewport } from "@/hooks/useIsMobileViewport";

const MobileSearchBox = dynamic(() => import("@/components/search/mobile/MobileSearchBox"), {
  ssr: false,
});

const SEARCH_TYPE_TITLES: Record<string, string> = {
  "phim-moi-cap-nhat": "Phim mới cập nhật",
  "phim-le": "Phim lẻ mới nhất",
  "phim-bo": "Phim bộ mới nhất",
  "phim-chieu-rap": "Phim chiếu rạp",
  "phim-sap-chieu": "Phim sắp chiếu",
  "hoat-hinh": "Kho tàng hoạt hình",
};

function SearchContent() {
  const params = useSearchParams();
  const router = useRouter();
  const isMobileViewport = useIsMobileViewport();
  const keyword = params.get("keyword")?.trim() || "";
  const type = params.get("type") || "";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const [movies, setMovies] = useState<any[]>([]);
  const [moviePages, setMoviePages] = useState(1);
  const [resolvedPage, setResolvedPage] = useState(page);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchBlocked, setSearchBlocked] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [sourceState, setSourceState] = useState<{ fallback: boolean; stale: boolean; savedAt?: string | null }>({ fallback: false, stale: false });

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError("");
      setSearchBlocked(false);
      setResolvedPage(page);
      setSourceState({ fallback: false, stale: false });
      try {
        if (keyword) {
          const movieResult = await searchMovies(keyword, page, {
            signal: controller.signal,
            timeoutMs: 5000,
          });
          if (controller.signal.aborted) return;
          const rawMovies = movieResult.items;
          const movieData = movieResult.data;
          setSearchBlocked(movieResult.blocked);
          const seen = new Set<string>();
          setMovies(rawMovies.filter((movie: any) => {
            const key = cleanSlug(movie.slug);
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
          }));
          const pagination = movieData?.pagination || movieData?.data?.params?.pagination;
          const totalPages = pagination
            ? Math.max(1, Number(pagination.totalPages) || Math.ceil(Number(pagination.totalItems) / Number(pagination.totalItemsPerPage)))
            : Math.max(1, Number(movieData?.totalPages) || 1);
          const currentPage = Math.min(totalPages, Math.max(1, Number(pagination?.currentPage) || page));
          setMoviePages(totalPages);
          setResolvedPage(currentPage);
          if (currentPage !== page) {
            const next = new URLSearchParams(params.toString());
            next.set("page", String(currentPage));
            router.replace(`/search?${next.toString()}`, { scroll: false });
          }
          setSourceState({
            fallback: Boolean(movieData?.fallback?.used),
            stale: Boolean(movieData?.stale?.used),
            savedAt: movieData?.stale?.savedAt,
          });
        } else {
          const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
          if (type === "phim-sap-chieu") {
            const upcomingController = new AbortController();
            const abortUpcoming = () => upcomingController.abort();
            const timeoutId = window.setTimeout(abortUpcoming, 8_000);
            controller.signal.addEventListener("abort", abortUpcoming, { once: true });
            try {
              const response = await fetch(`${API_URL}/movies/upcoming?page=${page}`, { signal: upcomingController.signal });
              if (!response.ok) throw new Error("Không thể tải danh sách phim");
              const data = await response.json();
              setMovies(data.items || []);
              setMoviePages(Math.max(1, Number(data.totalPages) || 1));
              setResolvedPage(page);
            } finally {
              window.clearTimeout(timeoutId);
              controller.signal.removeEventListener("abort", abortUpcoming);
            }
          } else {
            const data = await fetchMovieDiscovery(
              { kind: "list", slug: type || "phim-moi-cap-nhat", page, limit: 24 },
              { signal: controller.signal, timeoutMs: 8000 },
            );
            setMovies(data.items || []);
            setMoviePages(Math.max(1, Number(data.pagination?.totalPages) || 1));
            setResolvedPage(page);
            setSourceState({ fallback: Boolean(data.fallback?.used), stale: Boolean(data.stale?.used), savedAt: data.stale?.savedAt });
          }
        }
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setMovies([]);
          setError(loadError instanceof DOMException && loadError.name === "AbortError"
            ? "Kho phim phản hồi quá chậm. Bạn vui lòng thử lại."
            : loadError instanceof Error ? loadError.message : "Tìm kiếm tạm thời gián đoạn");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [keyword, page, params, retryKey, router, type]);

  const title = useMemo(() => {
    if (searchBlocked) return "Không thể tìm kiếm từ khóa này";
    if (keyword) return `Kết quả cho “${keyword}”`;
    return SEARCH_TYPE_TITLES[type] || "Khám phá phim";
  }, [keyword, searchBlocked, type]);

  const changePage = (nextPage: number) => {
    const next = new URLSearchParams(params.toString());
    next.set("page", String(nextPage));
    router.push(`/search?${next.toString()}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <main className="min-h-screen bg-black px-4 pb-28 pt-6 text-white md:px-5 md:pb-20 md:pt-28">
      <div className="mx-auto max-w-7xl">
        {isMobileViewport && <MobileSearchBox initialQuery={keyword} />}
        <header className="mb-5 border-b border-zinc-900 pb-5 md:mb-7">
          <p className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-pink-500"><Search size={14} /> Tìm kiếm DlowPhim</p>
          <h1 className="break-words text-2xl font-black md:text-4xl">{title}</h1>
          {!loading && keyword && !searchBlocked && <p className="mt-2 text-sm text-zinc-500">Tìm thấy {movies.length} phim trên trang này</p>}
        </header>

        {loading ? (
          <div className="flex min-h-[45vh] flex-col items-center justify-center gap-3 text-zinc-500"><Loader2 className="animate-spin text-pink-500" size={40} /><p>Đang tìm trong kho phim...</p></div>
        ) : error ? (
          <div role="alert" className="rounded-3xl border border-zinc-900 bg-zinc-950 px-5 py-20 text-center">
            <p className="font-bold">{error}</p>
            <p className="mt-2 text-sm text-zinc-500">Bạn thử lại sau một chút nhé.</p>
            <button type="button" onClick={() => setRetryKey((value) => value + 1)} className="mt-5 min-h-11 rounded-xl bg-pink-500 px-5 text-sm font-black text-white transition hover:bg-pink-400 active:scale-[0.98]">Thử lại</button>
          </div>
        ) : searchBlocked ? (
          <section role="status" className="rounded-3xl border border-pink-500/20 bg-pink-500/[0.06] px-5 py-16 text-center">
            <ShieldAlert className="mx-auto text-pink-400" size={38} />
            <p className="mt-4 font-black">Từ khóa này không được hỗ trợ</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">DlowPhim không hiển thị nội dung nhạy cảm trong kết quả tìm kiếm.</p>
          </section>
        ) : (
          <section>
            <DiscoverySourceNotice fallbackUsed={sourceState.fallback} staleUsed={sourceState.stale} savedAt={sourceState.savedAt} />
            <div className="mb-5 flex items-center gap-2"><Film className="text-pink-500" size={21} /><h2 className="text-xl font-black uppercase">Phim</h2></div>
            {movies.length ? <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7">{movies.map((movie) => <MovieCard key={movie._id || movie.slug} movie={movie} aspect="portrait" />)}</div> : <p className="rounded-2xl border border-zinc-900 bg-zinc-950 p-7 text-sm text-zinc-500">Không tìm thấy phim phù hợp. Bạn thử tên gốc hoặc kiểm tra lại chính tả nhé.</p>}
          </section>
        )}
        {!loading && !error && !searchBlocked && <Pagination compactOnMobile currentPage={resolvedPage} totalPages={moviePages} onPageChange={changePage} />}
      </div>
    </main>
  );
}

export default function SearchPage() {
  return <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-black"><Loader2 className="animate-spin text-pink-500" size={40} /></div>}><SearchContent /></Suspense>;
}
