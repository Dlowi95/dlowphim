"use client";

import React from "react";
import { Settings } from "lucide-react";

export default function PlaceholderView() {
  return (
    <div className="p-16 text-center flex flex-col items-center justify-center gap-3.5 select-none animate-fadeIn">
      <div className="w-14 h-14 rounded-full bg-pink-500/5 border border-pink-500/10 flex items-center justify-center text-pink-400">
        <Settings size={26} className="animate-spin duration-1000" />
      </div>
      <div className="space-y-1">
        <h4 className="font-extrabold text-xs text-zinc-300">Tính năng đang được phát triển</h4>
        <p className="text-[10px] text-zinc-500 max-w-xs mx-auto">
          Chức năng quản lý này đang được xây dựng hoàn thiện và sẽ sẵn sàng trong các bản phát hành tiếp theo.
        </p>
      </div>
    </div>
  );
}
