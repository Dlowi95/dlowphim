"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  Star,
  Send,
  MessageSquare,
  ArrowUp,
  ArrowDown,
  CornerDownLeft,
  MoreHorizontal,
  ShieldAlert,
  ThumbsUp,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import Cookies from "js-cookie";
import { ReactionsSummary, ReactTriggerButton } from "./comment/CommentReactions";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Comment {
  id: string;
  userId: string;
  avatar: string;
  avatarUrl?: string;
  name: string;
  role: "member" | "vip" | "admin";
  content: string;
  time: string;
  likes: number;
  liked?: boolean;
  userVote?: "up" | "down" | null;
  isSpoiler?: boolean;
  episodeLabel?: string;
  parentId?: string | null;
  reactionsSummary?: { type: string; count: number }[];
  userReaction?: string | null;
}

interface RatingData {
  average: number;
  count: number;
  userRating: number | null;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface CommentRatingSectionProps {
  /** Movie slug dùng cho API endpoint */
  slug: string;
  /** Optional: label tập phim sẽ gắn vào bình luận (chỉ ở watch page) */
  episodeLabel?: string;
  /** Tiêu đề phần bình luận (mặc định "Bình luận") */
  title?: string;
  /** Show rating tab switcher buttons */
  showTabs?: boolean;
  isTrailerOnly?: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function CommentRatingSection({
  slug,
  episodeLabel,
  title = "Bình luận",
  showTabs = true,
  isTrailerOnly = false,
}: CommentRatingSectionProps) {
  const { user, showToast } = useAuth();
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  // Comment states
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [revealedSpoilers, setRevealedSpoilers] = useState<Record<string, boolean>>({});

  // Rating states
  const [ratingData, setRatingData] = useState<RatingData>({ average: 0, count: 0, userRating: null });
  const [hoverStar, setHoverStar] = useState(0);
  const [submittingRating, setSubmittingRating] = useState(false);

  // Active tab
  const [activeTab, setActiveTab] = useState<"comment" | "rating">("comment");

  // Reply states
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [activeReplyTargetId, setActiveReplyTargetId] = useState<string | null>(null);
  const [replyToUserId, setReplyToUserId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyIsSpoiler, setReplyIsSpoiler] = useState(false);

  // Action menu state
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [activeEmojiMenuId, setActiveEmojiMenuId] = useState<string | null>(null);
  const hasScrolledRef = useRef(false);

  interface ReportModalState {
    isOpen: boolean;
    commentId: string | null;
    reason: string;
    customReason: string;
  }

  // Report Modal state
  const [reportModal, setReportModal] = useState<ReportModalState>({
    isOpen: false,
    commentId: null,
    reason: "Spam / Quảng cáo không phù hợp",
    customReason: "",
  });

  // ── Fetch data ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!slug) return;

    async function fetchComments() {
      try {
        const token = Cookies.get("token");
        const headers: HeadersInit = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const res = await fetch(`${API_URL}/comments/${slug}`, { headers });
        if (res.ok) setComments(await res.json());
      } catch (err) {
        console.error("Lỗi lấy bình luận:", err);
      }
    }

    async function fetchRating() {
      try {
        const token = Cookies.get("token");
        const headers: HeadersInit = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const res = await fetch(`${API_URL}/ratings/${slug}`, { headers });
        if (res.ok) setRatingData(await res.json());
      } catch (err) {
        console.error("Lỗi lấy đánh giá:", err);
      }
    }

    fetchComments();
    if (showTabs && !isTrailerOnly) {
      fetchRating();
    }

    // Polling comments every 6 seconds
    const interval = setInterval(fetchComments, 6000);
    return () => clearInterval(interval);
  }, [slug, API_URL, showTabs]);

  // Tự động cuộn xuống khu vực bình luận nếu URL chứa hash #movie-comments
  useEffect(() => {
    if (comments.length > 0 && typeof window !== "undefined" && window.location.hash === "#movie-comments" && !hasScrolledRef.current) {
      hasScrolledRef.current = true;

      // Kiểm tra xem trang có phải là reload hay không
      const navigationEntries = window.performance?.getEntriesByType("navigation");
      const isReload = navigationEntries && 
        navigationEntries[0] && 
        (navigationEntries[0] as PerformanceNavigationTiming).type === "reload";

      if (!isReload) {
        const timer = setTimeout(() => {
          const el = document.getElementById("movie-comments");
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "start" });
          }
          // Xóa hash để reload không bị cuộn lại
          window.history.replaceState(null, "", window.location.pathname + window.location.search);
        }, 500);
        return () => clearTimeout(timer);
      } else {
        // Nếu là reload, xóa hash ngay lập tức để giữ nguyên scroll của trình duyệt
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      }
    }
  }, [comments]);

  // Đảm bảo không ở tab đánh giá nếu phim là trailer chỉ xem
  useEffect(() => {
    if (isTrailerOnly && activeTab === "rating") {
      setActiveTab("comment");
    }
  }, [isTrailerOnly, activeTab]);

  // Lắng nghe sự kiện click từ nút rating trên banner để tự chuyển tab
  useEffect(() => {
    const handleSwitchTab = () => {
      if (!isTrailerOnly) {
        setActiveTab("rating");
      }
    };
    window.addEventListener("dlowphim_switch_rating_tab", handleSwitchTab);
    return () => window.removeEventListener("dlowphim_switch_rating_tab", handleSwitchTab);
  }, [isTrailerOnly]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !user) return;
    try {
      const token = Cookies.get("token");
      const res = await fetch(`${API_URL}/comments/${slug}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          content: commentText.trim(),
          isSpoiler,
          episodeLabel: episodeLabel || undefined,
        }),
      });
      if (res.ok) {
        const newComment = await res.json();
        setComments((prev: Comment[]) => [newComment, ...prev]);
        setCommentText("");
        setIsSpoiler(false);
      }
    } catch (err) {
      console.error("Lỗi gửi bình luận:", err);
    }
  };

  const handleSubmitReply = async (e: React.FormEvent, parentId: string) => {
    e.preventDefault();
    if (!replyText.trim() || !user) return;
    try {
      const token = Cookies.get("token");
      const res = await fetch(`${API_URL}/comments/${slug}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          content: replyText.trim(),
          isSpoiler: replyIsSpoiler,
          episodeLabel: episodeLabel || undefined,
          parentId,
          replyToUserId: replyToUserId || undefined,
        }),
      });
      if (res.ok) {
        const newReply = await res.json();
        setComments((prev: Comment[]) => [...prev, newReply]);
        setReplyText("");
        setReplyToId(null);
        setActiveReplyTargetId(null);
        setReplyToUserId(null);
        setReplyIsSpoiler(false);
      }
    } catch (err) {
      console.error("Lỗi gửi câu trả lời:", err);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!user) return;
    try {
      const token = Cookies.get("token");
      const res = await fetch(`${API_URL}/comments/${commentId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        setComments((prev: Comment[]) => {
          const target = prev.find((c: Comment) => c.id === commentId);
          if (!target) return prev;
          if (!target.parentId) {
            // Xóa cha -> xóa cả con
            return prev.filter((c: Comment) => c.id !== commentId && c.parentId !== commentId);
          } else {
            // Xóa con -> chỉ xóa chính nó
            return prev.filter((c: Comment) => c.id !== commentId);
          }
        });
        showToast("Xóa bình luận thành công!", "success");
        setActiveMenuId(null);
      } else {
        const errData = await res.json();
        showToast(errData.message || "Không thể xóa bình luận", "error");
      }
    } catch (err) {
      console.error("Lỗi xóa bình luận:", err);
      showToast("Lỗi kết nối máy chủ", "error");
    }
  };

  const handleReportComment = async (commentId: string, reason: string) => {
    if (!user) {
      window.dispatchEvent(new Event("dlowphim_open_auth"));
      return;
    }
    try {
      const token = Cookies.get("token");
      const res = await fetch(`${API_URL}/comments/${commentId}/report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason }),
      });
      if (res.ok) {
        showToast("Đã gửi báo cáo vi phạm bình luận này!", "success");
        setActiveMenuId(null);
      } else {
        const errData = await res.json();
        showToast(errData.message || "Không thể gửi báo cáo", "error");
      }
    } catch (err) {
      console.error("Lỗi báo xấu:", err);
      showToast("Lỗi kết nối máy chủ", "error");
    }
  };

  const openReportModal = (commentId: string) => {
    setReportModal({
      isOpen: true,
      commentId,
      reason: "Spam / Quảng cáo không phù hợp",
      customReason: "",
    });
    setActiveMenuId(null);
  };

  const handleVote = async (commentId: string, type: "up" | "down") => {
    if (!user) {
      window.dispatchEvent(new Event("dlowphim_open_auth"));
      return;
    }
    try {
      const token = Cookies.get("token");
      const res = await fetch(`${API_URL}/comments/${commentId}/vote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ type }),
      });
      if (res.ok) {
        const data = await res.json();
        setComments((prev: Comment[]) =>
          prev.map((c: Comment) =>
            c.id === commentId
              ? { ...c, likes: data.likes, liked: data.liked, userVote: data.userVote }
              : c
          )
        );
      }
    } catch (err) {
      console.error("Lỗi vote bình luận:", err);
    }
  };

  const handleReaction = async (commentId: string, reactionType: string) => {
    if (!user) {
      window.dispatchEvent(new Event("dlowphim_open_auth"));
      return;
    }
    try {
      const token = Cookies.get("token");
      const res = await fetch(`${API_URL}/comments/${commentId}/reaction`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ type: reactionType }),
      });
      if (res.ok) {
        const data = await res.json();
        setComments((prev: Comment[]) =>
          prev.map((c: Comment) =>
            c.id === commentId
              ? { ...c, reactionsSummary: data.reactionsSummary, userReaction: data.userReaction }
              : c
          )
        );
      }
    } catch (err) {
      console.error("Lỗi thả react:", err);
    }
  };

  const handleSubmitRating = async (score: number) => {
    if (!user) {
      window.dispatchEvent(new Event("dlowphim_open_auth"));
      return;
    }
    setSubmittingRating(true);
    try {
      const token = Cookies.get("token");
      const res = await fetch(`${API_URL}/ratings/${slug}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ score }),
      });
      if (res.ok) setRatingData(await res.json());
    } catch (err) {
      console.error("Lỗi gửi đánh giá:", err);
    } finally {
      setSubmittingRating(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div id="movie-comments" className="pt-6 border-t border-zinc-900/60 space-y-5">
      {/* ── Header + Tab switcher ── */}
      <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
        <div className="flex items-center gap-2">
          <MessageSquare size={18} className="text-zinc-100" />
          <h3 className="text-base md:text-lg font-bold text-white select-none">
            {activeTab === "comment" ? `${title} (${comments.length})` : "Đánh giá phim"}
          </h3>
        </div>

        {showTabs && !isTrailerOnly && (
          <div className="flex bg-zinc-900/60 p-0.5 rounded-lg border border-zinc-800/80 text-[10px] font-extrabold select-none">
            <button
              type="button"
              onClick={() => setActiveTab("comment")}
              className={`px-3 py-1.5 rounded-md font-black cursor-pointer transition-all ${activeTab === "comment" ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-400 hover:text-white"
                }`}
            >
              Bình luận
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("rating")}
              className={`px-3 py-1.5 rounded-md font-black cursor-pointer transition-all ${activeTab === "rating" ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-400 hover:text-white"
                }`}
            >
              Đánh giá
            </button>
          </div>
        )}
      </div>

      {/* ══ TAB: BÌNH LUẬN ══ */}
      {activeTab === "comment" && (
        <>
          {/* User info row */}
          <div className="flex items-center gap-3">
            {user ? (
              <>
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.displayName}
                    className={`w-10 h-10 rounded-full object-cover shrink-0 shadow-sm border border-zinc-800 ${user.role === "admin"
                        ? "ring-2 ring-pink-500 ring-offset-2 ring-offset-[#0d0e13] shadow-[0_0_10px_rgba(236,72,153,0.5)]"
                        : ""
                      }`}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <img
                    src="/images/avatars/default.png"
                    alt={user.displayName}
                    className={`w-10 h-10 rounded-full object-cover shrink-0 shadow-sm border border-zinc-800 ${user.role === "admin"
                        ? "ring-2 ring-pink-500 ring-offset-2 ring-offset-[#0d0e13] shadow-[0_0_10px_rgba(236,72,153,0.5)]"
                        : ""
                      }`}
                  />
                )}
                <div className="flex flex-col text-left">
                  <span className="text-[10px] text-zinc-500 font-semibold select-none leading-none">
                    Bình luận với tên
                  </span>
                  <span className="text-xs font-bold text-zinc-100 mt-1 select-none leading-none">
                    {user.displayName || user.email?.split("@")[0] || "Thành viên"}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="w-10 h-10 rounded-full font-black text-base flex items-center justify-center shrink-0 bg-zinc-800 text-zinc-500 select-none">
                  ?
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-[10px] text-zinc-500 font-semibold select-none leading-none">
                    Bạn chưa đăng nhập
                  </span>
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new Event("dlowphim_open_auth"))}
                    className="text-xs font-black text-pink-500 hover:text-pink-400 mt-1 transition-colors bg-transparent border-none p-0 cursor-pointer text-left leading-none"
                  >
                    Đăng nhập ngay
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Comment textarea */}
          {user ? (
            <form onSubmit={handleSubmitComment}>
              <div className="bg-[#13141d] border border-transparent focus-within:!border-pink-500 rounded-xl p-3.5 transition-all relative">
                <div className="relative">
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value.slice(0, 1000))}
                    placeholder="Viết bình luận..."
                    className="w-full min-h-[90px] bg-transparent text-sm text-zinc-200 placeholder-zinc-550 focus:outline-none resize-none pr-16 font-medium leading-relaxed"
                  />
                  <span className="absolute top-0 right-0 text-[10px] font-bold text-zinc-650 select-none">
                    {commentText.length} / 1000
                  </span>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-zinc-900/50">
                  {/* Spoiler toggle */}
                  <div
                    onClick={() => setIsSpoiler(!isSpoiler)}
                    className="flex items-center gap-2 select-none cursor-pointer"
                  >
                    <div
                      className={`w-8 h-4.5 rounded-full p-0.5 transition-colors duration-200 flex items-center ${isSpoiler ? "bg-pink-500" : "bg-zinc-800"
                        }`}
                    >
                      <div
                        className={`w-3.5 h-3.5 rounded-full bg-white transition-transform duration-200 ${isSpoiler ? "translate-x-3.5" : "translate-x-0"
                          }`}
                      />
                    </div>
                    <span className="text-[11px] font-extrabold text-zinc-400">Tiết lộ?</span>
                  </div>

                  {/* Submit button */}
                  <button
                    type="submit"
                    disabled={!commentText.trim()}
                    className="flex items-center gap-1.5 bg-transparent border-none text-zinc-100 hover:text-pink-400 font-extrabold text-xs cursor-pointer select-none transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span>Gửi</span>
                    <Send size={13} className="text-pink-500 fill-pink-500/10 rotate-45 -translate-y-0.5" />
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <div
              onClick={() => window.dispatchEvent(new Event("dlowphim_open_auth"))}
              className="bg-[#13141d]/45 rounded-xl p-6 text-center text-xs text-zinc-500 cursor-pointer hover:bg-[#13141d]/60 transition-all font-semibold"
            >
              Vui lòng{" "}
              <span className="text-pink-500 font-bold hover:underline">đăng nhập</span>{" "}
              để tham gia bình luận cùng mọi người.
            </div>
          )}

          {/* Comment list */}
          <div className="space-y-4 pt-2">
            {comments.filter((c: Comment) => !c.parentId).length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center justify-center gap-3 bg-zinc-950/40 rounded-2xl select-none">
                <MessageSquare size={36} className="text-zinc-700 stroke-[1.5]" />
                <span className="text-xs font-bold text-zinc-550">
                  Chưa có bình luận nào. Hãy là người đầu tiên chia sẻ cảm nghĩ!
                </span>
              </div>
            ) : (
              <div className="space-y-5 divide-y divide-zinc-900/60">
                {comments.filter((c: Comment) => !c.parentId).map((comment: Comment, index: number) => {
                  const isAdmin = comment.role === "admin";
                  const hasSpoiler = comment.isSpoiler;
                  const isRevealed = revealedSpoilers[comment.id];
                  const replies = comments.filter((r: Comment) => r.parentId === comment.id).sort((a: Comment, b: Comment) => a.id.localeCompare(b.id));

                  console.log("DEBUG FRONTEND CHECK:", {
                    commentAuthor: comment.name,
                    commentUserId: comment.userId,
                    currentUserId: user?.id,
                    currentUserRole: user?.role,
                    isOwner: user?.id === comment.userId,
                    isAdmin: user?.role === "admin",
                    showDelete: user && (user.id === comment.userId || user.role === "admin")
                  });

                  return (
                    <div key={comment.id} className={`flex flex-col gap-4 ${index === 0 ? "pt-0" : "pt-4"}`}>
                      {/* Root Comment Container */}
                      <div className="flex gap-3.5">
                        {/* Avatar */}
                        {comment.avatarUrl === "vietnam-flag" ? (
                          <div className="w-9 h-9 rounded-full bg-red-600 flex items-center justify-center shrink-0 border border-red-500 select-none">
                            <Star size={14} className="fill-yellow-400 text-yellow-400 stroke-none" />
                          </div>
                        ) : comment.avatarUrl ? (
                          <img
                            src={comment.avatarUrl}
                            alt={comment.name}
                            className={`w-9 h-9 rounded-full object-cover shrink-0 shadow-sm border border-zinc-800 ${isAdmin
                                ? "ring-2 ring-pink-500 ring-offset-[1.5px] ring-offset-[#0d0e13] shadow-[0_0_8px_rgba(236,72,153,0.45)]"
                                : ""
                              }`}
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <img
                            src="/images/avatars/default.png"
                            alt={comment.name}
                            className={`w-9 h-9 rounded-full object-cover shrink-0 shadow-sm border border-zinc-800 ${isAdmin
                                ? "ring-2 ring-pink-500 ring-offset-[1.5px] ring-offset-[#0d0e13] shadow-[0_0_8px_rgba(236,72,153,0.45)]"
                                : ""
                              }`}
                          />
                        )}

                        {/* Content */}
                        <div className="flex-1 space-y-1">
                          <div className="flex flex-wrap items-center select-none gap-y-1">
                            <span className="font-extrabold text-xs text-zinc-200 mr-1.5">{comment.name}</span>

                            {/* Neon pink infinity */}
                            <span
                              className="text-pink-500 drop-shadow-[0_0_6px_rgba(236,72,153,0.85)] font-extrabold text-sm mr-2.5 select-none flex items-center"
                              title="DlowPhim Member"
                            >
                              ∞
                            </span>

                            {/* Time */}
                            <span className="text-[9px] text-zinc-400 font-bold bg-[#13141d] px-2 py-0.5 rounded-md border border-zinc-800/40 mr-3 inline-flex items-center gap-1 select-none tabular-nums">
                              {comment.time}
                            </span>

                            {/* Admin badge */}
                            {isAdmin && (
                              <span className="bg-pink-500 text-white text-[8px] font-black px-1.5 py-0.2 rounded uppercase tracking-wider mr-2">
                                Quản trị
                              </span>
                            )}

                            {/* Spoiler badge */}
                            {hasSpoiler && (
                              <span className="bg-amber-500/10 text-amber-500 text-[8px] font-black px-1.5 py-0.2 rounded uppercase tracking-wider mr-2">
                                Spoilers
                              </span>
                            )}

                            {/* Episode badge without white border */}
                            {comment.episodeLabel && (
                              <span className="bg-[#1c2035]/40 text-zinc-400 text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase leading-none border border-transparent">
                                {comment.episodeLabel}
                              </span>
                            )}
                          </div>

                          {/* Spoiler gate */}
                          {hasSpoiler && !isRevealed ? (
                            <div
                              onClick={() =>
                                setRevealedSpoilers((prev: Record<string, boolean>) => ({ ...prev, [comment.id]: true }))
                              }
                              className="bg-[#1b1d2a]/55 hover:bg-[#1b1d2a]/75 border border-zinc-800/40 rounded-lg px-3 py-2 text-[11px] text-zinc-400 font-semibold cursor-pointer transition-colors mt-1 select-none flex items-center gap-1.5"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                              <span>Bình luận này có chứa tình tiết spoil phim. Bấm vào để xem.</span>
                            </div>
                          ) : (
                            <p
                              className={`text-zinc-300 text-xs md:text-sm leading-relaxed font-medium transition-all ${hasSpoiler
                                ? "bg-amber-500/5 p-2 rounded-lg border border-amber-500/10"
                                : ""
                                }`}
                            >
                              {comment.content}
                            </p>
                          )}

                          {/* Reactions Summary display */}
                          <ReactionsSummary
                            commentId={comment.id}
                            reactionsSummary={comment.reactionsSummary}
                            userReaction={comment.userReaction}
                            handleReaction={handleReaction}
                            isReply={false}
                          />

                          {/* Footer actions */}
                          <div className="flex items-center gap-4 pt-1.5 select-none text-zinc-500 font-bold text-[10px]">
                            {/* React Emoji Button */}
                            <ReactTriggerButton
                              commentId={comment.id}
                              userReaction={comment.userReaction}
                              activeEmojiMenuId={activeEmojiMenuId}
                              setActiveEmojiMenuId={setActiveEmojiMenuId}
                              handleReaction={handleReaction}
                              user={user}
                              size={11}
                            />

                            {/* Reply Button */}
                            <button
                              type="button"
                              onClick={() => {
                                if (!user) {
                                  window.dispatchEvent(new Event("dlowphim_open_auth"));
                                  return;
                                }
                                const targetId = activeReplyTargetId === comment.id ? null : comment.id;
                                setReplyToId(targetId);
                                setActiveReplyTargetId(targetId);
                                setReplyToUserId(targetId ? comment.userId : null);
                                setReplyText("");
                              }}
                              className={`flex items-center gap-1 hover:text-zinc-300 transition-colors cursor-pointer bg-transparent border-none text-[10px] font-bold ${activeReplyTargetId === comment.id ? "text-pink-500" : "text-zinc-500"
                                }`}
                            >
                              <CornerDownLeft size={11} />
                              <span>Trả lời</span>
                            </button>

                            {/* More */}
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => setActiveMenuId(activeMenuId === comment.id ? null : comment.id)}
                                className={`flex items-center gap-1 hover:text-zinc-300 transition-colors cursor-pointer bg-transparent border-none text-[10px] font-bold ${activeMenuId === comment.id ? "text-zinc-300" : "text-zinc-500"
                                  }`}
                              >
                                <MoreHorizontal size={11} />
                                <span>Thêm</span>
                              </button>

                              {activeMenuId === comment.id && (
                                <>
                                  {/* Transparent click-outside overlay */}
                                  <div className="fixed inset-0 z-40 bg-transparent cursor-default" onClick={() => setActiveMenuId(null)} />

                                  {/* Dropdown Box */}
                                  <div className="absolute left-0 mt-1.5 w-32 bg-[#0d0e13] border rounded-xl shadow-[0_0_15px_rgba(236,72,153,0.15)] p-1 z-50 animate-fadeIn flex flex-col gap-0.5" style={{ borderColor: "rgba(236, 72, 153, 0.25)" }}>
                                    {/* Delete option */}
                                    {user && (user.id === comment.userId || user.role === "admin") && (
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteComment(comment.id)}
                                        className="w-full text-left px-2.5 py-1.5 hover:bg-red-500/10 hover:text-red-400 text-red-500/85 text-[10px] font-extrabold rounded-lg transition-colors cursor-pointer border-none bg-transparent"
                                      >
                                        Xóa bình luận
                                      </button>
                                    )}

                                    {/* Report option */}
                                    {user && user.id !== comment.userId && (
                                      <button
                                        type="button"
                                        onClick={() => openReportModal(comment.id)}
                                        className="w-full text-left px-2.5 py-1.5 hover:bg-[#1b1d2a] hover:text-white text-zinc-400 text-[10px] font-extrabold rounded-lg transition-colors cursor-pointer border-none bg-transparent"
                                      >
                                        Báo xấu
                                      </button>
                                    )}

                                    {/* Unauthenticated fallback if guest clicks */}
                                    {!user && (
                                      <button
                                        type="button"
                                        onClick={() => window.dispatchEvent(new Event("dlowphim_open_auth"))}
                                        className="w-full text-left px-2.5 py-1.5 hover:bg-[#1b1d2a] hover:text-white text-zinc-400 text-[10px] font-extrabold rounded-lg transition-colors cursor-pointer border-none bg-transparent"
                                      >
                                        Báo xấu
                                      </button>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>



                      {/* Nested Replies List (Indented under parent) */}
                      {replies.length > 0 && (
                        <div className="ml-12 pl-3 border-l border-zinc-900/80 space-y-5.5">
                          {replies.map((reply: Comment) => {
                            const isReplyAdmin = reply.role === "admin";
                            const isReplySpoiler = reply.isSpoiler;
                            const isReplyRevealed = revealedSpoilers[reply.id];
                            const repliesOfReply = comments.filter(r => r.parentId === reply.id).sort((a, b) => a.id.localeCompare(b.id)); // not used yet but for safety

                            return (
                              <div key={reply.id} className="flex gap-3 pb-3">
                                {/* Reply Avatar */}
                                {reply.avatarUrl === "vietnam-flag" ? (
                                  <div className={`w-7 h-7 rounded-full bg-red-600 flex items-center justify-center shrink-0 border border-red-500 select-none ${isReplyAdmin ? "ring-2 ring-pink-500 ring-offset-1 ring-offset-[#0d0e13] shadow-[0_0_8px_rgba(236,72,153,0.45)]" : ""}`}>
                                    <Star size={10} className="fill-yellow-400 text-yellow-400 stroke-none" />
                                  </div>
                                ) : reply.avatarUrl ? (
                                  <img
                                    src={reply.avatarUrl}
                                    alt={reply.name}
                                    className={`w-7 h-7 rounded-full object-cover shrink-0 border border-zinc-800 ${isReplyAdmin
                                        ? "ring-2 ring-pink-500 ring-offset-1 ring-offset-[#0d0e13] shadow-[0_0_8px_rgba(236,72,153,0.45)]"
                                        : ""
                                      }`}
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <img
                                    src="/images/avatars/default.png"
                                    alt={reply.name}
                                    className={`w-7 h-7 rounded-full object-cover shrink-0 border border-zinc-800 ${isReplyAdmin
                                        ? "ring-2 ring-pink-500 ring-offset-1 ring-offset-[#0d0e13] shadow-[0_0_8px_rgba(236,72,153,0.45)]"
                                        : ""
                                      }`}
                                  />
                                )}

                                {/* Reply Content */}
                                <div className="flex-1 space-y-1">
                                  <div className="flex flex-wrap items-center select-none gap-y-1">
                                    <span className="font-extrabold text-[11px] text-zinc-200 mr-1.5">{reply.name}</span>
                                    <span className="text-pink-500 drop-shadow-[0_0_6px_rgba(236,72,153,0.85)] font-extrabold text-xs mr-2 select-none flex items-center">
                                      ∞
                                    </span>
                                    <span className="text-[8px] text-zinc-400 font-bold bg-[#13141d] px-1.5 py-0.5 rounded-md border border-zinc-800/40 mr-3 inline-flex items-center gap-1 select-none tabular-nums">
                                      {reply.time}
                                    </span>
                                    {isReplyAdmin && (
                                      <span className="bg-pink-500 text-white text-[7px] font-black px-1.5 py-0.1 rounded uppercase tracking-wider mr-2">
                                        Quản trị
                                      </span>
                                    )}
                                    {isReplySpoiler && (
                                      <span className="bg-amber-500/10 text-amber-500 text-[7px] font-black px-1.5 py-0.1 rounded uppercase tracking-wider mr-2">
                                        Spoilers
                                      </span>
                                    )}
                                  </div>

                                  {isReplySpoiler && !isReplyRevealed ? (
                                    <div
                                      onClick={() =>
                                        setRevealedSpoilers((prev: Record<string, boolean>) => ({ ...prev, [reply.id]: true }))
                                      }
                                      className="bg-[#1b1d2a]/55 hover:bg-[#1b1d2a]/75 border border-zinc-800/40 rounded-lg px-2.5 py-1.5 text-[10px] text-zinc-400 font-semibold cursor-pointer transition-colors mt-1 select-none flex items-center gap-1.5"
                                    >
                                      <span className="w-1 h-1 rounded-full bg-amber-500 shrink-0" />
                                      <span>Bình luận có chứa tình tiết spoil. Bấm để xem.</span>
                                    </div>
                                  ) : (
                                    <p className={`text-zinc-300 text-xs leading-relaxed font-medium transition-all ${isReplySpoiler ? "bg-amber-500/5 p-1.5 rounded-lg border border-amber-500/10" : ""
                                      }`}>
                                      {reply.content}
                                    </p>
                                  )}

                                  {/* Reactions Summary display */}
                                  <ReactionsSummary
                                    commentId={reply.id}
                                    reactionsSummary={reply.reactionsSummary}
                                    userReaction={reply.userReaction}
                                    handleReaction={handleReaction}
                                    isReply={true}
                                  />

                                  {/* Reply actions */}
                                  <div className="flex items-center gap-3 pt-1 select-none text-zinc-500 font-bold text-[9px]">
                                    {/* React Emoji Button */}
                                    <ReactTriggerButton
                                      commentId={reply.id}
                                      userReaction={reply.userReaction}
                                      activeEmojiMenuId={activeEmojiMenuId}
                                      setActiveEmojiMenuId={setActiveEmojiMenuId}
                                      handleReaction={handleReaction}
                                      user={user}
                                      size={10}
                                    />

                                    {/* Trả lời (Reply of Reply) */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (!user) {
                                          window.dispatchEvent(new Event("dlowphim_open_auth"));
                                          return;
                                        }
                                        if (activeReplyTargetId === reply.id) {
                                          setReplyToId(null);
                                          setActiveReplyTargetId(null);
                                          setReplyToUserId(null);
                                        } else {
                                          setReplyToId(comment.id);
                                          setActiveReplyTargetId(reply.id);
                                          setReplyToUserId(reply.userId);
                                          setReplyText("");
                                          setTimeout(() => {
                                            const textarea = document.getElementById(`reply-input-${comment.id}`);
                                            if (textarea) {
                                              textarea.focus();
                                            }
                                          }, 100);
                                        }
                                      }}
                                      className={`flex items-center gap-1 hover:text-zinc-300 transition-colors cursor-pointer bg-transparent border-none text-[9px] font-bold ${activeReplyTargetId === reply.id ? "text-pink-500" : "text-zinc-500"
                                        }`}
                                    >
                                      <CornerDownLeft size={10} />
                                      <span>Trả lời</span>
                                    </button>

                                    {/* More (Report/Delete) */}
                                    <div className="relative">
                                      <button
                                        type="button"
                                        onClick={() => setActiveMenuId(activeMenuId === reply.id ? null : reply.id)}
                                        className={`flex items-center gap-1 hover:text-zinc-300 transition-colors cursor-pointer bg-transparent border-none text-[9px] font-bold ${activeMenuId === reply.id ? "text-zinc-300" : "text-zinc-500"
                                          }`}
                                      >
                                        <MoreHorizontal size={10} />
                                        <span>Thêm</span>
                                      </button>

                                      {activeMenuId === reply.id && (
                                        <>
                                          {/* Transparent click-outside overlay */}
                                          <div className="fixed inset-0 z-40 bg-transparent cursor-default" onClick={() => setActiveMenuId(null)} />

                                          {/* Dropdown Box */}
                                          <div className="absolute left-0 mt-1 w-32 bg-[#0d0e13] border rounded-xl shadow-[0_0_15px_rgba(236,72,153,0.15)] p-1 z-50 animate-fadeIn flex flex-col gap-0.5" style={{ borderColor: "rgba(236, 72, 153, 0.25)" }}>
                                            {/* Delete option */}
                                            {user && (user.id === reply.userId || user.role === "admin") && (
                                              <button
                                                type="button"
                                                onClick={() => handleDeleteComment(reply.id)}
                                                className="w-full text-left px-2.5 py-1.5 hover:bg-red-500/10 hover:text-red-400 text-red-500/85 text-[10px] font-extrabold rounded-lg transition-colors cursor-pointer border-none bg-transparent"
                                              >
                                                Xóa phản hồi
                                              </button>
                                            )}

                                            {/* Report option */}
                                            {user && user.id !== reply.userId && (
                                              <button
                                                type="button"
                                                onClick={() => openReportModal(reply.id)}
                                                className="w-full text-left px-2.5 py-1.5 hover:bg-[#1b1d2a] hover:text-white text-zinc-400 text-[10px] font-extrabold rounded-lg transition-colors cursor-pointer border-none bg-transparent"
                                              >
                                                Báo xấu
                                              </button>
                                            )}

                                            {/* Unauthenticated fallback if guest clicks */}
                                            {!user && (
                                              <button
                                                type="button"
                                                onClick={() => window.dispatchEvent(new Event("dlowphim_open_auth"))}
                                                className="w-full text-left px-2.5 py-1.5 hover:bg-zinc-800 hover:text-white text-zinc-400 text-[10px] font-extrabold rounded-lg transition-colors cursor-pointer border-none bg-transparent"
                                              >
                                                Báo xấu
                                              </button>
                                            )}
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Reply Input Box (Neon Pink styling) - Dời xuống dưới cùng của thread comment */}
                      {replyToId === comment.id && (
                        <div className="ml-12 pl-1 animate-fadeIn mt-5.5">
                          <form onSubmit={(e) => handleSubmitReply(e, comment.id)}>
                            <div className="bg-[#13141d] border border-pink-500/20 focus-within:!border-pink-500 rounded-xl p-3 transition-all relative">
                              <div className="relative">
                                <textarea
                                  id={`reply-input-${comment.id}`}
                                  value={replyText}
                                  onChange={(e) => setReplyText(e.target.value.slice(0, 1000))}
                                  placeholder="Trả lời bình luận này..."
                                  className="w-full min-h-[70px] bg-transparent text-xs text-zinc-200 placeholder-zinc-550 focus:outline-none resize-none pr-16 font-medium leading-relaxed"
                                />
                                <span className="absolute top-0 right-0 text-[9px] font-bold text-zinc-650 select-none">
                                  {replyText.length} / 1000
                                </span>
                              </div>

                              <div className="flex items-center justify-between pt-2.5 border-t border-zinc-900/50">
                                {/* Spoiler toggle */}
                                <div
                                  onClick={() => setReplyIsSpoiler(!replyIsSpoiler)}
                                  className="flex items-center gap-2 select-none cursor-pointer"
                                >
                                  <div
                                    className={`w-7 h-4 rounded-full p-0.5 transition-colors duration-200 flex items-center ${replyIsSpoiler ? "bg-pink-500" : "bg-zinc-800"
                                      }`}
                                  >
                                    <div
                                      className={`w-3 h-3 rounded-full bg-white transition-transform duration-200 ${replyIsSpoiler ? "translate-x-3" : "translate-x-0"
                                        }`}
                                    />
                                  </div>
                                  <span className="text-[10px] font-extrabold text-zinc-400">Tiết lộ?</span>
                                </div>

                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setReplyToId(null);
                                      setActiveReplyTargetId(null);
                                      setReplyToUserId(null);
                                    }}
                                    className="bg-transparent border-none text-zinc-400 hover:text-white font-extrabold text-[10px] cursor-pointer"
                                  >
                                    Hủy
                                  </button>
                                  <button
                                    type="submit"
                                    disabled={!replyText.trim()}
                                    className="flex items-center gap-1.5 bg-transparent border-none text-pink-500 hover:text-pink-400 font-extrabold text-[10px] cursor-pointer disabled:opacity-40"
                                  >
                                    <span>Gửi</span>
                                    <Send size={11} className="text-pink-500 fill-pink-500/10 rotate-45 -translate-y-0.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </form>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* ══ TAB: ĐÁNH GIÁ ══ */}
      {activeTab === "rating" && (
        <div className="space-y-6">
          {/* Rating summary */}
          <div className="flex items-center gap-6 p-5 bg-[#13141d] rounded-2xl border border-zinc-900">
            <div className="text-center shrink-0">
              <div className="text-5xl font-black text-white tabular-nums leading-none">
                {ratingData.average > 0 ? ratingData.average.toFixed(1) : "—"}
              </div>
              <div className="text-[10px] font-bold text-zinc-500 mt-1.5 uppercase tracking-wider">/ 10 điểm</div>
              <div className="text-[9px] font-semibold text-zinc-600 mt-0.5">
                {ratingData.count} lượt đánh giá
              </div>
            </div>
            <div className="flex-1 space-y-1.5">
              <div className="flex gap-1 flex-wrap">
                {Array.from({ length: 10 }).map((_, i) => (
                  <Star
                    key={i}
                    size={18}
                    className={`transition-all ${i < Math.round(ratingData.average)
                      ? "fill-pink-500 text-pink-500"
                      : "text-zinc-700 fill-zinc-800"
                      }`}
                  />
                ))}
              </div>
              <p className="text-[11px] text-zinc-500 font-semibold leading-relaxed">
                {ratingData.userRating
                  ? `Bạn đã đánh giá ${ratingData.userRating}/10 ⭐`
                  : "Hãy là người đánh giá bộ phim này!"}
              </p>
            </div>
          </div>

          {/* Rating input */}
          <div className="space-y-3">
            <p className="text-xs font-black text-zinc-400 uppercase tracking-wider">
              {user
                ? ratingData.userRating
                  ? `Điểm của bạn: ${ratingData.userRating}/10`
                  : "Chấm điểm của bạn:"
                : "Đăng nhập để đánh giá:"}
            </p>

            {user ? (
              <div className="flex gap-1.5 flex-wrap" onMouseLeave={() => setHoverStar(0)}>
                {Array.from({ length: 10 }).map((_, i) => {
                  const val = i + 1;
                  const isHighlighted =
                    hoverStar > 0 ? val <= hoverStar : val <= (ratingData.userRating || 0);
                  return (
                    <button
                      key={val}
                      disabled={submittingRating}
                      onMouseEnter={() => setHoverStar(val)}
                      onClick={() => handleSubmitRating(val)}
                      className={`w-10 h-10 rounded-xl font-black text-sm transition-all border-none cursor-pointer select-none ${isHighlighted
                        ? "bg-pink-500 text-white shadow-md shadow-pink-500/20 scale-110"
                        : "bg-[#1b1d2a] text-zinc-500 hover:bg-pink-500/20 hover:text-pink-400"
                        } ${submittingRating ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      {val}
                    </button>
                  );
                })}
              </div>
            ) : (
              <button
                onClick={() => window.dispatchEvent(new Event("dlowphim_open_auth"))}
                className="flex items-center gap-2 bg-pink-500 hover:bg-pink-600 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl transition-all cursor-pointer border-none shadow-md shadow-pink-500/20"
              >
                <Star size={14} className="fill-white" />
                Đăng nhập để đánh giá
              </button>
            )}

            {hoverStar > 0 && (
              <p className="text-xs font-bold text-pink-400">
                {hoverStar === 10
                  ? "Tuyệt phẩm!"
                  : hoverStar >= 8
                    ? "Rất đáng xem!"
                    : hoverStar >= 6
                      ? "Khá hay"
                      : hoverStar >= 4
                        ? "Tạm được"
                        : "Chưa hấp dẫn"}{" "}
                — {hoverStar}/10
              </p>
            )}
          </div>
        </div>
      )}

      {/* ─── Reason Selection Modal for Report Comment ─── */}
      {reportModal.isOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center px-4 animate-fadeIn">
          <div
            onClick={() => setReportModal((prev: ReportModalState) => ({ ...prev, isOpen: false }))}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />
          <div className="relative w-full max-w-sm bg-[#0d0e13] border border-zinc-900 rounded-2xl p-6 shadow-2xl space-y-4 animate-scaleUp text-left">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/5 border border-red-500/10 flex items-center justify-center text-red-455 shrink-0">
                <ShieldAlert size={20} className="stroke-[2.5]" />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-zinc-150">Báo xấu bình luận</h4>
                <p className="text-[10px] text-zinc-500 mt-0.5 font-semibold">
                  Chọn lý do để giúp quản trị viên kiểm duyệt nhanh chóng.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {[
                "Spam / Quảng cáo không phù hợp",
                "Tiết lộ trước nội dung phim (Spoilers)",
                "Ngôn từ thô tục, xúc phạm người khác",
                "Nội dung khiêu dâm / Nhạy cảm",
                "Lý do khác"
              ].map((r: string) => (
                <label
                  key={r}
                  className="flex items-center gap-3 p-2.5 rounded-xl bg-[#13141d]/40 border border-zinc-900/60 hover:bg-[#13141d]/85 transition-colors cursor-pointer"
                >
                  <input
                    type="radio"
                    name="reportReason"
                    checked={reportModal.reason === r}
                    onChange={() => setReportModal((prev: ReportModalState) => ({ ...prev, reason: r }))}
                    className="accent-pink-500 cursor-pointer"
                  />
                  <span className="text-xs text-zinc-300 font-bold select-none">{r}</span>
                </label>
              ))}

              {reportModal.reason === "Lý do khác" && (
                <textarea
                  value={reportModal.customReason}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReportModal((prev: ReportModalState) => ({ ...prev, customReason: e.target.value.slice(0, 100) }))}
                  placeholder="Nhập lý do cụ thể của bạn (tối đa 100 ký tự)..."
                  className="w-full bg-[#13141d] border border-zinc-900/60 rounded-xl p-3 text-xs text-zinc-200 focus:outline-none focus:border-pink-500/50 resize-none h-18 font-semibold placeholder-zinc-650"
                />
              )}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setReportModal((prev: ReportModalState) => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-[11px] font-black rounded-lg transition-colors cursor-pointer border-none"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={reportModal.reason === "Lý do khác" && !reportModal.customReason.trim()}
                onClick={() => {
                  const finalReason = reportModal.reason === "Lý do khác" ? reportModal.customReason.trim() : reportModal.reason;
                  if (reportModal.commentId) {
                    handleReportComment(reportModal.commentId, finalReason);
                  }
                  setReportModal((prev: ReportModalState) => ({ ...prev, isOpen: false }));
                }}
                className="px-4 py-2 bg-pink-500 hover:bg-pink-600 disabled:opacity-50 text-white text-[11px] font-black rounded-lg transition-colors cursor-pointer border-none flex items-center justify-center"
              >
                Gửi báo cáo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
