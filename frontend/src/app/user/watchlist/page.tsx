"use client";

import React from "react";
import { Plus } from "lucide-react";

export default function UserWatchlistPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-zinc-900 pb-3.5">
        <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-zinc-100 flex items-center gap-2.5">
          <Plus className="text-pink-500" size={24} />
          <span>Danh sách phát</span>
        </h2>
      </div>

      <div className="bg-[#12131b]/30 border border-zinc-900 rounded-3xl py-20 px-8 flex flex-col items-center justify-center gap-3 select-none text-center">
        <Plus size={44} className="text-zinc-700" />
        <h4 className="text-base font-bold text-zinc-400">Danh sách xem sau trống</h4>
        <p className="text-xs text-zinc-500 max-w-xs">
          Bạn chưa thêm bộ phim nào vào danh sách xem sau.
        </p>
      </div>
    </div>
  );
}
