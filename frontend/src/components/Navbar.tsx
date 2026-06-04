"use client";

import React, { useState, useEffect, useRef } from "react";
import { Navbar, NavbarBrand, NavbarContent, NavbarItem, Input, Button } from "@heroui/react";
import { Search, User, Loader2, ChevronDown, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NavbarComponent() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isScrolled, setIsScrolled] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  
  // Dropdown States for Categories & Countries
  const [isGenreOpen, setIsGenreOpen] = useState(false);
  const [isCountryOpen, setIsCountryOpen] = useState(false);
  
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
        console.error("Lỗi lấy gợi ý nhanh:", error);
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
    router.push(`/movie/${movieUrl}`);
  };

  // Thể loại danh mục (4 cột giống hệt screenshot)
  const genres = [
    [
      { name: "Chính kịch", slug: "chinh-kich" },
      { name: "Tâm Lý", slug: "tam-ly" },
      { name: "Hài Hước", slug: "hai-huoc" },
      { name: "Tài Liệu", slug: "tai-lieu" },
    ],
    [
      { name: "Khoa Học", slug: "khoa-hoc" },
      { name: "Bí Ẩn", slug: "bi-an" },
      { name: "Phiêu Lưu", slug: "phieu-luu" },
      { name: "Gia Đình", slug: "gia-dinh" },
    ],
    [
      { name: "Tình Cảm", slug: "tinh-cam" },
      { name: "Hành Động", slug: "hanh-dong" },
      { name: "Võ Thuật", slug: "vo-thuat" },
      { name: "Hoạt Hình", slug: "hoat-hinh" },
    ],
    [
      { name: "Cổ Trang", slug: "co-trang" },
      { name: "Hình Sự", slug: "hinh-su" },
      { name: "Kinh Dị", slug: "kinh-di" },
      { name: "Chiếu Rạp", slug: "phim-chieu-rap" },
    ]
  ];

  // Quốc gia danh mục (2 cột)
  const countries = [
    [
      { name: "Trung Quốc", slug: "trung-quoc" },
      { name: "Hàn Quốc", slug: "han-quoc" },
      { name: "Nhật Bản", slug: "nhat-ban" },
      { name: "Thái Lan", slug: "thai-lan" },
      { name: "Việt Nam", slug: "viet-nam" },
    ],
    [
      { name: "Âu Mỹ", slug: "au-my" },
      { name: "Mỹ", slug: "my" },
      { name: "Ấn Độ", slug: "an-do" },
      { name: "Hồng Kông", slug: "hong-kong" },
      { name: "Đài Loan", slug: "tai-wan" },
    ]
  ];

  return (
    <Navbar
      isBlurred={false}
      classNames={{
        base: `transition-all duration-300 fixed top-0 w-full z-50 !shadow-none !border-none ${
          isScrolled 
            ? "!bg-black/85" 
            : "!bg-transparent bg-gradient-to-b from-black/85 via-black/35 to-transparent"
        }`,
        wrapper: "h-20 px-6 gap-8 max-w-7xl justify-between",
      }}
    >
      {/* CỤM BÊN TRÁI: LOGO VÀ Ô TÌM KIẾM ĐỘNG */}
      <NavbarContent justify="start" className="gap-6 flex-grow max-w-2xl">
        <NavbarBrand className="gap-2.5 cursor-pointer max-w-fit flex items-center shrink-0" onClick={() => router.push("/")}>
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-pink-500 to-rose-500 flex items-center justify-center shadow-lg shadow-pink-500/20 hover:scale-105 transition-transform duration-200">
            <Play className="text-white fill-white ml-0.5" size={14} />
          </div>
          <div className="flex flex-col -space-y-1">
            <p className="font-black text-2xl tracking-wider text-white select-none">
              Dlow<span className="text-pink-500">Phim</span>
            </p>
          </div>
        </NavbarBrand>

        {/* Khung chứa ô tìm kiếm */}
        <div ref={dropdownRef} className="relative hidden md:block w-full max-w-[340px]">
          <form onSubmit={handleSearchSubmit} className="w-full">
            <Input
              classNames={{
                base: "h-11 w-full",
                mainWrapper: "h-full w-full",
                input: "text-sm text-white placeholder:text-zinc-500 ml-2 bg-transparent w-full font-medium focus:outline-none",
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

          {/* DROPDOWN GỢI Ý NHANH THEO HÌNH ẢNH */}
          {showDropdown && searchQuery.trim() && (
            <div className="absolute top-full left-0 mt-2 w-full min-w-[340px] bg-[#0b0b0d] border border-zinc-700 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col">
              
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

              {/* PHẦN 2: DANH SÁCH DIỄN VIÊN */}
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
                      {searchQuery.trim()} Actor
                    </h4>
                    <p className="text-zinc-500 text-[11px]">Diễn viên liên quan</p>
                  </div>
                </div>
              </div>

              {/* NÚT TOÀN BỘ KẾT QUẢ */}
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
      <NavbarContent className="hidden lg:flex gap-8 font-semibold text-sm items-center" justify="end">
        
        {/* THỂ LOẠI (Dropdown) */}
        <NavbarItem 
          className="relative py-4"
          onMouseEnter={() => {
            setIsGenreOpen(true);
            setIsCountryOpen(false);
          }}
          onMouseLeave={() => setIsGenreOpen(false)}
        >
          <button
            type="button"
            className={`flex items-center gap-1 font-bold text-sm tracking-wide transition-colors duration-200 ${
              isGenreOpen ? "text-pink-500" : "text-zinc-300 hover:text-pink-500"
            }`}
          >
            Thể loại
            <ChevronDown 
              size={14} 
              className={`transition-transform duration-200 ${isGenreOpen ? "rotate-180 text-pink-500" : "text-zinc-400"}`} 
            />
          </button>

          {isGenreOpen && (
            <div 
              className="absolute top-[80%] left-1/2 -translate-x-1/2 mt-2 w-[580px] bg-[#0b0b0d] border border-zinc-700 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.9)] p-6 grid grid-cols-4 gap-x-6 gap-y-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200"
              onMouseEnter={() => setIsGenreOpen(true)}
              onMouseLeave={() => setIsGenreOpen(false)}
            >
              {genres.map((col, colIdx) => (
                <div key={colIdx} className="flex flex-col gap-3">
                  {col.map((item) => (
                    <Link
                      key={item.slug}
                      href={`/search?genre=${item.slug}`}
                      onClick={() => setIsGenreOpen(false)}
                      className="text-[13px] font-semibold text-zinc-300 hover:text-pink-500 transition-colors duration-150 py-0.5"
                    >
                      {item.name}
                    </Link>
                  ))}
                </div>
              ))}
            </div>
          )}
        </NavbarItem>

        {/* PHIM LẺ */}
        <NavbarItem>
          <Link 
            href="/search?type=phim-le" 
            className="text-zinc-300 hover:text-pink-500 font-bold tracking-wide transition-colors duration-200"
          >
            Phim Lẻ
          </Link>
        </NavbarItem>

        {/* PHIM BỘ */}
        <NavbarItem>
          <Link 
            href="/search?type=phim-bo" 
            className="text-zinc-300 hover:text-pink-500 font-bold tracking-wide transition-colors duration-200"
          >
            Phim Bộ
          </Link>
        </NavbarItem>

        {/* QUỐC GIA (Dropdown) */}
        <NavbarItem 
          className="relative py-4"
          onMouseEnter={() => {
            setIsCountryOpen(true);
            setIsGenreOpen(false);
          }}
          onMouseLeave={() => setIsCountryOpen(false)}
        >
          <button
            type="button"
            className={`flex items-center gap-1 font-bold text-sm tracking-wide transition-colors duration-200 ${
              isCountryOpen ? "text-pink-500" : "text-zinc-300 hover:text-pink-500"
            }`}
          >
            Quốc gia
            <ChevronDown 
              size={14} 
              className={`transition-transform duration-200 ${isCountryOpen ? "rotate-180 text-pink-500" : "text-zinc-400"}`} 
            />
          </button>

          {isCountryOpen && (
            <div 
              className="absolute top-[80%] left-1/2 -translate-x-1/2 mt-2 w-[280px] bg-[#0b0b0d] border border-zinc-700 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.9)] p-5 grid grid-cols-2 gap-x-4 gap-y-3.5 z-50 animate-in fade-in slide-in-from-top-2 duration-200"
              onMouseEnter={() => setIsCountryOpen(true)}
              onMouseLeave={() => setIsCountryOpen(false)}
            >
              {countries.map((col, colIdx) => (
                <div key={colIdx} className="flex flex-col gap-3">
                  {col.map((item) => (
                    <Link
                      key={item.slug}
                      href={`/search?country=${item.slug}`}
                      onClick={() => setIsCountryOpen(false)}
                      className="text-[13px] font-semibold text-zinc-300 hover:text-pink-500 transition-colors duration-150 py-0.5"
                    >
                      {item.name}
                    </Link>
                  ))}
                </div>
              ))}
            </div>
          )}
        </NavbarItem>
        
        {/* NÚT THÀNH VIÊN */}
        <NavbarItem className="pl-4">
          <Button 
            color="default" 
            size="md"
            className="font-bold text-black bg-white hover:bg-zinc-100 rounded-full px-6 h-10 transition-all duration-200 shadow-md shadow-white/5"
            startContent={<User size={16} className="text-black shrink-0" />}
          >
            Thành viên
          </Button>
        </NavbarItem>
      </NavbarContent>
    </Navbar>
  );
}