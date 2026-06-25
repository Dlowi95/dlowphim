"use client";

import React from "react";
import { Bell } from "lucide-react";

export default function UserNotificationsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-zinc-900 pb-3.5">
        <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-zinc-100 flex items-center gap-2.5">
          <Bell className="text-pink-500" size={24} />
          <span>Thông báo hệ thống</span>
        </h2>
      </div>

      <div className="bg-[#12131b]/30 border border-zinc-900 rounded-3xl py-20 px-8 flex flex-col items-center justify-center gap-3 select-none text-center">
        <Bell size={44} className="text-zinc-700" />
        <h4 className="text-base font-bold text-zinc-400">Không có thông báo mới</h4>
        <p className="text-xs text-zinc-500 max-w-xs">
          Bạn đã đọc hết tất cả các thông báo từ hệ thống DlowPhim.
        </p>
      </div>
    </div>
  );
}
