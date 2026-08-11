"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Search, UserRound, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { cleanMovieName, cleanSlug, getImageUrl } from "@/utils/movieUtils";
import { searchMovies } from "@/utils/movieSearch";
import { searchPeople, type PersonResult } from "@/utils/people";

type MobileSearchBoxProps = {
  initialQuery: string;
};

export default function MobileSearchBox({ initialQuery }: MobileSearchBoxProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(initialQuery);
  const [movies, setMovies] = useState<any[]>([]);
  const [people, setPeople] = useState<PersonResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    if (!hasInteracted) return;
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      setMovies([]);
      setPeople([]);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    const debounce = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const [movieResult, peopleResult] = await Promise.allSettled([
          searchMovies(normalizedQuery, 1, { signal: controller.signal, timeoutMs: 3500 }),
          searchPeople(normalizedQuery, 1, controller.signal),
        ]);
        if (controller.signal.aborted) return;

        const seen = new Set<string>();
        const uniqueMovies = movieResult.status === "fulfilled"
          ? movieResult.value.items.filter((movie: any) => {
              const slug = cleanSlug(movie.slug);
              if (!slug || seen.has(slug)) return false;
              seen.add(slug);
              return true;
            })
          : [];

        setMovies(uniqueMovies.slice(0, 4));
        setPeople(peopleResult.status === "fulfilled" ? peopleResult.value.items.slice(0, 3) : []);
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(debounce);
      controller.abort();
    };
  }, [hasInteracted, query]);

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const submitSearch = () => {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) return;
    setIsOpen(false);
    inputRef.current?.blur();
    router.push(`/search?keyword=${encodeURIComponent(normalizedQuery)}`);
  };

  const selectMovie = (slug: string) => {
    setIsOpen(false);
    router.push(`/movie/${slug}`);
  };

  const selectPerson = (id: string) => {
    setIsOpen(false);
    router.push(`/dien-vien/${id}`);
  };

  const showSuggestions = isOpen && Boolean(query.trim());

  return (
    <div ref={containerRef} className="relative z-40 mb-6 md:hidden">
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          submitSearch();
        }}
        className="relative"
      >
        <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-zinc-400">
          {isSearching ? <Loader2 size={19} className="animate-spin text-pink-500" /> : <Search size={19} />}
        </span>
        <input
          ref={inputRef}
          type="text"
          inputMode="search"
          enterKeyHint="search"
          value={query}
          onFocus={() => {
            setHasInteracted(true);
            setIsOpen(true);
          }}
          onChange={(event) => {
            setHasInteracted(true);
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          placeholder="Tìm kiếm phim, diễn viên..."
          aria-label="Tìm kiếm phim, diễn viên"
          aria-expanded={showSuggestions}
          className="h-12 w-full rounded-2xl border border-white/10 bg-[#15151c] py-3 pl-12 pr-12 text-[15px] font-semibold text-white outline-none transition-colors placeholder:text-zinc-500 focus:border-pink-500/70"
        />
        {query && (
          <button
            type="button"
            aria-label="Xóa nội dung tìm kiếm"
            onClick={() => {
              setQuery("");
              setMovies([]);
              setPeople([]);
              inputRef.current?.focus();
            }}
            className="absolute inset-y-0 right-2 flex w-10 items-center justify-center rounded-full text-zinc-500 active:text-white"
          >
            <X size={18} />
          </button>
        )}
      </form>

      {showSuggestions && (
        <section className="absolute inset-x-0 top-full z-50 mt-2 max-h-[min(64dvh,34rem)] overflow-y-auto overscroll-contain rounded-2xl border border-white/10 bg-[#0b0b0f] shadow-[0_24px_70px_rgba(0,0,0,0.8)]">
          <div className="p-3.5 pb-2">
            <p className="mb-2 px-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">Danh sách phim</p>
            {!isSearching && movies.length === 0 ? (
              <p className="px-1 py-3 text-xs text-zinc-500">Không tìm thấy phim phù hợp.</p>
            ) : (
              <div className="space-y-1">
                {movies.map((movie) => (
                  <button
                    key={movie._id || movie.slug}
                    type="button"
                    onClick={() => selectMovie(movie.slug)}
                    className="flex min-h-[4.5rem] w-full items-center gap-3 rounded-xl p-2 text-left active:bg-white/[0.06]"
                  >
                    <img
                      src={getImageUrl(movie.poster_url || movie.thumb_url)}
                      alt=""
                      className="h-14 w-10 shrink-0 rounded-md border border-zinc-800 bg-zinc-900 object-cover"
                      loading="lazy"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-zinc-100">{cleanMovieName(movie.name)}</span>
                      <span className="mt-0.5 block truncate text-xs text-zinc-500">{cleanMovieName(movie.origin_name)}</span>
                      <span className="mt-1 block truncate text-[10px] font-semibold text-zinc-600">HD • {movie.year || "Đang cập nhật"} • {movie.lang || "Vietsub"}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-zinc-900/80 p-3.5 pt-3">
            <p className="mb-2 px-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">Danh sách diễn viên</p>
            {!isSearching && people.length === 0 ? (
              <p className="px-1 py-3 text-xs text-zinc-500">Không tìm thấy diễn viên phù hợp.</p>
            ) : (
              <div className="space-y-1">
                {people.map((person) => (
                  <button key={person.id} type="button" onClick={() => selectPerson(person.id)} className="flex min-h-14 w-full items-center gap-3 rounded-xl p-2 text-left active:bg-white/[0.06]">
                    {person.profileUrl ? (
                      <img src={person.profileUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" loading="lazy" />
                    ) : (
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-500"><UserRound size={18} /></span>
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-zinc-200">{person.name}</span>
                      <span className="mt-0.5 block truncate text-[11px] text-zinc-500">{person.knownFor.join(" • ") || "Xem phim đã tham gia"}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button type="button" onClick={submitSearch} className="sticky bottom-0 min-h-12 w-full border-t border-zinc-800 bg-[#15151c] px-4 text-center text-xs font-black text-pink-400 active:bg-pink-500/10">
            Xem toàn bộ kết quả
          </button>
        </section>
      )}
    </div>
  );
}
