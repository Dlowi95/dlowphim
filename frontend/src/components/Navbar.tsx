"use client";

import React, { useState, useEffect, useRef } from "react";
import { Navbar, NavbarBrand, NavbarContent, NavbarItem, Input, Button } from "@heroui/react";
import { Search, Film, User, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NavbarComponent() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isScrolled, setIsScrolled] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 1. Lắng nghe cuộn chuột để bật/tắt trạng thái trong suốt
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 30) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // 2. Cơ chế DEBOUNCE: Tự động gọi API lấy gợi ý khi người dùng dừng gõ 300ms
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(
          `https://ophim1.com/v1/api/tim-kiem?keyword=${encodeURIComponent(searchQuery.trim())}`
        );
        const data = await res.json();
        if (data.status === "success" || data.status === true) {
          const items = data.data?.items || data.items || [];
          // Chỉ lấy tối đa 4 phim hàng đầu để hiển thị dropdown gọn gàng giống Cobephim
          setSuggestions(items.slice(0, 4));
        }
      } catch (error) {
        console.error("Lỗi lấy dữ liệu gợi ý nhanh:", error);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  // 3. Đóng dropdown khi người dùng click chuột ra ngoài vùng tìm kiếm
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 4. Xử lý khi người dùng nhấn Enter hoặc click "Toàn bộ kết quả"
  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (searchQuery.trim()) {
      setShowDropdown(false);
      router.push(`/search?keyword=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  // 5. Xử lý khi click trực tiếp vào một phim trong danh sách gợi ý
  const handleSelectMovie = (movieUrl: string) => {
    setShowDropdown(false);
    setSearchQuery("");
    // Sau này bồ làm trang chi tiết thì route sẽ dẫn đến đây luôn
    router.push(`/movie/${movieUrl}`);
  };

  return (
    <Navbar
      position="fixed"
      classNames={{
        base: `transition-all duration-300 fixed top-0 w-full z-50 ${
          isScrolled 
            ? "bg-zinc-950/95 backdrop-blur-md shadow-xl" 
            : "bg-gradient-to-b from-black/90 via-black/40 to-transparent"
        }`,
        wrapper: "h-20 px-6 gap-8 max-w-7xl justify-between",
      }}
    >
      {/* CỤM BÊN TRÁI: LOGO VÀ Ô TÌM KIẾM ĐỘNG */}
      <NavbarContent justify="start" className="gap-6 flex-grow max-w-2xl">
        <NavbarBrand className="gap-2 cursor-pointer max-w-fit" onClick={() => router.push("/")}>
          <Film className="text-pink-500" size={26} />
          <p className="font-black text-2xl tracking-wider text-white select-none">
            Dlow<span className="text-pink-500">Phim</span>
          </p>
        </NavbarBrand>

        {/* Khung chứa ô tìm kiếm (Cần thuộc tính relative để định vị Dropdown) */}
        <div ref={dropdownRef} className="relative hidden md:block w-full max-w-[380px]">
          <form onSubmit={handleSearchSubmit} className="w-full">
            <Input
              classNames={{
                base: "h-11 w-full",
                mainWrapper: "h-full w-full",
                input: "text-sm text-zinc-100 placeholder:text-zinc-500 ml-2 bg-transparent w-full font-medium focus:outline-none",
                inputWrapper: "h-full bg-zinc-900/40 border border-zinc-800/80 hover:border-zinc-700/80 focus-within:!border-pink-500 rounded-xl px-4 transition-all duration-200 shadow-none",
              }}
              placeholder="Tìm kiếm phim, diễn viên..."
              size="md"
              startContent={
                isSearching ? (
                  <Loader2 size={18} className="text-pink-500 animate-spin shrink-0" />
                ) : (
                  <Search size={18} className="text-zinc-400 shrink-0" />
                )
              }
              type="search"
              value={searchQuery}
              onFocus={() => setShowDropdown(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowDropdown(true);
              }}
            />
          </form>

          {/* 🌟 DROPDOWN GỢI Ý NHANH SAO CHÉP Y KHUÔN THẨM MỸ COBEPHIM 🌟 */}
          {showDropdown && searchQuery.trim() && (
            <div className="absolute top-full left-0 mt-2 w-full min-w-[340px] bg-[#121214]/95 backdrop-blur-xl border border-zinc-800/90 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col">
              
              {/* PHẦN 1: DANH SÁCH PHIM */}
              <div className="p-4 pb-2">
                <p className="text-zinc-500 text-[11px] font-bold uppercase tracking-wider mb-3">
                  Danh sách phim
                </p>
                
                {suggestions.length === 0 && !isSearching ? (
                  <p className="text-xs text-zinc-400 py-2 italic">Không tìm thấy phim phù hợp...</p>
                ) : (
                  <div className="space-y-3">
                    {suggestions.map((movie) => {
                      const fileName = movie.thumb_url ? movie.thumb_url.split("/").pop() : "";
                      const thumbUrl = `https://img.ophim.live/uploads/movies/${fileName}`;

                      return (
                        <div
                          key={movie._id}
                          onClick={() => handleSelectMovie(movie.slug)}
                          className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-zinc-900/80 cursor-pointer transition-all group"
                        >
                          <img
                            src={thumbUrl}
                            alt={movie.name}
                            referrerPolicy="no-referrer"
                            className="w-10 h-14 object-cover rounded-md bg-zinc-800 border border-zinc-800"
                          />
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-bold text-zinc-100 truncate group-hover:text-pink-500 transition-colors">
                              {movie.name}
                            </h4>
                            <p className="text-zinc-400 text-xs truncate mt-0.5">
                              {movie.origin_name}
                            </p>
                            <p className="text-zinc-500 text-[10px] font-medium mt-1">
                              HD • {movie.year} • {movie.lang || "Vietsub"}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* KHÚC ĐỆM BÁNH CUỐN: DANH SÁCH DIỄN VIÊN GIẢ LẬP THEO PHONG CÁCH COBEPHIM */}
              <div className="p-4 pt-2 border-t border-zinc-900/60">
                <p className="text-zinc-500 text-[11px] font-bold uppercase tracking-wider mb-3">
                  Danh sách diễn viên
                </p>
                <div className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-zinc-900/80 cursor-pointer transition-all">
                  <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-500 border border-zinc-700 font-bold text-xs">
                    {searchQuery.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-zinc-200">
                      {searchQuery.trim()} Kamo
                    </h4>
                    <p className="text-zinc-500 text-[11px]">Diễn viên liên quan</p>
                  </div>
                </div>
              </div>

              {/* NÚT XEM TOÀN BỘ KẾT QUẢ DƯỚI ĐÁY DROPDOWN */}
              <button
                type="button"
                onClick={() => handleSearchSubmit()}
                className="w-full py-3 bg-zinc-900 hover:bg-pink-500/10 text-center font-bold text-xs text-zinc-300 hover:text-pink-500 border-t border-zinc-900 transition-all select-none"
              >
                Toàn bộ kết quả
              </button>

            </div>
          )}
        </div>
      </NavbarContent>

      {/* CỤM BÊN PHẢI: LINKS MENU VÀ NÚT THÀNH VIÊN */}
      <NavbarContent className="hidden lg:flex gap-8 font-semibold text-sm" justify="end">
        <NavbarItem>
          <Link href="/" className="text-zinc-300 hover:text-pink-500 transition-colors duration-200">
            Trang Chủ
          </Link>
        </NavbarItem>
        <NavbarItem>
          <Link href="/search?type=phim-le" className="text-zinc-300 hover:text-pink-500 transition-colors duration-200">
            Phim Lẻ
          </Link>
        </NavbarItem>
        <NavbarItem>
          <Link href="/search?type=phim-bo" className="text-zinc-300 hover:text-pink-500 transition-colors duration-200">
            Phim Bộ
          </Link>
        </NavbarItem>
        <NavbarItem>
          <Link href="/search?type=hoat-hinh" className="text-zinc-300 hover:text-pink-500 transition-colors duration-200">
            Hoạt Hình
          </Link>
        </NavbarItem>
        
        <NavbarItem className="pl-2">
          <Button 
            color="default" 
            variant="flat"
            size="md"
            className="font-bold text-zinc-200 bg-zinc-900/80 border border-zinc-800 hover:bg-zinc-800 rounded-xl px-5 h-11 transition-all"
            startContent={<User size={16} className="text-pink-500" />}
          >
            Thành viên
          </Button>
        </NavbarItem>
      </NavbarContent>
    </Navbar>
  );
}