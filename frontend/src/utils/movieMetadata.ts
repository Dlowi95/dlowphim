import type { Metadata } from "next";

export type MovieMetadata = {
  name?: string;
  origin_name?: string;
  content?: string;
  thumb_url?: string;
  poster_url?: string;
  year?: number;
};

const FALLBACK_IMAGE = "/images/cinema.png";

export const toAbsoluteImage = (path?: string) => {
  if (!path) return FALLBACK_IMAGE;
  if (/^https?:\/\//i.test(path)) {
    if (
      (path.includes("img.ophimimg.com") || path.includes("img.ophim.live") || path.includes("ophim.cc") || path.includes("ophim1.com")) &&
      !path.includes("/uploads/movies/")
    ) {
      const filename = path.split("/").pop() || "";
      return `https://img.ophim.live/uploads/movies/${filename}`;
    }
    return path;
  }
  const cleanPath = path.replace(/^\/+/, "");
  if (!cleanPath.includes("/")) {
    return `https://img.ophim.live/uploads/movies/${cleanPath}`;
  }
  if (cleanPath.startsWith("uploads/movies/")) {
    return `https://img.ophim.live/${cleanPath}`;
  }
  return `https://phimimg.com/${cleanPath}`;
};

export const cleanDescription = (content?: string) => {
  const plainText = (content || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&amp;|&quot;|&#39;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return plainText.slice(0, 155);
};

export async function getMovieMetadata(
  slug: string,
  options?: { timeoutMs?: number; customFetch?: typeof fetch },
): Promise<MovieMetadata | null> {
  const totalBudgetMs = options?.timeoutMs ?? 2500;
  const overallController = new AbortController();

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const deadlinePromise = new Promise<null>((resolve) => {
    timeoutHandle = setTimeout(() => {
      overallController.abort();
      resolve(null);
    }, totalBudgetMs);
  });

  const workerPromise = (async (): Promise<MovieMetadata | null> => {
    const apiUrl = process.env.BACKEND_INTERNAL_URL
      || process.env.NEXT_PUBLIC_API_URL
      || "http://localhost:5000";
    const fetchFn = options?.customFetch || fetch;

    try {
      const tmdbUpcomingMatch = slug.match(/^tmdb-(\d+)(?:-|$)/);
      if (tmdbUpcomingMatch) {
        try {
          const response = await fetchFn(`${apiUrl}/movies/upcoming/${tmdbUpcomingMatch[1]}`, {
            signal: overallController.signal,
            next: { revalidate: 1800 },
          });
          if (response.ok) {
            const data = await response.json();
            const movie = data.movie || data.data?.item;
            if (movie?.name) return movie;
          }
        } catch {}
      }

      if (overallController.signal.aborted) return null;

      const attempts = [
        { path: `/phim/${slug}`, source: "active" },
        { path: `/phim/${slug}`, source: "fallback" },
      ];

      for (const attempt of attempts) {
        if (overallController.signal.aborted) break;
        try {
          const url = `${apiUrl}/movies/ophim-proxy?path=${encodeURIComponent(attempt.path)}&source=${attempt.source}`;
          const response = await fetchFn(url, {
            signal: overallController.signal,
            next: { revalidate: 1800 },
          });
          if (!response.ok) continue;
          const data = await response.json();
          const movie = data.movie || data.data?.item;
          if (movie?.name) return movie;
        } catch {}
      }

      if (!overallController.signal.aborted) {
        try {
          const response = await fetchFn(`${apiUrl}/movies/custom/${slug}`, {
            signal: overallController.signal,
            next: { revalidate: 1800 },
          });
          if (response.ok) {
            const movie = await response.json();
            if (movie?.name) return movie;
          }
        } catch {}
      }
    } catch {}
    return null;
  })();

  try {
    return await Promise.race([workerPromise, deadlinePromise]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

export function buildMovieMetadata(movie: MovieMetadata | null, slug: string): Metadata {
  if (!movie || !movie.name) {
    return {
      title: "Xem phim trực tuyến | DlowPhim",
      description: "Xem phim chất lượng cao, Vietsub và Lồng tiếng tại DlowPhim.",
    };
  }

  const title = `${movie.name}${movie.year ? ` (${movie.year})` : ""} | DlowPhim`;
  const description = cleanDescription(movie.content)
    || `Xem ${movie.name}${movie.origin_name ? ` - ${movie.origin_name}` : ""} chất lượng cao tại DlowPhim.`;
  const image = toAbsoluteImage(movie.poster_url || movie.thumb_url);

  return {
    title,
    description,
    alternates: { canonical: `/movie/${slug}` },
    openGraph: {
      type: "video.movie",
      locale: "vi_VN",
      siteName: "DlowPhim",
      title,
      description,
      url: `/movie/${slug}`,
      images: [{ url: image, alt: movie.name }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}
