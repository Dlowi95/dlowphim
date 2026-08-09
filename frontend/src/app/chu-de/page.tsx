import { Compass } from "lucide-react";
import { InterestCard, themes } from "@/components/Interests";

export default function ChuDePage() {
  return (
    <main className="min-h-screen bg-black px-5 pb-20 pt-28 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 border-b border-zinc-900 pb-6">
          <p className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-pink-500">
            <Compass size={15} /> Khám phá DlowPhim
          </p>
          <h1 className="text-3xl font-black tracking-tight md:text-5xl">Chủ đề dành cho bạn</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">
            Chọn nhanh theo loại nội dung hoặc cảm xúc bạn muốn xem. Mỗi chủ đề đều dẫn tới danh sách phim được hỗ trợ trực tiếp bởi kho phim.
          </p>
        </header>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5" aria-label="Danh sách chủ đề">
          {themes.map((theme) => <InterestCard key={theme.href} theme={theme} />)}
        </section>
      </div>
    </main>
  );
}
