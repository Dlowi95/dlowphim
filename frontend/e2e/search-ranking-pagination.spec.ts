import { expect, test, type Page } from "@playwright/test";

const relevantMovies = [
  {
    _id: "chronicle-exact",
    slug: "suc-manh-vo-hinh",
    name: "Sức Mạnh Vô Hình",
    origin_name: "Chronicle",
    poster_url: "/images/movie-placeholder.svg",
    thumb_url: "/images/movie-placeholder.svg",
    quality: "HD",
    lang: "Vietsub",
    year: 2012,
  },
  {
    _id: "chronicle-related",
    slug: "arthdal-chronicles",
    name: "Biên Niên Sử Arthdal",
    origin_name: "Arthdal Chronicles",
    poster_url: "/images/movie-placeholder.svg",
    thumb_url: "/images/movie-placeholder.svg",
    quality: "HD",
    lang: "Vietsub",
    year: 2019,
  },
];

async function mockSearch(page: Page) {
  await page.route("**/movies/discovery?**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      status: true,
      availability: "ready",
      source: "phimapi",
      items: relevantMovies,
      pagination: { currentPage: 2, totalItems: 34, totalItemsPerPage: 24, totalPages: 2 },
      fallback: { used: false, reason: null },
      stale: { used: false, savedAt: null },
    }),
  }));
  await page.route("**/auth/me", (route) => route.fulfill({ status: 401, contentType: "application/json", body: "{}" }));
  await page.route("**/system-settings/public", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.route("https://accounts.google.com/**", (route) => route.abort());
}

test("search clamps stale provider pages and only renders the ranked result page", async ({ browser }) => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
  ]) {
    const context = await browser.newContext({ viewport, hasTouch: viewport.width < 768 });
    const page = await context.newPage();
    await mockSearch(page);

    await page.goto("/search?keyword=chronicle&page=3");

    await expect(page).toHaveURL(/keyword=chronicle&page=2/);
    await expect(page.getByText("Sức Mạnh Vô Hình", { exact: true })).toBeVisible();
    await expect(page.getByText("Biên Niên Sử Arthdal", { exact: true })).toBeVisible();
    await expect(page.getByText("Gia Tộc Bridgerton", { exact: true })).toHaveCount(0);
    if (viewport.width < 768) {
      await expect(page.getByText("Trang 2 / 2", { exact: true })).toBeVisible();
    } else {
      await expect(page.getByRole("button", { name: "2", exact: true })).toHaveClass(/bg-pink-500/);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth === document.documentElement.clientWidth)).toBe(true);

    await context.close();
  }
});
