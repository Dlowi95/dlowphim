const { chromium } = require("playwright");

const normalizeUrl = (value) => {
  try {
    const url = new URL(value);
    for (const key of ["_rsc", "t", "timestamp", "cacheBust"]) url.searchParams.delete(key);
    url.hash = "";
    return url.toString();
  } catch {
    return value;
  }
};

async function auditViewport(browser, width, height, label) {
  const page = await browser.newPage({ viewport: { width, height } });
  const requests = [];
  const failures = [];
  const consoleErrors = [];

  page.on("request", (request) => {
    if (["fetch", "xhr", "websocket"].includes(request.resourceType())) {
      requests.push({ type: request.resourceType(), url: normalizeUrl(request.url()) });
    }
  });
  page.on("requestfailed", (request) => failures.push({ url: request.url(), reason: request.failure()?.errorText }));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(10000);

  const initial = await page.evaluate(() => ({
    nodes: document.querySelectorAll("body *").length,
    images: document.images.length,
    imageSources: [...document.images].map((image) => image.currentSrc || image.src).filter(Boolean),
    scrollHeight: document.documentElement.scrollHeight,
  }));

  let stableBottomPasses = 0;
  let previousHeight = 0;
  for (let index = 0; index < 40 && stableBottomPasses < 4; index += 1) {
    await page.evaluate(() => scrollBy(0, Math.max(420, innerHeight * 0.65)));
    await page.waitForTimeout(650);
    const state = await page.evaluate(() => ({
      atBottom: scrollY + innerHeight >= document.documentElement.scrollHeight - 4,
      height: document.documentElement.scrollHeight,
    }));
    if (state.atBottom && state.height === previousHeight) stableBottomPasses += 1;
    else stableBottomPasses = 0;
    previousHeight = state.height;
  }
  await page.waitForTimeout(4000);

  const final = await page.evaluate(() => {
    const visible = (element) => {
      const style = getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden" && element.getBoundingClientRect().width > 0;
    };
    const images = [...document.images];
    const visibleImages = images.filter(visible);
    const sourceCounts = images.reduce((counts, image) => {
      const source = image.currentSrc || image.src;
      if (source) counts[source] = (counts[source] || 0) + 1;
      return counts;
    }, {});
    const text = document.body.innerText.toLowerCase();
    return {
      nodes: document.querySelectorAll("body *").length,
      images: images.length,
      visibleImages: visibleImages.length,
      brokenVisibleImages: visibleImages.filter((image) => image.complete && image.naturalWidth === 0).map((image) => image.currentSrc || image.src),
      stillLoadingVisibleImages: visibleImages.filter((image) => !image.complete).length,
      transparentLoadedImages: visibleImages.filter((image) => image.complete && image.naturalWidth > 0 && Number(getComputedStyle(image).opacity) === 0).length,
      duplicateDomImageSources: Object.entries(sourceCounts).filter(([, count]) => count > 1).map(([source, count]) => ({ source, count })),
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      scrollHeight: document.documentElement.scrollHeight,
      sections: {
        country: text.includes("phim hàn quốc mới") && text.includes("phim việt nam mới") && text.includes("phim us-uk mới"),
        top10: text.includes("top 10 phim bộ hôm nay"),
        upcoming: text.includes("phim sắp chiếu"),
        cinema: text.includes("mãn nhãn với phim chiếu rạp"),
        anime: text.includes("kho tàng anime mới nhất"),
        latest: text.includes("phim mới cập nhật"),
      },
      mobileHeroMounted: [...document.querySelectorAll("section")].some((element) => element.className.includes("md:hidden") && element.textContent.includes("Đề xuất")),
      desktopHeroMounted: [...document.querySelectorAll("div")].some((element) => element.className.includes("h-[88vh]") && element.className.includes("md:flex")),
    };
  });

  const requestCounts = requests.reduce((counts, request) => {
    const key = `${request.type} ${request.url}`;
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
  const duplicateRequests = Object.entries(requestCounts)
    .filter(([, count]) => count > 1)
    .map(([request, count]) => ({ request, count }));

  await page.close();
  return {
    label,
    viewport: { width, height },
    initial,
    final,
    requestSummary: {
      fetchXhr: requests.filter((request) => request.type !== "websocket").length,
      websockets: requests.filter((request) => request.type === "websocket"),
      duplicateRequests,
      failures,
      consoleErrors,
    },
  };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const mobile = await auditViewport(browser, 390, 844, "mobile");
  const desktop = await auditViewport(browser, 1440, 900, "desktop");
  console.log(JSON.stringify({ mobile, desktop }, null, 2));
  await browser.close();
})();
