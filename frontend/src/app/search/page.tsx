"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { Film, Loader2, Search, UserRound } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import MovieCard from "@/components/MovieCard";
import Pagination from "@/components/Pagination";
import PersonCard from "@/components/discovery/PersonCard";
import { cleanSlug } from "@/utils/movieUtils";
import { searchMovies } from "@/utils/movieSearch";
import { searchPeople, type PersonResult } from "@/utils/people";
import { getProxyUrl, MOVIE_API_DOMAIN } from "@/utils/api";

type ResultTab = "all" | "movies" | "people";

function SearchContent() {
  const params = useSearchParams();
  const router = useRouter();
  const keyword = params.get("keyword")?.trim() || "";
  const type = params.get("type") || "";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const [tab, setTab] = useState<ResultTab>("all");
  const [movies, setMovies] = useState<any[]>([]);
  const [people, setPeople] = useState<PersonResult[]>([]);
  const [moviePages, setMoviePages] = useState(1);
  const [peoplePages, setPeoplePages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        if (keyword) {
          const [movieResult, peopleResult] = await Promise.allSettled([
            searchMovies(keyword, page, { signal: controller.signal, timeoutMs: 5000 }),
            searchPeople(keyword, page, controller.signal),
          ]);
          if (controller.signal.aborted) return;
          const rawMovies = movieResult.status === "fulfilled" ? movieResult.value.items : [];
          const movieData = movieResult.status === "fulfilled" ? movieResult.value.data : null;
          const seen = new Set<string>();
          setMovies(rawMovies.filter((movie: any) => {
            const key = cleanSlug(movie.slug);
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
          }));
          const pagination = movieData?.data?.params?.pagination;
          setMoviePages(pagination
            ? Math.max(1, Math.ceil(Number(pagination.totalItems) / Number(pagination.totalItemsPerPage)))
            : Math.max(1, Number(movieData?.totalPages) || 1));
          if (peopleResult.status === "fulfilled") {
            setPeople(peopleResult.value.items);
            setPeoplePages(peopleResult.value.totalPages || 1);
          } else {
            setPeople([]);
            setPeoplePages(1);
          }
          if (movieResult.status === "rejected" && peopleResult.status === "rejected") {
            throw new Error("Không thể kết nối dịch vụ tìm kiếm");
          }
        } else {
          setPeople([]);
          const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
          const path = `/v1/api/danh-sach/${type || "phim-moi-cap-nhat"}?page=${page}`;
          const requestUrl = type === "phim-sap-chieu"
            ? `${API_URL}/movies/upcoming?page=${page}`
            : getProxyUrl(`${MOVIE_API_DOMAIN}${path}`);
          const response = await fetch(requestUrl, { signal: controller.signal });
          if (!response.ok) throw new Error("Không thể tải danh sách phim");
          const data = await response.json();
          setMovies(data.data?.items || data.items || []);
          const pagination = data.data?.params?.pagination;
          setMoviePages(pagination
            ? Math.max(1, Math.ceil(Number(pagination.totalItems) / Number(pagination.totalItemsPerPage)))
            : Math.max(1, Number(data.totalPages) || 1));
        }
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setMovies([]);
          setPeople([]);
          setError(loadError instanceof Error ? loadError.message : "Tìm kiếm tạm thời gián đoạn");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [keyword, page, type]);

  const visibleMovies = tab !== "people";
  const visiblePeople = keyword && tab !== "movies";
  const totalPages = tab === "people" ? peoplePages : moviePages;
  const title = useMemo(() => {
    if (keyword) return `Kết quả cho “${keyword}”`;
    if (type === "phim-le") return "Phim lẻ mới nhất";
    if (type === "phim-bo") return "Phim bộ mới nhất";
    return "Khám phá phim";
  }, [keyword, type]);

  const changePage = (nextPage: number) => {
    const next = new URLSearchParams(params.toString());
    next.set("page", String(nextPage));
    router.push(`/search?${next.toString()}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <main className="min-h-screen bg-black px-5 pb-20 pt-28 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="mb-7 border-b border-zinc-900 pb-5">
          <p className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-pink-500"><Search size={14} /> Tìm kiếm DlowPhim</p>
          <h1 className="text-2xl font-black md:text-4xl">{title}</h1>
          {!loading && keyword && <p className="mt-2 text-sm text-zinc-500">Tìm thấy {movies.length} phim và {people.length} diễn viên trên trang này</p>}
        </header>

        {keyword && (
          <div className="mb-8 flex gap-2 overflow-x-auto">
            {(["all", "movies", "people"] as ResultTab[]).map((value) => (
              <button key={value} onClick={() => setTab(value)} className={`whitespace-nowrap rounded-full px-5 py-2 text-sm font-bold transition ${tab === value ? "bg-pink-500 text-white" : "border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white"}`}>
                {value === "all" ? "Tất cả" : value === "movies" ? `Phim (${movies.length})` : `Diễn viên (${people.length})`}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex min-h-[45vh] flex-col items-center justify-center gap-3 text-zinc-500"><Loader2 className="animate-spin text-pink-500" size={40} /><p>Đang tìm trong kho phim...</p></div>
        ) : error ? (
          <div className="rounded-3xl border border-zinc-900 bg-zinc-950 py-20 text-center"><p className="font-bold">{error}</p><p className="mt-2 text-sm text-zinc-500">Bạn thử lại sau một chút nhé.</p></div>
        ) : (
          <div className="space-y-12">
            {visiblePeople && (
              <section>
                <div className="mb-5 flex items-center gap-2"><UserRound className="text-pink-500" size={21} /><h2 className="text-xl font-black uppercase">Diễn viên</h2></div>
                {people.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{people.map((person) => <PersonCard key={person.id} person={person} />)}</div> : <p className="rounded-2xl border border-zinc-900 bg-zinc-950 p-7 text-sm text-zinc-500">Không tìm thấy diễn viên phù hợp.</p>}
              </section>
            )}
            {visibleMovies && (
              <section>
                <div className="mb-5 flex items-center gap-2"><Film className="text-pink-500" size={21} /><h2 className="text-xl font-black uppercase">Phim</h2></div>
                {movies.length ? <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7">{movies.map((movie) => <MovieCard key={movie._id || movie.slug} movie={movie} aspect="portrait" />)}</div> : <p className="rounded-2xl border border-zinc-900 bg-zinc-950 p-7 text-sm text-zinc-500">Không tìm thấy phim phù hợp. Bạn thử tên gốc hoặc kiểm tra lại chính tả nhé.</p>}
              </section>
            )}
          </div>
        )}
        {!loading && !error && <Pagination currentPage={page} totalPages={totalPages} onPageChange={changePage} />}
      </div>
    </main>
  );
}

export default function SearchPage() {
  return <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-black"><Loader2 className="animate-spin text-pink-500" size={40} /></div>}><SearchContent /></Suspense>;
}
