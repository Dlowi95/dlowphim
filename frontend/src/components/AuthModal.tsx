"use client";

import React, { useState, useEffect } from "react";
import { Modal, ModalContent, ModalBody, Input, Button } from "@heroui/react";
import { X, Play } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useGoogleLogin } from "@react-oauth/google";

interface AuthModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export default function AuthModal({ isOpen, onOpenChange }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { loginManual, registerManual, loginGoogle } = useAuth();

  // Reset form states when modal is opened/closed
  useEffect(() => {
    if (!isOpen) {
      setDisplayName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setError(null);
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError("Vui lòng nhập đầy đủ email và mật khẩu");
      return;
    }

    setSubmitting(true);
    try {
      if (isLogin) {
        await loginManual(email, password);
        onOpenChange(false);
      } else {
        if (!displayName.trim()) {
          setError("Vui lòng nhập tên hiển thị");
          setSubmitting(false);
          return;
        }
        if (password !== confirmPassword) {
          setError("Mật khẩu nhập lại không khớp");
          setSubmitting(false);
          return;
        }
        await registerManual(displayName, email, password);
        // Đăng nhập tự động sau khi đăng ký thành công
        await loginManual(email, password);
        onOpenChange(false);
      }
    } catch (err: any) {
      setError(err.message || "Đã xảy ra lỗi trong quá trình xác thực");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setSubmitting(true);
      setError(null);
      try {
        await loginGoogle(tokenResponse.access_token, true);
        onOpenChange(false);
      } catch (err: any) {
        setError(err.message || "Đăng nhập bằng Google thất bại");
      } finally {
        setSubmitting(false);
      }
    },
    onError: () => {
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
        base: "bg-[#161a33] text-white rounded-3xl overflow-hidden p-0 max-w-[800px] border border-zinc-800/80 shadow-2xl",
        backdrop: "bg-black/85 backdrop-blur-sm"
      }}
    >
      <ModalContent>
        {(onClose) => (
          <ModalBody className="p-0 flex flex-col md:flex-row h-[580px] min-h-[580px] max-h-[580px]">
            
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
            <div className="flex-1 bg-[#161a33] p-10 flex flex-col justify-center relative">
              {/* Nút đóng modal góc phải */}
              <button 
                onClick={onClose}
                className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors z-10"
              >
                <X size={20} />
              </button>

              <div className="space-y-5">
                <div>
                  <h3 className="text-2xl font-black tracking-tight select-none">
                    {isLogin ? "Đăng nhập" : "Đăng ký"}
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1.5 font-medium select-none">
                    {isLogin ? "Nếu bạn chưa có tài khoản, " : "Nếu bạn đã có tài khoản, "}
                    <span 
                      onClick={() => {
                        setIsLogin(!isLogin);
                        setError(null);
                      }} 
                      className="text-pink-500 font-bold cursor-pointer hover:underline"
                    >
                      {isLogin ? "đăng ký ngay" : "đăng nhập"}
                    </span>
                  </p>
                </div>

                {/* Hiển thị lỗi nếu có */}
                {error && (
                  <div className="text-xs text-red-400 font-bold bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-xl select-none">
                    {error}
                  </div>
                )}

                {/* Các ô Inputs điền dữ liệu */}
                <div className="space-y-3">
                  {!isLogin && (
                    <Input
                      type="text"
                      placeholder="Tên hiển thị"
                      variant="bordered"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      classNames={{
                        inputWrapper: "border-zinc-800 hover:border-zinc-700/80 focus-within:!border-pink-500 bg-[#0e1022]/40 rounded-xl h-11 shadow-none",
                        input: "text-sm text-zinc-200 placeholder:text-zinc-500 ml-1"
                      }}
                    />
                  )}
                  <Input
                    type="email"
                    placeholder="Email"
                    variant="bordered"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    classNames={{
                      inputWrapper: "border-zinc-800 hover:border-zinc-700/80 focus-within:!border-pink-500 bg-[#0e1022]/40 rounded-xl h-11 shadow-none",
                      input: "text-sm text-zinc-200 placeholder:text-zinc-500 ml-1"
                    }}
                  />
                  <Input
                    type="password"
                    placeholder="Mật khẩu"
                    variant="bordered"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    classNames={{
                      inputWrapper: "border-zinc-800 hover:border-zinc-700/80 focus-within:!border-pink-500 bg-[#0e1022]/40 rounded-xl h-11 shadow-none",
                      input: "text-sm text-zinc-200 placeholder:text-zinc-500 ml-1"
                    }}
                  />
                  {!isLogin && (
                    <Input
                      type="password"
                      placeholder="Nhập lại mật khẩu"
                      variant="bordered"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      classNames={{
                        inputWrapper: "border-zinc-800 hover:border-zinc-700/80 focus-within:!border-pink-500 bg-[#0e1022]/40 rounded-xl h-11 shadow-none",
                        input: "text-sm text-zinc-200 placeholder:text-zinc-500 ml-1"
                      }}
                    />
                  )}
                </div>

                {/* Nút Submit */}
                <Button 
                  isLoading={submitting}
                  onClick={handleSubmit}
                  className="w-full bg-pink-500 hover:bg-pink-600 text-white font-extrabold rounded-xl h-11 text-sm shadow-lg shadow-pink-500/20 transition-all duration-200"
                >
                  {isLogin ? "Đăng nhập" : "Đăng ký"}
                </Button>

                {isLogin && (
                  <div className="text-center">
                    <span className="text-xs text-pink-500 hover:underline font-bold cursor-pointer transition-colors select-none">
                      Quên mật khẩu?
                    </span>
                  </div>
                )}

                {/* Đăng nhập bằng Google */}
                <div className="pt-2 border-t border-zinc-800/40">
                  <Button 
                    variant="flat"
                    isLoading={submitting}
                    onClick={() => handleGoogleLogin()}
                    className="w-full bg-white hover:bg-zinc-100 text-zinc-800 font-bold rounded-xl h-11 text-xs transition-all duration-200 flex items-center justify-center gap-2.5 shadow-md shadow-black/5"
                  >
                    <img 
                      src="https://img.icons8.com/color/32/google-logo.png" 
                      alt="Google logo" 
                      className="w-4.5 h-4.5 shrink-0"
                    />
                    {isLogin ? "Đăng nhập bằng Google" : "Đăng ký bằng Google"}
                  </Button>
                </div>
              </div>
            </div>

          </ModalBody>
        )}
      </ModalContent>
    </Modal>
  );
}