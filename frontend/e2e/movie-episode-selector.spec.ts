import { expect, test, type Page } from "@playwright/test";

const episodes = Array.from({ length: 1196 }, (_, index) => {
  const number = index + 16;
  return {
    name: String(number),
    slug: `tap-${number}`,
    filename: `Conan tập ${number}`,
    link_embed: `https://embed.example/${number}`,
    link_m3u8: `https://stream.example/${number}.m3u8`,
  };
});

const movie = {
  _id: "conan-fixture",
  name: "Thám Tử Lừng Danh Conan",
  slug: "tham-tu-lung-danh-conan",
  origin_name: "Detective Conan",
  content: "Dữ liệu kiểm thử nhóm tập bị thiếu các tập đầu.",
  type: "series",
  status: "ongoing",
  thumb_url: "/images/movie-placeholder.svg",
  poster_url: "/images/movie-placeholder.svg",
  time: "25 phút/tập",
  episode_current: "Tập 1211",
  episode_total: "",
  year: 1996,
  actor: [],
  director: [],
  category: [{ name: "Hoạt Hình", slug: "hoat-hinh" }],
  country: [{ name: "Nhật Bản", slug: "nhat-ban" }],
  episodes: [{ server_name: "Vietsub", server_data: episodes }],
};

async function mockMovieDetail(page: Page) {
  await page.route("**/movies/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.includes("/check-blocked/")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ isBlocked: false }) });
    }
    if (pathname.includes("/logo/")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: true, movie, episodes: movie.episodes }),
    });
  });
  await page.route("**/auth/me", (route) => route.fulfill({ status: 401, contentType: "application/json", body: "{}" }));
  await page.route("**/ratings/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ average: 0, count: 0 }) }));
  await page.route("**/comments/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/socket.io/**", (route) => route.fulfill({ status: 200, contentType: "text/plain", body: "ok" }));
}

test("episode ranges use actual provider labels and the picker stays responsive", async ({ browser }) => {
  for (const viewport of [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 440, height: 956 },
    { width: 767, height: 1000 },
    { width: 768, height: 1024 },
    { width: 1024, height: 900 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ]) {
    const context = await browser.newContext({ viewport, hasTouch: viewport.width < 768 });
    const page = await context.newPage();
    await mockMovieDetail(page);
    await page.goto("/movie/tham-tu-lung-danh-conan");

    const mobile = viewport.width < 768;
    const picker = page.getByTestId(`${mobile ? "mobile" : "desktop"}-episode-picker-0`);
    const batchSelector = page.getByTestId(`${mobile ? "mobile" : "desktop"}-episode-batch-selector-0`);
    await expect(picker).toBeVisible();
    await expect(batchSelector.getByText("Chọn tập phim", { exact: true })).toBeVisible();
    await expect(batchSelector).toHaveCSS("border-top-style", "solid");
    await expect(picker.getByText(/Đang xem nhóm|tập khả dụng/i)).toHaveCount(0);

    const lastRange = mobile ? "1166–1211" : "Tập 1116 - 1211";
    await batchSelector.getByRole("button", { name: lastRange, exact: true }).click();
    const lastEpisode = picker.getByRole("button", { name: "Tập 1211", exact: true });
    await expect(lastEpisode).toBeVisible();
    expect(await lastEpisode.evaluate((button, selector) => !button.closest(selector), `[data-testid="${mobile ? "mobile" : "desktop"}-episode-batch-selector-0"]`)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth === document.documentElement.clientWidth)).toBe(true);

    await context.close();
  }
});
