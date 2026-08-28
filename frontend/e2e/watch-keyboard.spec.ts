import { expect, Page, test } from "@playwright/test";

const movie = {
  _id: "e2e-keyboard-movie",
  name: "Phim kiểm thử Keyboard Shortcuts",
  origin_name: "E2E Keyboard Movie",
  slug: "phim-kiem-thu-e2e",
  content: "Nội dung dùng để kiểm tra phím tắt player.",
  type: "series",
  status: "ongoing",
  thumb_url: "https://image.example/poster.jpg",
  poster_url: "https://image.example/backdrop.jpg",
  time: "24 phút/tập",
  episode_current: "Tập 1",
  episode_total: "12",
  year: 2026,
  actor: [],
  director: [],
  category: [{ name: "Hoạt Hình", slug: "hoat-hinh" }],
  country: [{ name: "Nhật Bản", slug: "nhat-ban" }],
  episodes: [
    {
      server_name: "Vietsub",
      server_data: [
        {
          name: "Tập 01",
          slug: "tap-01",
          link_embed: "https://embed.example/1",
          link_m3u8: "https://stream.example/1/master.m3u8",
        },
      ],
    },
  ],
};

async function mockBackend(page: Page) {
  await page.route(/https?:\/\/(?:localhost|127\.0\.0\.1):5000\/.*/, async (route) => {
    const url = new URL(route.request().url());
    let body: unknown = {};
    let status = 200;

    if (url.pathname.includes("/movies/check-blocked/")) body = { isBlocked: false };
    else if (url.pathname === "/movies/ophim-proxy") body = { status: true, movie, episodes: movie.episodes, _sourceId: "phimapi" };
    else if (url.pathname.includes("/movies/resolved-detail/")) body = { status: true, movie, episodes: movie.episodes, _sourceId: "ophim" };
    else if (url.pathname === "/playback-health/reputation") body = [];
    else if (url.pathname.startsWith("/auth/me")) status = 401;
    else if (url.pathname.startsWith("/notifications/")) body = { notifications: [], unreadCount: 0 };
    else if (url.pathname.startsWith("/movies/logo/")) body = {};
    else if (url.pathname.startsWith("/movies/credits/")) body = [];
    else if (url.pathname.startsWith("/movies/schedule/")) body = { state: "ongoing", source: "provider" };
    else if (url.pathname.startsWith("/ratings/")) body = { average: 0, count: 0 };
    else status = 404;

    await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.route("https://embed.example/**", (route) => route.abort());
  await page.route("https://image.example/**", (route) => route.abort());
  await page.route("https://stream.example/**", (route) => route.fulfill({
    status: 200,
    contentType: "application/vnd.apple.mpegurl",
    body: "#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:10\n#EXTINF:10,\nsegment.ts\n#EXT-X-ENDLIST",
  }));
}

async function installMockMedia(page: Page) {
  await page.addInitScript(() => {
    // 1. Mock Hls library with construct and load tracking
    type TestWindow = typeof window & {
      __watchHlsConstructCount?: number;
      __watchHlsLoadCount?: number;
    };
    const state = window as TestWindow;

    class MockHls {
      static Events = {
        ERROR: "hlsError",
        MANIFEST_PARSED: "hlsManifestParsed",
        FRAG_LOADED: "hlsFragLoaded",
        LEVEL_SWITCHED: "hlsLevelSwitched",
      };
      static ErrorTypes = { NETWORK_ERROR: "networkError", MEDIA_ERROR: "mediaError" };
      static ErrorDetails = { MANIFEST_LOAD_ERROR: "manifestLoadError" };
      static isSupported() { return true; }
      levels = [{ height: 720, bitrate: 1_500_000 }];
      currentLevel = -1;
      nextLevel = -1;

      constructor() {
        state.__watchHlsConstructCount = (state.__watchHlsConstructCount || 0) + 1;
      }
      loadSource() {
        state.__watchHlsLoadCount = (state.__watchHlsLoadCount || 0) + 1;
      }
      attachMedia(video: HTMLVideoElement) {
        if (!video) return;
        const target = video as HTMLVideoElement & {
          __mockMediaState?: { currentTime: number; paused: boolean; duration: number };
        };
        if (!target.__mockMediaState) {
          target.__mockMediaState = {
            currentTime: 0,
            paused: true,
            duration: 1200,
          };

          Object.defineProperty(target, "duration", {
            configurable: true,
            get() { return target.__mockMediaState?.duration ?? 1200; },
          });

          Object.defineProperty(target, "currentTime", {
            configurable: true,
            get() { return target.__mockMediaState?.currentTime ?? 0; },
            set(val: number) {
              if (!target.__mockMediaState) return;
              const duration = target.__mockMediaState.duration;
              target.__mockMediaState.currentTime = Math.max(0, Math.min(duration, Number(val) || 0));
              target.dispatchEvent(new Event("timeupdate"));
            },
          });

          Object.defineProperty(target, "paused", {
            configurable: true,
            get() { return target.__mockMediaState?.paused ?? true; },
            set(val: boolean) {
              if (target.__mockMediaState) {
                target.__mockMediaState.paused = Boolean(val);
              }
            },
          });

          Object.defineProperty(target, "readyState", {
            configurable: true,
            get() { return 4; },
          });

          Object.defineProperty(target, "networkState", {
            configurable: true,
            get() { return 1; },
          });

          target.play = function() {
            if (target.__mockMediaState) target.__mockMediaState.paused = false;
            target.dispatchEvent(new Event("play"));
            target.dispatchEvent(new Event("playing"));
            return Promise.resolve();
          };

          target.pause = function() {
            if (target.__mockMediaState) target.__mockMediaState.paused = true;
            target.dispatchEvent(new Event("pause"));
          };
        }
      }
      startLoad() {}
      stopLoad() {}
      recoverMediaError() {}
      on(event: string, callback: (event: string, data: unknown) => void) {
        if (event === "hlsManifestParsed") {
          window.setTimeout(() => callback(event, {}), 0);
        }
      }
      destroy() {}
    }
    (window as typeof window & { Hls?: unknown }).Hls = MockHls;

    // 2. HTMLMediaElement prototype mock to ensure all media instances default to valid headless playback state
    Object.defineProperty(HTMLMediaElement.prototype, "duration", {
      configurable: true,
      get() { return 1200; },
    });

    Object.defineProperty(HTMLMediaElement.prototype, "readyState", {
      configurable: true,
      get() { return 4; },
    });

    Object.defineProperty(HTMLMediaElement.prototype, "networkState", {
      configurable: true,
      get() { return 1; },
    });
  });

  await page.route("https://cdn.jsdelivr.net/**", (route) => route.fulfill({
    status: 200,
    contentType: "application/javascript",
    body: "window.Hls = window.Hls || class MockHls { static isSupported() { return true; } };",
  }));
}

test("Desktop Keyboard Shortcuts with Real Plyr DOM: Space and Arrow keys work when settings closed, blocked when settings or modal open", async ({ page }) => {
  await installMockMedia(page);
  await mockBackend(page);
  await page.setViewportSize({ width: 1280, height: 800 });

  await page.goto("/watch/phim-kiem-thu-e2e");
  await expect(page.getByText("Phim kiểm thử Keyboard Shortcuts", { exact: false }).first()).toBeVisible();
  await expect(page.locator("#dlow-hls-video")).toHaveCount(1);
  await expect(page.locator(".plyr .plyr__controls")).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const w = window as typeof window & { __watchHlsLoadCount?: number };
    const video = document.querySelector("#dlow-hls-video") as HTMLVideoElement | null;
    return (w.__watchHlsLoadCount || 0) >= 1 && Boolean(video && (video as any).__mockMediaState);
  })).toBe(true);

  // Đảm bảo focus ở body ngữ cảnh player trước khi gửi shortcut
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());

  const getMediaSnapshot = async () => {
    return page.evaluate(() => {
      const video = document.querySelector("#dlow-hls-video") as HTMLVideoElement | null;
      return {
        currentTime: video?.currentTime ?? 0,
        paused: video?.paused ?? true,
      };
    });
  };

  // A. Khởi tạo ban đầu: Menu ẩn trong DOM
  await expect.poll(async () => (await getMediaSnapshot()).paused).toBe(true);
  await expect.poll(async () => (await getMediaSnapshot()).currentTime).toBe(0);

  // 1. Phím Space -> Video chuyển sang play (paused = false, currentTime = 0)
  await page.keyboard.press("Space");
  await expect.poll(async () => (await getMediaSnapshot()).paused).toBe(false);
  expect((await getMediaSnapshot()).currentTime).toBe(0);

  // 2. Phím ArrowRight -> tua +5s (0 -> 5)
  await page.keyboard.press("ArrowRight");
  await expect.poll(async () => (await getMediaSnapshot()).currentTime).toBe(5);
  expect((await getMediaSnapshot()).paused).toBe(false);

  // 3. Phím ArrowRight lần nữa -> tua +5s (5 -> 10)
  await page.keyboard.press("ArrowRight");
  await expect.poll(async () => (await getMediaSnapshot()).currentTime).toBe(10);
  expect((await getMediaSnapshot()).paused).toBe(false);

  // 4. Phím ArrowLeft -> tua -5s (10 -> 5)
  await page.keyboard.press("ArrowLeft");
  await expect.poll(async () => (await getMediaSnapshot()).currentTime).toBe(5);
  expect((await getMediaSnapshot()).paused).toBe(false);

  // 5. Phím Space -> toggle sang pause (true) để chuẩn bị mở settings mà controls không bị autohide
  await page.keyboard.press("Space");
  await expect.poll(async () => (await getMediaSnapshot()).paused).toBe(true);
  expect((await getMediaSnapshot()).currentTime).toBe(5);

  // B. Mở Settings Plyr thật:
  const settingsBtn = page.locator(".plyr__menu > button[data-plyr='settings']");
  await expect(settingsBtn).toBeVisible();
  await settingsBtn.click();
  await expect(settingsBtn).toHaveAttribute("aria-expanded", "true");

  // Đưa focus ra khỏi nút để kiểm tra guard độc lập với tag button, giữ settings mở
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await page.waitForTimeout(50);
  await expect(settingsBtn).toHaveAttribute("aria-expanded", "true");

  // Kiểm tra từng phím khi settings mở (assert ngay sau từng phím):
  // - ArrowRight -> currentTime không đổi (5)
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(50);
  expect((await getMediaSnapshot()).currentTime).toBe(5);

  // - ArrowLeft -> currentTime không đổi (5)
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(50);
  expect((await getMediaSnapshot()).currentTime).toBe(5);

  // - Space -> paused không đổi (true)
  await page.keyboard.press("Space");
  await page.waitForTimeout(50);
  expect((await getMediaSnapshot()).paused).toBe(true);

  // C. Đóng Settings menu:
  await settingsBtn.click();
  await expect(settingsBtn).toHaveAttribute("aria-expanded", "false");
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await page.waitForTimeout(100);

  // Sau khi đóng settings: Từng phím tạo đúng tác dụng
  // - ArrowRight -> tua +5s (5 -> 10)
  await page.keyboard.press("ArrowRight");
  await expect.poll(async () => (await getMediaSnapshot()).currentTime).toBe(10);

  // - ArrowLeft -> tua -5s (10 -> 5)
  await page.keyboard.press("ArrowLeft");
  await expect.poll(async () => (await getMediaSnapshot()).currentTime).toBe(5);

  // - Space -> toggle sang play (false)
  await page.keyboard.press("Space");
  await expect.poll(async () => (await getMediaSnapshot()).paused).toBe(false);

  // D. Mở Modal Báo Lỗi:
  const reportBtn = page.getByRole("button", { name: "Báo lỗi" });
  await expect(reportBtn).toBeVisible();
  await reportBtn.click();
  await expect(page.getByText("Báo cáo lỗi phim")).toBeVisible();

  // Đưa focus ra khỏi input/button trong modal nhưng giữ modal hiển thị
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await page.waitForTimeout(50);
  await expect(page.getByText("Báo cáo lỗi phim")).toBeVisible();

  // Kiểm tra từng phím khi modal mở (assert ngay sau từng phím):
  // - ArrowRight -> currentTime không đổi (5)
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(50);
  expect((await getMediaSnapshot()).currentTime).toBe(5);

  // - ArrowLeft -> currentTime không đổi (5)
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(50);
  expect((await getMediaSnapshot()).currentTime).toBe(5);

  // - Space -> paused không đổi (false)
  await page.keyboard.press("Space");
  await page.waitForTimeout(50);
  expect((await getMediaSnapshot()).paused).toBe(false);

  // E. Đóng Modal Báo Lỗi bằng nút "Hủy bỏ":
  const cancelBtn = page.getByRole("button", { name: "Hủy bỏ" });
  await expect(cancelBtn).toBeVisible();
  await cancelBtn.click();
  await expect(page.getByText("Báo cáo lỗi phim")).toBeHidden();

  // Trả focus về body
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await page.waitForTimeout(100);

  // Sau khi đóng modal: Từng phím tạo đúng tác dụng
  // - Space -> toggle sang pause (true)
  await page.keyboard.press("Space");
  await expect.poll(async () => (await getMediaSnapshot()).paused).toBe(true);

  // - ArrowRight -> tua +5s (5 -> 10)
  await page.keyboard.press("ArrowRight");
  await expect.poll(async () => (await getMediaSnapshot()).currentTime).toBe(10);

  // - ArrowLeft -> tua -5s (10 -> 5)
  await page.keyboard.press("ArrowLeft");
  await expect.poll(async () => (await getMediaSnapshot()).currentTime).toBe(5);
});
