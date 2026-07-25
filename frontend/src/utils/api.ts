const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
// Reusable config variable for Movie API Domain
export const MOVIE_API_DOMAIN = process.env.NEXT_PUBLIC_MOVIE_API_DOMAIN || "https://ophim1.com";

// Reusable config variable for Fallback/Secondary Movie API Domain (KKPhim/PhimAPI)
export const FALLBACK_API_DOMAIN = process.env.NEXT_PUBLIC_FALLBACK_API_DOMAIN || "https://phimapi.com";

/**
 * Chuyển đổi một URL gọi API Ophim trực tiếp thành một URL đi qua Proxy Cache ở Backend DlowPhim.
 * Giúp tối ưu hóa tốc độ load (mất 5-10ms thay vì 1-2s) và hoạt động bền bỉ kể cả khi Ophim sập.
 */
export const getProxyUrl = (originalUrl: string): string => {
  try {
    // Nếu truyền vào là link tương đối (ví dụ: /v1/api/...)
    if (originalUrl.startsWith("/")) {
      return `${API_URL}/movies/ophim-proxy?path=${encodeURIComponent(originalUrl)}`;
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
      return `${API_URL}/movies/ophim-proxy?path=${encodeURIComponent(pathWithQuery)}`;
    }
  } catch (e) {
    console.error("Lỗi parse URL trong getProxyUrl:", e);
  }
  return originalUrl;
};
