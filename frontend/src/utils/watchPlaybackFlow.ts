import { normalizeEpisodeKey } from "./episodeUtils.ts";

interface EpisodeLike {
  name: string;
  link_m3u8?: string;
}

interface HistoryLike {
  movieSlug?: string;
  episodeName?: string;
  episodeKey?: string;
  currentTime?: number;
  updatedAt?: string | number | Date;
}

export function findEpisodeHistory(
  history: HistoryLike[] | undefined,
  movieSlug: string,
  episodeName: string,
) {
  if (!Array.isArray(history)) return null;
  const episodeKey = normalizeEpisodeKey(episodeName);
  const latestMovieItem = history
    .filter((item) => item.movieSlug === movieSlug)
    .sort(
      (left, right) =>
        new Date(right.updatedAt || 0).getTime() -
        new Date(left.updatedAt || 0).getTime(),
    )[0];
  if (!latestMovieItem) return null;
  return normalizeEpisodeKey(
    latestMovieItem.episodeKey || latestMovieItem.episodeName || "",
  ) === episodeKey ? latestMovieItem : null;
}

export function getResumeTime(
  historyItem: HistoryLike | null,
  failoverTime = 0,
) {
  const savedTime = Number(historyItem?.currentTime) > 5
    ? Number(historyItem?.currentTime)
    : 0;
  return Math.max(savedTime, Number.isFinite(failoverTime) ? failoverTime : 0);
}

export function findNextEpisode<T extends EpisodeLike>(
  sortedEpisodes: T[],
  currentEpisodeName: string,
) {
  const currentKey = normalizeEpisodeKey(currentEpisodeName);
  const currentIndex = sortedEpisodes.findIndex(
    (episode) => normalizeEpisodeKey(episode.name) === currentKey,
  );
  return currentIndex >= 0 ? sortedEpisodes[currentIndex + 1] || null : null;
}

export function shouldPrefetchNextManifest(currentTime: number, duration: number) {
  return Number.isFinite(currentTime) &&
    Number.isFinite(duration) &&
    duration > 0 &&
    currentTime >= duration * 0.8 &&
    duration - currentTime <= 120;
}

export interface WatchOverlayState {
  showReportModal?: boolean;
  showEpisodeDrawer?: boolean;
  showMobileServerPicker?: boolean;
  showPlaylistDropdown?: boolean;
  isCreatingPlaylist?: boolean;
}

/**
 * Kiểm tra xem một phần tử DOM có thực sự đang hiển thị hay không
 * (kiểm tra cả chính phần tử đó lẫn toàn bộ cây ancestor của nó xem có bị hidden, aria-hidden="true", class="hidden" hoặc display:none hay không).
 */
export function isElementEffectivelyVisible(element: HTMLElement | null): boolean {
  if (!element) return false;
  let current: HTMLElement | null = element;
  const doc = element.ownerDocument;
  const root = doc?.documentElement;

  while (current && current !== root && current.nodeType === 1) {
    if (
      current.hasAttribute("hidden") ||
      current.getAttribute("aria-hidden") === "true" ||
      current.classList?.contains("hidden")
    ) {
      return false;
    }

    if (typeof window !== "undefined" && typeof window.getComputedStyle === "function") {
      try {
        const style = window.getComputedStyle(current);
        if (style.display === "none" || style.visibility === "hidden") {
          return false;
        }
      } catch {
        // Fallback nếu mock DOM không hỗ trợ getComputedStyle đầy đủ
      }
    }

    current = current.parentElement;
  }
  return true;
}

/**
 * Kiểm tra xem có overlay/modal/menu nào đang thực sự mở hay không.
 * Phân biệt chính xác giữa các phần tử đang mở với các node menu Plyr/dialog đang ở trạng thái ẩn (hidden/aria-hidden/closed).
 */
export function isWatchOverlayActive(
  state: WatchOverlayState = {},
  doc: Document | null = typeof document !== "undefined" ? document : null,
): boolean {
  if (
    state.showReportModal ||
    state.showEpisodeDrawer ||
    state.showMobileServerPicker ||
    state.showPlaylistDropdown ||
    state.isCreatingPlaylist
  ) {
    return true;
  }
  if (!doc) return false;

  // Mobile watch settings overlay
  if (
    doc.body?.classList.contains("dlowphim-watch-settings-open") ||
    Boolean(doc.querySelector("[data-mobile-watch-settings='true']"))
  ) {
    return true;
  }

  // Plyr settings menu đang mở (khi mở: nút có aria-expanded="true" hoặc container player có class plyr--menu-open)
  const plyrSettingsOpen = doc.querySelector(
    ".plyr.plyr--menu-open, .plyr button[data-plyr='settings'][aria-expanded='true']",
  );
  if (plyrSettingsOpen && isElementEffectivelyVisible(plyrSettingsOpen as HTMLElement)) {
    return true;
  }

  // Modal / dialog chung đang mở (kiểm tra phần tử và toàn bộ ancestor không bị ẩn)
  const dialogs = doc.querySelectorAll<HTMLElement>(
    "[role='dialog'], [aria-modal='true'], .modal",
  );
  for (let i = 0; i < dialogs.length; i++) {
    const dialog = dialogs[i];
    if (isElementEffectivelyVisible(dialog)) {
      return true;
    }
  }

  return false;
}

export interface WatchKeyboardShortcutEvent {
  key: string;
  code?: string;
  repeat?: boolean;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  target?: EventTarget | { tagName?: string; isContentEditable?: boolean } | null;
}

export type WatchShortcutAction = "toggle-play" | "seek-left" | "seek-right" | "ignore";

export function evaluateWatchKeyboardShortcut(
  event: WatchKeyboardShortcutEvent,
  overlayState: WatchOverlayState = {},
  doc: Document | null = typeof document !== "undefined" ? document : null,
): { action: WatchShortcutAction; shouldPreventDefault: boolean } {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
    return { action: "ignore", shouldPreventDefault: false };
  }

  const element = event.target as { tagName?: string; isContentEditable?: boolean } | null | undefined;
  const tagName = element?.tagName?.toUpperCase();
  // Guard 1: Người dùng đang thao tác nhập liệu hoặc các control form/button
  if (
    element?.isContentEditable ||
    tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    tagName === "SELECT" ||
    tagName === "BUTTON"
  ) {
    return { action: "ignore", shouldPreventDefault: false };
  }

  // Guard 2: Kiểm tra modal/menu/drawer đang mở (cả state và DOM)
  if (isWatchOverlayActive(overlayState, doc)) {
    return { action: "ignore", shouldPreventDefault: false };
  }

  // Xử lý phím Space
  if (event.code === "Space" || event.key === " " || event.key === "Spacebar") {
    // Trong ngữ cảnh hợp lệ của player: luôn chặn cuộn trang
    // Nếu đang giữ phím (repeat): chỉ chặn cuộn trang, không toggle lặp lại
    return {
      action: event.repeat ? "ignore" : "toggle-play",
      shouldPreventDefault: true,
    };
  }

  // Xử lý phím ArrowLeft / ArrowRight
  if (event.key === "ArrowLeft") {
    return { action: "seek-left", shouldPreventDefault: true };
  }
  if (event.key === "ArrowRight") {
    return { action: "seek-right", shouldPreventDefault: true };
  }

  return { action: "ignore", shouldPreventDefault: false };
}
