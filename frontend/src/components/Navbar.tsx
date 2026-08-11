"use client";

import React, { useState, useEffect, useRef } from "react";
import { Navbar, NavbarBrand, NavbarContent, NavbarItem, Input, Button, useDisclosure, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Avatar } from "@heroui/react";
import { Search, User, Loader2, ChevronDown, Play, Bell, ChevronUp, Wallet, Heart, Plus, History, LogOut } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import AuthModal from "./AuthModal";
import { useAuth } from "@/context/AuthContext";
import { cleanMovieName, cleanSlug, getImageUrl } from "@/utils/movieUtils";
import { searchMovies } from "@/utils/movieSearch";
import { searchPeople, type PersonResult } from "@/utils/people";
import { COUNTRIES, GENRES } from "@/constants/discovery";
import MobileNavigation from "./MobileNavigation";
import DesktopNotificationBell from "./notifications/DesktopNotificationBell";

export default function NavbarComponent() {
  const pathname = usePathname();
  if (pathname?.startsWith("/sys-dlowadmin")) {
    return null;
  }
  const [searchQuery, setSearchQuery] = useState("");
  const [isScrolled, setIsScrolled] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [personSuggestions, setPersonSuggestions] = useState<PersonResult[]>([]);
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
  const [isNotifPopoverOpen, setIsNotifPopoverOpen] = useState(false);

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

  const handleNotificationOpenChange = (nextOpen: boolean) => {
    setIsNotifPopoverOpen(nextOpen);
    if (nextOpen) void loadRecentNotifs();
  };

  const handleReadAllRecentNotifications = async () => {
    const success = await readAllNotifications();
    if (success) setRecentNotifications((items) => items.map((item) => ({ ...item, isRead: true })));
  };

  const handleSelectRecentNotification = (notification: any) => {
    if (!notification.isRead) {
      setRecentNotifications((items) => items.map((item) =>
        item._id === notification._id ? { ...item, isRead: true } : item,
      ));
      void readSingleNotification(notification._id);
    }
    setIsNotifPopoverOpen(false);
    const target = String(notification.link || "").trim();
    if (target.startsWith("/") && !target.startsWith("//")) router.push(target);
  };

  const handleViewAllNotifications = () => {
    setIsNotifPopoverOpen(false);
    router.push("/user/notifications");
  };

  useEffect(() => {
    if (!isNotifPopoverOpen) return;
    const refresh = () => void loadRecentNotifs();
    window.addEventListener("dlowphim:notifications-changed", refresh);
    return () => window.removeEventListener("dlowphim:notifications-changed", refresh);
  }, [isNotifPopoverOpen, user?.id]);

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
      setPersonSuggestions([]);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    const delayDebounce = setTimeout(async () => {
      setIsSearching(true);
      try {
        const [movieResult, peopleResult] = await Promise.allSettled([
          searchMovies(searchQuery.trim(), 1, { signal: controller.signal, timeoutMs: 3500 }),
          searchPeople(searchQuery.trim(), 1, controller.signal),
        ]);
        const items = movieResult.status === "fulfilled" ? movieResult.value.items : [];
        const seen = new Set<string>();
        const uniqueItems = items.filter((item: any) => {
          const baseSlug = cleanSlug(item.slug);
          if (seen.has(baseSlug)) return false;
          seen.add(baseSlug);
          return true;
        });
        setSuggestions(uniqueItems.slice(0, 4));
        setPersonSuggestions(peopleResult.status === "fulfilled" ? peopleResult.value.items.slice(0, 3) : []);
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("Lỗi lấy gợi ý nhanh:", error);
          setSuggestions([]);
          setPersonSuggestions([]);
        }
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, 300);

    return () => {
      clearTimeout(delayDebounce);
      controller.abort();
    };
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

  const handleSelectPerson = (personId: string) => {
    setShowDropdown(false);
    setSearchQuery("");
    router.push(`/dien-vien/${personId}`);
  };

  // Thể loại danh mục (4 cột giống hệt screenshot)
  const genres = [GENRES.slice(0, 4), GENRES.slice(4, 8), GENRES.slice(8, 12), GENRES.slice(12, 16)];

  // Quốc gia danh mục (2 cột)
  const countries = [COUNTRIES.slice(0, 5), COUNTRIES.slice(5, 10)];

  return (
    <>
      <MobileNavigation
        isAuthenticated={Boolean(user)}
        isAuthLoading={loading}
        unreadNotificationsCount={unreadNotificationsCount}
        onOpenAuth={onOpen}
        notifications={recentNotifications}
        isLoadingNotifications={isLoadingNotifs}
        onRequestNotifications={loadRecentNotifs}
        onReadAllNotifications={handleReadAllRecentNotifications}
        onSelectNotification={handleSelectRecentNotification}
        onViewAllNotifications={handleViewAllNotifications}
      />
      <div className="hidden md:block">
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
                        const thumbUrl = getImageUrl(movie.poster_url || movie.thumb_url);

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
                  {personSuggestions.length ? personSuggestions.map((person) => (
                    <button key={person.id} type="button" onClick={() => handleSelectPerson(person.id)} className="flex w-full items-center gap-3 rounded-xl p-1.5 text-left transition-all hover:bg-zinc-900/80">
                      {person.profileUrl ? (
                        <img src={person.profileUrl} alt={person.name} className="h-10 w-10 rounded-full object-cover" loading="lazy" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-xs font-bold text-zinc-500">{person.name.slice(0, 2).toUpperCase()}</div>
                      )}
                      <div className="min-w-0">
                        <h4 className="truncate text-sm font-bold text-zinc-200">{person.name}</h4>
                        <p className="truncate text-[11px] text-zinc-500">{person.knownFor.join(" • ") || "Xem phim đã tham gia"}</p>
                      </div>
                    </button>
                  )) : !isSearching && (
                    <p className="py-1 text-xs italic text-zinc-500">Không tìm thấy diễn viên phù hợp...</p>
                  )}
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
                        href={`/the-loai/${item.slug}`}
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
              href="/phim-le"
              className="text-zinc-300 hover:text-pink-500 font-bold tracking-wide transition-colors duration-200"
            >
              Phim Lẻ
            </Link>
          </NavbarItem>

          {/* PHIM BỘ */}
          <NavbarItem>
            <Link
              href="/phim-bo"
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
                        href={`/quoc-gia/${item.slug}`}
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
                <DesktopNotificationBell
                  notifications={recentNotifications}
                  isLoading={isLoadingNotifs}
                  unreadCount={unreadNotificationsCount}
                  onOpenChange={handleNotificationOpenChange}
                  onReadAll={handleReadAllRecentNotifications}
                  onSelect={handleSelectRecentNotification}
                  onViewAll={handleViewAllNotifications}
                />

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

                    <DropdownItem
                      key="notifications"
                      className="hover:bg-zinc-800/40 py-2.5 rounded-xl"
                      textValue="notifications"
                      onPress={() => router.push("/user/notifications")}
                    >
                      <div className="flex items-center justify-between gap-3 w-full">
                        <div className="flex items-center gap-3">
                          <Bell
                            size={16}
                            className={unreadNotificationsCount > 0 ? "text-pink-500" : "text-zinc-400"}
                          />
                          <span className="text-sm font-semibold text-zinc-300">Thông báo</span>
                        </div>
                        {unreadNotificationsCount > 0 && (
                          <span className="h-5 min-w-5 px-1.5 rounded-full bg-pink-500 text-white text-[10px] font-black flex items-center justify-center">
                            {unreadNotificationsCount > 99 ? "99+" : unreadNotificationsCount}
                          </span>
                        )}
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
      </div>
      <AuthModal isOpen={isOpen} onOpenChange={onOpenChange} />
    </>
  );
}
