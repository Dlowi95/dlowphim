"use client";

import React from "react";
import { Camera, Check, Image as ImageIcon, Loader2, Save, Upload, User, X } from "lucide-react";

type Gender = "male" | "female" | "other" | string;

type MobileAccountViewProps = {
  email: string;
  displayName: string;
  gender: Gender;
  avatar: string;
  isSaving: boolean;
  hasChanges: boolean;
  showAvatarModal: boolean;
  availableAvatars: string[];
  onDisplayNameChange: (value: string) => void;
  onGenderChange: (value: Gender) => void;
  onSubmit: (event: React.FormEvent) => void;
  onUploadClick: () => void;
  onOpenAvatarModal: () => void;
  onCloseAvatarModal: () => void;
  onAvatarSelect: (url: string) => void;
};

const genderOptions = [
  { value: "male", label: "Nam" },
  { value: "female", label: "Nữ" },
  { value: "other", label: "Không xác định" },
];

export default function MobileAccountView({
  email,
  displayName,
  gender,
  avatar,
  isSaving,
  hasChanges,
  showAvatarModal,
  availableAvatars,
  onDisplayNameChange,
  onGenderChange,
  onSubmit,
  onUploadClick,
  onOpenAvatarModal,
  onCloseAvatarModal,
  onAvatarSelect,
}: MobileAccountViewProps) {
  return (
    <div id="thong-tin-tai-khoan" className="relative space-y-5 scroll-mt-24 select-none">
      <div className="flex items-center border-b border-zinc-900 pb-3.5">
        <h2 className="flex items-center gap-2.5 text-lg font-black uppercase tracking-tight text-zinc-100">
          <User className="h-[22px] w-[22px] text-pink-500" />
          <span>Thông tin tài khoản</span>
        </h2>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        <div className="space-y-5 rounded-2xl border border-zinc-800/40 bg-[#12131b]/60 p-4 text-left shadow-md">
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-wider text-zinc-400">Email tài khoản</label>
            <input
              type="email"
              disabled
              value={email}
              className="h-11 w-full cursor-not-allowed rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 text-sm font-medium text-zinc-500 outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-wider text-zinc-400">Tên hiển thị</label>
            <input
              type="text"
              value={displayName}
              onChange={(event) => onDisplayNameChange(event.target.value)}
              minLength={2}
              maxLength={40}
              placeholder="Nhập tên hiển thị mới..."
              className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 text-sm font-medium text-zinc-200 outline-none transition-colors focus:border-pink-500"
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="text-xs font-black uppercase tracking-wider text-zinc-400">Giới tính</legend>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3 pt-1">
              {genderOptions.map((option) => {
                const checked = gender === option.value;
                return (
                  <label key={option.value} className="group flex min-h-8 cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="mobile-gender"
                      value={option.value}
                      checked={checked}
                      onChange={() => onGenderChange(option.value)}
                      className="peer sr-only"
                    />
                    <span
                      aria-hidden="true"
                      className={`flex h-4 w-4 items-center justify-center rounded-full border transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-pink-400 ${
                        checked ? "border-pink-500" : "border-zinc-600 bg-zinc-800"
                      }`}
                    >
                      {checked && <span className="h-2 w-2 rounded-full bg-pink-500" />}
                    </span>
                    <span className="text-sm font-semibold text-zinc-300">{option.label}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        </div>

        <div className="flex flex-col items-center justify-center space-y-4 rounded-2xl border border-zinc-800/40 bg-[#12131b]/60 p-4 text-center shadow-md">
          <button type="button" onClick={onUploadClick} className="group relative rounded-full" aria-label="Tải ảnh đại diện lên">
            <span className="relative block h-28 w-28 overflow-hidden rounded-full border-4 border-zinc-800 bg-zinc-900 shadow-xl">
              <img src={avatar} alt="Ảnh đại diện" className="h-full w-full rounded-full object-cover avatar-smooth" referrerPolicy="no-referrer" />
              <span className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-active:opacity-100">
                <Camera size={24} className="text-pink-400" />
              </span>
            </span>
          </button>

          <div className="flex w-full max-w-sm gap-3">
            <button type="button" onClick={onUploadClick} className="flex h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 text-xs font-extrabold text-zinc-300">
              <Upload size={14} className="shrink-0 text-pink-500" />
              <span className="truncate">Tải ảnh lên</span>
            </button>
            <button type="button" onClick={onOpenAvatarModal} className="flex h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 text-xs font-extrabold text-zinc-300">
              <ImageIcon size={14} className="shrink-0 text-pink-500" />
              <span className="truncate">Ảnh có sẵn</span>
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSaving || !hasChanges}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-pink-500 px-8 text-sm font-extrabold text-white shadow-lg shadow-pink-500/10 transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
        >
          {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          <span>Cập nhật</span>
        </button>
      </form>

      {showAvatarModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-avatar-title"
            className="flex max-h-[calc(100dvh-8rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-[#12131b] shadow-2xl"
          >
            <header className="relative shrink-0 px-4 pb-4 pt-5 text-left">
              <button type="button" onClick={onCloseAvatarModal} aria-label="Đóng" className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full text-zinc-500 active:bg-white/[0.06] active:text-white">
                <X size={18} />
              </button>
              <h3 id="mobile-avatar-title" className="pr-10 text-lg font-black uppercase tracking-tight text-zinc-200">Đổi ảnh đại diện</h3>
              <p className="mt-1 pr-8 text-xs font-medium text-zinc-500">Danh sách avatar hoạt hình có sẵn của hệ thống</p>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <div className="grid grid-cols-4 gap-2.5">
                {availableAvatars.map((url, idx) => {
                  const isSelected = avatar === url;
                  return (
                    <button
                      type="button"
                      key={url}
                      onClick={() => onAvatarSelect(url)}
                      aria-label={`Chọn avatar ${idx + 1}`}
                      aria-pressed={isSelected}
                      className={`relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl border-2 bg-zinc-900/60 p-2 transition-colors ${
                        isSelected ? "border-pink-500 bg-pink-500/5" : "border-zinc-800"
                      }`}
                    >
                      <img src={url} alt="" className="h-full w-full rounded-xl object-contain" />
                      {isSelected && <span className="absolute right-1 top-1 rounded-full bg-pink-500 p-0.5 text-white"><Check size={10} className="stroke-[3]" /></span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
