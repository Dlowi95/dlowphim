import Link from "next/link";
import { ArrowRight, CalendarDays, Clock3, UsersRound } from "lucide-react";

export const metadata = {
  title: "Lịch chiếu | DlowPhim",
  description: "Theo dõi lịch chiếu và các phòng xem chung trên DlowPhim.",
};

const scheduleGroups = [
  {
    title: "Hôm nay",
    description: "Các suất chiếu diễn ra trong ngày sẽ xuất hiện tại đây.",
    icon: CalendarDays,
  },
  {
    title: "Sắp tới",
    description: "Theo dõi những phòng đã được lên lịch trong thời gian tới.",
    icon: Clock3,
  },
  {
    title: "Phòng của bạn",
    description: "Lịch xem chung do bạn tạo hoặc đã tham gia sẽ được tổng hợp tại đây.",
    icon: UsersRound,
  },
];

export default function SchedulePage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-8 pt-24 sm:px-6 md:pb-14 md:pt-28">
      <section className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(236,72,153,0.22),transparent_38%),linear-gradient(145deg,#15151d,#09090d)] p-5 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-pink-400">
          Lịch chiếu DlowPhim
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">
          Hẹn giờ xem phim cùng nhau
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
          Khu vực lịch chiếu đang được hoàn thiện. Trong lúc chờ, bạn vẫn có thể
          khám phá hoặc tạo phòng xem chung ngay.
        </p>
        <Link
          href="/watch-together"
          className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-pink-500 px-5 text-sm font-bold text-white shadow-[0_10px_30px_rgba(236,72,153,0.28)] transition hover:bg-pink-400"
        >
          Xem các phòng
          <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-3 md:mt-8 md:gap-4">
        {scheduleGroups.map(({ title, description, icon: Icon }) => (
          <article
            key={title}
            className="rounded-2xl border border-white/10 bg-zinc-950 p-4 sm:p-5"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-500/10 text-pink-400">
              <Icon size={20} aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-lg font-bold text-white">{title}</h2>
            <p className="mt-1 text-sm leading-6 text-zinc-500">{description}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
