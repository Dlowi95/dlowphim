"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { themes } from "@/components/Interests";

export default function ChuDePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-black text-white pt-28 pb-16 px-6">
      <div className="container mx-auto max-w-7xl space-y-8">
        
        {/* Tiêu đề trang */}
        <div className="border-b border-zinc-900 pb-4">
          <h1 className="text-xl md:text-3xl font-black tracking-tight text-white uppercase select-none">
            Các chủ đề
          </h1>
        </div>

        {/* Lưới toàn bộ 10 chủ đề giàn đều 6 cột */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 w-full">
          {themes.map((cat, idx) => (
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
                  Xem toàn bộ <ChevronRight size={10} className="shrink-0" />
                </span>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
