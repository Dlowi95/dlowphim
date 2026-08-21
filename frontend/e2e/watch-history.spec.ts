import { expect, Page, test } from "@playwright/test";

const movie = {
  _id: "e2e-movie",
  name: "Phim kiểm thử E2E",
  origin_name: "E2E Movie",
  slug: "phim-kiem-thu-e2e",
  content: "Nội dung dùng để kiểm tra luồng xem phim.",
  type: "series",
  status: "ongoing",
  thumb_url: "https://image.example/poster.jpg",
  poster_url: "https://image.example/backdrop.jpg",
  time: "24 phút/tập",
  episode_current: "Tập 2",
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
        { name: "Tập 01", slug: "tap-01", link_embed: "https://embed.example/1", link_m3u8: "" },
        { name: "Tập 02", slug: "tap-02", link_embed: "https://embed.example/2", link_m3u8: "" },
      ],
    },
  ],
};

async function mockBackend(
  page: Page,
  authenticatedHistory: unknown[] = [],
  movieFixture = movie,
  authDelayMs = 0,
) {
  await page.route(/https?:\/\/(?:localhost|127\.0\.0\.1):5000\/.*/, async (route) => {
    const url = new URL(route.request().url());
    let body: unknown = {};
    let status = 200;

    if (url.pathname.includes("/movies/check-blocked/")) body = { isBlocked: false };
    else if (url.pathname === "/movies/ophim-proxy") body = { status: true, movie: movieFixture, episodes: movieFixture.episodes, _sourceId: "phimapi" };
    else if (url.pathname.includes("/movies/resolved-detail/")) body = { status: true, movie: movieFixture, episodes: movieFixture.episodes, _sourceId: "ophim" };
    else if (url.pathname === "/playback-health/reputation") body = [];
    else if (url.pathname.startsWith("/auth/me")) {
      if (authDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, authDelayMs));
      if (authenticatedHistory.length > 0) {
        body = {
          id: "e2e-user",
          email: "e2e@example.com",
          displayName: "E2E User",
          role: "user",
          favorites: [],
          watchHistory: authenticatedHistory,
        };
      } else status = 401;
    }
    else if (url.pathname === "/auth/history/update") body = { watchHistory: [] };
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
}

const hlsMovie = {
  ...movie,
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
        {
          name: "Tập 02",
          slug: "tap-02",
          link_embed: "https://embed.example/2",
          link_m3u8: "https://stream.example/2/master.m3u8",
        },
      ],
    },
  ],
};

async function installFailingHls(page: Page) {
  await page.addInitScript(() => {
    class FailingHls {
      static Events = {
        ERROR: "hlsError",
        MANIFEST_PARSED: "hlsManifestParsed",
        FRAG_LOADED: "hlsFragLoaded",
        LEVEL_SWITCHED: "hlsLevelSwitched",
      };
      static ErrorTypes = { NETWORK_ERROR: "networkError", MEDIA_ERROR: "mediaError" };
      static ErrorDetails = { MANIFEST_LOAD_ERROR: "manifestLoadError" };
      static isSupported() { return true; }
      levels: unknown[] = [];
      currentLevel = -1;
      nextLevel = -1;
      private timers: number[] = [];
      loadSource() {
        const state = window as typeof window & { __watchHlsLoadCount?: number };
        state.__watchHlsLoadCount = (state.__watchHlsLoadCount || 0) + 1;
      }
      attachMedia() {}
      startLoad() {}
      recoverMediaError() {}
      on(event: string, callback: (event: string, data: unknown) => void) {
        if (event !== "hlsError") return;
        [50, 750, 2050].forEach((delay) => {
          this.timers.push(window.setTimeout(() => callback(event, {
            fatal: true,
            type: "networkError",
            details: "manifestLoadError",
          }), delay));
        });
      }
      destroy() { this.timers.forEach((timer) => window.clearTimeout(timer)); }
    }
    (window as typeof window & { Hls?: unknown }).Hls = FailingHls;
  });
}

async function installControllableNetworkHls(page: Page, initialOnline = true) {
  await page.addInitScript((onlineAtStart) => {
    type NetworkTestWindow = typeof window & {
      __watchHlsLoadCount?: number;
      __watchHlsDestroyCount?: number;
      __watchHlsStopCount?: number;
      __watchEmitNetworkError?: () => void;
      __watchSetOnline?: (online: boolean) => void;
    };
    const state = window as NetworkTestWindow;
    let online = onlineAtStart;

    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      get: () => online,
    });
    state.__watchSetOnline = (nextOnline: boolean) => {
      online = nextOnline;
      window.dispatchEvent(new Event(nextOnline ? "online" : "offline"));
    };

    class ControllableNetworkHls {
      static Events = {
        ERROR: "hlsError",
        MANIFEST_PARSED: "hlsManifestParsed",
        FRAG_LOADED: "hlsFragLoaded",
        LEVEL_SWITCHED: "hlsLevelSwitched",
      };
      static ErrorTypes = { NETWORK_ERROR: "networkError", MEDIA_ERROR: "mediaError" };
      static ErrorDetails = { MANIFEST_LOAD_ERROR: "manifestLoadError" };
      static isSupported() { return true; }
      levels: unknown[] = [];
      currentLevel = -1;
      nextLevel = -1;
      private errorHandler?: (event: string, data: unknown) => void;

      loadSource() {
        state.__watchHlsLoadCount = (state.__watchHlsLoadCount || 0) + 1;
      }
      attachMedia() {}
      startLoad() {}
      stopLoad() {
        state.__watchHlsStopCount = (state.__watchHlsStopCount || 0) + 1;
      }
      recoverMediaError() {}
      on(event: string, callback: (event: string, data: unknown) => void) {
        if (event !== "hlsError") return;
        this.errorHandler = callback;
        state.__watchEmitNetworkError = () => callback(event, {
          fatal: true,
          type: "networkError",
          details: "manifestLoadError",
        });
      }
      destroy() {
        state.__watchHlsDestroyCount = (state.__watchHlsDestroyCount || 0) + 1;
        if (state.__watchEmitNetworkError && this.errorHandler) {
          state.__watchEmitNetworkError = undefined;
        }
      }
    }
    (window as typeof window & { Hls?: unknown }).Hls = ControllableNetworkHls;
  }, initialOnline);
}

test("Watch ghép nguồn và chuyển đúng tập từ URL", async ({ page }) => {
  await mockBackend(page);
  await page.goto("/watch/phim-kiem-thu-e2e?ep=T%E1%BA%ADp%2002");

  await expect(page.getByText("Phim kiểm thử E2E", { exact: false }).first()).toBeVisible();
  await expect(page.getByText("Tập 02", { exact: true }).first()).toBeVisible();
  await expect(page).toHaveURL(/ep=T(%E1%BA%ADp|ập)%2002/i);
});

test("Watch chỉ tải nguồn dự phòng một lần sau khi phim chính sẵn sàng", async ({ page }) => {
  await mockBackend(page);
  const requestCounts = {
    blocked: 0,
    resolvedDetail: 0,
  };

  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.includes("/movies/check-blocked/")) requestCounts.blocked += 1;
    if (pathname.includes("/movies/resolved-detail/")) requestCounts.resolvedDetail += 1;
  });

  await page.goto("/watch/phim-kiem-thu-e2e?ep=T%E1%BA%ADp%2002");
  await expect(page.getByText("Phim kiểm thử E2E", { exact: false }).first()).toBeVisible();
  await expect.poll(() => requestCounts.resolvedDetail).toBe(1);

  expect(requestCounts.blocked).toBe(1);
  expect(requestCounts.resolvedDetail).toBe(1);
});

test("Lịch sử khôi phục đúng phim, tập và tiến độ", async ({ page }) => {
  const historyItem = {
    movieSlug: "phim-kiem-thu-e2e",
    movieName: "Phim kiểm thử E2E",
    episodeName: "Tập 02",
    episodeKey: "tap-02",
    currentTime: 720,
    duration: 1440,
    progressMode: "exact",
    updatedAt: new Date().toISOString(),
  };
  await mockBackend(page, [historyItem]);
  await page.addInitScript(() => {
    document.cookie = "token=e2e-token; path=/";
  });

  await page.goto("/user/history");
  await expect(page.getByText("Phim kiểm thử E2E", { exact: true })).toBeVisible();
  await expect(page.getByText(/Đang xem Tập 02 \(50%\)/i)).toBeVisible();
});

test("HLS lỗi sau phục hồi giới hạn thì chuyển sang embed và không bật lại HLS", async ({ page }) => {
  await installFailingHls(page);
  await mockBackend(page, [], hlsMovie);

  await page.goto("/watch/phim-kiem-thu-e2e?ep=T%E1%BA%ADp%2001");
  await expect.poll(() => page.evaluate(
    () => (window as typeof window & { __watchHlsLoadCount?: number }).__watchHlsLoadCount || 0,
  )).toBeGreaterThan(0);
  await expect(page.locator('iframe[title="DlowPhim Video Player"]')).toBeVisible({ timeout: 10_000 });
  const loadCountAfterFailover = await page.evaluate(
    () => (window as typeof window & { __watchHlsLoadCount?: number }).__watchHlsLoadCount || 0,
  );

  await page.waitForTimeout(1_000);
  await expect(page.locator('iframe[title="DlowPhim Video Player"]')).toBeVisible();
  await expect.poll(() => page.evaluate(
    () => (window as typeof window & { __watchHlsLoadCount?: number }).__watchHlsLoadCount || 0,
  )).toBe(loadCountAfterFailover);
  expect(loadCountAfterFailover).toBe(3);
});

test("Mất mạng không phạt CDN hoặc chuyển Embed và tự thử lại một lần khi online", async ({ page }) => {
  await installControllableNetworkHls(page);
  await mockBackend(page, [], hlsMovie);
  let playbackFailureBatches = 0;
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/playback-health/events" && request.method() === "POST") {
      playbackFailureBatches += 1;
    }
  });

  await page.goto("/watch/phim-kiem-thu-e2e?ep=T%E1%BA%ADp%2001");
  await expect.poll(() => page.evaluate(
    () => (window as typeof window & { __watchHlsLoadCount?: number }).__watchHlsLoadCount || 0,
  )).toBe(1);

  await page.evaluate(() => {
    const state = window as typeof window & {
      __watchSetOnline?: (online: boolean) => void;
      __watchEmitNetworkError?: () => void;
    };
    state.__watchSetOnline?.(false);
    state.__watchEmitNetworkError?.();
  });

  await expect(page.getByText("Mất kết nối mạng", { exact: true })).toBeVisible();
  await expect(page.locator('iframe[title="DlowPhim Video Player"]')).toHaveCount(0);
  expect(await page.evaluate(
    () => (window as typeof window & { __watchHlsStopCount?: number }).__watchHlsStopCount || 0,
  )).toBe(1);
  await page.waitForTimeout(800);
  expect(await page.evaluate(
    () => (window as typeof window & { __watchHlsLoadCount?: number }).__watchHlsLoadCount || 0,
  )).toBe(1);
  expect(playbackFailureBatches).toBe(0);
  expect(await page.evaluate(() => sessionStorage.getItem("dlowphim_hls_quarantine"))).toBeNull();

  await page.evaluate(() => {
    (window as typeof window & { __watchSetOnline?: (online: boolean) => void })
      .__watchSetOnline?.(true);
  });

  await expect.poll(() => page.evaluate(
    () => (window as typeof window & { __watchHlsLoadCount?: number }).__watchHlsLoadCount || 0,
  )).toBe(2);
  await expect(page.getByText("Mất kết nối mạng", { exact: true })).toHaveCount(0);
  await expect(page.locator('iframe[title="DlowPhim Video Player"]')).toHaveCount(0);
});

test("Mở trang khi offline chờ mạng và chỉ khởi tạo HLS một lần sau khi online", async ({ page }) => {
  await installControllableNetworkHls(page, false);
  await mockBackend(page, [], hlsMovie);

  await page.goto("/watch/phim-kiem-thu-e2e?ep=T%E1%BA%ADp%2001");
  await expect(page.getByText("Mất kết nối mạng", { exact: true })).toBeVisible();
  expect(await page.evaluate(
    () => (window as typeof window & { __watchHlsLoadCount?: number }).__watchHlsLoadCount || 0,
  )).toBe(0);
  await expect(page.locator('iframe[title="DlowPhim Video Player"]')).toHaveCount(0);

  await page.evaluate(() => {
    (window as typeof window & { __watchSetOnline?: (online: boolean) => void })
      .__watchSetOnline?.(true);
  });

  await expect.poll(() => page.evaluate(
    () => (window as typeof window & { __watchHlsLoadCount?: number }).__watchHlsLoadCount || 0,
  )).toBe(1);
  await expect(page.getByText("Mất kết nối mạng", { exact: true })).toHaveCount(0);
  await expect(page.locator('iframe[title="DlowPhim Video Player"]')).toHaveCount(0);
});

test("Trạng thái offline không tràn hoặc nhân đôi player tại các breakpoint watch", async ({ page }) => {
  await installControllableNetworkHls(page, false);
  await mockBackend(page, [], hlsMovie);
  const unexpectedConsoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (/hydration|maximum update depth|typeerror|referenceerror|cannot read propert/i.test(text)) {
      unexpectedConsoleErrors.push(text);
    }
  });

  await page.goto("/watch/phim-kiem-thu-e2e?ep=T%E1%BA%ADp%2001");

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 767, height: 900 },
    { width: 768, height: 900 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(page.getByText("Mất kết nối mạng", { exact: true })).toBeVisible();
    await expect(page.locator("#dlow-hls-video")).toHaveCount(1);
    await expect(page.locator('iframe[title="DlowPhim Video Player"]')).toHaveCount(0);
    expect(await page.evaluate(() => ({
      documentOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      bodyOverflow: document.body.scrollWidth > document.body.clientWidth,
    }))).toEqual({ documentOverflow: false, bodyOverflow: false });
  }

  expect(unexpectedConsoleErrors).toEqual([]);
});

test("HLS chỉ khởi tạo sau khi auth hiện hành tải xong", async ({ page }) => {
  await installFailingHls(page);
  await mockBackend(page, [{
    movieSlug: movie.slug,
    movieName: movie.name,
    episodeName: "Tập 01",
    episodeKey: "tap-01",
    currentTime: 30,
    duration: 120,
    progressMode: "exact",
    updatedAt: new Date().toISOString(),
  }], hlsMovie, 800);
  await page.addInitScript(() => {
    document.cookie = "token=e2e-token; path=/";
  });

  await page.goto("/watch/phim-kiem-thu-e2e?ep=T%E1%BA%ADp%2001", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(250);
  expect(await page.evaluate(
    () => (window as typeof window & { __watchHlsLoadCount?: number }).__watchHlsLoadCount || 0,
  )).toBe(0);
  await expect.poll(() => page.evaluate(
    () => (window as typeof window & { __watchHlsLoadCount?: number }).__watchHlsLoadCount || 0,
  )).toBeGreaterThan(0);
});

test("Lịch sử embed chỉ đồng bộ sau khi auth hiện hành tải xong", async ({ page }) => {
  const historyRequests: Array<{ authorization: string; body: Record<string, unknown> }> = [];
  await mockBackend(page, [{
    movieSlug: movie.slug,
    movieName: movie.name,
    episodeName: "Tập 01",
    episodeKey: "1",
    currentTime: 30,
    duration: 0,
    progressMode: "embed",
    updatedAt: new Date().toISOString(),
  }], movie, 800);
  await page.addInitScript(() => {
    document.cookie = "token=e2e-token; path=/";
  });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname !== "/auth/history/update") return;
    historyRequests.push({
      authorization: request.headers().authorization || "",
      body: request.postDataJSON(),
    });
  });

  await page.goto("/watch/phim-kiem-thu-e2e?ep=T%E1%BA%ADp%2001", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(250);
  expect(historyRequests).toHaveLength(0);

  await expect.poll(() => historyRequests.length).toBe(1);
  expect(historyRequests[0].authorization).toBe("Bearer e2e-token");
  expect(historyRequests[0].body).toEqual(expect.objectContaining({
    movieSlug: movie.slug,
    episodeName: "Tập 01",
    progressMode: "embed",
    updatedAt: expect.any(String),
  }));

  await page.evaluate(() => {
    window.dispatchEvent(new Event("pagehide"));
    window.dispatchEvent(new Event("pagehide"));
  });
  await page.waitForTimeout(150);
  expect(historyRequests).toHaveLength(1);
});

test("Đổi tập sau embed failover reset đúng về HLS của tập mới", async ({ page }) => {
  await installFailingHls(page);
  await mockBackend(page, [], hlsMovie);

  await page.goto("/watch/phim-kiem-thu-e2e?ep=T%E1%BA%ADp%2001");
  await expect.poll(() => page.evaluate(
    () => (window as typeof window & { __watchHlsLoadCount?: number }).__watchHlsLoadCount || 0,
  )).toBeGreaterThan(0);
  await expect(page.locator('iframe[title="DlowPhim Video Player"]')).toBeVisible({ timeout: 10_000 });
  const loadCountBeforeEpisodeChange = await page.evaluate(
    () => (window as typeof window & { __watchHlsLoadCount?: number }).__watchHlsLoadCount || 0,
  );

  await page.getByRole("button", { name: /Tập 02/i }).last().click();
  await expect(page).toHaveURL(/ep=T(%E1%BA%ADp|ập)%2002/i);
  await expect(page.locator("#dlow-hls-video")).toBeVisible();
  await expect.poll(() => page.evaluate(
    () => (window as typeof window & { __watchHlsLoadCount?: number }).__watchHlsLoadCount || 0,
  )).toBeGreaterThan(loadCountBeforeEpisodeChange);
});
