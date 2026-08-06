"use client";

import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import Cookies from "js-cookie";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setError("");
    if (password.length < 8 || password.length > 72 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      setError("Mật khẩu cần 8–72 ký tự, có ít nhất một chữ cái và một chữ số.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Mật khẩu nhập lại không khớp.");
      return;
    }
    if (!token) {
      setError("Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Không thể đặt lại mật khẩu");
      Cookies.remove("token");
      setSuccess(true);
      setPassword("");
      setConfirmPassword("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không thể kết nối máy chủ");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="text-center">
        <CheckCircle2 className="mx-auto mb-4 text-emerald-400" size={48} />
        <h1 className="text-2xl font-black uppercase">Đổi mật khẩu thành công</h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">Tất cả phiên đăng nhập cũ đã được đăng xuất. Hãy đăng nhập lại bằng mật khẩu mới.</p>
        <a href="/" className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-pink-500 px-6 text-sm font-black text-white hover:bg-pink-600">Về trang đăng nhập</a>
      </div>
    );
  }

  return (
    <>
      <div className="mb-7 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-pink-500/20 bg-pink-500/10 text-pink-400"><KeyRound size={26} /></div>
        <h1 className="text-2xl font-black uppercase tracking-tight">Tạo mật khẩu mới</h1>
        <p className="mt-2 text-sm text-zinc-400">Liên kết chỉ dùng được một lần và hết hạn sau 15 phút.</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        {[
          { label: "Mật khẩu mới", value: password, setter: setPassword, autocomplete: "new-password" },
          { label: "Nhập lại mật khẩu", value: confirmPassword, setter: setConfirmPassword, autocomplete: "new-password" },
        ].map((field) => (
          <label key={field.label} className="block space-y-2">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-400">{field.label}</span>
            <span className="flex h-12 items-center rounded-xl border border-zinc-800 bg-black/30 px-4 focus-within:border-pink-500">
              <input type={showPassword ? "text" : "password"} autoComplete={field.autocomplete} maxLength={72} required disabled={submitting} value={field.value} onChange={(event) => field.setter(event.target.value)} className="h-full min-w-0 flex-1 bg-transparent text-sm text-zinc-100 outline-none" />
              <button type="button" aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"} onClick={() => setShowPassword((value) => !value)} className="text-zinc-500 hover:text-white">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
            </span>
          </label>
        ))}
        <p className="text-[11px] leading-relaxed text-zinc-500">Dùng 8–72 ký tự, có ít nhất một chữ cái và một chữ số.</p>
        {error && <p role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300">{error}</p>}
        <button disabled={submitting} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-pink-500 text-sm font-black text-white hover:bg-pink-600 disabled:opacity-60">{submitting ? <Loader2 className="animate-spin" size={17} /> : <KeyRound size={17} />}Đặt lại mật khẩu</button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <section className="flex min-h-[calc(100vh-160px)] items-center justify-center bg-[radial-gradient(circle_at_top,rgba(236,72,153,0.12),transparent_38%)] px-4 pb-16 pt-28">
      <div className="w-full max-w-md rounded-3xl border border-zinc-800/80 bg-[#11121a]/95 p-6 shadow-2xl shadow-pink-950/20 md:p-8">
        <Suspense fallback={<div className="flex justify-center py-16"><Loader2 className="animate-spin text-pink-500" /></div>}><ResetPasswordForm /></Suspense>
      </div>
    </section>
  );
}
