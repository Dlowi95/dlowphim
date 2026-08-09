interface MovieQualityBadgeProps {
  quality?: string;
  fallback?: string;
  className?: string;
}

export function normalizeMovieQuality(quality?: string, fallback = "HD") {
  const normalized = (quality || fallback).trim().toUpperCase();

  if (normalized.includes("4K") || normalized.includes("2160")) return "4K";
  if (normalized.includes("FHD") || normalized.includes("1080")) return "FHD";
  if (normalized.includes("HD") || normalized.includes("720")) return "HD";

  return normalized || fallback;
}

const QUALITY_STYLES: Record<string, string> = {
  "4K": "bg-gradient-to-r from-pink-500 to-fuchsia-500 ring-1 ring-white/30 shadow-[0_4px_14px_rgba(236,72,153,0.45)]",
  FHD: "bg-pink-500/95 ring-1 ring-pink-300/30 shadow-[0_4px_12px_rgba(236,72,153,0.3)]",
  HD: "bg-zinc-700/95 ring-1 ring-white/15 shadow-sm",
};

export default function MovieQualityBadge({
  quality,
  fallback = "HD",
  className = "",
}: MovieQualityBadgeProps) {
  const label = normalizeMovieQuality(quality, fallback);
  const style = QUALITY_STYLES[label] || QUALITY_STYLES.HD;

  return (
    <span
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase leading-tight text-white backdrop-blur-md ${style} ${className}`}
      aria-label={`Chất lượng ${label}`}
    >
      {label}
    </span>
  );
}
