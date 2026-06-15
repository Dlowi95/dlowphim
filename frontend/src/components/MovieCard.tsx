"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { cleanMovieName } from "@/utils/movieUtils";
import MovieHoverPopup from "./MovieHoverPopup";

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
}

export default function MovieCard({ movie, aspect = "landscape" }: MovieCardProps) {
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

  const getImageUrl = (movieObj: Movie) => {
    // In OPhim API, thumb_url is the vertical portrait poster, and poster_url is the horizontal landscape backdrop.
    const path = aspect === "landscape"
      ? (movieObj.poster_url || movieObj.thumb_url)
      : (movieObj.thumb_url || movieObj.poster_url);
    if (!path) return "";
    const fileName = path.split("/").pop();
    return `https://img.ophim.live/uploads/movies/${fileName}`;
  };

  const handleMouseEnter = (e: React.MouseEvent) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    
    // Immediately mount the popup component (so it starts fetching details)
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
          className={`w-full overflow-hidden bg-zinc-900 border border-zinc-800/40 hover:border-pink-500/40 rounded-xl relative transition-all duration-300 ${
            aspect === "landscape" ? "aspect-[16/10]" : "aspect-[2/3]"
          }`}
          style={{
            WebkitMaskImage: "-webkit-radial-gradient(white, black)",
            maskImage: "radial-gradient(white, black)"
          }}
        >
          <img
            src={getImageUrl(movie)}
            alt={cleanedName}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover rounded-xl group-hover/card:scale-105 transition-transform duration-300"
            loading="lazy"
            decoding="async"
          />
          {/* Halftone dot grid pattern overlay to make the image look crisp and textured */}
          <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:4px_4px] opacity-100 z-10 pointer-events-none rounded-xl" />
          
          {/* Badge phụ đề góc trái */}
          <div className="absolute bottom-2 left-2 flex items-center gap-1 z-10">
            <span className="bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded text-[9px] font-black text-pink-400 border border-zinc-800/50 uppercase">
              {movie.quality || "HD"}
            </span>
            <span className="bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded text-[9px] font-black text-white border border-zinc-800/50 uppercase">
              {movie.lang || "Vietsub"}
            </span>
          </div>
        </div>

        {/* Text descriptions underneath (Flat Style) */}
        <div className="pt-2.5 space-y-0.5 text-left select-text">
          <h4 className="font-bold text-xs md:text-sm text-zinc-100 truncate group-hover/card:text-pink-500 transition-colors">
            {cleanedName}
          </h4>
          <p className="text-[10px] text-zinc-500 truncate font-semibold">
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
