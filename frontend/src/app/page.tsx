"use client";

import React, { useEffect, useState } from "react";
import { Button, Card, CardBody } from "@heroui/react";
import { Play, Flame, Film, Loader2, Monitor } from "lucide-react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const [heroMovie, setHeroMovie] = useState<any>(null);
  const [movieList, setMovieList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function fetchOPhim() {
      try {
        setLoading(true);
        const res = await fetch("https://ophim1.com/danh-sach/phim-moi-cap-nhat?page=1");
        const data = await res.json();
        
        if (data.status && data.items) {
          setHeroMovie(data.items[0]);
          setMovieList(data.items.slice(1, 9));
        }
      } catch (error) {
        console.error("Lỗi khi kết nối API OPhim:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchOPhim();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center gap-3 bg-black text-white">
        <Loader2 className="animate-spin text-pink-500" size={40} />
        <p className="text-sm font-medium text-zinc-400">Đang đồng bộ máy chủ DlowPhim...</p>
      </div>
    );
  }

  // Mảng danh mục "Bạn đang quan tâm gì" chuẩn style Cobephim
  const categories = [
    { name: "Top IMDb", query: "phim-moi-cap-nhat", gradient: "from-amber-600 via-orange-600 to-red-600" },
    { name: "Thuyết Minh", query: "phim-bo", gradient: "from-teal-600 via-cyan-600 to-blue-600" },
    { name: "Phim Lẻ Mới", query: "phim-le", gradient: "from-indigo-600 via-purple-600 to-pink-600" },
    { name: "Hoạt Hình / Anime", query: "hoat-hinh", gradient: "from-pink-600 via-rose-600 to-red-600" },
    { name: "Thịnh Hành", query: "phim-moi-cap-nhat", gradient: "from-zinc-800 to-zinc-900" },
  ];

  return (
    <div className="min-h-screen bg-black text-white pb-12">
      {/* 1. HERO BANNER */}
      {heroMovie && (
        <div className="relative w-full h-[65vh] md:h-[80vh] flex items-end bg-gradient-to-t from-black via-black/40 to-transparent">
          <div className="absolute inset-0 z-0">
            <img 
              src={`https://img.ophim.live/uploads/movies/${heroMovie.poster_url?.split("/").pop()}`} 
              alt={heroMovie.name} 
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover opacity-25 blur-sm"
            />
          </div>

          <div className="container mx-auto px-6 mb-16 z-10 max-w-7xl space-y-4">
            <div className="inline-flex items-center gap-2 bg-pink-500/10 border border-pink-500/30 px-3 py-1 rounded-full text-xs text-pink-400 font-semibold">
              <Flame size={14} className="fill-pink-400" /> PHIM MỚI CẬP BẾN RẠP
            </div>
            
            <h1 className="text-4xl md:text-6xl font-black tracking-tight max-w-3xl leading-none uppercase text-white">
              {heroMovie.name}
            </h1>
            
            <h2 className="text-lg md:text-xl font-medium text-zinc-400 tracking-wide italic">
              {heroMovie.origin_name}
            </h2>

            <div className="flex items-center gap-4 text-sm text-zinc-400 font-medium">
              <span className="bg-pink-500 text-white font-extrabold px-2 py-0.5 rounded text-xs">
                {heroMovie.lang || "Vietsub"}
              </span>
              <span>•</span>
              <span className="text-zinc-300">{heroMovie.year}</span>
            </div>

            <p className="text-zinc-400 text-sm md:text-base max-w-xl leading-relaxed">
              Bấm vào chi tiết để xem lịch chiếu, danh sách tập phim, chọn nguồn server tốc độ cao và thưởng thức trọn vẹn bộ phim bom tấn này.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Button 
                size="lg" 
                onClick={() => router.push(`/movie/${heroMovie.slug}`)}
                className="font-extrabold text-white bg-pink-500 hover:bg-pink-600 rounded-xl px-8 h-12 shadow-lg shadow-pink-500/30 transition-all duration-200"
                startContent={<Play size={18} className="fill-white" />}
              >
                Xem Chi Tiết
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 2. KHÚC ĐỆM BỔ SUNG: "BẠN ĐANG QUAN TÂM GÌ?" Y HỆT COBEPHIM */}
      <div className="container mx-auto px-6 mt-6 max-w-7xl space-y-4">
        <h3 className="text-lg md:text-xl font-black tracking-tight text-zinc-100">
          Bạn đang quan tâm gì?
        </h3>
        
        {/* Hàng danh mục cuộn ngang mượt mà trên điện thoại */}
        <div className="flex items-center gap-4 overflow-x-auto pb-3 scrollbar-none no-scrollbar">
          {categories.map((cat, idx) => (
            <div
              key={idx}
              onClick={() => router.push(`/search?type=${cat.query}`)}
              className={`flex-shrink-0 w-40 h-20 rounded-2xl bg-gradient-to-br ${cat.gradient} p-4 flex items-end cursor-pointer hover:scale-[1.03] active:scale-[0.98] transition-all duration-200 shadow-md`}
            >
              <span className="font-bold text-sm text-white tracking-wide select-none drop-shadow-md">
                {cat.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 3. MAIN CONTENT - GRID DANH SÁCH PHIM */}
      <div className="container mx-auto px-6 mt-10 max-w-7xl space-y-6">
        <div className="flex items-center gap-2 border-b border-zinc-900 pb-3">
          <Film size={22} className="text-pink-500" />
          <h2 className="text-xl md:text-2xl font-bold tracking-tight">Phim Mới Cập Nhật</h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
          {movieList.map((movie) => {
            const fileName = movie.thumb_url ? movie.thumb_url.split("/").pop() : "";
            const fullThumbUrl = `https://img.ophim.live/uploads/movies/${fileName}`;

            return (
              <Card 
                key={movie._id} 
                isPressable 
                onClick={() => router.push(`/movie/${movie.slug}`)}
                className="bg-zinc-900 border border-zinc-800/80 hover:border-pink-500/50 transition-all duration-300 rounded-xl group overflow-hidden"
              >
                <CardBody className="p-0 relative">
                  <div className="overflow-hidden aspect-[2/3] w-full bg-zinc-800">
                    <img
                      src={fullThumbUrl}
                      alt={movie.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
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
      </div>
    </div>
  );
}