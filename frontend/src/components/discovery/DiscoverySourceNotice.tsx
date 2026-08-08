import { History, Server } from "lucide-react";

export default function DiscoverySourceNotice({
  fallbackUsed,
  staleUsed,
  savedAt,
}: {
  fallbackUsed?: boolean;
  staleUsed?: boolean;
  savedAt?: string | null;
}) {
  if (staleUsed) {
    const time = savedAt
      ? new Date(savedAt).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })
      : "gần đây";
    return (
      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-sky-500/20 bg-sky-500/5 px-4 py-3 text-sky-200">
        <History size={19} className="mt-0.5 shrink-0 text-sky-400" />
        <div><p className="text-sm font-bold">Đang hiển thị dữ liệu gần nhất</p><p className="mt-0.5 text-xs text-sky-200/60">Máy chủ đang gián đoạn nên DlowPhim giữ lại danh sách thành công lúc {time}.</p></div>
      </div>
    );
  }
  if (!fallbackUsed) return null;
  return (
    <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-amber-200">
      <Server size={19} className="mt-0.5 shrink-0 text-amber-400" />
      <div><p className="text-sm font-bold">Đang dùng máy chủ dự phòng</p><p className="mt-0.5 text-xs text-amber-200/60">Nguồn chính đang chậm hoặc chưa có dữ liệu. Danh sách đã được chuyển tự động.</p></div>
    </div>
  );
}
