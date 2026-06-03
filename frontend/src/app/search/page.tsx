"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardBody } from "@heroui/react"; 
import { Loader2, Monitor, ArrowLeft, ArrowRight } from "lucide-react"; 

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const keyword = searchParams.get("keyword") || "";
  const type = searchParams.get("type") || "";
  const pageUrl = parseInt(searchParams.get("page") || "1", 10);

  const [movies, setMovies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    async function fetchSearchData() {
      try {
        setLoading(true);
        let url = "";
        
        if (keyword) {
          url = `https://ophim1.com/v1/api/tim-kiem?keyword=${encodeURIComponent(keyword)}&page=${pageUrl}`;
        } else if (type) {
          url = `https://ophim1.com/v1/api/danh-sach/${type}?page=${pageUrl}`;
        } else {
          url = `https://ophim1.com/v1/api/danh-sach/phim-moi-cap-nhat?page=${pageUrl}`;
        }

        const res = await fetch(url);
        const data = await res.json();

        if (data.status === "success" || data.status === true) {
          const items = data.data?.items || data.items || [];
          setMovies(items);

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
        }
      } catch (error) {
        console.error("Lỗi gọi API tìm kiếm OPhim:", error);
        setMovies([]);
      } finally {
        setLoading(false);
      }
    }

    fetchSearchData();
  }, [keyword, type, pageUrl]);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    
    let targetUrl = `/search?page=${newPage}`;
    if (keyword) targetUrl += `&keyword=${encodeURIComponent(keyword)}`;
    if (type) targetUrl += `&type=${type}`;
    
    router.push(targetUrl);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const getPageTitle = () => {
    if (keyword) return `Kết quả tìm kiếm cho: "${keyword}"`;
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
            {movies.map((movie) => {
              
              // 🌟 ĐỒNG BỘ TRANG CHỦ: Cắt lấy tên file ảnh gốc
              const fileName = movie.thumb_url ? movie.thumb_url.split("/").pop() : "";
              
              // 🌟 Ép chạy thẳng bằng domain .live thần thánh đã kiểm chứng ăn khớp mạng nhà bồ
              const fullThumbUrl = `https://img.ophim.live/uploads/movies/${fileName}`;

              return (
                <Card 
                  key={movie._id} 
                  isPressable 
                  className="bg-zinc-900 border border-zinc-800/80 hover:border-pink-500/50 transition-all duration-300 rounded-xl group overflow-hidden"
                >
                  <CardBody className="p-0 relative">
                    <div className="overflow-hidden aspect-[2/3] w-full bg-zinc-800">
                      <img
                        src={fullThumbUrl}
                        alt={movie.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                        referrerPolicy="no-referrer" 
                      />
                    </div>
                    
                    <div className="absolute top-2 right-2 bg-black/75 backdrop-blur-md px-2 py-0.5 rounded-md text-[10px] font-bold text-pink-400 flex items-center gap-1 z-10 border border-zinc-800">
                      <Monitor size={10} /> {movie.quality || "HD"} - {movie.lang || "Vietsub"}
                    </div>

                    <div className="p-3 space-y-1 text-left">
                      <h3 className="font-bold text-sm text-zinc-100 truncate group-hover:text-pink-500 transition-colors">
                        {movie.name}
                      </h3>
                      <div className="flex items-center justify-between text-[11px] text-zinc-500 font-medium">
                        <span className="truncate max-w-[70%]">{movie.origin_name}</span>
                        <span>{movie.year}</span>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              );
            })}
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