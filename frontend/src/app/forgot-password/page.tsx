"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowLeft, CheckCircle2, KeyRound, Loader2, Mail, ShieldCheck } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Không thể gửi yêu cầu lúc này");
      setMessage(data.message || "Nếu email hỗ trợ khôi phục mật khẩu, DlowPhim đã gửi hướng dẫn đến hộp thư của bạn.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không thể kết nối máy chủ");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="flex min-h-[calc(100vh-160px)] items-center justify-center bg-[radial-gradient(circle_at_top,rgba(236,72,153,0.12),transparent_38%)] px-4 pb-16 pt-28">
      <div className="w-full max-w-md rounded-3xl border border-zinc-800/80 bg-[#11121a]/95 p-6 shadow-2xl shadow-pink-950/20 md:p-8">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-pink-500/20 bg-pink-500/10 text-pink-400">
            <KeyRound size={26} />
          </div>
          <h1 className="text-2xl font-black uppercase tracking-tight">Quên mật khẩu?</h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            Nhập email đăng ký tay để nhận liên kết đặt lại mật khẩu có hiệu lực trong 15 phút.
          </p>
        </div>

        {message ? (
          <div role="status" className="space-y-5 text-center">
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm leading-relaxed text-emerald-200">
              <CheckCircle2 className="mx-auto mb-2" size={24} />
              {message}
            </div>
            <p className="text-xs leading-relaxed text-zinc-500">Kiểm tra cả thư rác. Bạn chỉ có thể yêu cầu lại sau ít nhất 60 giây.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block space-y-2">
              <span className="text-xs font-black uppercase tracking-wider text-zinc-400">Email tài khoản</span>
              <span className="flex h-12 items-center gap-3 rounded-xl border border-zinc-800 bg-black/30 px-4 focus-within:border-pink-500">
                <Mail size={17} className="text-zinc-500" />
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  maxLength={254}
                  required
                  disabled={submitting}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="h-full min-w-0 flex-1 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
                />
              </span>
            </label>
            {error && <p role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300">{error}</p>}
            <button disabled={submitting} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-pink-500 text-sm font-black text-white transition hover:bg-pink-600 disabled:cursor-not-allowed disabled:opacity-60">
              {submitting ? <Loader2 className="animate-spin" size={17} /> : <Mail size={17} />}
              Gửi liên kết khôi phục
            </button>
          </form>
        )}

        <div className="mt-6 space-y-3 border-t border-zinc-800/70 pt-5 text-center">
          <p className="flex items-center justify-center gap-1.5 text-xs text-zinc-500"><ShieldCheck size={14} className="text-emerald-500" />Tài khoản Google khôi phục mật khẩu tại Google.</p>
          <a href="https://accounts.google.com/signin/recovery" target="_blank" rel="noreferrer" className="inline-block text-xs font-bold text-pink-400 hover:text-pink-300 hover:underline">Khôi phục tài khoản Google</a>
          <div>
            <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-white"><ArrowLeft size={14} />Quay lại đăng nhập</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
