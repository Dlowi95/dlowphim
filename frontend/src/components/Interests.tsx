"use client";

import React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export const themes = [
  { name: "Top IMDb", query: "/search?type=top-imdb", gradient: "from-[#f19a1a] to-[#e65c40]" },
  { name: "Thuyết Minh", query: "/search?type=phim-thuyet-minh", gradient: "from-[#50c9c3] to-[#96deda]" },
  { name: "Phim 4K", query: "/search?type=phim-4k", gradient: "from-[#a1c4fd] to-[#c2e9fb]" },
  { name: "Lồng Tiếng Cực Mạnh", query: "/search?keyword=lồng%20tiếng", gradient: "from-[#cd9cf2] to-[#f6f3ff]" },
  { name: "Netflix", query: "/search?keyword=netflix", gradient: "from-[#f857a6] to-[#ff5858]" },
  { name: "TVB", query: "/search?keyword=TVB", gradient: "from-[#11998e] to-[#38ef7d]" },
  { name: "Cổ Trang", query: "/search?genre=co-trang", gradient: "from-[#ba5370] to-[#f4e2d8]" },
  { name: "Chữa lành", query: "/search?genre=tam-ly", gradient: "from-[#ff9a9e] via-[#fecfef] to-[#fecfef]" },
  { name: "Marvel Studios", query: "/search?keyword=marvel", gradient: "from-[#2193b0] to-[#6dd5ed]" },
  { name: "Ngày Giải Phóng Miền...", query: "/search?keyword=lịch%20sử", gradient: "from-[#f12711] to-[#f5af19]" }
];

export default function Interests() {
  const router = useRouter();

  // Trang chủ chỉ hiển thị 6 chủ đề đầu tiên
  const visibleThemes = themes.slice(0, 6);

  return (
    <div className="container mx-auto px-6 mt-8 max-w-7xl space-y-4">
      <h3 className="text-lg md:text-xl font-black tracking-tight text-zinc-100 uppercase select-none">
        Bạn đang quan tâm gì?
      </h3>
      
      {/* Grid 6 chủ đề đầu tiên */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 w-full">
        {visibleThemes.map((cat, idx) => (
          <div
            key={idx}
            onClick={() => router.push(cat.query)}
            className={`w-full h-28 rounded-2xl bg-gradient-to-br ${cat.gradient} p-4 flex flex-col justify-between cursor-pointer transition-transform duration-200 ease-out hover:-translate-y-1.5 select-none shadow-md group`}
          >
            <div></div> {/* Spacer */}
            <div className="space-y-1">
              <span className="block font-black text-base md:text-lg text-white tracking-wide leading-tight">
                {cat.name}
              </span>
              <span className="flex items-center gap-0.5 text-[11px] font-bold text-white/80 group-hover:text-white transition-colors">
                Xem chủ đề <ChevronRight size={10} className="shrink-0" />
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Nút +4 chủ đề nằm ở dòng dưới, canh trái */}
      <div className="flex justify-start pt-1">
        <Link
          href="/chu-de"
          className="w-36 h-12 flex items-center justify-center bg-[#1c1c1e] hover:bg-[#25252b] border border-zinc-800/60 rounded-2xl transition-all duration-200 text-sm font-extrabold text-zinc-300 hover:text-white hover:-translate-y-0.5 select-none shadow-md"
        >
          +4 chủ đề
        </Link>
      </div>
    </div>
  );
}
