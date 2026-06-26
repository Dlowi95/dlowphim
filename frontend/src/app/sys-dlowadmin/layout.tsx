"use client";

import React from "react";
import { useAuth } from "@/context/AuthContext";
import { notFound } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  // If still loading auth state, show a clean premium dark loading screen
  if (loading) {
    return (
      <div className="min-h-screen bg-[#07070a] text-white flex flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-pink-500" size={32} />
        <span className="text-xs font-black text-zinc-500 uppercase tracking-widest">Đang xác thực quyền Admin...</span>
      </div>
    );
  }

  // If loading is done but no user or user is not an admin, render notFound (404)
  if (!user || user.role !== "admin") {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[#07070a] text-zinc-200">
      {children}
    </div>
  );
}
