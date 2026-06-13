"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2, ArrowLeft, ArrowRight } from "lucide-react"; 
import MovieCard from "@/components/MovieCard";

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const keyword = searchParams.get("keyword") || "";
  const type = searchParams.get("type") || "";
  const genre = searchParams.get("genre") || "";
  const country = searchParams.get("country") || "";
  const pageUrl = parseInt(searchParams.get("page") || "1", 10);

  const [movies, setMovies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [apiTitle, setApiTitle] = useState("");

  useEffect(() => {
    async function fetchSearchData() {
      try {
        setLoading(true);
        let url = "";
        
        if (keyword) {
          url = `https://ophim1.com/v1/api/tim-kiem?keyword=${encodeURIComponent(keyword)}&page=${pageUrl}`;
        } else if (genre) {
          url = `https://ophim1.com/v1/api/the-loai/${genre}?page=${pageUrl}`;
        } else if (country) {
          url = `https://ophim1.com/v1/api/quoc-gia/${country}?page=${pageUrl}`;
        } else if (type) {
          url = `https://ophim1.com/v1/api/danh-sach/${type}?page=${pageUrl}`;
        } else {
          url = `https://ophim1.com/v1/api/danh-sach/phim-moi-cap-nhat?page=${pageUrl}`;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          console.warn("Search API timeout. Aborting request.");
          controller.abort();
        }, 6000); // 6 seconds timeout

        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        const data = await res.json();

        if (data.status === "success" || data.status === true) {
          const items = data.data?.items || data.items || [];
          setMovies(items);

          const title = data.data?.titlePage || data.titlePage || "";
          setApiTitle(title);

          const pagination = data.data?.params?.pagination;
          if (pagination) {
            const total = pagination.totalItems;
            const perPage = pagination.totalItemsPerPage;
            setTotalPages(Math.ceil(total / perPage) || 1);
          } else {
            setTotalPages(1);
          }
        } else {
          setMovies([]);
          setTotalPages(1);
          setApiTitle("");
        }
      } catch (error) {
        console.error("Lỗi gọi API tìm kiếm OPhim:", error);
        setMovies([]);
        setApiTitle("");
      } finally {
        setLoading(false);
      }
    }

    fetchSearchData();
  }, [keyword, type, genre, country, pageUrl]);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    
    let targetUrl = `/search?page=${newPage}`;
    if (keyword) targetUrl += `&keyword=${encodeURIComponent(keyword)}`;
    if (genre) targetUrl += `&genre=${genre}`;
    if (country) targetUrl += `&country=${country}`;
    if (type) targetUrl += `&type=${type}`;
    
    router.push(targetUrl);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const getPageTitle = () => {
    if (keyword) return `Kết quả tìm kiếm cho: "${keyword}"`;
    if (type === "top-imdb") return "Bảng Xếp Hạng Phim Top IMDb";
    if (type === "phim-thuyet-minh") return "Danh Sách Phim Thuyết Minh";
    if (type === "phim-sap-chieu") return "Danh Sách Phim Sắp Chiếu / Phim Hot";
    if (type === "phim-4k") return "Danh Sách Phim 4K Siêu Nét";
    if (apiTitle) return apiTitle;
    if (genre) return `Thể Loại: ${genre}`;
    if (country) return `Quốc Gia: ${country}`;
    if (type === "phim-le") return "Danh Sách Phim Lẻ Mới Nhất";
    if (type === "phim-bo") return "Danh Sách Phim Bộ Lồng Tiếng / Vietsub";
    if (type === "hoat-hinh") return "Kho Phim Hoạt Hình / Anime Đặc Sắc";
    return "Danh Sách Phim Hệ Thống";
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 bg-black text-white">
        <Loader2 className="animate-spin text-pink-500" size={40} />
        <p className="text-sm font-medium text-zinc-500">Đang lục tìm kho lưu trữ phim...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pt-28 pb-16 px-6">
      <div className="container mx-auto max-w-7xl space-y-8">
        
        {/* Tiêu đề trang */}
        <div className="border-b border-zinc-900 pb-4">
          <h1 className="text-xl md:text-3xl font-black tracking-tight text-white uppercase">
            {getPageTitle()}
          </h1>
          <p className="text-xs md:text-sm text-zinc-500 font-medium mt-1">
            Trang {pageUrl} / {totalPages}
          </p>
        </div>

        {/* Khối hiển thị khi trống kết quả */}
        {movies.length === 0 ? (
          <div className="text-center py-20 bg-zinc-950 rounded-2xl border border-zinc-900/50 space-y-2">
            <p className="text-lg font-bold text-zinc-400">Rất tiếc, không tìm thấy phim phù hợp!</p>
            <p className="text-xs text-zinc-600">Bồ thử tìm bằng từ khóa khác hoặc kiểm tra lại chính tả xem sao nhé.</p>
          </div>
        ) : (
          /* Grid danh sách phim tìm kiếm */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
            {movies.map((movie) => (
              <MovieCard key={movie._id} movie={movie} aspect="portrait" />
            ))}
          </div>
        )}

        {/* Thanh chuyển trang màu hồng */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-8 border-t border-zinc-900">
            <button
              onClick={() => handlePageChange(pageUrl - 1)}
              disabled={pageUrl === 1}
              className="p-2.5 rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white hover:border-zinc-700 disabled:opacity-30 disabled:hover:text-zinc-400 disabled:hover:border-zinc-800 transition-all"
            >
              <ArrowLeft size={16} />
            </button>

            <div className="px-5 py-2 rounded-xl bg-pink-500 text-white font-extrabold text-sm shadow-lg shadow-pink-500/20 select-none">
              Trang {pageUrl} / {totalPages}
            </div>

            <button
              onClick={() => handlePageChange(pageUrl + 1)}
              disabled={pageUrl === totalPages}
              className="p-2.5 rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white hover:border-zinc-700 disabled:opacity-30 disabled:hover:text-zinc-400 disabled:hover:border-zinc-800 transition-all"
            >
              <ArrowRight size={16} />
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <Loader2 className="animate-spin text-pink-500" size={40} />
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}