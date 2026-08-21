"use client";

import { ArrowLeft, Check, Copy, Film, LockKeyhole, Trash2 } from "lucide-react";

interface MobileRoomHeaderProps {
  roomName: string;
  roomId: string;
  movieName: string;
  isPrivate: boolean;
  isHost: boolean;
  privatePin?: string;
  isScheduled: boolean;
  copied: boolean;
  onBack: () => void;
  onCopy: () => void;
  onClose: () => void;
}

export default function MobileRoomHeader({
  roomName,
  roomId,
  movieName,
  isPrivate,
  isHost,
  privatePin,
  isScheduled,
  copied,
  onBack,
  onCopy,
  onClose,
}: MobileRoomHeaderProps) {
  return (
    <section className="md:hidden border-b border-zinc-900/80 pb-3" aria-labelledby="mobile-room-title">
      <div className="flex items-start gap-2.5">
        <button
          type="button"
          onClick={onBack}
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950 text-zinc-300 active:scale-95"
          aria-label="Quay lại trang phim"
        >
          <ArrowLeft size={15} />
        </button>

        <div className="min-w-0 flex-1 text-left">
          <h1 id="mobile-room-title" className="line-clamp-2 text-[15px] font-black uppercase leading-5 text-zinc-100">
            {roomName}
          </h1>
          <p className="mt-1 flex min-w-0 items-center gap-1.5 text-[10px] font-bold uppercase text-zinc-500">
            <Film size={11} className="shrink-0 text-pink-500" />
            <span className={isScheduled ? "shrink-0 text-amber-400" : "shrink-0 text-pink-400"}>
              {isScheduled ? "Sắp chiếu" : "Đang phát"}:
            </span>
            <span className="truncate">{movieName}</span>
          </p>
        </div>

        <button
          type="button"
          onClick={onCopy}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-pink-500/20 bg-pink-500/10 px-2.5 text-[10px] font-black uppercase text-pink-400 active:scale-95"
          aria-label={copied ? "Đã sao chép mã phòng" : "Sao chép mã phòng"}
        >
          <span className="max-w-[74px] truncate">{roomId}</span>
          {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
        </button>
      </div>

      {(isPrivate || isHost) && (
        <div className="mt-2.5 flex items-center gap-2 pl-[46px]">
          {isPrivate && (
            <span className="inline-flex min-w-0 items-center gap-1 rounded-lg border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[9px] font-black uppercase text-amber-400">
              <LockKeyhole size={10} className="shrink-0" />
              <span className="truncate">Phòng riêng{isHost && privatePin ? ` · PIN ${privatePin}` : ""}</span>
            </span>
          )}
          {isHost && (
            <button
              type="button"
              onClick={onClose}
              className="ml-auto inline-flex h-8 shrink-0 items-center gap-1.5 rounded-xl border border-red-500/20 bg-red-600/15 px-2.5 text-[10px] font-black text-red-400 active:scale-95"
            >
              <Trash2 size={12} /> Đóng phòng
            </button>
          )}
        </div>
      )}
    </section>
  );
}
