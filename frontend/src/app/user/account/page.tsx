"use client";

import React, { useEffect, useState, useRef } from "react";
import { User, Loader2, Save, Upload, Image as ImageIcon, Camera, Check } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import Cookies from "js-cookie";

const AVAILABLE_AVATARS = [
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Aneka",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Jack",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Buster",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Coco",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Loki",
];

export default function UserAccountPage() {
  const { user, showToast, refreshUser } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [gender, setGender] = useState("other");
  const [avatar, setAvatar] = useState("");
  
  const [isSaving, setIsSaving] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || "");
      setGender(user.gender || "other");
      setAvatar(user.avatar || "/images/avatars/default.png");
    }
  }, [user]);

  useEffect(() => {
    refreshUser();
  }, []);

  // Xử lý chọn ảnh từ thiết bị
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    if (file.size > 2 * 1024 * 1024) {
      showToast("Vui lòng chọn ảnh nhỏ hơn 2MB", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setAvatar(reader.result);
        showToast("Đã tải ảnh lên thành công", "success");
      }
    };
    reader.readAsDataURL(file);
  };

  // Kích hoạt input file ẩn
  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      showToast("Vui lòng điền tên hiển thị", "error");
      return;
    }

    setIsSaving(true);
    try {
      const token = Cookies.get("token");
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      
      const res = await fetch(`${API_URL}/auth/me/update`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          displayName: displayName.trim(),
          gender,
          avatar,
        }),
      });

      if (res.ok) {
        await refreshUser();
        showToast("Cập nhật thông tin thành công", "success");
      } else {
        const errData = await res.json();
        showToast(errData.message || "Cập nhật thất bại", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Không thể kết nối máy chủ", "error");
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-6 select-none relative">
      <div className="flex items-center justify-between border-b border-zinc-900 pb-3.5">
        <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-zinc-100 flex items-center gap-2.5">
          <User className="text-pink-500" size={24} />
          <span>Thông tin tài khoản</span>
        </h2>
      </div>

      {/* Bao bọc toàn bộ Grid 2 cột bằng thẻ form */}
      <form onSubmit={handleSaveProfile} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* Cột trái: Thông tin form (Col-span 2) */}
          <div className="lg:col-span-2 bg-[#12131b]/60 border border-zinc-800/40 p-6 md:p-8 rounded-3xl space-y-6 text-left shadow-md">
            
            {/* Input Email (Disabled) */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-zinc-400 uppercase tracking-wider">Email tài khoản</label>
              <input 
                type="email"
                disabled
                value={user.email}
                className="w-full h-11 bg-zinc-900/40 border border-zinc-800 rounded-xl px-4 text-sm text-zinc-500 outline-none cursor-not-allowed font-medium"
              />
            </div>

            {/* Input Tên hiển thị */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-zinc-400 uppercase tracking-wider">Tên hiển thị</label>
              <input 
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Nhập tên hiển thị mới..."
                className="w-full h-11 bg-zinc-900/60 border border-zinc-800 focus:border-pink-500 rounded-xl px-4 text-sm text-zinc-200 outline-none transition-colors font-medium"
              />
            </div>

            {/* Giới tính Radio Group */}
            <div className="space-y-2">
              <label className="text-xs font-black text-zinc-400 uppercase tracking-wider block">Giới tính</label>
              <div className="flex items-center gap-6 mt-1">
                
                {/* Nam */}
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input 
                    type="radio" 
                    name="gender" 
                    value="male"
                    checked={gender === "male"}
                    onChange={() => setGender("male")}
                    className="w-4 h-4 text-pink-500 bg-zinc-900 border-zinc-800 focus:ring-pink-500 focus:ring-2 cursor-pointer"
                  />
                  <span className="text-sm font-semibold text-zinc-300 group-hover:text-zinc-150 transition-colors">Nam</span>
                </label>

                {/* Nữ */}
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input 
                    type="radio" 
                    name="gender" 
                    value="female"
                    checked={gender === "female"}
                    onChange={() => setGender("female")}
                    className="w-4 h-4 text-pink-500 bg-zinc-900 border-zinc-800 focus:ring-pink-500 focus:ring-2 cursor-pointer"
                  />
                  <span className="text-sm font-semibold text-zinc-300 group-hover:text-zinc-150 transition-colors">Nữ</span>
                </label>

                {/* Không xác định */}
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input 
                    type="radio" 
                    name="gender" 
                    value="other"
                    checked={gender === "other"}
                    onChange={() => setGender("other")}
                    className="w-4 h-4 text-pink-500 bg-zinc-900 border-zinc-800 focus:ring-pink-500 focus:ring-2 cursor-pointer"
                  />
                  <span className="text-sm font-semibold text-zinc-300 group-hover:text-zinc-150 transition-colors">Không xác định</span>
                </label>
              </div>
            </div>
          </div>

          {/* Cột phải: Quản lý Avatar bên phải */}
          <div className="bg-[#12131b]/60 border border-zinc-800/40 p-6 md:p-8 rounded-3xl flex flex-col items-center justify-center space-y-6 text-center shadow-md">
            <div className="relative group/avatar cursor-pointer" onClick={triggerFileSelect}>
              
              {/* Vòng tròn Avatar to sang trọng */}
              <div className="w-36 h-36 md:w-44 md:h-44 rounded-full overflow-hidden border-4 border-zinc-800 shadow-xl group-hover/avatar:border-pink-500 transition-all duration-300 relative bg-zinc-900">
                <img 
                  src={avatar} 
                  alt="Avatar Preview" 
                  className="w-full h-full object-cover rounded-full"
                  referrerPolicy="no-referrer"
                />
                
                {/* Lớp phủ hover chọn ảnh */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/avatar:opacity-100 flex items-center justify-center transition-all duration-300">
                  <div className="flex flex-col items-center gap-1 text-white">
                    <Camera size={26} className="text-pink-400" />
                    <span className="text-[10px] font-black uppercase tracking-wider">Tải ảnh lên</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Nút bấm quản lý */}
            <div className="flex flex-col gap-3.5 w-full max-w-[200px]">
              {/* Uploader Input File */}
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />
              
              {/* Nút chọn ảnh từ thiết bị */}
              <button
                type="button"
                onClick={triggerFileSelect}
                className="w-full h-10 border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900 text-zinc-300 hover:text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 transition-all"
              >
                <Upload size={14} className="text-pink-500" />
                <span>Tải ảnh lên</span>
              </button>

              {/* Nút mở modal ảnh có sẵn */}
              <button
                type="button"
                onClick={() => setShowAvatarModal(true)}
                className="w-full h-10 border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900 text-zinc-300 hover:text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 transition-all"
              >
                <ImageIcon size={14} className="text-pink-500" />
                <span>Ảnh có sẵn</span>
              </button>
            </div>
          </div>
        </div>

        {/* Nút Cập nhật đứng riêng biệt bên dưới Grid ở góc bên phải */}
        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={isSaving}
            className="h-11 px-8 bg-pink-500 hover:bg-pink-600 disabled:bg-zinc-800 text-white font-extrabold text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-pink-500/10 active:scale-98 transition-all cursor-pointer"
          >
            {isSaving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            <span>Cập nhật</span>
          </button>
        </div>
      </form>

      {/* POPUP MODAL CHỌN AVATAR CÓ SẴN (DiceBear) */}
      {showAvatarModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#12131b] border border-zinc-800 rounded-3xl p-6 shadow-2xl relative text-left animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-black text-zinc-200 tracking-tight uppercase mb-2">Chọn ảnh có sẵn</h3>
            <p className="text-xs text-zinc-550 font-medium mb-5">Danh sách các ảnh avatar dễ thương của DiceBear</p>
            
            <div className="grid grid-cols-3 gap-4 mb-6">
              {AVAILABLE_AVATARS.map((url, idx) => {
                const isSelected = avatar === url;
                return (
                  <div
                    key={idx}
                    onClick={() => {
                      setAvatar(url);
                      setShowAvatarModal(false);
                      showToast("Đã chọn ảnh có sẵn", "success");
                    }}
                    className={`relative aspect-square rounded-2xl overflow-hidden border-2 cursor-pointer transition-all duration-200 bg-zinc-900/60 flex items-center justify-center p-2 ${
                      isSelected 
                        ? "border-pink-500 ring-2 ring-pink-500/25 bg-pink-500/5" 
                        : "border-zinc-800 hover:border-zinc-700"
                    }`}
                  >
                    <img 
                      src={url} 
                      alt={`Avatar ${idx}`} 
                      className="w-full h-full object-contain rounded-xl"
                    />
                    {isSelected && (
                      <div className="absolute top-1 right-1 bg-pink-500 text-white rounded-full p-0.5 shadow-md">
                        <Check size={10} className="stroke-[3]" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowAvatarModal(false)}
                className="px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white font-extrabold text-xs rounded-xl transition-all"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
