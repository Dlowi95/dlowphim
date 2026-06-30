let cachedApiKey: string | null = null;

export const DEFAULT_TMDB_API_KEY = "591c025bb1641315ae087330271132bc";

/**
 * Lấy API Key TMDB động từ cấu hình hệ thống (Settings), có cơ chế cache trong bộ nhớ
 * để tránh việc gửi nhiều request API dư thừa lên Backend.
 */
export const getTmdbApiKey = async (apiUrl: string): Promise<string> => {
  if (cachedApiKey) return cachedApiKey;

  try {
    const res = await fetch(`${apiUrl}/system-settings`);
    if (res.ok) {
      const data = await res.json();
      if (data.tmdbApiKey && data.tmdbApiKey.trim()) {
        const key = data.tmdbApiKey.trim();
        // Bỏ qua các API Key lỗi thời/bị thu hồi trong quá khứ
        if (
          key !== "e897a0225bb9007f33d45543c3f1591f" &&
          key !== "53a1f81cf9b82cd5516086708b51d451"
        ) {
          cachedApiKey = key;
          return key;
        }
      }
    }
  } catch (e) {
    console.error("Lỗi khi lấy TMDB API Key từ system settings:", e);
  }

  return DEFAULT_TMDB_API_KEY;
};

/**
 * Xóa cache API Key (dùng khi Admin cập nhật cấu hình mới để ép tải lại key mới)
 */
export const clearTmdbApiKeyCache = () => {
  cachedApiKey = null;
};
