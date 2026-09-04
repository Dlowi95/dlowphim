import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, UsersRound } from "lucide-react";
import { GENRES } from "@/constants/discovery";

export const metadata: Metadata = {
  title: "Thể loại phim | DlowPhim",
  description: "Khám phá phim theo thể loại tại DlowPhim.",
};

const EXTRA_LINKS = [
  { href: "/watch-together", label: "Xem chung", icon: UsersRound },
  { href: "/lich-chieu", label: "Lịch chiếu", icon: CalendarDays },
] as const;

export default function GenreMenuPage() {
  return (
    <main data-testid="genre-menu-page" className="min-h-screen bg-black px-4 pb-32 pt-6 text-white md:px-6 md:pb-20 md:pt-28">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-7 border-b border-white/[0.07] pb-6 md:mb-9">
          <p className="mb-2 text-[11px] font-black uppercase tracking-[0.2em] text-pink-500">Menu DlowPhim</p>
          <h1 className="text-2xl font-black tracking-tight md:text-4xl">Khám phá theo thể loại</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">Chọn thể loại bạn muốn xem để mở danh sách phim tương ứng.</p>
        </header>

        <section aria-labelledby="genre-menu-heading">
          <h2 id="genre-menu-heading" className="mb-3 text-sm font-extrabold text-zinc-200 md:text-base">Thể loại</h2>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {GENRES.map((genre) => (
              <Link
                key={genre.slug}
                href={`/the-loai/${genre.slug}`}
                className="flex min-h-14 items-center rounded-xl border border-white/[0.08] bg-[#151517] px-4 text-sm font-bold text-zinc-200 transition-colors hover:border-pink-500/40 hover:bg-pink-500/[0.07] hover:text-pink-400 active:bg-white/[0.08] focus-visible:border-pink-500 focus-visible:outline-none"
              >
                {genre.name}
              </Link>
            ))}
          </div>
        </section>

        <section data-testid="genre-extra-menu" aria-labelledby="extra-menu-heading" className="mt-8 md:mt-10">
          <h2 id="extra-menu-heading" className="mb-3 text-sm font-extrabold text-zinc-200 md:text-base">Thêm</h2>
          <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#151517] sm:grid sm:grid-cols-2 sm:divide-x sm:divide-zinc-800">
            {EXTRA_LINKS.map(({ href, label, icon: Icon }, index) => (
              <Link
                key={href}
                href={href}
                className={`flex min-h-14 items-center gap-3 px-4 text-sm font-bold text-zinc-200 transition-colors hover:bg-pink-500/[0.07] hover:text-pink-400 active:bg-white/[0.08] focus-visible:bg-pink-500/[0.07] focus-visible:text-pink-400 focus-visible:outline-none ${index > 0 ? "border-t border-zinc-800 sm:border-t-0" : ""}`}
              >
                <Icon size={18} className="text-pink-500" aria-hidden="true" />
                {label}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
