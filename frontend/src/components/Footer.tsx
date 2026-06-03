import React from "react";
import { Film } from "lucide-react";

export default function FooterComponent() {
  return (
    <footer className="w-full bg-zinc-950 border-t border-zinc-900 text-zinc-500 py-8 mt-12">
      <div className="container mx-auto px-6 max-w-7xl flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Bản quyền và Logo */}
        <div className="flex items-center gap-2">
          <Film className="text-amber-500/60" size={18} />
          <p className="text-sm font-medium text-zinc-400">
            © {new Date().getFullYear()} <span className="text-amber-500 font-semibold">DlowPhim</span>. Đồ án Full-stack tốt nghiệp.
          </p>
        </div>

        {/* Các liên kết chính sách ảo */}
        <div className="flex flex-wrap gap-6 text-xs font-medium text-zinc-500">
          <a href="#" className="hover:text-zinc-300 transition-colors">Điều khoản sử dụng</a>
          <a href="#" className="hover:text-zinc-300 transition-colors">Chính sách bảo mật</a>
          <a href="#" className="hover:text-zinc-300 transition-colors">Khiếu nại bản quyền</a>
          <a href="#" className="hover:text-zinc-300 transition-colors">Liên hệ Admin</a>
        </div>
      </div>
    </footer>
  );
}