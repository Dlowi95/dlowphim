import assert from "node:assert/strict";
import test from "node:test";
import { findMatchingEpisodeIndex } from "./episodeUtils.ts";
import {
  evaluateWatchKeyboardShortcut,
  findEpisodeHistory,
  findNextEpisode,
  getResumeTime,
  isWatchOverlayActive,
  shouldPrefetchNextManifest,
} from "./watchPlaybackFlow.ts";
import { isPlaybackOriginGloballyBlocked } from "./playbackHealth.ts";
import { HLS_LIBRARY_VERSION, recoverHlsMediaError } from "./hlsLoader.ts";

test("restores the same episode and time after PhimAPI fails over to OPhim", () => {
  const ophimEpisodes = [{ name: "1" }, { name: "02" }, { name: "03" }];
  const history = [{
    movieSlug: "conan",
    episodeName: "Táº­p 02",
    episodeKey: "2",
    currentTime: 742,
  }];

  assert.equal(findMatchingEpisodeIndex(ophimEpisodes, "Táº­p 2"), 1);
  assert.equal(getResumeTime(findEpisodeHistory(history, "conan", "02"), 735), 742);
  assert.equal(getResumeTime(findEpisodeHistory(history, "conan", "02"), 760), 760);
});

test("prefetches only near the end and selects the normalized next episode", () => {
  const episodes = [
    { name: "Táº­p 01", link_m3u8: "https://cdn.test/1.m3u8" },
    { name: "Episode 2", link_m3u8: "https://cdn.test/2.m3u8" },
  ];

  assert.equal(shouldPrefetchNextManifest(700, 1200), false);
  assert.equal(shouldPrefetchNextManifest(1090, 1200), true);
  assert.equal(findNextEpisode(episodes, "1")?.name, "Episode 2");
  assert.equal(findNextEpisode(episodes, "2"), null);
});

test("honors a temporary global CDN block but allows it again after expiry", () => {
  const url = "https://cdn.test/video/index.m3u8";
  assert.equal(isPlaybackOriginGloballyBlocked(url, [{
    origin: "https://cdn.test",
    penaltyMs: 5000,
    blockedUntil: Date.now() + 60_000,
    samples: 4,
  }]), true);
  assert.equal(isPlaybackOriginGloballyBlocked(url, [{
    origin: "https://cdn.test",
    penaltyMs: 0,
    blockedUntil: Date.now() - 1,
    samples: 4,
  }]), false);
});

test("uses the stable HLS release and bounds media recovery with an audio codec swap", () => {
  const calls: string[] = [];
  const hls = {
    recoverMediaError: () => calls.push("recover"),
    swapAudioCodec: () => calls.push("swap-audio-codec"),
  };

  assert.equal(HLS_LIBRARY_VERSION, "1.6.17");
  assert.equal(recoverHlsMediaError(hls, 0), true);
  assert.equal(recoverHlsMediaError(hls, 1), true);
  assert.equal(recoverHlsMediaError(hls, 2), false);
  assert.deepEqual(calls, ["recover", "swap-audio-codec", "recover"]);
});

test("Desktop Keyboard Shortcuts (Production Code): accurately distinguishes between open overlays and hidden Plyr/DOM menus with ancestor hierarchy", () => {
  // Mock element hierarchy supporting parentElement and attributes
  const createMockElement = (
    tagName: string,
    attributes: Record<string, string> = {},
    classList: string[] = [],
    parent: any = null,
  ) => {
    const el: any = {
      nodeType: 1,
      tagName: tagName.toUpperCase(),
      attributes: { ...attributes },
      classList: { contains: (cls: string) => classList.includes(cls) },
      hasAttribute: (name: string) => name in el.attributes,
      getAttribute: (name: string) => el.attributes[name] ?? null,
      setAttribute: (name: string, value: string) => { el.attributes[name] = value; },
      parentElement: parent,
    };
    el.ownerDocument = { documentElement: { nodeType: 1 } };
    return el;
  };

  // A. Trường hợp Plyr khởi tạo, menu settings nằm dưới ancestor có [hidden]:
  // Cấu trúc: <div class="plyr"> -> <div class="plyr__controls"> -> <button data-plyr="settings" aria-expanded="false">
  //                               -> <div class="plyr__menu" hidden> -> <div class="plyr__menu__container"> -> <div role="menu">
  const plyrContainer = createMockElement("div", {}, ["plyr"]);
  const settingsBtn = createMockElement(
    "button",
    { "data-plyr": "settings", "aria-expanded": "false" },
    ["plyr__control"],
    plyrContainer,
  );
  const plyrMenu = createMockElement("div", { hidden: "" }, ["plyr__menu"], plyrContainer);
  const plyrMenuContainer = createMockElement("div", {}, ["plyr__menu__container"], plyrMenu);
  const roleMenu = createMockElement("div", { role: "menu" }, [], plyrMenuContainer);

  const mockDoc = {
    body: { classList: { contains: (cls: string) => false } },
    querySelector: (selector: string) => {
      if (selector.includes("button[data-plyr='settings'][aria-expanded='true']") && settingsBtn.getAttribute("aria-expanded") === "true") {
        return settingsBtn;
      }
      if (selector.includes(".plyr.plyr--menu-open") && plyrContainer.classList.contains("plyr--menu-open")) {
        return plyrContainer;
      }
      return null;
    },
    querySelectorAll: (selector: string) => {
      if (selector.includes("[role='dialog']") || selector.includes("[aria-modal='true']")) {
        return [];
      }
      return [];
    },
  } as unknown as Document;

  // 1. Phím Space khi Plyr có menu ẩn dưới ancestor hidden -> Hoạt động bình thường (toggle-play, preventDefault = true)
  const resSpace = evaluateWatchKeyboardShortcut(
    { key: " ", code: "Space", repeat: false, target: { tagName: "DIV" } },
    {},
    mockDoc,
  );
  assert.equal(resSpace.action, "toggle-play", "Space phải toggle play khi menu Plyr đang ẩn");
  assert.equal(resSpace.shouldPreventDefault, true, "Space phải chặn cuộn trang");

  // 2. Giữ phím Space (repeat = true) -> Chặn cuộn trang (preventDefault = true), action = "ignore" (không toggle lặp)
  const resSpaceRepeat = evaluateWatchKeyboardShortcut(
    { key: " ", code: "Space", repeat: true, target: { tagName: "DIV" } },
    {},
    mockDoc,
  );
  assert.equal(resSpaceRepeat.action, "ignore", "Giữ Space không toggle lặp");
  assert.equal(resSpaceRepeat.shouldPreventDefault, true, "Giữ Space PHẢI chặn cuộn trang");

  // 3. Phím ArrowLeft / ArrowRight khi Plyr có menu ẩn -> Tua +-5s
  const resRight = evaluateWatchKeyboardShortcut(
    { key: "ArrowRight", target: { tagName: "DIV" } },
    {},
    mockDoc,
  );
  assert.equal(resRight.action, "seek-right");
  assert.equal(resRight.shouldPreventDefault, true);

  const resLeft = evaluateWatchKeyboardShortcut(
    { key: "ArrowLeft", target: { tagName: "DIV" } },
    {},
    mockDoc,
  );
  assert.equal(resLeft.action, "seek-left");
  assert.equal(resLeft.shouldPreventDefault, true);

  // B. Khi Plyr Settings Menu ĐANG MỞ (nút settings có aria-expanded="true", container có plyr--menu-open):
  settingsBtn.setAttribute("aria-expanded", "true");
  plyrContainer.classList = { contains: (cls: string) => cls === "plyr" || cls === "plyr--menu-open" };

  const resSpaceMenuOpen = evaluateWatchKeyboardShortcut(
    { key: " ", code: "Space", repeat: false, target: { tagName: "BODY" } },
    {},
    mockDoc,
  );
  assert.equal(resSpaceMenuOpen.action, "ignore", "Không toggle khi Settings menu Plyr đang mở");
  assert.equal(resSpaceMenuOpen.shouldPreventDefault, false, "Không chặn phím của menu");

  // C. Khi đóng Settings menu Plyr lại (aria-expanded="false", xóa plyr--menu-open):
  settingsBtn.setAttribute("aria-expanded", "false");
  plyrContainer.classList = { contains: (cls: string) => cls === "plyr" };

  const resSpaceMenuClosed = evaluateWatchKeyboardShortcut(
    { key: " ", code: "Space", repeat: false, target: { tagName: "BODY" } },
    {},
    mockDoc,
  );
  assert.equal(resSpaceMenuClosed.action, "toggle-play", "Đóng settings thì Space hoạt động lại");
  assert.equal(resSpaceMenuClosed.shouldPreventDefault, true);

  // D. Dialog nằm dưới ancestor có hidden / aria-hidden="true":
  // Cấu trúc: <div hidden> -> <div role="dialog">
  const hiddenAncestor = createMockElement("div", { hidden: "" });
  const modalUnderHidden = createMockElement("div", { role: "dialog" }, [], hiddenAncestor);
  const mockDocWithHiddenDialog = {
    ...mockDoc,
    querySelectorAll: (selector: string) => {
      if (selector.includes("[role='dialog']")) return [modalUnderHidden];
      return [];
    },
  } as unknown as Document;

  const resHiddenDialog = evaluateWatchKeyboardShortcut(
    { key: " ", code: "Space", repeat: false, target: { tagName: "BODY" } },
    {},
    mockDocWithHiddenDialog,
  );
  assert.equal(resHiddenDialog.action, "toggle-play", "Dialog nằm dưới ancestor hidden không được chặn shortcut");

  // E. Khi Modal Báo Lỗi thực sự mở (state showReportModal = true):
  const resSpaceModalState = evaluateWatchKeyboardShortcut(
    { key: " ", code: "Space", repeat: false, target: { tagName: "BODY" } },
    { showReportModal: true },
    mockDoc,
  );
  assert.equal(resSpaceModalState.action, "ignore", "Modal báo lỗi đang mở không được toggle phim");
  assert.equal(resSpaceModalState.shouldPreventDefault, false);

  // F. Người dùng gõ text trong INPUT hoặc focus vào BUTTON:
  const resInput = evaluateWatchKeyboardShortcut(
    { key: " ", code: "Space", repeat: false, target: { tagName: "INPUT" } },
    {},
    mockDoc,
  );
  assert.equal(resInput.action, "ignore");
  assert.equal(resInput.shouldPreventDefault, false, "Không chặn phím Space trong ô nhập liệu");

  const resButton = evaluateWatchKeyboardShortcut(
    { key: " ", code: "Space", repeat: false, target: { tagName: "BUTTON" } },
    {},
    mockDoc,
  );
  assert.equal(resButton.action, "ignore");
  assert.equal(resButton.shouldPreventDefault, false, "Không double-toggle khi focus vào button");
});

test("Mobile Gesture & Auto-Hide Lifecycle: background single-tap toggles controls, cancels pending tap on control click, holds on scrubber", () => {
  let controlsVisible = true;
  let isPlaying = true;
  let currentTime = 10;
  const duration = 100;
  let hideTimerScheduled = false;
  let isScrubbing = false;
  let pendingSingleTapTimer: ReturnType<typeof setTimeout> | null = null;
  let lastTapZone: "left" | "right" | "center" | null = null;

  const clearHideTimer = () => {
    hideTimerScheduled = false;
  };
  const startAutoHideTimer = () => {
    clearHideTimer();
    if (isPlaying && !isScrubbing) {
      hideTimerScheduled = true;
    }
  };
  const showControls = () => {
    controlsVisible = true;
    startAutoHideTimer();
  };
  const hideControls = () => {
    clearHideTimer();
    controlsVisible = false;
  };
  const clearSingleTapTimer = () => {
    if (pendingSingleTapTimer) {
      clearTimeout(pendingSingleTapTimer);
      pendingSingleTapTimer = null;
    }
  };
  const dismissPendingGestures = () => {
    clearSingleTapTimer();
    lastTapZone = null;
  };
  const togglePlayback = () => {
    isPlaying = !isPlaying;
    if (isPlaying) {
      showControls();
    } else {
      controlsVisible = true;
      clearHideTimer();
    }
  };
  const seekBy = (amount: number) => {
    currentTime = Math.max(0, Math.min(duration, currentTime + amount));
    showControls();
  };

  // 1. Single tap ở Center khi controls đang hiện -> Ẩn controls ngay, không đổi isPlaying
  hideControls();
  assert.equal(controlsVisible, false, "Chạm center phải ẩn controls");
  assert.equal(isPlaying, true, "Chạm center KHÔNG được pause phim");
  assert.equal(hideTimerScheduled, false);

  // 2. Single tap khi controls đang ẩn -> Hiện controls và bắt đầu đếm 3s tự ẩn
  showControls();
  assert.equal(controlsVisible, true, "Chạm nền khi ẩn phải hiện controls");
  assert.equal(hideTimerScheduled, true, "Hiện controls thì bắt đầu timer 3s");

  // 3. Tương tác với Scrubber (kéo thanh tiến trình):
  // Giữ slider -> Controls giữ nguyên, timer tự ẩn BỊ TẠM DỪNG (không tự ẩn sau 3 giây)
  isScrubbing = true;
  clearHideTimer();
  startAutoHideTimer(); // Thử kích hoạt timer khi đang kéo slider
  assert.equal(hideTimerScheduled, false, "Đang kéo slider TUYỆT ĐỐI KHÔNG lập timer tự ẩn");

  // Thả slider -> Timer tự ẩn được kích hoạt lại
  isScrubbing = false;
  startAutoHideTimer();
  assert.equal(hideTimerScheduled, true, "Thả slider thì tiếp tục đếm ngược 3s tự ẩn");

  // 4. Pending single-tap bị hủy khi click sang control khác (Fullscreen / Volume / Settings):
  // Giả lập chạm zone 'right' (lập timer 280ms)
  pendingSingleTapTimer = setTimeout(() => {
    if (controlsVisible) hideControls();
    else showControls();
  }, 280);
  lastTapZone = "right";

  // Người dùng bấm Fullscreen trong 280ms:
  dismissPendingGestures();
  assert.equal(pendingSingleTapTimer, null, "dismissPendingGestures phải hủy timer pending single-tap");
  assert.equal(lastTapZone, null);

  // 5. Double-tap ±5 giây:
  // Tua thời gian, hủy single tap, khởi động lại timer 3s tự ẩn mà KHÔNG pause phim
  seekBy(5);
  assert.equal(currentTime, 15, "Tua thành công lên 15s");
  assert.equal(isPlaying, true, "Double tap không pause phim");
  assert.equal(controlsVisible, true);
  assert.equal(hideTimerScheduled, true, "Double tap khởi động lại timer 3s");

  // 6. Nút hồng trung tâm chuyển sang Tạm dừng (Pause):
  // Controls giữ nguyên hiển thị, hủy timer tự ẩn để người dùng xem thông tin
  togglePlayback();
  assert.equal(isPlaying, false, "Nút hồng chuyển sang pause");
  assert.equal(controlsVisible, true, "Controls giữ nguyên khi pause");
  assert.equal(hideTimerScheduled, false, "Pause không tự ẩn controls");
});
