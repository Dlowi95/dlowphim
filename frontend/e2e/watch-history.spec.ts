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

async function mockBackend(page: Page, authenticatedHistory: unknown[] = []) {
  await page.route("http://localhost:5000/**", async (route) => {
    const url = new URL(route.request().url());
    let body: unknown = {};
    let status = 200;

    if (url.pathname.includes("/movies/check-blocked/")) body = { isBlocked: false };
    else if (url.pathname === "/movies/ophim-proxy") body = { status: true, movie, episodes: movie.episodes, _sourceId: "phimapi" };
    else if (url.pathname.includes("/movies/resolved-detail/")) body = { status: true, movie, episodes: movie.episodes, _sourceId: "ophim" };
    else if (url.pathname === "/playback-health/reputation") body = [];
    else if (url.pathname.startsWith("/auth/me")) {
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

test("Watch ghép nguồn và chuyển đúng tập từ URL", async ({ page }) => {
  await mockBackend(page);
  await page.goto("/watch/phim-kiem-thu-e2e?ep=T%E1%BA%ADp%2002");

  await expect(page.getByText("Phim kiểm thử E2E", { exact: false }).first()).toBeVisible();
  await expect(page.getByText("Tập 02", { exact: true }).first()).toBeVisible();
  await expect(page).toHaveURL(/ep=T(%E1%BA%ADp|ập)%2002/i);
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
