import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = [];
  const maxPageVisible = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxPageVisible / 2));
  let endPage = Math.min(totalPages, startPage + maxPageVisible - 1);

  if (endPage - startPage + 1 < maxPageVisible) {
    startPage = Math.max(1, endPage - maxPageVisible + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  return (
    <div className="flex items-center justify-center gap-1.5 py-4 select-none">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="w-8 h-8 rounded-xl bg-zinc-900/60 hover:bg-zinc-900 disabled:opacity-30 text-zinc-400 hover:text-white flex items-center justify-center transition-all cursor-pointer border border-zinc-900/60 disabled:cursor-not-allowed"
      >
        <ChevronLeft size={14} />
      </button>

      {startPage > 1 && (
        <>
          <button
            onClick={() => onPageChange(1)}
            className={`w-8 h-8 rounded-xl font-bold text-xs transition-all border cursor-pointer ${
              currentPage === 1
                ? "bg-pink-500 text-white border-pink-500"
                : "bg-[#0d0e13] text-zinc-400 border-zinc-900/60 hover:text-white hover:border-zinc-800"
            }`}
          >
            1
          </button>
          {startPage > 2 && <span className="text-zinc-650 px-1 text-xs">...</span>}
        </>
      )}

      {pages.map((page) => (
        <button
          key={page}
          onClick={() => onPageChange(page)}
          className={`w-8 h-8 rounded-xl font-bold text-xs transition-all border cursor-pointer ${
            currentPage === page
              ? "bg-pink-500 text-white border-pink-500 shadow-md shadow-pink-500/10"
              : "bg-[#0d0e13] text-zinc-400 border-zinc-900/60 hover:text-white hover:border-zinc-800"
          }`}
        >
          {page}
        </button>
      ))}

      {endPage < totalPages && (
        <>
          {endPage < totalPages - 1 && <span className="text-zinc-650 px-1 text-xs">...</span>}
          <button
            onClick={() => onPageChange(totalPages)}
            className={`w-8 h-8 rounded-xl font-bold text-xs transition-all border cursor-pointer ${
              currentPage === totalPages
                ? "bg-pink-500 text-white border-pink-500"
                : "bg-[#0d0e13] text-zinc-400 border-zinc-900/60 hover:text-white hover:border-zinc-800"
            }`}
          >
            {totalPages}
          </button>
        </>
      )}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="w-8 h-8 rounded-xl bg-zinc-900/60 hover:bg-zinc-900 disabled:opacity-30 text-zinc-400 hover:text-white flex items-center justify-center transition-all cursor-pointer border border-zinc-900/60 disabled:cursor-not-allowed"
      >
        <ChevronRight size={14} />
      </button>
    </div>
  );
}
