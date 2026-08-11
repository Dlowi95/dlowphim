"use client";

import React, { ImgHTMLAttributes, useState } from "react";

type ProgressiveImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  priority?: boolean;
  wrapperClassName?: string;
  skeletonClassName?: string;
};

export default function ProgressiveImage({
  src,
  alt = "",
  priority = false,
  wrapperClassName = "",
  skeletonClassName = "",
  className = "",
  onLoad,
  onError,
  ...props
}: ProgressiveImageProps) {
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const normalizedSrc = typeof src === "string" ? src : "";
  const loaded = Boolean(normalizedSrc) && loadedSrc === normalizedSrc;

  return (
    <span className={`relative block h-full w-full overflow-hidden bg-zinc-900 ${wrapperClassName}`}>
      <span
        aria-hidden="true"
        className={`absolute inset-0 transition-opacity duration-300 ${
          loaded ? "opacity-0" : "animate-pulse bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 opacity-100"
        } ${skeletonClassName}`}
      />
      <img
        {...props}
        src={src}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        onLoad={(event) => {
          setLoadedSrc(normalizedSrc);
          onLoad?.(event);
        }}
        onError={(event) => {
          setLoadedSrc(normalizedSrc);
          onError?.(event);
        }}
        className={`transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"} ${className}`}
      />
    </span>
  );
}
