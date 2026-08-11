"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { cleanMovieName, getImageUrl, getBestMovieImage } from "@/utils/movieUtils";
import MovieHoverPopup from "./MovieHoverPopup";
import ProgressiveImage from "./ProgressiveImage";
import MovieLanguageBadges from "./MovieLanguageBadges";
import MovieQualityBadge from "./MovieQualityBadge";
import { fetchMovieArtwork, LOCAL_MOVIE_IMAGE_FALLBACK } from "@/utils/movieArtwork";

interface Movie {
  _id: string;
  name: string;
  slug: string;
  origin_name: string;
  poster_url?: string;
  thumb_url?: string;
  year?: number;
  quality?: string;
  lang?: string;
}

interface MovieCardProps {
  movie: Movie;
  aspect?: "landscape" | "portrait";
  variant?: "default" | "country-row";
}

export default function MovieCard({ movie, aspect = "landscape", variant = "default" }: MovieCardProps) {
  const [mounted, setMounted] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });

  const cardRef = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<NodeJS.Timeout | null>(null);
  const closeTimer = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();

  const cleanedName = cleanMovieName(movie.name);
  const cleanedOriginName = cleanMovieName(movie.origin_name);
  useEffect(() => {
    setMounted(true);
    return () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const initialUrl = aspect === "landscape"
    ? (movie.poster_url || movie.thumb_url)
    : (movie.thumb_url || movie.poster_url);

  const [imgSrc, setImgSrc] = useState<string>(() => getBestMovieImage(movie, aspect === "landscape" ? "poster" : "thumb"));
  const [attemptCount, setAttemptCount] = useState(0);

  useEffect(() => {
    setImgSrc(getBestMovieImage(movie, aspect === "landscape" ? "poster" : "thumb"));
    setAttemptCount(0);
  }, [movie.slug, movie.poster_url, movie.thumb_url, aspect]);

  const handleImageError = () => {
    const alternateUrl = aspect === "portrait" ? movie.poster_url : movie.thumb_url;
    if (attemptCount === 0 && alternateUrl && movie.poster_url && movie.thumb_url && movie.poster_url !== movie.thumb_url) {
      setAttemptCount(1);
      setImgSrc(getImageUrl(alternateUrl));
      return;
    }

    if (attemptCount < 2) {
      setAttemptCount(2);
      fetchMovieArtwork({ slug: movie.slug, title: movie.origin_name || movie.name })
        .then((data) => {
          if (data && (data.posterUrl || data.backdropUrl)) {
            setImgSrc(
              (aspect === "portrait" ? (data.posterUrl || data.backdropUrl) : (data.backdropUrl || data.posterUrl))
                || LOCAL_MOVIE_IMAGE_FALLBACK,
            );
          } else {
            setImgSrc(LOCAL_MOVIE_IMAGE_FALLBACK);
          }
        })
        .catch(() => {
          setImgSrc(LOCAL_MOVIE_IMAGE_FALLBACK);
        });
    }
  };

  const handleMouseEnter = (e: React.MouseEvent) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    
    // Popup owns the single detail request for this hover.
    setShowPopup(true);

    if (isHovered) return;

    const currentTarget = e.currentTarget;
    
    // Restore 800ms delay to prevent flickering popups during mouse sweeps
    hoverTimer.current = setTimeout(() => {
      const rect = currentTarget.getBoundingClientRect();
      const scrollY = window.scrollY || window.pageYOffset;
      const scrollX = window.scrollX || window.pageXOffset;

      // Scale calculations (scale up width by 1.25x for a compact, neat popup)
      const scaleFactor = 1.25;
      const scaledWidth = Math.min(Math.max(rect.width * scaleFactor, 300), 380);
      const leftOffset = rect.left + scrollX - (scaledWidth - rect.width) / 2;
      
      // Ensure hover card doesn't overflow left boundary of the screen
      const windowWidth = typeof window !== "undefined" ? window.innerWidth : 1200;
      const rightEdge = leftOffset + scaledWidth;
      let finalLeft = Math.max(10, leftOffset);
      
      // Safeguard against right edge overflow
      if (rightEdge > windowWidth - 15) {
        finalLeft = Math.max(10, windowWidth - scaledWidth - 15);
      }

      setPosition({
        top: rect.top + scrollY - 30, // Positioned slightly higher to balance the enlarged card
        left: finalLeft,
        width: scaledWidth
      });
      setIsHovered(true);
    }, 800); // 800ms delay to prevent flickering popups during mouse sweeps
  };

  const handleMouseLeave = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    closeTimer.current = setTimeout(() => {
      setIsHovered(false);
      setShowPopup(false);
    }, 200); // 200ms delay to allow mouse transition from original element to hover card
  };

  const clearCloseTimer = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };

  // Render standard flat card
  const standardCard = (
    <div
      ref={cardRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={() => router.push(`/movie/${movie.slug}`)}
      className="w-full cursor-pointer group/card select-none relative"
    >
      <div className="relative overflow-hidden">
        {/* Poster Image Frame */}
        <div 
          className={`w-full overflow-hidden bg-zinc-900 rounded-xl relative transition-all duration-300 ${
            aspect === "landscape" ? "aspect-[16/10]" : "aspect-[2/3]"
          }`}
          style={{
            WebkitMaskImage: "-webkit-radial-gradient(white, black)",
            maskImage: "radial-gradient(white, black)"
          }}
        >
          <ProgressiveImage
            src={imgSrc}
            alt={cleanedName}
            onError={handleImageError}
            className="w-full h-full object-cover rounded-xl group-hover/card:scale-105 transition-transform duration-300"
          />

          
          {/* Badge phụ đề góc trái */}
          {variant === "country-row" ? (
            <MovieLanguageBadges
              lang={movie.lang}
              className="absolute bottom-1.5 left-1.5 z-10 flex flex-col items-start gap-0.5"
            />
          ) : (
            <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1">
              <MovieQualityBadge quality={movie.quality} />
              <span className="min-w-0 truncate rounded border border-zinc-800/50 bg-black/60 px-1.5 py-0.5 text-[9px] font-black uppercase text-white backdrop-blur-md">
                {movie.lang || "Vietsub"}
              </span>
            </div>
          )}
        </div>

        {/* Text descriptions underneath (Flat Style) */}
        <div className="pt-2.5 space-y-0.5 text-left select-text">
          <h4 className={`truncate font-bold leading-snug text-zinc-100 transition-colors group-hover/card:text-pink-500 ${variant === "country-row" ? "text-[13px] sm:text-sm" : "text-xs md:text-sm"}`}>
            {cleanedName}
          </h4>
          <p className={`truncate font-semibold leading-snug text-zinc-500 ${variant === "country-row" ? "text-[11px] sm:text-xs" : "text-[10px]"}`}>
            {cleanedOriginName}
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {standardCard}
      {showPopup && mounted && (
        <MovieHoverPopup
          movie={movie}
          position={position}
          aspect={aspect}
          isVisible={isHovered}
          onMouseEnter={clearCloseTimer}
          onMouseLeave={handleMouseLeave}
        />
      )}
    </>
  );
}
