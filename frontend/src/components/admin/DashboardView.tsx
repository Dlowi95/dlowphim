"use client";

import React, { useState, useEffect } from "react";
import { Film, Users, MessageSquare, AlertTriangle, TrendingUp, Loader2 } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

interface DashboardViewProps {
  stats: {
    totalUsers: number;
    totalComments: number;
    activeReports: number;
    totalViews: number;
    chartData: Array<{ month: string; LuotXem: number; BinhLuan: number }>;
  } | null;
  loading: boolean;
}

export default function DashboardView({ stats, loading }: DashboardViewProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (loading || !stats) {
    return (
      <div className="space-y-6 animate-fadeIn">
        {/* Skeleton Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div
              key={idx}
              className="p-4 bg-[#0d0e13] border border-zinc-900 rounded-2xl flex items-center justify-between animate-pulse"
            >
              <div className="space-y-2">
                <div className="w-16 h-3 bg-zinc-800 rounded" />
                <div className="w-24 h-6 bg-zinc-850 rounded" />
                <div className="w-28 h-2 bg-zinc-900 rounded" />
              </div>
              <div className="w-11 h-11 rounded-xl bg-zinc-800" />
            </div>
          ))}
        </div>

        {/* Skeleton Chart */}
        <div className="p-5 bg-[#0d0e13] border border-zinc-900 rounded-2xl h-80 flex flex-col justify-center items-center gap-3">
          <Loader2 className="animate-spin text-pink-500" size={24} />
          <span className="text-[10px] font-black text-zinc-550 uppercase tracking-widest">Đang tải biểu đồ...</span>
        </div>
      </div>
    );
  }

  const statItems = [
    {
      title: "Tổng người dùng",
      value: stats.totalUsers.toLocaleString("vi-VN"),
      change: "+4.1%",
      icon: Users,
      color: "from-blue-500 to-cyan-500",
    },
    {
      title: "Lượt xem phim",
      value: stats.totalViews.toLocaleString("vi-VN"),
      change: "+22.4%",
      icon: Film,
      color: "from-pink-500 to-rose-500",
    },
    {
      title: "Tổng số bình luận",
      value: stats.totalComments.toLocaleString("vi-VN"),
      change: "+15.6%",
      icon: MessageSquare,
      color: "from-purple-500 to-indigo-500",
    },
    {
      title: "Báo cáo bình luận",
      value: `${stats.activeReports} hoạt động`,
      change: stats.activeReports > 0 ? `+${stats.activeReports}` : "0",
      icon: AlertTriangle,
      color: "from-amber-500 to-orange-500",
    },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statItems.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div
              key={idx}
              className="p-4 bg-[#0d0e13] border border-zinc-900/80 rounded-2xl flex items-center justify-between hover:border-pink-500/20 transition-all duration-300 group shadow-sm"
            >
              <div className="space-y-1.5 text-left">
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block">
                  {stat.title}
                </span>
                <h3 className="text-lg md:text-xl font-black text-white tracking-tight">{stat.value}</h3>
                <div className="flex items-center gap-1">
                  <TrendingUp size={11} className="text-emerald-500" />
                  <span className="text-[10px] font-bold text-emerald-500">{stat.change}</span>
                  <span className="text-[9px] font-bold text-zinc-650">so với tháng trước</span>
                </div>
              </div>
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-tr ${stat.color} text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform duration-300`}>
                <Icon size={16} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Chart Section */}
      {mounted && (
        <div className="p-5 bg-[#0d0e13] border border-zinc-900 rounded-2xl space-y-4 text-left shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-black text-zinc-400 uppercase tracking-wider">Tương tác và Lượt xem</h4>
              <p className="text-[10px] font-semibold text-zinc-650">Phát triển lượt truy cập và bình luận 6 tháng gần nhất</p>
            </div>
            <span className="text-[10px] font-bold bg-pink-500/10 text-pink-400 px-2 py-0.5 rounded-full border border-pink-500/10">
              Đơn vị: Lượt
            </span>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorLuotXem" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ec4899" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorBinhLuan" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#12131b" vertical={false} />
                <XAxis dataKey="month" stroke="#4b5563" fontSize={10} tickLine={false} />
                <YAxis stroke="#4b5563" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0d0e13", border: "1px solid #1f2937", borderRadius: "12px", fontSize: "11px" }}
                  labelClassName="font-extrabold text-zinc-400"
                />
                <Area type="monotone" dataKey="LuotXem" stroke="#ec4899" strokeWidth={2.5} fillOpacity={1} fill="url(#colorLuotXem)" name="Lượt xem" />
                <Area type="monotone" dataKey="BinhLuan" stroke="#8b5cf6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorBinhLuan)" name="Bình luận" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
