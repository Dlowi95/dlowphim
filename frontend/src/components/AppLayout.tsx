"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import NavbarComponent from "@/components/Navbar";
import FooterComponent from "@/components/Footer";
import { ShieldAlert, Loader2 } from "lucide-react";
import { normalizeAdminRole } from "@/utils/adminPermissions";
import { shouldHideMobileNavigation } from "@/utils/mobileNavigation";

const SYSTEM_SETTINGS_CACHE_TTL_MS = 60 * 1000;
let maintenanceCache: { value: boolean; expiresAt: number } | null = null;
let maintenanceInflight: Promise<boolean> | null = null;

function loadMaintenanceMode(apiUrl: string) {
  if (maintenanceCache && maintenanceCache.expiresAt > Date.now()) {
    return Promise.resolve(maintenanceCache.value);
  }
  if (maintenanceInflight) return maintenanceInflight;

  maintenanceInflight = fetch(`${apiUrl}/system-settings`)
    .then(async (response) => {
      if (!response.ok) throw new Error(`System settings ${response.status}`);
      const data = await response.json();
      const value = Boolean(data.maintenanceMode);
      maintenanceCache = {
        value,
        expiresAt: Date.now() + SYSTEM_SETTINGS_CACHE_TTL_MS,
      };
      return value;
    })
    .finally(() => {
      maintenanceInflight = null;
    });
  return maintenanceInflight;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const pathname = usePathname();
  const [maintenance, setMaintenance] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  useEffect(() => {
    let disposed = false;
    void loadMaintenanceMode(API_URL)
      .then((value) => {
        if (!disposed) setMaintenance(value);
      })
      .catch((error) => {
        if (!disposed) console.error("Lỗi kiểm tra bảo trì:", error);
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });
    return () => {
      disposed = true;
    };
  }, [API_URL, pathname]);

  const isAdminPath = pathname.startsWith("/sys-dlowadmin");
  const showMobileNavigation =
    !isAdminPath && !shouldHideMobileNavigation(pathname);

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-pink-500" size={36} />
        <span className="text-sm md:text-base text-zinc-400 font-bold uppercase tracking-widest animate-pulse">Đang tải DlowPhim...</span>
      </div>
    );
  }

  // Nếu đang bảo trì hệ thống VÀ không phải trang admin VÀ tài khoản hiện tại không phải admin
  if (maintenance && !isAdminPath && !normalizeAdminRole(user?.role)) {
    return (
      <div className="min-h-screen bg-[#07070a] flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="w-24 h-24 rounded-full bg-pink-500/5 border border-pink-500/10 flex items-center justify-center text-pink-500 shadow-[0_0_40px_rgba(236,72,153,0.15)] mb-8 animate-pulse">
          <ShieldAlert size={44} />
        </div>
        <div className="space-y-4 max-w-2xl">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-white uppercase tracking-widest leading-tight">
            Hệ thống đang bảo trì
          </h1>
          <p className="text-sm md:text-base text-zinc-350 leading-relaxed font-bold max-w-xl mx-auto">
            DlowPhim đang được nâng cấp cấu hình để mang lại trải nghiệm xem phim tốc độ cao tốt hơn. Chúng tôi sẽ sớm quay trở lại. Xin lỗi vì sự bất tiện này!
          </p>
        </div>
        <div className="mt-12 text-[10px] md:text-xs font-black text-zinc-650 uppercase tracking-widest">
          © {new Date().getFullYear()} DlowPhim Inc. All rights reserved.
        </div>
      </div>
    );
  }

  // Bình thường: Ẩn Navbar và Footer client nếu là trang Admin
  return (
    <div
      className={`flex min-h-screen flex-col bg-black ${
        showMobileNavigation
              ? "pb-[calc(6.25rem+env(safe-area-inset-bottom))] md:pb-0"
          : ""
      }`}
    >
      {!isAdminPath && <NavbarComponent />}
      <main className="flex-grow flex flex-col">{children}</main>
      {!isAdminPath && <FooterComponent />}
    </div>
  );
}
