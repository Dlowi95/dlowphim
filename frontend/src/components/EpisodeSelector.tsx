"use client";

import React, { useState, useEffect } from "react";
import { Play } from "lucide-react";

interface Episode {
  name: string;
  slug: string;
  filename?: string;
  link_embed?: string;
  link_m3u8?: string;
}

interface EpisodeSelectorProps {
  episodes: Episode[];
  activeEpisodeIndex: number;
  onSelectEpisode: (index: number) => void;
  batchSize?: number;
}

export default function EpisodeSelector({
  episodes,
  activeEpisodeIndex,
  onSelectEpisode,
  batchSize = 40,
}: EpisodeSelectorProps) {
  const [selectedBatch, setSelectedBatch] = useState(0);

  // Khi activeEpisodeIndex thay đổi từ bên ngoài (ví dụ tự chuyển tập),
  // tự động chuyển tab/batch tương ứng để tập đang phát hiển thị ra
  useEffect(() => {
    if (episodes.length > batchSize) {
      const batchOfActive = Math.floor(activeEpisodeIndex / batchSize);
      setSelectedBatch(batchOfActive);
    }
  }, [activeEpisodeIndex, episodes.length, batchSize]);

  if (!episodes || episodes.length === 0) return null;

  const showBatches = episodes.length > batchSize;
  const totalBatches = Math.ceil(episodes.length / batchSize);

  // Lấy danh sách tập của batch hiện tại
  const visibleEpisodes = showBatches
    ? episodes.slice(selectedBatch * batchSize, (selectedBatch + 1) * batchSize)
    : episodes;

  return (
    <div className="space-y-4">
      {/* Phân nhóm các tập phim (Tabs) */}
      {showBatches && (
        <div className="flex flex-wrap gap-1.5 pb-1">
          {Array.from({ length: totalBatches }).map((_, bIdx) => {
            const start = bIdx * batchSize + 1;
            const end = Math.min((bIdx + 1) * batchSize, episodes.length);
            const isActive = selectedBatch === bIdx;

            return (
              <button
                key={`episode-batch-tab-${bIdx}`}
                type="button"
                onClick={() => setSelectedBatch(bIdx)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer border-none ${
                  isActive
                    ? "bg-pink-500 text-white shadow-md shadow-pink-500/15"
                    : "bg-[#1b1d2a] text-[#a0a5c0] hover:text-white hover:bg-[#23263a]"
                }`}
              >
                Tập {start} - {end}
              </button>
            );
          })}
        </div>
      )}

      {/* Grid danh sách tập phim */}
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2 max-h-[220px] overflow-y-auto pr-1 scrollbar-none">
        {visibleEpisodes.map((ep, idx) => {
          const globalIdx = showBatches ? selectedBatch * batchSize + idx : idx;
          const isEpActive = globalIdx === activeEpisodeIndex;

          return (
            <button
              key={`episode-item-btn-${globalIdx}`}
              type="button"
              onClick={() => onSelectEpisode(globalIdx)}
              className={`h-10 rounded-xl font-extrabold text-xs flex items-center justify-center transition-all cursor-pointer border-none ${
                isEpActive
                  ? "bg-pink-500 text-white shadow-lg shadow-pink-500/25"
                  : "bg-[#1b1d2a] text-[#a0a5c0] hover:bg-pink-500 hover:text-white"
              }`}
            >
              <Play size={10} className="fill-current mr-1.5 shrink-0" />
              {ep.name.toLowerCase().includes("tập") ? ep.name : `Tập ${ep.name}`}
            </button>
          );
        })}
      </div>
    </div>
  );
}
