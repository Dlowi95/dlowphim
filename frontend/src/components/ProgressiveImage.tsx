"use client";

import React, { ImgHTMLAttributes, useEffect, useState } from "react";

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
  const [loaded, setLoaded] = useState(false);

  useEffect(() => setLoaded(false), [src]);

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
          setLoaded(true);
          onLoad?.(event);
        }}
        onError={(event) => {
          setLoaded(true);
          onError?.(event);
        }}
        className={`transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"} ${className}`}
      />
    </span>
  );
}
