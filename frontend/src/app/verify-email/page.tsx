"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, MailCheck, RefreshCw, XCircle } from "lucide-react";

type VerifyState = "verifying" | "success" | "error";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
  const requestedToken = useRef("");
  const [state, setState] = useState<VerifyState>("verifying");
  const [message, setMessage] = useState("Đang xác minh email của bạn...");
  const [email, setEmail] = useState("");
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (requestedToken.current === token) return;
    requestedToken.current = token;
    if (!token) {
      setState("error");
      setMessage("Liên kết xác minh không hợp lệ.");
      return;
    }
    void (async () => {
      try {
        const response = await fetch(`${API_URL}/auth/verify-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Không thể xác minh email");
        setState("success");
        setMessage(data.message || "Xác minh email thành công.");
      } catch (error) {
        setState("error");
        setMessage(error instanceof Error ? error.message : "Liên kết không hợp lệ hoặc đã hết hạn.");
      }
    })();
  }, [API_URL, token]);

  const resend = async () => {
    if (!email.trim()) return;
    setResending(true);
    try {
      const response = await fetch(`${API_URL}/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await response.json();
      setMessage(data.message || "Nếu tài khoản đang chờ xác minh, một liên kết mới đã được gửi.");
    } catch {
      setMessage("Chưa thể gửi lại email. Vui lòng thử sau.");
    } finally {
      setResending(false);
    }
  };

  const Icon = state === "success" ? CheckCircle2 : state === "error" ? XCircle : MailCheck;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#07070a] p-5 text-white">
      <section className="w-full max-w-md rounded-3xl border border-white/[0.07] bg-[#101119] p-7 text-center shadow-2xl">
        <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl ${state === "success" ? "bg-emerald-500/10 text-emerald-400" : state === "error" ? "bg-red-500/10 text-red-400" : "bg-pink-500/10 text-pink-400"}`}>
          {state === "verifying" ? <Loader2 size={30} className="animate-spin" /> : <Icon size={30} />}
        </div>
        <h1 className="mt-5 text-2xl font-black">{state === "success" ? "Email đã được xác minh" : state === "error" ? "Chưa thể xác minh" : "Xác minh tài khoản"}</h1>
        <p className="mt-3 text-sm font-medium leading-6 text-zinc-500">{message}</p>

        {state === "error" && (
          <div className="mt-6 space-y-3 border-t border-white/[0.06] pt-5 text-left">
            <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Gửi lại liên kết xác minh</label>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Nhập email đã đăng ký" className="h-11 w-full rounded-xl border border-white/[0.07] bg-black/25 px-3 text-sm outline-none focus:border-pink-500/40" />
            <button type="button" onClick={() => void resend()} disabled={resending || !email.trim()} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-pink-500 text-sm font-black disabled:opacity-50">{resending && <RefreshCw size={15} className="animate-spin" />}Gửi lại email</button>
          </div>
        )}

        <Link href="/" className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-sm font-black text-zinc-300 transition-colors hover:bg-white/[0.06] hover:text-white">
          {state === "success" ? "Về trang chủ để đăng nhập" : "Về trang chủ"}
        </Link>
      </section>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-[#07070a] text-pink-400"><Loader2 size={30} className="animate-spin" /></main>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
