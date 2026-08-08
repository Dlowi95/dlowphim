"use client";

import { useEffect, useState } from "react";
import { Loader2, MapPin, UserRound } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import MovieCard from "@/components/MovieCard";
import Pagination from "@/components/Pagination";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function PersonMoviesPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`${API_URL}/movies/people/${params.id}/movies?page=${page}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Không tìm thấy thông tin diễn viên");
        setData(await response.json());
      } catch (loadError) {
        if (!controller.signal.aborted) setError(loadError instanceof Error ? loadError.message : "Không thể tải dữ liệu");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [page, params.id]);

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-black"><Loader2 className="animate-spin text-pink-500" size={42} /></div>;
  if (error || !data) return <div className="flex min-h-screen items-center justify-center bg-black px-5 text-center text-white"><div><UserRound className="mx-auto mb-4 text-zinc-600" size={48} /><h1 className="text-xl font-bold">{error}</h1><button onClick={() => router.push("/search")} className="mt-5 rounded-xl bg-pink-500 px-5 py-2 font-bold">Về trang tìm kiếm</button></div></div>;

  const person = data.person;
  return (
    <main className="min-h-screen bg-black px-5 pb-20 pt-28 text-white">
      <div className="mx-auto max-w-7xl">
        <section className="mb-10 flex flex-col gap-6 rounded-3xl border border-zinc-900 bg-gradient-to-br from-zinc-950 to-black p-5 sm:flex-row md:p-8">
          <div className="h-64 w-44 shrink-0 overflow-hidden rounded-2xl bg-zinc-900">
            {person.profileUrl ? <img src={person.profileUrl} alt={person.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-zinc-700"><UserRound size={48} /></div>}
          </div>
          <div className="self-center">
            <p className="mb-2 text-xs font-black uppercase tracking-[0.25em] text-pink-500">Hồ sơ diễn viên</p>
            <h1 className="text-3xl font-black md:text-5xl">{person.name}</h1>
            {person.placeOfBirth && <p className="mt-3 flex items-center gap-2 text-sm text-zinc-400"><MapPin size={15} /> {person.placeOfBirth}</p>}
            {person.biography && <p className="mt-5 line-clamp-5 max-w-3xl text-sm leading-7 text-zinc-400">{person.biography}</p>}
          </div>
        </section>
        <section>
          <div className="mb-6"><h2 className="text-2xl font-black uppercase">Phim có trên DlowPhim</h2><p className="mt-2 text-sm text-zinc-500">Đã đối chiếu vai diễn với PhimAPI và nguồn dự phòng. Một số tác phẩm chưa có bản phát sẽ không hiển thị.</p></div>
          {data.items.length ? <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7">{data.items.map((movie: any) => <MovieCard key={movie._id || movie.slug} movie={movie} aspect="portrait" />)}</div> : <div className="rounded-3xl border border-zinc-900 bg-zinc-950 py-16 text-center text-zinc-500">Chưa tìm thấy phim của diễn viên này trong kho DlowPhim ở trang hiện tại.</div>}
          <Pagination currentPage={page} totalPages={data.totalPages} onPageChange={(nextPage) => { router.push(`/dien-vien/${params.id}?page=${nextPage}`); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
        </section>
      </div>
    </main>
  );
}

