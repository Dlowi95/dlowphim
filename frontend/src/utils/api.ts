const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
// Reusable config variable for Movie API Domain
export const MOVIE_API_DOMAIN = process.env.NEXT_PUBLIC_MOVIE_API_DOMAIN || "https://phimapi.com";

export type MovieSourcePreference = "active" | "fallback" | "phimapi" | "ophim";

const buildProxyUrl = (path: string, source: MovieSourcePreference): string =>
  `${API_URL}/movies/ophim-proxy?path=${encodeURIComponent(path)}&source=${encodeURIComponent(source)}`;

/**
 * Route movie API requests through the backend cache. The backend selects
 * PhimAPI/OPhim from admin settings, so frontend builds do not pin a provider.
 */
export const getProxyUrl = (
  originalUrl: string,
  source: MovieSourcePreference = "active"
): string => {
  try {
    // Nếu truyền vào là link tương đối (ví dụ: /v1/api/...)
    if (originalUrl.startsWith("/")) {
      return buildProxyUrl(originalUrl, source);
    }

    const url = new URL(originalUrl);
    // Nếu là API của backend của chính chúng ta thì không cần proxy
    if (url.origin === API_URL) {
      return originalUrl;
    }
    
    // Nếu là gọi sang Ophim, KKPhim hoặc các nguồn cào phim khác
    if (
      url.hostname.includes("ophim") || 
      url.hostname.includes("kkphim") || 
      url.hostname.includes("phimimg") ||
      url.hostname.includes("phimapi") ||
      url.origin === MOVIE_API_DOMAIN
    ) {
      const pathWithQuery = url.pathname + url.search;
      return buildProxyUrl(pathWithQuery, source);
    }
  } catch (e) {
    console.error("Lỗi parse URL trong getProxyUrl:", e);
  }
  return originalUrl;
};
