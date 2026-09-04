import test from "node:test";
import assert from "node:assert/strict";
import {
  canTriggerHoverPopup,
  isFineHoverCapability,
  isTouchOrPenInteraction,
  recordTouchInteraction,
  isRecentTouchSuppressed,
  resetTouchRecordForTest,
  subscribeToFineHoverCapability,
} from "./hoverCardGuard.ts";
import {
  getMovieMetadata,
  buildMovieMetadata,
} from "./movieMetadata.ts";
import {
  primeMovieNavigationPreview,
  readMovieNavigationPreview,
} from "./movieNavigationPreview.ts";

function createMemoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

test("movie navigation preview is slug-bound, short-lived, and storage-safe", () => {
  const storage = createMemoryStorage();
  const movie = { slug: "mui-pho", name: "Mùi Phở", episodes: [] };
  const savedAt = 1_000_000;

  primeMovieNavigationPreview(movie.slug, movie, storage, savedAt);
  assert.deepEqual(
    readMovieNavigationPreview("mui-pho", storage, savedAt + 1_000),
    movie,
    "Matching fresh preview must be available during client navigation",
  );
  assert.equal(
    readMovieNavigationPreview("phim-khac", storage, savedAt + 1_000),
    null,
    "A preview must never leak into another movie route",
  );

  primeMovieNavigationPreview(movie.slug, movie, storage, savedAt);
  assert.equal(
    readMovieNavigationPreview("mui-pho", storage, savedAt + 120_001),
    null,
    "Expired navigation data must be discarded",
  );
});

test("canTriggerHoverPopup rejects touch, pen, and coarse-only environments", () => {
  // Save original window matchMedia
  const originalWindow = global.window;

  try {
    // Mock matchMedia returning false (coarse pointer / no hover)
    (global as any).window = {
      matchMedia: (query: string) => ({
        matches: query.includes("(hover: hover)") && query.includes("(pointer: fine)") ? false : false,
      }),
    };

    assert.equal(
      canTriggerHoverPopup({ pointerType: "touch" }),
      false,
      "Touch pointer must be rejected",
    );
    assert.equal(
      canTriggerHoverPopup({ pointerType: "pen" }),
      false,
      "Pen pointer must be rejected",
    );
    assert.equal(
      canTriggerHoverPopup({ pointerType: "mouse" }),
      false,
      "Mouse pointer on coarse-only device must be rejected",
    );
    assert.equal(
      canTriggerHoverPopup(null),
      false,
      "Null event must be rejected",
    );

    // Mock matchMedia returning true (desktop fine pointer)
    resetTouchRecordForTest();
    (global as any).window = {
      matchMedia: (query: string) => ({
        matches: query.includes("(hover: hover)") && query.includes("(pointer: fine)") ? true : false,
      }),
    };

    assert.equal(
      canTriggerHoverPopup({ pointerType: "touch" }),
      false,
      "Touch pointer on hybrid device must still be rejected even if fine pointer supported",
    );
    assert.equal(
      canTriggerHoverPopup({ pointerType: "pen" }),
      false,
      "Pen pointer must still be rejected",
    );
    resetTouchRecordForTest();
    assert.equal(
      canTriggerHoverPopup({ pointerType: "mouse" }),
      true,
      "Mouse pointer on fine-pointer desktop must be accepted",
    );
  } finally {
    global.window = originalWindow;
  }
});

test("isTouchOrPenInteraction accurately identifies touch and pen", () => {
  assert.equal(isTouchOrPenInteraction({ pointerType: "touch" }), true);
  assert.equal(isTouchOrPenInteraction({ pointerType: "pen" }), true);
  assert.equal(isTouchOrPenInteraction({ pointerType: "mouse" }), false);
  assert.equal(isTouchOrPenInteraction(null), false);
  assert.equal(isTouchOrPenInteraction(undefined), false);
});

test("buildMovieMetadata produces valid SEO metadata and clean descriptions", () => {
  // Generic fallback test
  const fallback = buildMovieMetadata(null, "slug-test");
  assert.equal(fallback.title, "Xem phim trực tuyến | DlowPhim");
  assert.equal(fallback.description, "Xem phim chất lượng cao, Vietsub và Lồng tiếng tại DlowPhim.");

  // Valid movie metadata test
  const meta = buildMovieMetadata(
    {
      name: "Mùi Phở",
      origin_name: "The Scent of Pho",
      year: 2026,
      content: "<p>Bộ phim <b>Mùi Phở</b> &nbsp; đưa người xem khám phá ẩm thực Việt Nam.</p>",
      poster_url: "https://phimimg.com/uploads/movies/mui-pho-poster.jpg",
      thumb_url: "https://phimimg.com/uploads/movies/mui-pho-thumb.jpg",
    },
    "mui-pho",
  );

  assert.equal(meta.title, "Mùi Phở (2026) | DlowPhim");
  assert.equal(
    meta.description,
    "Bộ phim Mùi Phở đưa người xem khám phá ẩm thực Việt Nam.",
  );
  assert.equal(meta.alternates?.canonical, "/movie/mui-pho");
  const firstOgImage = Array.isArray(meta.openGraph?.images) ? (meta.openGraph?.images[0] as any)?.url : (meta.openGraph?.images as any)?.url;
  assert.equal(firstOgImage, "https://phimimg.com/uploads/movies/mui-pho-poster.jpg");
});

test("getMovieMetadata respects overall timeout budget and falls back gracefully", async () => {
  // Test with slow mock fetch that exceeds budget
  const slowFetch: typeof fetch = ((url: string, init?: RequestInit) => {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        resolve({
          ok: true,
          json: async () => ({ movie: { name: "Late Movie" } }),
        } as any);
      }, 500);

      init?.signal?.addEventListener("abort", () => {
        clearTimeout(timer);
        const err = new Error("Aborted");
        err.name = "AbortError";
        reject(err);
      });
    });
  }) as any;

  const startedAt = Date.now();
  const result = await getMovieMetadata("test-slug", {
    timeoutMs: 100,
    customFetch: slowFetch,
  });
  const elapsed = Date.now() - startedAt;

  assert.equal(result, null, "Exceeding total budget must return null for generic fallback");
  assert.ok(elapsed < 300, `Execution (${elapsed}ms) must remain bounded near total budget`);
});

test("getMovieMetadata successfully extracts movie from active source and calls only active endpoint", async () => {
  const calls: string[] = [];
  const successfulFetch: typeof fetch = (async (url: string) => {
    calls.push(url);
    return {
      ok: true,
      json: async () => ({
        status: true,
        movie: {
          name: "Mùi Phở",
          year: 2026,
        },
      }),
    } as any;
  }) as any;

  const result = await getMovieMetadata("mui-pho", {
    timeoutMs: 2000,
    customFetch: successfulFetch,
  });

  assert.ok(result);
  assert.equal(result?.name, "Mùi Phở");
  assert.equal(result?.year, 2026);
  assert.equal(calls.length, 1, "Healthy path must only invoke active source endpoint");
});

test("getMovieMetadata hard-cap terminates uncooperative fetch ignoring AbortSignal", async () => {
  // A promise that completely ignores AbortSignal and never resolves
  const uncooperativeFetch: typeof fetch = (() => {
    return new Promise(() => {
      // Intentionally never resolving or rejecting, ignoring signal
    });
  }) as any;

  const startedAt = Date.now();
  const result = await getMovieMetadata("uncooperative-slug", {
    timeoutMs: 150,
    customFetch: uncooperativeFetch,
  });
  const elapsed = Date.now() - startedAt;

  assert.equal(result, null, "Hard-cap must return null when worker promise is completely uncooperative");
  assert.ok(elapsed >= 140 && elapsed < 350, `Hard-cap race must resolve near budget deadline (${elapsed}ms)`);
});

test("getMovieMetadata chains active to fallback when active fails", async () => {
  const calls: string[] = [];
  const fallbackFetch: typeof fetch = (async (url: string) => {
    calls.push(url);
    if (url.includes("source=active")) {
      return {
        ok: false,
        status: 500,
      } as any;
    }
    // Fallback succeeds
    return {
      ok: true,
      json: async () => ({
        status: "success",
        data: {
          item: {
            name: "Phim Dự Phòng",
            year: 2025,
          },
        },
      }),
    } as any;
  }) as any;

  const result = await getMovieMetadata("phim-du-phong", {
    timeoutMs: 2000,
    customFetch: fallbackFetch,
  });

  assert.ok(result);
  assert.equal(result?.name, "Phim Dự Phòng");
  assert.equal(calls.length, 2, "Must fall back to second provider after first provider fails");
});

test("recent-touch suppression suppresses synthetic mouse within window and allows mouse after", () => {
  const originalWindow = global.window;
  try {
    (global as any).window = {
      matchMedia: (query: string) => ({
        matches: query.includes("(hover: hover)") && query.includes("(pointer: fine)") ? true : false,
      }),
    };

    resetTouchRecordForTest();
    assert.equal(canTriggerHoverPopup({ pointerType: "mouse" }, 800), true, "Mouse without prior touch is allowed");

    // Touch event occurs
    assert.equal(canTriggerHoverPopup({ pointerType: "touch" }, 800), false, "Touch is rejected");
    assert.equal(isRecentTouchSuppressed(800), true, "Recent touch is recorded");

    // Synthetic mouse within suppression window
    assert.equal(
      canTriggerHoverPopup({ pointerType: "mouse" }, 800),
      false,
      "Synthetic mouse within suppression window must be rejected",
    );

    // After window expires
    assert.equal(
      canTriggerHoverPopup({ pointerType: "mouse" }, 0),
      true,
      "Mouse after suppression window must be allowed",
    );
  } finally {
    global.window = originalWindow;
    resetTouchRecordForTest();
  }
});

test("subscribeToFineHoverCapability balances listeners and triggers on change", () => {
  const originalWindow = global.window;
  const added: string[] = [];
  const removed: string[] = [];

  try {
    (global as any).window = {
      matchMedia: (query: string) => ({
        matches: true,
        addEventListener: (event: string, fn: any) => {
          added.push(query);
        },
        removeEventListener: (event: string, fn: any) => {
          removed.push(query);
        },
      }),
    };

    let capValue = true;
    const unsub = subscribeToFineHoverCapability((hasCap) => {
      capValue = hasCap;
    });

    assert.equal(added.length, 2, "Must subscribe to both primary and any-pointer fine media queries");
    assert.equal(removed.length, 0, "No removeEventListener before unsubscription");

    unsub();
    assert.equal(removed.length, 2, "Must unsubscribe from both media queries on cleanup");
  } finally {
    global.window = originalWindow;
  }
});
