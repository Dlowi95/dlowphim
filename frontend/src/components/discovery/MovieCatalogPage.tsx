"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, ChevronDown, Filter, Loader2, RefreshCw, RotateCcw, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import MovieCard from "@/components/MovieCard";
import Pagination from "@/components/Pagination";
import DiscoverySourceNotice from "@/components/discovery/DiscoverySourceNotice";
import { GENRES } from "@/constants/discovery";
import { cleanSlug } from "@/utils/movieUtils";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function MovieCatalogPage({ type }: { type: "phim-le" | "phim-bo" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const year = searchParams.get("year") || "";
  const genre = searchParams.get("genre") || "";
  const status = searchParams.get("status") || "";
  const sort = searchParams.get("sort") || "updated";
  const [movies, setMovies] = useState<any[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fallbackUsed, setFallbackUsed] = useState(false);
  const [staleState, setStaleState] = useState<{ used: boolean; savedAt?: string | null }>({ used: false });
  const [reloadKey, setReloadKey] = useState(0);
  const title = type === "phim-le" ? "Phim lẻ" : "Phim bộ";
  const years = useMemo(() => Array.from({ length: 37 }, (_, index) => new Date().getFullYear() + 1 - index), []);

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ type, page: String(page), limit: "24", sort });
    if (year) query.set("year", year);
    if (genre) query.set("genre", genre);
    if (status) query.set("status", status);
    const load = async () => {
      setLoading(true);
      setError("");
      setFallbackUsed(false);
      setStaleState({ used: false });
      try {
        const response = await fetch(`${API_URL}/movies/catalog?${query.toString()}`, { signal: controller.signal });
        const data = await response.json().catch(() => null);
        if (!response.ok || data?.status === false) {
          const message = Array.isArray(data?.message) ? data.message[0] : data?.message;
          throw new Error(message || "Máy chủ phim đang phản hồi chậm");
        }
        const seen = new Set<string>();
        const uniqueMovies = (data.items || []).filter((movie: any) => {
          const key = cleanSlug(movie.slug);
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        const pagination = data.pagination || {};
        const pages = Math.max(1, Math.ceil(Number(pagination.totalItems || uniqueMovies.length) / Number(pagination.totalItemsPerPage || 24)));
        setMovies(uniqueMovies);
        setTotalPages(pages);
        setFallbackUsed(Boolean(data.fallback?.used));
        setStaleState({ used: Boolean(data.stale?.used), savedAt: data.stale?.savedAt });
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
  }, [genre, page, reloadKey, sort, status, type, year]);

  const updateFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value); else next.delete(key);
    next.delete("page");
    router.push(`/${type}?${next.toString()}`);
  };

  const resetFilters = () => router.push(`/${type}`);
  const hasFilters = Boolean(year || genre || status || sort !== "updated");

  return (
    <main className="min-h-screen bg-black px-5 pb-20 pt-28 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 border-b border-zinc-900 pb-5">
          <p className="mb-2 text-xs font-black uppercase tracking-[0.24em] text-pink-500">Kho phim DlowPhim</p>
          <h1 className="text-3xl font-black uppercase md:text-5xl">{title}</h1>
          <p className="mt-2 text-sm text-zinc-500">Lọc và sắp xếp trực tiếp trên nguồn phim đang được Admin lựa chọn.</p>
        </header>

        <section className="mb-8 rounded-2xl border border-zinc-900 bg-zinc-950/80 p-4">
          <div className="mb-3 flex items-center justify-between"><p className="flex items-center gap-2 text-sm font-black uppercase"><Filter size={16} className="text-pink-500" /> Bộ lọc</p>{hasFilters && <button onClick={resetFilters} className="flex items-center gap-1 text-xs font-bold text-zinc-500 hover:text-pink-400"><RotateCcw size={13} /> Xóa lọc</button>}</div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <CatalogSelect label="Năm phát hành" value={year} onChange={(value) => updateFilter("year", value)} options={[{ value: "", label: "Tất cả năm" }, ...years.map((value) => ({ value: String(value), label: String(value) }))]} />
            <CatalogSelect label="Thể loại" value={genre} onChange={(value) => updateFilter("genre", value)} options={[{ value: "", label: "Tất cả thể loại" }, ...GENRES.map((item) => ({ value: item.slug, label: item.name }))]} />
            <CatalogSelect label="Trạng thái" value={status} onChange={(value) => updateFilter("status", value)} options={[{ value: "", label: "Tất cả trạng thái" }, { value: "ongoing", label: "Đang cập nhật" }, { value: "completed", label: "Đã hoàn tất" }]} />
            <CatalogSelect label="Sắp xếp" value={sort} onChange={(value) => updateFilter("sort", value)} options={[{ value: "updated", label: "Mới cập nhật" }, { value: "year-desc", label: "Năm mới nhất" }, { value: "year-asc", label: "Năm cũ nhất" }]} />
          </div>
        </section>

        {!loading && !error && <DiscoverySourceNotice fallbackUsed={fallbackUsed} staleUsed={staleState.used} savedAt={staleState.savedAt} />}

        {loading ? (
          <div className="flex min-h-[45vh] flex-col items-center justify-center gap-3 text-zinc-500"><Loader2 className="animate-spin text-pink-500" size={40} /><p>Đang tải {title.toLowerCase()}...</p></div>
        ) : error ? (
          <div className="flex min-h-[38vh] flex-col items-center justify-center rounded-3xl border border-red-500/15 bg-gradient-to-b from-red-500/5 to-zinc-950 px-5 text-center">
            <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-red-500/20 bg-red-500/10 text-red-400"><AlertTriangle size={27} /></span>
            <h2 className="text-lg font-black">Kho phim đang tạm gián đoạn</h2>
            <p className="mt-2 max-w-lg text-sm leading-6 text-zinc-500">{error}</p>
            <button onClick={() => setReloadKey((value) => value + 1)} className="mt-5 flex items-center gap-2 rounded-xl bg-pink-500 px-5 py-2.5 text-sm font-bold transition hover:bg-pink-400"><RefreshCw size={15} /> Thử lại cả hai máy chủ</button>
          </div>
        ) : movies.length ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">{movies.map((movie) => <MovieCard key={movie._id || movie.slug} movie={movie} aspect="portrait" />)}</div>
        ) : (
          <div className="flex min-h-[34vh] flex-col items-center justify-center rounded-3xl border border-zinc-900 bg-zinc-950 px-5 text-center">
            <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-zinc-800 bg-black text-zinc-600"><Filter size={25} /></span>
            <h2 className="font-black text-zinc-200">{hasFilters ? "Chưa có phim phù hợp" : "Kho phim hiện chưa có dữ liệu"}</h2>
            <p className="mt-2 max-w-md text-sm text-zinc-600">{hasFilters ? "Bạn thử bỏ bớt điều kiện hoặc chọn một năm, thể loại khác nhé." : "Dữ liệu có thể đang được nguồn phim cập nhật. Bạn thử tải lại sau một chút nhé."}</p>
            <button onClick={hasFilters ? resetFilters : () => setReloadKey((value) => value + 1)} className="mt-5 flex items-center gap-2 rounded-xl border border-zinc-800 bg-black px-5 py-2.5 text-sm font-bold text-zinc-300 transition hover:border-pink-500 hover:text-pink-400">{hasFilters ? <RotateCcw size={15} /> : <RefreshCw size={15} />}{hasFilters ? "Xóa toàn bộ bộ lọc" : "Tải lại danh sách"}</button>
          </div>
        )}

        {!loading && !error && <Pagination currentPage={page} totalPages={totalPages} onPageChange={(nextPage) => { const next = new URLSearchParams(searchParams.toString()); next.set("page", String(nextPage)); router.push(`/${type}?${next.toString()}`); window.scrollTo({ top: 0, behavior: "smooth" }); }} />}
      </div>
    </main>
  );
}

function CatalogSelect({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value) || options[0];
  const searchable = options.length > 10;
  const normalizedQuery = query.trim().toLocaleLowerCase("vi");
  const visibleOptions = normalizedQuery
    ? options.filter((option) => option.label.toLocaleLowerCase("vi").includes(normalizedQuery))
    : options;

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const chooseOption = (nextValue: string) => {
    onChange(nextValue);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={containerRef} className="relative space-y-1.5">
      <span className="text-[10px] font-black uppercase tracking-wider text-zinc-600">{label}</span>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={`flex h-12 w-full items-center justify-between rounded-xl border bg-black px-4 text-left text-sm font-bold transition ${open ? "border-pink-500 shadow-[0_0_0_3px_rgba(236,72,153,0.1)]" : "border-zinc-800 hover:border-zinc-700"}`}
      >
        <span className={value ? "text-white" : "text-zinc-300"}>{selected.label}</span>
        <ChevronDown size={17} className={`text-zinc-500 transition-transform ${open ? "rotate-180 text-pink-500" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-[0_18px_55px_rgba(0,0,0,0.75)]">
          {searchable && (
            <div className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950 p-2.5">
              <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-black px-3 focus-within:border-pink-500">
                <Search size={15} className="text-zinc-600" />
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={`Tìm ${label.toLocaleLowerCase("vi")}...`}
                  className="h-10 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"
                />
              </div>
            </div>
          )}
          <div role="listbox" aria-label={label} className="max-h-64 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-pink-500 scrollbar-track-zinc-900">
            {visibleOptions.length > 0 ? visibleOptions.map((option) => {
              const active = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => chooseOption(option.value)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${active ? "bg-pink-500/15 text-pink-400" : "text-zinc-300 hover:bg-zinc-900 hover:text-white"}`}
                >
                  <span>{option.label}</span>
                  {active && <Check size={16} />}
                </button>
              );
            }) : <p className="px-3 py-6 text-center text-sm text-zinc-600">Không tìm thấy lựa chọn</p>}
          </div>
        </div>
      )}
    </div>
  );
}
