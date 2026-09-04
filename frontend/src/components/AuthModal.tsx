"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Modal, ModalContent, ModalBody, Input, Button } from "@heroui/react";
import { X, Play, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useGoogleLogin } from "@react-oauth/google";
import CloudflareTurnstile from "@/components/security/CloudflareTurnstile";

interface AuthModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

type SubmittingAction = "form" | "google" | "resend" | null;

export default function AuthModal({ isOpen, onOpenChange }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submittingAction, setSubmittingAction] = useState<SubmittingAction>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

  const { loginManual, registerManual, loginGoogle, showToast } = useAuth();
  const submitting = submittingAction !== null;

  // Reset form states when modal is opened/closed
  useEffect(() => {
    if (!isOpen) {
      setDisplayName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setError(null);
      setShowPassword(false);
      setShowConfirmPassword(false);
      setNeedsVerification(false);
      setSubmittingAction(null);
      setTurnstileToken(null);
      setTurnstileResetKey((value) => value + 1);
    }
  }, [isOpen]);

  const handleSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (submitting) return;
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError("Vui lòng nhập đầy đủ email và mật khẩu");
      return;
    }
    if (!turnstileSiteKey) {
      setError("Xác minh bảo mật Cloudflare chưa được cấu hình.");
      return;
    }
    if (!turnstileToken) {
      setError("Vui lòng chờ Cloudflare xác minh trước khi tiếp tục.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError("Email không đúng định dạng (Ví dụ: user@example.com)");
      return;
    }

    setSubmittingAction("form");
    try {
      if (isLogin) {
        await loginManual(email, password, turnstileToken);
        showToast("Đăng nhập thành công", "success");
        onOpenChange(false);
      } else {
        if (displayName.trim().length < 2 || displayName.trim().length > 40) {
          setError("Tên hiển thị cần từ 2 đến 40 ký tự");
          setSubmittingAction(null);
          return;
        }
        if (password.length < 8 || password.length > 72) {
          setError("Mật khẩu cần từ 8 đến 72 ký tự");
          setSubmittingAction(null);
          return;
        }
        if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
          setError("Mật khẩu cần có ít nhất một chữ cái và một chữ số");
          setSubmittingAction(null);
          return;
        }
        if (password !== confirmPassword) {
          setError("Mật khẩu nhập lại không khớp");
          setSubmittingAction(null);
          return;
        }
        const result = await registerManual(displayName, email, password, turnstileToken);
        showToast(result.message || "Đăng ký thành công. Hãy kiểm tra email để xác minh tài khoản.", "success");
        onOpenChange(false);
      }
    } catch (err: any) {
      const message = err.message || "Đã xảy ra lỗi trong quá trình xác thực";
      setError(message);
      setNeedsVerification(String(message).toLowerCase().includes("xác minh"));
      setTurnstileToken(null);
      setTurnstileResetKey((value) => value + 1);
    } finally {
      setSubmittingAction(null);
    }
  };

  const resendVerification = async () => {
    if (!email.trim() || submitting) return;
    setSubmittingAction("resend");
    try {
      const response = await fetch(`${API_URL}/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Chưa thể gửi lại email xác minh");
      showToast(data.message, "success");
      setNeedsVerification(false);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Chưa thể gửi lại email xác minh");
    } finally {
      setSubmittingAction(null);
    }
  };

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setSubmittingAction("google");
      setError(null);
      try {
        await loginGoogle(tokenResponse.access_token, true);
        showToast("Đăng nhập bằng Google thành công", "success");
        onOpenChange(false);
      } catch (err: any) {
        setError(err.message || "Đăng nhập bằng Google thất bại");
      } finally {
        setSubmittingAction(null);
      }
    },
    onError: () => {
      setSubmittingAction(null);
      setError("Kết nối tới tài khoản Google thất bại");
    },
  });

  return (
    <Modal 
      isOpen={isOpen} 
      onOpenChange={onOpenChange}
      hideCloseButton
      placement="center"
      size="3xl"
      classNames={{
        base: "self-center w-full max-w-none md:max-w-[800px] bg-[#161a33] text-white rounded-3xl overflow-hidden p-0 border border-zinc-800/80 shadow-2xl",
        backdrop: "bg-black/85 backdrop-blur-sm"
      }}
    >
      <ModalContent>
        {(onClose) => (
          <ModalBody className="p-0 flex flex-col md:flex-row h-auto min-h-0 max-h-[calc(100dvh-5rem)] md:h-[580px] md:min-h-[580px] md:max-h-[580px] overflow-y-auto md:overflow-hidden">
            
            {/* CỘT TRÁI: BANNER POSTER PHIM MỜ ẢO (Ẩn trên điện thoại) */}
            <div className="hidden md:flex w-[350px] relative items-end p-8 bg-[#0f1122] overflow-hidden border-r border-zinc-800/40 select-none">
              <img 
                src="/images/dlowphim-login.jpg" 
                alt="Backdrop" 
                className="absolute inset-0 w-full h-full object-cover opacity-20 transition-all duration-700 scale-102 select-none pointer-events-none"
              />
              {/* Overlay làm tối dịu và chuyển màu */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0f1122] via-[#0f1122]/70 to-[#0f1122]/30 z-1" />
              
              {/* Logo góc dưới cột trái */}
              <div className="relative z-10 flex flex-col items-start w-full">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-pink-500 to-rose-500 flex items-center justify-center shadow-lg shadow-pink-500/20 shrink-0">
                    <Play className="text-white fill-white ml-0.5" size={16} />
                  </div>
                  <div className="flex flex-col -space-y-0.5">
                    <span className="font-black text-xl tracking-wider leading-none">Dlow<span className="text-pink-500">Phim</span></span>
                    <span className="text-[10px] text-zinc-400 font-bold tracking-tight mt-1 select-none">Trải nghiệm điện ảnh đỉnh cao</span>
                  </div>
                </div>
              </div>
            </div>

            {/* CỘT PHẢI: FORM ĐĂNG NHẬP / ĐĂNG KÝ */}
            <form onSubmit={handleSubmit} className="flex-1 bg-[#161a33] px-5 pb-7 pt-14 sm:px-7 md:p-10 flex flex-col justify-start md:justify-center relative">
              {/* Nút đóng modal góc phải */}
              <button 
                type="button"
                onClick={onClose}
                aria-label="Đóng"
                className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors z-10"
              >
                <X size={20} />
              </button>

              <div className="space-y-4 md:space-y-5">
                <div>
                  <h3 className="text-2xl font-black tracking-tight select-none">
                    {isLogin ? "Đăng nhập" : "Đăng ký"}
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1.5 font-medium select-none">
                    {isLogin ? "Nếu bạn chưa có tài khoản, " : "Nếu bạn đã có tài khoản, "}
                    <button
                      type="button"
                      onClick={() => {
                        setIsLogin(!isLogin);
                        setError(null);
                        setPassword("");
                        setConfirmPassword("");
                        setTurnstileToken(null);
                        setTurnstileResetKey((value) => value + 1);
                      }} 
                      className="text-pink-500 font-bold cursor-pointer hover:underline"
                    >
                      {isLogin ? "đăng ký ngay" : "đăng nhập"}
                    </button>
                  </p>
                </div>

                {/* Hiển thị lỗi nếu có */}
                {error && (
                  <div role="alert" aria-live="polite" className="text-xs text-red-400 font-bold bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-xl">
                    <p>{error}</p>
                    {needsVerification && <button type="button" disabled={submitting} onClick={() => void resendVerification()} className="mt-2 text-pink-400 underline hover:text-pink-300">Gửi lại email xác minh</button>}
                  </div>
                )}

                {/* Các ô Inputs điền dữ liệu */}
                <div className="space-y-3">
                  {!isLogin && (
                    <Input
                      type="text"
                      name="displayName"
                      placeholder="Tên hiển thị"
                      autoComplete="name"
                      maxLength={40}
                      isDisabled={submitting}
                      variant="flat"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      classNames={{
                        inputWrapper: "border-0 hover:border-0 data-[focus=true]:border-0 data-[focus=true]:ring-0 focus-within:!border-0 focus-within:!ring-0 bg-[#0e1022]/70 rounded-xl h-11 shadow-none",
                        input: "text-sm text-zinc-200 placeholder:text-zinc-500 ml-1 outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0"
                      }}
                    />
                  )}
                  <Input
                    type="email"
                    name="email"
                    placeholder="Email"
                    autoComplete="email"
                    maxLength={254}
                    isDisabled={submitting}
                    variant="flat"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    classNames={{
                      inputWrapper: "border-0 hover:border-0 data-[focus=true]:border-0 data-[focus=true]:ring-0 focus-within:!border-0 focus-within:!ring-0 bg-[#0e1022]/70 rounded-xl h-11 shadow-none",
                      input: "text-sm text-zinc-200 placeholder:text-zinc-500 ml-1 outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0"
                    }}
                  />
                  <Input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    placeholder="Mật khẩu"
                    autoComplete={isLogin ? "current-password" : "new-password"}
                    maxLength={72}
                    isDisabled={submitting}
                    variant="flat"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    endContent={
                      <button
                        type="button"
                        aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                        onClick={() => setShowPassword((value) => !value)}
                        className="text-zinc-500 transition hover:text-zinc-200"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    }
                    classNames={{
                      inputWrapper: "border-0 hover:border-0 data-[focus=true]:border-0 data-[focus=true]:ring-0 focus-within:!border-0 focus-within:!ring-0 bg-[#0e1022]/70 rounded-xl h-11 shadow-none",
                      input: "text-sm text-zinc-200 placeholder:text-zinc-500 ml-1 outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0"
                    }}
                  />
                  {!isLogin && (
                    <>
                      <Input
                        type={showConfirmPassword ? "text" : "password"}
                        name="confirmPassword"
                        placeholder="Nhập lại mật khẩu"
                        autoComplete="new-password"
                        maxLength={72}
                        isDisabled={submitting}
                        variant="flat"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        endContent={
                          <button
                            type="button"
                            aria-label={showConfirmPassword ? "Ẩn mật khẩu nhập lại" : "Hiện mật khẩu nhập lại"}
                            onClick={() => setShowConfirmPassword((value) => !value)}
                            className="text-zinc-500 transition hover:text-zinc-200"
                          >
                            {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        }
                        classNames={{
                          inputWrapper: "border-0 hover:border-0 data-[focus=true]:border-0 data-[focus=true]:ring-0 focus-within:!border-0 focus-within:!ring-0 bg-[#0e1022]/70 rounded-xl h-11 shadow-none",
                          input: "text-sm text-zinc-200 placeholder:text-zinc-500 ml-1 outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0"
                        }}
                      />
                      <p className="px-1 text-[10px] font-medium leading-relaxed text-zinc-500">
                        Dùng 8–72 ký tự, có ít nhất một chữ cái và một chữ số.
                      </p>
                    </>
                  )}
                </div>

                <CloudflareTurnstile
                  siteKey={turnstileSiteKey}
                  action={isLogin ? "login" : "register"}
                  resetKey={turnstileResetKey}
                  onToken={setTurnstileToken}
                  onError={() => setError("Cloudflare chưa thể xác minh trình duyệt. Vui lòng tải lại và thử lại.")}
                />

                {/* Nút Submit */}
                <Button 
                  type="submit"
                  isLoading={submittingAction === "form"}
                  isDisabled={submitting || !turnstileToken || !turnstileSiteKey}
                  className="w-full bg-pink-500 hover:bg-pink-600 text-white font-extrabold rounded-xl h-11 text-sm shadow-lg shadow-pink-500/20 transition-all duration-200"
                >
                  {submittingAction === "form" ? "Đang xác thực..." : isLogin ? "Đăng nhập" : "Đăng ký"}
                </Button>

                {isLogin && (
                  <div className="text-center">
                    <Link
                      href="/forgot-password"
                      onClick={() => onOpenChange(false)}
                      className="text-xs font-bold text-pink-500 transition-colors hover:text-pink-400 hover:underline"
                    >
                      Quên mật khẩu?
                    </Link>
                  </div>
                )}

                {/* Đăng nhập bằng Google */}
                <div className="pt-2 border-t border-zinc-800/40">
                  <Button 
                    type="button"
                    variant="flat"
                    isLoading={submittingAction === "google"}
                    isDisabled={submitting}
                    onClick={() => handleGoogleLogin()}
                    className="w-full bg-white hover:bg-zinc-100 text-zinc-800 font-bold rounded-xl h-11 text-xs transition-all duration-200 flex items-center justify-center gap-2.5 shadow-md shadow-black/5"
                  >
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0">
                      <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.91h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.4Z" />
                      <path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.37l-3.24-2.54c-.9.6-2.05.96-3.38.96-2.6 0-4.81-1.76-5.6-4.13H3.05v2.62A10 10 0 0 0 12 22Z" />
                      <path fill="#FBBC05" d="M6.4 13.92A6 6 0 0 1 6.08 12c0-.67.12-1.32.32-1.92V7.46H3.05A10 10 0 0 0 2 12c0 1.61.39 3.14 1.05 4.54l3.35-2.62Z" />
                      <path fill="#EA4335" d="M12 5.95c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.64 9.64 0 0 0 12 2a10 10 0 0 0-8.95 5.46l3.35 2.62c.79-2.37 3-4.13 5.6-4.13Z" />
                    </svg>
                    Tiếp tục với Google
                  </Button>
                  <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-[10px] font-medium text-zinc-500">
                    <ShieldCheck size={12} className="text-emerald-500" />
                    Tài khoản Google không dùng mật khẩu DlowPhim
                  </p>
                </div>
              </div>
            </form>

          </ModalBody>
        )}
      </ModalContent>
    </Modal>
  );
}
