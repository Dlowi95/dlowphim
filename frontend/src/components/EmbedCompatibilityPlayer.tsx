"use client";

import { AlertCircle } from "lucide-react";

interface EmbedCompatibilityPlayerProps {
  src: string;
  title: string;
  notice?: string;
  onLoad?: () => void;
}

export default function EmbedCompatibilityPlayer({
  src,
  title,
  notice = "Không thể lưu chính xác thời gian hoặc tự động chuyển tập.",
  onLoad,
}: EmbedCompatibilityPlayerProps) {
  return (
    <div className="relative h-full w-full bg-black">
      <iframe
        src={src}
        onLoad={onLoad}
        referrerPolicy="no-referrer"
        allowFullScreen
        frameBorder="0"
        scrolling="no"
        className="absolute -left-4 -top-8 h-[calc(100%+32px)] w-[calc(100%+16px)]"
        title={title}
      />
      <div className="pointer-events-none absolute bottom-3 left-3 z-30 flex max-w-[calc(100%-24px)] items-start gap-2 rounded-xl border border-amber-400/25 bg-black/80 px-3 py-2 text-left shadow-lg backdrop-blur-md">
        <AlertCircle className="mt-0.5 shrink-0 text-amber-400" size={14} />
        <p className="text-[10px] font-bold leading-relaxed text-zinc-300 sm:text-xs">
          <span className="text-amber-400">Chế độ tương thích:</span>{" "}
          {notice}
        </p>
      </div>
    </div>
  );
}
