"use client";

import React, { useState, useEffect, useRef } from "react";
import { Navbar, NavbarBrand, NavbarContent, NavbarItem, Input, Button, useDisclosure, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Avatar, Popover, PopoverTrigger, PopoverContent } from "@heroui/react";
import { Search, User, Loader2, ChevronDown, Play, Bell, ChevronUp, Wallet, Heart, Plus, History, LogOut, MessageSquare, Film, Info } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import AuthModal from "./AuthModal";
import { useAuth } from "@/context/AuthContext";
import { cleanMovieName, cleanSlug } from "@/utils/movieUtils";

export default function NavbarComponent() {
  const pathname = usePathname();
  if (pathname?.startsWith("/sys-dlowadmin")) {
    return null;
  }
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
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  
  const { 
    user, 
    loading, 
    logout, 
    unreadNotificationsCount, 
    getUserNotifications, 
    readSingleNotification, 
    readAllNotifications 
  } = useAuth();

  // State lưu thông báo xem nhanh ở Navbar
  const [recentNotifications, setRecentNotifications] = useState<any[]>([]);
  const [isLoadingNotifs, setIsLoadingNotifs] = useState(false);

  const loadRecentNotifs = async () => {
    if (!user) return;
    setIsLoadingNotifs(true);
    try {
      const data = await getUserNotifications(1, 5);
      if (data && data.items) {
        setRecentNotifications(data.items);
      }
    } catch (e) {
      console.error("Lỗi tải thông báo xem nhanh:", e);
    } finally {
      setIsLoadingNotifs(false);
    }
  };

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

  // 1.5. Lắng nghe sự kiện toàn cục để mở AuthModal từ các component khác
  useEffect(() => {
    const handleOpenAuth = () => {
      onOpen();
    };
    window.addEventListener("dlowphim_open_auth", handleOpenAuth);
    return () => window.removeEventListener("dlowphim_open_auth", handleOpenAuth);
  }, [onOpen]);

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
          // Deduplicate suggestions by cleanSlug
          const seen = new Set<string>();
          const uniqueItems = items.filter((item: any) => {
            const baseSlug = cleanSlug(item.slug);
            if (seen.has(baseSlug)) return false;
            seen.add(baseSlug);
            return true;
          });
          // Chỉ lấy tối đa 4 phim hàng đầu để hiển thị dropdown gọn gàng giống Cobephim
          setSuggestions(uniqueItems.slice(0, 4));
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
    <>
      <Navbar
        isBlurred={false}
        classNames={{
          base: `transition-all duration-300 fixed top-0 w-full z-50 !shadow-none !border-none ${isScrolled
            ? "!bg-black/85"
            : "!bg-transparent bg-gradient-to-b from-black/85 via-black/35 to-transparent"
            }`,
          wrapper: "h-20 px-6 gap-8 max-w-7xl justify-between",
        }}
      >
        {/* CỤM BÊN TRÁI: LOGO VÀ Ô TÌM KIẾM ĐỘNG */}
        <NavbarContent justify="start" className="gap-6 flex-grow max-w-2xl">
          <NavbarBrand className="gap-2.5 cursor-pointer max-w-fit flex items-center shrink-0" onClick={() => router.push("/")}>
            <div className="w-11 h-11 rounded-full overflow-hidden hover:scale-105 transition-transform duration-200 shadow-lg shadow-pink-500/10 shrink-0">
              <img src="/images/logo.png" alt="DlowPhim Logo" className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col -space-y-1">
              <p className="font-black text-2xl tracking-wider text-white select-none">
                Dlow<span className="text-pink-500">Phim</span>
              </p>
            </div>
          </NavbarBrand>

          {/* Khung chứa ô tìm kiếm */}
          <div ref={dropdownRef} className="relative hidden md:block w-full max-w-[340px] ">
            <form onSubmit={handleSearchSubmit} className="w-full">
              <Input
                classNames={{
                  base: "h-11 w-full",
                  mainWrapper: "h-full w-full",
                  input: "text-sm text-white placeholder:text-white/70 ml-2 bg-transparent w-full font-medium focus:outline-none",
                  inputWrapper: "h-full bg-white/15 border border-transparent focus-within:!border-pink-500 rounded-xl px-4 transition-all duration-200 shadow-none",
                }}
                placeholder="Tìm kiếm phim, diễn viên..."
                size="md"
                startContent={
                  isSearching ? (
                    <Loader2 size={18} className="text-pink-500 animate-spin shrink-0" />
                  ) : (
                    <Search size={18} className="text-white/70 shrink-0" />
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
              <div className="absolute top-full left-0 mt-2 w-full min-w-[340px] bg-[#0b0b0d] rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col">

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
                              loading="lazy"
                              decoding="async"
                            />
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-bold text-zinc-100 truncate group-hover:text-pink-500 transition-colors">
                                {cleanMovieName(movie.name)}
                              </h4>
                              <p className="text-zinc-400 text-xs truncate mt-0.5">
                                {cleanMovieName(movie.origin_name)}
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
              className={`flex items-center gap-1 font-bold text-sm tracking-wide transition-colors duration-200 ${isGenreOpen ? "text-pink-500" : "text-zinc-300 hover:text-pink-500"
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
              className={`flex items-center gap-1 font-bold text-sm tracking-wide transition-colors duration-200 ${isCountryOpen ? "text-pink-500" : "text-zinc-300 hover:text-pink-500"
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

          {/* NÚT THÀNH VIÊN HOẶC PROFILE DROPDOWN */}
          <NavbarItem className="pl-2">
            {loading ? (
              <Button isDisabled className="bg-zinc-800 text-zinc-400 rounded-full h-10 px-6 font-bold">
                <Loader2 className="animate-spin mr-1 text-zinc-500" size={16} />
                Đang tải...
              </Button>
            ) : user ? (
              <div className="flex items-center gap-4">
                {/* Nút Chuông Thông Báo Popover (Tối ưu hóa bằng Popover để hiển thị hoàn hảo) */}
                <Popover
                  placement="bottom-end"
                  onOpenChange={(isOpen) => isOpen && loadRecentNotifs()}
                >
                  <PopoverTrigger>
                    <Button
                      isIconOnly
                      radius="full"
                      variant="light"
                      className="bg-[#1c203e]/60 hover:bg-[#23284e] border border-zinc-800/60 w-10 h-10 flex items-center justify-center transition-all duration-200 relative cursor-pointer select-none"
                    >
                      <Bell size={18} className="text-white fill-white" />
                      {unreadNotificationsCount > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-pink-500 text-white text-[9px] font-black rounded-full flex items-center justify-center px-1 border-2 border-[#12131b] z-50 animate-bounce">
                          {unreadNotificationsCount > 9 ? "9+" : unreadNotificationsCount}
                        </span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="bg-[#161a33] text-white border border-zinc-800 rounded-3xl p-4 w-[340px] shadow-[0_25px_60px_rgba(0,0,0,0.8)] block text-left">
                    {/* Header */}
                    <div className="flex items-center justify-between w-full border-b border-zinc-800/50 pb-2.5 mb-3">
                      <span className="font-extrabold text-sm text-white uppercase tracking-wider">Thông báo</span>
                      {unreadNotificationsCount > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            readAllNotifications();
                          }}
                          className="text-[10px] font-black text-pink-500 hover:text-pink-400 uppercase tracking-wider transition-colors cursor-pointer border-none bg-transparent"
                        >
                          Đọc tất cả
                        </button>
                      )}
                    </div>
                    
                    {/* List Items */}
                    <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1 no-scrollbar">
                      {isLoadingNotifs ? (
                        <div className="py-8 text-center flex flex-col items-center justify-center gap-2">
                          <Loader2 size={20} className="animate-spin text-pink-500" />
                          <span className="text-xs text-zinc-500 font-medium">Đang tải...</span>
                        </div>
                      ) : recentNotifications.length === 0 ? (
                        <div className="py-8 text-center flex flex-col items-center justify-center gap-1.5 text-zinc-500">
                          <Bell size={24} className="stroke-[1.5]" />
                          <span className="text-xs font-semibold">Không có thông báo mới nào</span>
                        </div>
                      ) : (
                        recentNotifications.map((notif) => {
                          let Icon = Info;
                          let iconColor = "text-sky-500 bg-sky-500/10";
                          if (notif.type === "reply") {
                            Icon = MessageSquare;
                            iconColor = "text-pink-500 bg-pink-500/10";
                          } else if (notif.type === "movie_update") {
                            Icon = Film;
                            iconColor = "text-yellow-500 bg-yellow-500/10";
                          }
                          return (
                            <div
                              key={notif._id}
                              onClick={() => {
                                readSingleNotification(notif._id);
                                if (notif.link) {
                                  router.push(notif.link);
                                }
                              }}
                              className={`flex items-start gap-3 w-full hover:bg-zinc-800/40 p-2.5 rounded-2xl transition-all cursor-pointer ${
                                !notif.isRead ? "bg-pink-500/5 border-l-2 border-pink-500 pl-2" : ""
                              }`}
                            >
                              <div className={`p-2 rounded-xl shrink-0 ${iconColor}`}>
                                <Icon size={16} />
                              </div>
                              <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                                <span className="font-bold text-xs text-zinc-200 truncate">{notif.title}</span>
                                <p className="text-[11px] text-zinc-400 font-medium line-clamp-2 leading-relaxed">{notif.content}</p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Footer */}
                    <div className="pt-2.5 border-t border-zinc-800/50 mt-2">
                      <button
                        onClick={() => router.push("/user/notifications")}
                        className="w-full h-9 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white font-extrabold text-xs rounded-xl transition-all cursor-pointer border-none"
                      >
                        Xem tất cả thông báo
                      </button>
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Dropdown Avatar Premium */}
                <Dropdown
                  placement="bottom-end"
                  classNames={{
                    content: "bg-[#161a33] text-white border border-zinc-800 rounded-2xl p-2 w-[260px] shadow-[0_25px_60px_rgba(0,0,0,0.8)]"
                  }}
                >
                  <DropdownTrigger>
                    <div className="flex items-center gap-1.5 cursor-pointer group hover:opacity-90 select-none">
                      <img
                        src={user.avatar || "/images/avatars/default.png"}
                        alt={user.displayName}
                        className="w-10 h-10 rounded-full border border-zinc-700 shadow-md object-cover cursor-pointer hover:border-pink-500/50 transition-all duration-200 avatar-smooth"
                        referrerPolicy="no-referrer"
                      />
                      <ChevronDown size={14} className="text-zinc-400 group-hover:text-white transition-colors" />
                    </div>
                  </DropdownTrigger>
                  <DropdownMenu aria-label="User Actions" variant="flat" className="p-0">
                    <DropdownItem key="profile" className="opacity-100 cursor-default select-none pointer-events-none hover:bg-transparent p-2 mb-1 border-b border-zinc-800/50 pb-3" textValue="profile">
                      <div className="flex flex-col gap-0.5 w-full">
                        <p className="font-bold text-[10px] text-zinc-500 uppercase tracking-wider">Đang đăng nhập</p>
                        <span className="font-extrabold text-base text-white truncate max-w-[200px]">
                          {user.displayName}
                        </span>
                        <span className="text-xs text-zinc-400 truncate max-w-[200px]">
                          {user.email}
                        </span>
                      </div>
                    </DropdownItem>

                    <DropdownItem
                      key="account"
                      className="hover:bg-zinc-800/40 py-2.5 rounded-xl"
                      textValue="account"
                      onPress={() => router.push("/user/account")}
                    >
                      <div className="flex items-center gap-3">
                        <User size={16} className="text-zinc-400" />
                        <span className="text-sm font-semibold text-zinc-300">Tài khoản</span>
                      </div>
                    </DropdownItem>

                    <DropdownItem
                      key="favorites"
                      className="hover:bg-zinc-800/40 py-2.5 rounded-xl"
                      textValue="favorites"
                      onPress={() => router.push("/user/favorite")}
                    >
                      <div className="flex items-center gap-3">
                        <Heart size={16} className="text-zinc-400" />
                        <span className="text-sm font-semibold text-zinc-300">Yêu thích</span>
                      </div>
                    </DropdownItem>

                    <DropdownItem
                      key="watchlist"
                      className="hover:bg-zinc-800/40 py-2.5 rounded-xl"
                      textValue="watchlist"
                      onPress={() => router.push("/user/watchlist")}
                    >
                      <div className="flex items-center gap-3">
                        <Plus size={16} className="text-zinc-400" />
                        <span className="text-sm font-semibold text-zinc-300">Danh sách</span>
                      </div>
                    </DropdownItem>

                    <DropdownItem
                      key="history"
                      className="hover:bg-zinc-800/40 py-2.5 rounded-xl"
                      textValue="history"
                      onPress={() => router.push("/user/history")}
                    >
                      <div className="flex items-center gap-3">
                        <History size={16} className="text-zinc-400" />
                        <span className="text-sm font-semibold text-zinc-300">Xem tiếp</span>
                      </div>
                    </DropdownItem>

                    <DropdownItem key="logout" className="hover:bg-red-500/10 text-red-500 py-2.5 rounded-xl border-t border-zinc-800/50 mt-1" onPress={logout} textValue="logout">
                      <div className="flex items-center gap-3">
                        <LogOut size={16} className="text-red-500" />
                        <span className="text-sm font-bold">Thoát</span>
                      </div>
                    </DropdownItem>
                  </DropdownMenu>
                </Dropdown>
              </div>
            ) : (
              <Button
                onPress={onOpen}
                color="default"
                size="md"
                className="font-bold text-black bg-white hover:bg-zinc-100 rounded-full px-6 h-10 transition-all duration-200 shadow-md shadow-white/5"
                startContent={<User size={16} className="text-black shrink-0" />}
              >
                Thành viên
              </Button>
            )}
          </NavbarItem>
        </NavbarContent>
      </Navbar>
      <AuthModal isOpen={isOpen} onOpenChange={onOpenChange} />
    </>
  );
}