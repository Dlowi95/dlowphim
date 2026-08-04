"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, Clock3, Radio, Sparkles } from "lucide-react";

interface MovieReleaseStatusProps {
  slug: string;
  title: string;
  originTitle?: string;
  movieType?: string;
  movieStatus?: string;
  episodeCurrent?: string;
  episodeTotal?: string;
  releaseDate?: string;
  tmdbId?: string | number;
  tmdbType?: string;
  compact?: boolean;
  delayMs?: number;
}

interface ScheduleData {
  state: "upcoming" | "airing" | "completed" | "unknown";
  source: "tmdb" | "tmdb-cache" | "provider";
  nextEpisode: null | {
    episodeNumber?: number;
    seasonNumber?: number;
    name?: string;
    airDate?: string;
  };
  releaseDate?: string;
}

function formatAirDate(value = "") {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.round((date.getTime() - todayStart.getTime()) / 86_400_000);
  if (days === 0) return "hôm nay";
  if (days === 1) return "ngày mai";
  return date.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function MovieReleaseStatus({
  slug,
  title,
  originTitle = "",
  movieType = "",
  movieStatus = "",
  episodeCurrent = "",
  episodeTotal = "",
  releaseDate = "",
  tmdbId,
  tmdbType,
  compact = false,
  delayMs = 800,
}: MovieReleaseStatusProps) {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
  const [schedule, setSchedule] = useState<ScheduleData | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const params = new URLSearchParams({
        title,
        originTitle,
        movieType,
        movieStatus,
        episodeCurrent,
        episodeTotal,
        releaseDate,
        tmdbType: tmdbType || (movieType === "series" ? "tv" : "movie"),
      });
      if (tmdbId) params.set("tmdbId", String(tmdbId));
      try {
        const response = await fetch(`${API_URL}/movies/schedule/${slug}?${params}`, {
          signal: controller.signal,
        });
        if (response.ok) setSchedule(await response.json());
      } catch {
        // Trạng thái lịch là thông tin bổ sung, không được cản trở nội dung chính.
      }
    }, delayMs);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [API_URL, delayMs, episodeCurrent, episodeTotal, movieStatus, movieType, originTitle, releaseDate, slug, title, tmdbId, tmdbType]);

  const presentation = useMemo(() => {
    if (!schedule) return null;
    const next = schedule.nextEpisode;
    const airDate = formatAirDate(next?.airDate);
    const releaseDate = formatAirDate(schedule.releaseDate);
    if (next && airDate) {
      return {
        icon: CalendarDays,
        label: "Lịch phát tập mới",
        title: `Tập ${next.episodeNumber || "mới"} phát sóng ${airDate}`,
        detail: next.name || "Ngày phát do TMDB cung cấp",
        tone: "border-pink-500/20 bg-pink-500/[0.07] text-pink-400",
      };
    }
    if (schedule.state === "completed") {
      return {
        icon: CheckCircle2,
        label: "Trạng thái",
        title: "Phim đã hoàn tất",
        detail: episodeCurrent || "Có thể xem trọn bộ",
        tone: "border-emerald-500/20 bg-emerald-500/[0.07] text-emerald-400",
      };
    }
    if (schedule.state === "upcoming") {
      return {
        icon: Clock3,
        label: "Sắp phát hành",
        title: releaseDate ? `Công chiếu ${releaseDate}` : "Đang chờ lịch công chiếu",
        detail: releaseDate ? "Ngày phát hành do TMDB cung cấp" : "Chưa có ngày phát chính xác",
        tone: "border-amber-500/20 bg-amber-500/[0.07] text-amber-400",
      };
    }
    if (schedule.state === "airing") {
      return {
        icon: Radio,
        label: "Đang cập nhật",
        title: episodeCurrent || "Phim đang phát sóng",
        detail: "Chưa có lịch tập mới được xác nhận",
        tone: "border-sky-500/20 bg-sky-500/[0.07] text-sky-400",
      };
    }
    return null;
  }, [episodeCurrent, schedule]);

  if (!presentation) return null;
  const Icon = presentation.icon;

  return (
    <div className={`flex items-center gap-3 rounded-2xl border ${presentation.tone} ${compact ? "px-3 py-2.5" : "px-4 py-3"}`}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-black/20"><Icon size={17} /></div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.17em] opacity-80"><Sparkles size={10} />{presentation.label}</p>
        <p className={`${compact ? "text-xs" : "text-sm"} mt-0.5 font-black text-white`}>{presentation.title}</p>
        {!compact && <p className="mt-0.5 truncate text-[11px] text-zinc-500">{presentation.detail}</p>}
      </div>
    </div>
  );
}
