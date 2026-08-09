import Link from "next/link";
import { ArrowRight } from "lucide-react";

export type InterestTheme = {
  name: string;
  description: string;
  href: string;
  gradient: string;
};

// Chỉ dùng các danh sách/thể loại mà discovery backend hỗ trợ thật sự.
export const themes: InterestTheme[] = [
  {
    name: "Phim mới cập nhật",
    description: "Nội dung vừa được bổ sung",
    href: "/search?type=phim-moi-cap-nhat",
    gradient: "from-[#f59e0b] via-[#f97316] to-[#ef4444]",
  },
  {
    name: "Phim chiếu rạp",
    description: "Điện ảnh mới và nổi bật",
    href: "/search?type=phim-chieu-rap",
    gradient: "from-[#06b6d4] via-[#14b8a6] to-[#22c55e]",
  },
  {
    name: "Phim bộ đang cập nhật",
    description: "Theo dõi tập mới mỗi ngày",
    href: "/phim-bo?status=ongoing",
    gradient: "from-[#3b82f6] via-[#6366f1] to-[#8b5cf6]",
  },
  {
    name: "Hoạt hình & Anime",
    description: "Thế giới hoạt hình đặc sắc",
    href: "/search?type=hoat-hinh",
    gradient: "from-[#a855f7] via-[#d946ef] to-[#ec4899]",
  },
  {
    name: "Cổ trang",
    description: "Kiếm hiệp và cung đấu",
    href: "/the-loai/co-trang",
    gradient: "from-[#f43f5e] via-[#ec4899] to-[#be123c]",
  },
  {
    name: "Hành động",
    description: "Kịch tính đến phút cuối",
    href: "/the-loai/hanh-dong",
    gradient: "from-[#10b981] via-[#14b8a6] to-[#0891b2]",
  },
  {
    name: "Phim lẻ",
    description: "Thưởng thức trọn vẹn một lần",
    href: "/phim-le",
    gradient: "from-[#fb7185] via-[#f472b6] to-[#c084fc]",
  },
  {
    name: "Phim bộ hoàn tất",
    description: "Xem liền mạch đến tập cuối",
    href: "/phim-bo?status=completed",
    gradient: "from-[#22c55e] via-[#10b981] to-[#0f766e]",
  },
  {
    name: "Tâm lý",
    description: "Câu chuyện nhiều cảm xúc",
    href: "/the-loai/tam-ly",
    gradient: "from-[#f472b6] via-[#e879f9] to-[#a78bfa]",
  },
  {
    name: "Kinh dị",
    description: "Dành cho người thích hồi hộp",
    href: "/the-loai/kinh-di",
    gradient: "from-[#475569] via-[#334155] to-[#18181b]",
  },
];

export function InterestCard({ theme, compact = false }: { theme: InterestTheme; compact?: boolean }) {
  return (
    <Link
      href={theme.href}
      className={`group relative isolate flex shrink-0 snap-start flex-col justify-end overflow-hidden rounded-2xl bg-gradient-to-br ${theme.gradient} p-4 text-white shadow-[0_14px_35px_rgba(0,0,0,0.18)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(0,0,0,0.3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black ${compact ? "h-32 w-[72vw] max-w-[280px] sm:w-auto sm:max-w-none md:h-36" : "h-36 w-full"}`}
      aria-label={`Khám phá chủ đề ${theme.name}`}
    >
      <span className="absolute -right-7 -top-8 h-28 w-28 rounded-full bg-white/10 transition-transform duration-500 group-hover:scale-125" />
      <span className="absolute -bottom-12 -left-9 h-28 w-28 rounded-full bg-black/10" />

      <span className="relative block min-w-0">
        <strong className="block text-base font-black leading-tight tracking-tight md:text-lg">{theme.name}</strong>
        <span className="mt-1 block truncate text-[11px] font-semibold text-white/75">{theme.description}</span>
        <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-black text-white/90">
          Khám phá <ArrowRight size={12} className="transition-transform group-hover:translate-x-1" />
        </span>
      </span>
    </Link>
  );
}

export default function Interests() {
  const visibleThemes = themes.slice(0, 6);

  return (
    <section className="container mx-auto mt-8 max-w-7xl space-y-4 px-6" aria-labelledby="interest-heading">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-[10px] font-black uppercase tracking-[0.24em] text-pink-500">Chọn nhanh nội dung</p>
          <h2 id="interest-heading" className="text-xl font-black tracking-tight text-zinc-100 md:text-2xl">
            Khám phá theo sở thích
          </h2>
        </div>
        <Link href="/chu-de" className="group hidden items-center gap-1 text-xs font-black text-zinc-500 transition hover:text-pink-400 sm:inline-flex">
          Xem tất cả chủ đề <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
        </Link>
      </div>

      <div className="-mx-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-3 scrollbar-none sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3 xl:grid-cols-6">
        {visibleThemes.map((theme) => <InterestCard key={theme.href} theme={theme} compact />)}
      </div>

      <Link href="/chu-de" className="flex h-11 w-full items-center justify-center gap-1 rounded-xl border border-zinc-800 bg-zinc-950 text-xs font-black text-zinc-400 transition hover:border-pink-500/40 hover:text-pink-400 sm:hidden">
        Xem tất cả chủ đề <ArrowRight size={14} />
      </Link>
    </section>
  );
}
