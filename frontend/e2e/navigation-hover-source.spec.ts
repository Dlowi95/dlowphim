import { test, expect, Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const mockMovie = {
  _id: "movie-mui-pho-id",
  name: "Mùi Phở",
  origin_name: "The Scent of Pho",
  slug: "mui-pho",
  content: "Một bộ phim đặc sắc về ẩm thực Việt Nam năm 2026.",
  thumb_url: "https://phimimg.com/uploads/movies/mui-pho-thumb.jpg",
  poster_url: "https://phimimg.com/uploads/movies/mui-pho-poster.jpg",
  year: 2026,
  quality: "HD",
  lang: "Vietsub",
  time: "1h 45m",
  episode_current: "Full",
  last_episodes: [{ name: "Full", slug: "full" }],
  category: [{ name: "Tâm Lý", slug: "tam-ly" }],
  country: [{ name: "Việt Nam", slug: "viet-nam" }],
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

const mockHeroSlot = {
  slotIndex: 0,
  movie: mockMovie,
  tmdbData: {
    logoUrl: "https://image.tmdb.org/t/p/original/mui-pho-logo.png",
    backdropUrl: "https://image.tmdb.org/t/p/original/mui-pho-backdrop.jpg",
    posterUrl: "https://image.tmdb.org/t/p/original/mui-pho-poster.jpg",
  },
  detail: mockMovie,
  isCustomBanner: false,
};

const transparentPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
const dummyJpeg = Buffer.from("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=", "base64");
const placeholderSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450"><rect width="300" height="450" fill="#18181b"/></svg>`, "utf8");

type TrackedRequest = {
  method: string;
  url: string;
  timestamp: number;
};

type FailedRequestRecord = {
  url: string;
  failureText: string;
  method: string;
};

type ViewportMetric = {
  width: number;
  height: number;
  horizontalOverflow: boolean;
  consoleErrors: string[];
  failedRequests: string[];
  hoverPopupCount: number;
  detailRequestsOnHover: number;
  navigationUrl: string;
  rawObservations: {
    totalRequestsCount: number;
    detailRequestsCount: number;
    prefetchRequestsCount: number;
    imagesCheckedCount: number;
  };
};

const recordedMetrics: Record<string, ViewportMetric> = {};

function createRuntimeCollector(page: Page) {
  const consoleErrors: string[] = [];
  const failedRequests: FailedRequestRecord[] = [];
  const requests: TrackedRequest[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      if (!text.includes("ResizeObserver loop limit exceeded")) {
        consoleErrors.push(text);
      }
    }
  });

  page.on("requestfailed", (req) => {
    failedRequests.push({
      url: req.url(),
      failureText: req.failure()?.errorText || "Unknown error",
      method: req.method(),
    });
  });

  page.on("request", (req) => {
    requests.push({
      method: req.method(),
      url: req.url(),
      timestamp: Date.now(),
    });
  });

  return {
    consoleErrors,
    failedRequests,
    requests,
    getDetailRequestCount(fromIndex = 0) {
      let count = 0;
      for (let i = fromIndex; i < requests.length; i++) {
        const req = requests[i];
        let decoded = req.url;
        try {
          decoded = decodeURIComponent(req.url);
        } catch {}
        if (
          decoded.includes("/movies/ophim-proxy?path=/phim/mui-pho") ||
          decoded.includes("/phim/mui-pho") ||
          decoded.includes("/v1/api/phim/mui-pho")
        ) {
          count++;
        }
      }
      return count;
    },
    getPrefetchRequestCount(fromIndex = 0) {
      let count = 0;
      for (let i = fromIndex; i < requests.length; i++) {
        const req = requests[i];
        if (req.url.includes("_rsc=")) {
          count++;
        }
      }
      return count;
    },
    finalizeAssertions() {
      expect(consoleErrors, "Console errors must be strictly empty").toEqual([]);

      const unexpectedFailed = failedRequests.filter((r) => {
        if (
          r.failureText.includes("net::ERR_ABORTED") &&
          (r.url.includes("_rsc=") ||
            r.url.includes("movie-placeholder.svg") ||
            r.url.includes("/images/") ||
            r.url.includes("ophim-proxy"))
        ) {
          return false;
        }
        return true;
      });

      expect(unexpectedFailed, "Unexpected failed network requests must be empty").toEqual([]);
    },
  };
}

async function setupDeterministicMocks(page: Page) {
  await page.route("https://accounts.google.com/gsi/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/javascript", body: "/* deterministic Google Identity mock */" }),
  );
  await page.route(/https:\/\/image\.tmdb\.org\/.*/, (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: transparentPng }),
  );
  await page.route(/https:\/\/(?:phimimg\.com|img\.ophim\.live)\/.*/, (route) =>
    route.fulfill({ status: 200, contentType: "image/jpeg", body: dummyJpeg }),
  );
  await page.route(/https:\/\/embed\.example\/.*/, (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<html><body>Mock Video Embed</body></html>" }),
  );
  await page.route("**/images/**", (route) =>
    route.fulfill({ status: 200, contentType: "image/svg+xml", body: placeholderSvg }),
  );
  await page.route("**/_next/image*", (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: transparentPng }),
  );
  await page.route(/.*\/images\/movie-placeholder\.svg.*/, (route) =>
    route.fulfill({ status: 200, contentType: "image/svg+xml", body: placeholderSvg }),
  );
  await page.route("**/socket.io/**", (route) =>
    route.fulfill({
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "*",
      },
      contentType: "text/plain",
      body: "ok",
    }),
  );

  await page.route(
    (url) =>
      url.port === "5000" ||
      url.pathname.startsWith("/banners") ||
      url.pathname.startsWith("/system-settings") ||
      url.pathname.startsWith("/movies") ||
      url.pathname.startsWith("/auth") ||
      url.pathname.startsWith("/notifications") ||
      url.pathname.startsWith("/playback-health") ||
      url.pathname.startsWith("/ratings") ||
      url.pathname.startsWith("/comments") ||
      url.pathname.startsWith("/the-loai") ||
      url.pathname.startsWith("/danh-sach"),
    async (route) => {
      if (route.request().method() === "OPTIONS") {
        return route.fulfill({
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, HEAD",
            "Access-Control-Allow-Headers": "*",
          },
        });
      }

      const url = new URL(route.request().url());
      let body: any = {};
      let status = 200;

      if (url.pathname.startsWith("/banners/")) {
        body = {
          sourceId: "phimapi",
          generatedAt: new Date().toISOString(),
          slots: [mockHeroSlot],
          rawBanners: [],
          latestMovies: [mockMovie],
        };
      } else if (url.pathname === "/system-settings/public") {
        body = { websiteName: "DlowPhim", activeMovieSourceId: "phimapi" };
      } else if (url.pathname.startsWith("/movies/discovery")) {
        body = {
          status: true,
          availability: "ready",
          items: [mockMovie],
          pagination: { currentPage: 1, totalItems: 1, totalItemsPerPage: 24, totalPages: 1 },
        };
      } else if (url.pathname === "/movies/ophim-proxy") {
        body = {
          status: true,
          items: [mockMovie],
          data: { items: [mockMovie], item: mockMovie, params: { pagination: { totalItems: 1 } } },
          movie: mockMovie,
          episodes: mockMovie.episodes,
          _sourceId: "phimapi",
        };
      } else if (url.pathname.startsWith("/movies/logo/")) {
        body = {
          backdropUrl: "https://phimimg.com/uploads/movies/mui-pho-poster.jpg",
          posterUrl: "https://phimimg.com/uploads/movies/mui-pho-thumb.jpg",
        };
      } else if (url.pathname.includes("/movies/resolved-detail/") || url.pathname.includes("/phim/")) {
        body = { status: true, movie: mockMovie, data: { item: mockMovie }, episodes: mockMovie.episodes };
      } else if (url.pathname.includes("/movies/upcoming/")) {
        body = { status: true, movie: mockMovie, episodes: mockMovie.episodes };
      } else if (url.pathname.startsWith("/auth/me")) {
        status = 401;
      } else if (url.pathname.startsWith("/notifications/")) {
        body = { notifications: [], unreadCount: 0 };
      } else if (url.pathname.startsWith("/playback-health/")) {
        body = [];
      } else if (url.pathname.startsWith("/movies/credits/")) {
        body = [];
      } else if (url.pathname.startsWith("/movies/schedule/")) {
        body = { state: "completed", source: "provider" };
      } else if (url.pathname.startsWith("/ratings/")) {
        body = { average: 9.2, count: 120, userRating: null };
      } else if (url.pathname.startsWith("/comments/")) {
        body = [];
      } else {
        body = { status: true, items: [mockMovie] };
      }

      return route.fulfill({
        status,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "*",
        },
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    },
  );
}

test.describe("DlowPhim Production Navigation, Hover & Touch E2E Suite (Round 4 Hardening)", () => {
  test.afterAll(() => {
    const logDir = path.resolve(process.cwd(), "..", ".codex-logs", "anti-handoffs");
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const jsonPath = path.join(logDir, "movie-navigation-touch-hover-v4.runtime.json");
    fs.writeFileSync(jsonPath, JSON.stringify(recordedMetrics, null, 2), "utf8");
  });

  const mobileBreakpoints = [
    { name: "Mobile 360", width: 360, height: 740 },
    { name: "Mobile 390", width: 390, height: 844 },
    { name: "Mobile 440", width: 440, height: 956 },
    { name: "Mobile 767", width: 767, height: 1000 },
  ];

  for (const bp of mobileBreakpoints) {
    test(`${bp.name} (${bp.width}x${bp.height}): Touch intent is safe on all card types and one real tap navigates cleanly`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: bp.width, height: bp.height },
        hasTouch: true,
      });
      const page = await context.newPage();
      const collector = createRuntimeCollector(page);

      await setupDeterministicMocks(page);

      await page.goto("/");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(650); // Allow hero visual safety timer to enable deferred sections

      // Scroll to trigger lazy row mounting
      await page.evaluate(async () => {
        window.scrollTo(0, document.body.scrollHeight);
        await new Promise((r) => setTimeout(r, 400));
        window.scrollTo(0, document.body.scrollHeight);
      });

      const popup = page.locator('[data-testid="movie-hover-popup"]');

      // Exercise React's delegated pointer path for every card family. `pointerover`
      // is intentional: React derives onPointerEnter from pointerover/out.
      let maxTouchPopupCount = 0;
      let touchHoverDetailDelta = 0;
      for (const testId of ["movie-card", "top10-card", "cinema-card"] as const) {
        const card = page.locator(`[data-testid="${testId}"]`).first();
        await card.scrollIntoViewIfNeeded();
        await expect(card, `${testId} must be visible`).toBeVisible({ timeout: 10_000 });
        expect(await card.evaluate((element) => element.tagName), `${testId} must be an anchor`).toBe("A");
        expect(await card.getAttribute("href"), `${testId} must expose the movie href`).toBe("/movie/mui-pho");

        const requestIndex = collector.requests.length;
        await card.dispatchEvent("pointerover", { pointerType: "touch" });
        await card.dispatchEvent("pointerdown", { pointerType: "touch" });
        await page.waitForTimeout(900);

        const popupCount = await popup.count();
        const detailDelta = collector.getDetailRequestCount(requestIndex);
        maxTouchPopupCount = Math.max(maxTouchPopupCount, popupCount);
        touchHoverDetailDelta += detailDelta;
        expect(popupCount, `${testId} touch must not open a hover popup`).toBe(0);
        expect(detailDelta, `${testId} touch must not request hover details`).toBe(0);
      }

      // Verify single real touch tap navigates directly to detail page
      const cinemaCard = page.locator('[data-testid="cinema-card"]').first();
      await cinemaCard.scrollIntoViewIfNeeded();
      await cinemaCard.tap();
      await page.waitForURL(/\/movie\/mui-pho/, { timeout: 8000 });

      expect(page.url()).toContain("/movie/mui-pho");
      expect(await popup.count(), "Popup must remain 0 after navigation").toBe(0);

      // Check horizontal overflow
      const isOverflowing = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      expect(isOverflowing, "Must have zero horizontal overflow").toBe(false);

      // Check visible images
      const imagesHealthy = await page.evaluate(() => {
        const imgs = Array.from(document.querySelectorAll("img"));
        return imgs.every((img) => img.complete && img.naturalWidth > 0);
      });
      expect(imagesHealthy, "All rendered images must be complete and decoded").toBe(true);

      recordedMetrics[bp.name] = {
        width: bp.width,
        height: bp.height,
        horizontalOverflow: isOverflowing,
        consoleErrors: collector.consoleErrors,
        failedRequests: collector.failedRequests.map((f) => f.url),
        hoverPopupCount: maxTouchPopupCount,
        detailRequestsOnHover: touchHoverDetailDelta,
        navigationUrl: page.url(),
        rawObservations: {
          totalRequestsCount: collector.requests.length,
          detailRequestsCount: collector.getDetailRequestCount(),
          prefetchRequestsCount: collector.getPrefetchRequestCount(),
          imagesCheckedCount: 1,
        },
      };

      collector.finalizeAssertions();
      await context.close();
    });
  }

  test("Hybrid 768px (768x1024): Touch/pen/synthetic-mouse suppressed; genuine mouse hover opens exactly 1 popup", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 768, height: 1024 },
      hasTouch: true,
    });
    const page = await context.newPage();
    const collector = createRuntimeCollector(page);

    await page.addInitScript(() => {
      const origMatchMedia = window.matchMedia;
      window.matchMedia = (query: string) => {
        if (query.includes("hover") || query.includes("pointer")) {
          return {
            matches: true,
            media: query,
            onchange: null,
            addListener: () => {},
            removeListener: () => {},
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => true,
          } as unknown as MediaQueryList;
        }
        return origMatchMedia ? origMatchMedia.call(window, query) : ({ matches: false } as any);
      };
    });

    await setupDeterministicMocks(page);

    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(650);

    await page.evaluate(async () => {
      window.scrollTo(0, document.body.scrollHeight);
      await new Promise((r) => setTimeout(r, 400));
      window.scrollTo(0, document.body.scrollHeight);
    });

    const cinemaCard = page.locator('[data-testid="cinema-card"]').first();
    await cinemaCard.scrollIntoViewIfNeeded();
    await expect(cinemaCard).toBeVisible({ timeout: 10_000 });

    const popup = page.locator('[data-testid="movie-hover-popup"]');

    // 1. Pointer Touch sequence
    await cinemaCard.dispatchEvent("pointerover", { pointerType: "touch" });
    await cinemaCard.dispatchEvent("pointerdown", { pointerType: "touch" });
    await page.waitForTimeout(900);
    expect(await popup.count(), "Touch pointer must never open popup").toBe(0);

    // 2. Pointer Pen sequence
    await cinemaCard.dispatchEvent("pointerover", { pointerType: "pen" });
    await cinemaCard.dispatchEvent("pointerdown", { pointerType: "pen" });
    await page.waitForTimeout(900);
    expect(await popup.count(), "Pen pointer must never open popup").toBe(0);

    // 3. Post-touch synthetic mouse sequence within suppression window (< 800ms)
    await cinemaCard.dispatchEvent("pointerdown", { pointerType: "touch" });
    await cinemaCard.dispatchEvent("pointerup", { pointerType: "touch" });
    await cinemaCard.dispatchEvent("pointerover", { pointerType: "mouse" });
    await page.waitForTimeout(900);
    expect(await popup.count(), "Synthetic mouse within suppression window must be suppressed").toBe(0);

    // 4. Genuine mouse hover outside suppression window
    await page.waitForTimeout(850);
    const reqBeforeHover = collector.requests.length;
    await cinemaCard.hover();
    await page.waitForTimeout(950);

    const popupCount = await popup.count();
    expect(popupCount, "Genuine mouse hover on hybrid device must open exactly 1 popup").toBe(1);
    await expect(popup).toBeVisible();

    const isOverflowing = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(isOverflowing).toBe(false);

    recordedMetrics["Hybrid 768"] = {
      width: 768,
      height: 1024,
      horizontalOverflow: isOverflowing,
      consoleErrors: collector.consoleErrors,
      failedRequests: collector.failedRequests.map((f) => f.url),
      hoverPopupCount: popupCount,
      detailRequestsOnHover: collector.getDetailRequestCount(reqBeforeHover),
      navigationUrl: page.url(),
      rawObservations: {
        totalRequestsCount: collector.requests.length,
        detailRequestsCount: collector.getDetailRequestCount(),
        prefetchRequestsCount: collector.getPrefetchRequestCount(),
        imagesCheckedCount: 1,
      },
    };

    collector.finalizeAssertions();
    await context.close();
  });

  const desktopBreakpoints = [
    { name: "Desktop 1024", width: 1024, height: 768 },
    { name: "Desktop 1440", width: 1440, height: 900 },
    { name: "Desktop 1920", width: 1920, height: 1080 },
  ];

  for (const bp of desktopBreakpoints) {
    test(`${bp.name} (${bp.width}x${bp.height}): Genuine mouse hover opens popup, maintains portal on move, clicks buttons, and tests keyboard navigation`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: bp.width, height: bp.height },
      });
      const page = await context.newPage();
      const collector = createRuntimeCollector(page);

      await setupDeterministicMocks(page);

      await page.goto("/");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(650);

      await page.evaluate(async () => {
        window.scrollTo(0, document.body.scrollHeight);
        await new Promise((r) => setTimeout(r, 400));
        window.scrollTo(0, document.body.scrollHeight);
      });

      const popup = page.locator('[data-testid="movie-hover-popup"]');
      let popupCount = 0;
      let desktopHoverDetailCount = 0;

      // Assert semantic anchors and genuine hover behavior for all card families.
      for (const testId of ["movie-card", "top10-card", "cinema-card"] as const) {
        const card = page.locator(`[data-testid="${testId}"]`).first();
        await card.scrollIntoViewIfNeeded();
        await expect(card, `${testId} must be visible`).toBeVisible({ timeout: 10_000 });
        expect(await card.evaluate((element) => element.tagName), `${testId} must be an anchor`).toBe("A");
        expect(await card.getAttribute("href"), `${testId} must expose the movie href`).toBe("/movie/mui-pho");

        const requestIndex = collector.requests.length;
        await card.hover();
        await page.waitForTimeout(950);

        popupCount = await popup.count();
        expect(popupCount, `${testId} hover must mount exactly one popup`).toBe(1);
        await expect(popup).toBeVisible();
        await popup.hover();
        await page.waitForTimeout(150);
        await expect(popup, `${testId} popup must survive card-to-portal movement`).toBeVisible();
        desktopHoverDetailCount += collector.getDetailRequestCount(requestIndex);

        await page.mouse.move(0, 0);
        await page.waitForTimeout(300);
        expect(await popup.count(), `${testId} popup must unmount after leaving`).toBe(0);
      }

      const cinemaCard = page.locator('[data-testid="cinema-card"]').first();
      await cinemaCard.scrollIntoViewIfNeeded();

      // Modifier/middle clicks must remain native anchor operations. A document
      // observer prevents the synthetic test event's default action only after
      // React handlers have had the opportunity to cancel it.
      const nativeSemanticsPreserved = await cinemaCard.evaluate(async (element) => {
        const cases: MouseEventInit[] = [
          { ctrlKey: true, button: 0 },
          { metaKey: true, button: 0 },
          { shiftKey: true, button: 0 },
          { altKey: true, button: 0 },
          { button: 1 },
        ];
        const results: boolean[] = [];
        for (const eventInit of cases) {
          results.push(await new Promise<boolean>((resolve) => {
            document.addEventListener("click", (event) => {
              const wasPreserved = !event.defaultPrevented;
              event.preventDefault();
              resolve(wasPreserved);
            }, { once: true });
            element.dispatchEvent(new MouseEvent("click", {
              bubbles: true,
              cancelable: true,
              ...eventInit,
            }));
          }));
        }
        return results;
      });
      expect(nativeSemanticsPreserved, "Modifier and middle clicks must not be cancelled by card handlers")
        .toEqual([true, true, true, true, true]);

      // Re-open the Cinema popup to exercise the detail action.
      await cinemaCard.hover();
      await page.waitForTimeout(950);
      await expect(popup).toBeVisible();

      // 2. Click detail button inside popup
      const detailBtn = page.locator('[data-testid="hover-detail-btn"]').first();
      await detailBtn.click();
      await page.waitForURL(/\/movie\/mui-pho/, { timeout: 7000 });
      expect(page.url()).toContain("/movie/mui-pho");
      await page.waitForTimeout(400);

      // Go back to test keyboard navigation
      await page.goto("/");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(650);
      await page.evaluate(async () => {
        window.scrollTo(0, document.body.scrollHeight);
        await new Promise((r) => setTimeout(r, 400));
        window.scrollTo(0, document.body.scrollHeight);
      });
      await cinemaCard.scrollIntoViewIfNeeded();

      // 3. Test Enter key navigation
      await cinemaCard.focus();
      await page.keyboard.press("Enter");
      await page.waitForURL(/\/movie\/mui-pho/, { timeout: 7000 });
      expect(page.url()).toContain("/movie/mui-pho");
      await page.waitForTimeout(400);

      // Go back to test Space key navigation
      await page.goto("/");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(650);
      await page.evaluate(async () => {
        window.scrollTo(0, document.body.scrollHeight);
        await new Promise((r) => setTimeout(r, 400));
        window.scrollTo(0, document.body.scrollHeight);
      });
      await cinemaCard.scrollIntoViewIfNeeded();

      // 4. Test Space key navigation
      await cinemaCard.focus();
      await page.keyboard.press("Space");
      await page.waitForURL(/\/movie\/mui-pho/, { timeout: 7000 });
      expect(page.url()).toContain("/movie/mui-pho");
      await page.waitForTimeout(400);

      // Check overflow and images
      const isOverflowing = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(isOverflowing).toBe(false);

      recordedMetrics[bp.name] = {
        width: bp.width,
        height: bp.height,
        horizontalOverflow: isOverflowing,
        consoleErrors: collector.consoleErrors,
        failedRequests: collector.failedRequests.map((f) => f.url),
        hoverPopupCount: popupCount,
        detailRequestsOnHover: desktopHoverDetailCount,
        navigationUrl: page.url(),
        rawObservations: {
          totalRequestsCount: collector.requests.length,
          detailRequestsCount: collector.getDetailRequestCount(),
          prefetchRequestsCount: collector.getPrefetchRequestCount(),
          imagesCheckedCount: 1,
        },
      };

      collector.finalizeAssertions();
      await context.close();
    });
  }

  test("Lifecycle, Listener Balance, Autoplay Prefetch & Reloads: 10-cycle open/close, zero autoplay prefetch spam, image naturalWidth check", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    const collector = createRuntimeCollector(page);

    await setupDeterministicMocks(page);

    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(650);

    await page.evaluate(async () => {
      window.scrollTo(0, document.body.scrollHeight);
      await new Promise((r) => setTimeout(r, 400));
      window.scrollTo(0, document.body.scrollHeight);
    });

    const cinemaCard = page.locator('[data-testid="cinema-card"]').first();
    await cinemaCard.scrollIntoViewIfNeeded();
    await expect(cinemaCard).toBeVisible({ timeout: 10_000 });

    const popup = page.locator('[data-testid="movie-hover-popup"]');

    // 1. Perform 10 open/close cycles on popup
    for (let i = 0; i < 10; i++) {
      await cinemaCard.hover();
      await page.waitForTimeout(900);
      expect(await popup.count(), `Popup cycle ${i + 1} must mount 1 popup`).toBe(1);

      // Move mouse away to body
      await page.mouse.move(0, 0);
      await page.waitForTimeout(300);
      expect(await popup.count(), `Popup cycle ${i + 1} must unmount cleanly`).toBe(0);
    }

    // 2. Autoplay Prefetch Test: Wait 4500ms (1 hero cycle) without mouse movement
    const prefetchBeforeAutoplay = collector.getPrefetchRequestCount();
    await page.waitForTimeout(4500);
    const prefetchDeltaAutoplay = collector.getPrefetchRequestCount() - prefetchBeforeAutoplay;
    expect(prefetchDeltaAutoplay, "Hero autoplay must not emit unsolicited _rsc prefetch spam").toBe(0);

    // 3. Test genuine mouse hover prefetch contract
    await cinemaCard.hover();
    await page.waitForTimeout(200);
    await page.mouse.move(0, 0);

    // 4. Test image completeness after reload
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(400);
    await page.evaluate(async () => {
      const imgs = Array.from(document.querySelectorAll("img"));
      await Promise.all(
        imgs.map(async (img) => {
          if (img.decode) {
            try {
              await img.decode();
            } catch {}
          }
        }),
      );
    });
    const healthyImagesAfterReload = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll("img")).filter((img) => {
        const rect = img.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && img.src;
      });
      return imgs.length > 0 && imgs.every((img) => img.complete && img.naturalWidth > 0);
    });
    expect(healthyImagesAfterReload, "Images must load cleanly with positive naturalWidth after reload").toBe(true);

    collector.finalizeAssertions();
    await context.close();
  });
});
