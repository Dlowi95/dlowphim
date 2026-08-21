"use client";

interface EmbedCompatibilityPlayerProps {
  src: string;
  title: string;
  onLoad?: () => void;
}

export default function EmbedCompatibilityPlayer({
  src,
  title,
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
    </div>
  );
}
