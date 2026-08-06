import type { Metadata } from "next";
import MovieDetailClient from "./MovieDetailClient";

type MovieMetadata = {
  name?: string;
  origin_name?: string;
  content?: string;
  thumb_url?: string;
  poster_url?: string;
  year?: number;
};

const FALLBACK_IMAGE = "/images/cinema.png";

const toAbsoluteImage = (path?: string) => {
  if (!path) return FALLBACK_IMAGE;
  if (/^https?:\/\//i.test(path)) return path;
  const cleanPath = path.replace(/^\/+/, "");
  if (!cleanPath.includes("/")) {
    return `https://img.ophim.live/uploads/movies/${cleanPath}`;
  }
  return `https://phimimg.com/${cleanPath}`;
};

const cleanDescription = (content?: string) => {
  const plainText = (content || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&amp;|&quot;|&#39;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return plainText.slice(0, 155);
};

async function getMovieMetadata(slug: string): Promise<MovieMetadata | null> {
  const apiUrl = process.env.BACKEND_INTERNAL_URL
    || process.env.NEXT_PUBLIC_API_URL
    || "http://localhost:5000";
  const tmdbUpcomingMatch = slug.match(/^tmdb-(\d+)(?:-|$)/);
  if (tmdbUpcomingMatch) {
    try {
      const response = await fetch(`${apiUrl}/movies/upcoming/${tmdbUpcomingMatch[1]}`, {
        next: { revalidate: 1800 },
      });
      if (response.ok) {
        const data = await response.json();
        const movie = data.movie || data.data?.item;
        if (movie?.name) return movie;
      }
    } catch {
      // Continue to the standard sources below.
    }
  }

  const attempts = [
    { path: `/phim/${slug}`, source: "active" },
    { path: `/v1/api/phim/${slug}`, source: "active" },
    { path: `/phim/${slug}`, source: "fallback" },
    { path: `/v1/api/phim/${slug}`, source: "fallback" },
  ];

  for (const attempt of attempts) {
    try {
      const url = `${apiUrl}/movies/ophim-proxy?path=${encodeURIComponent(attempt.path)}&source=${attempt.source}`;
      const response = await fetch(url, { next: { revalidate: 1800 } });
      if (!response.ok) continue;
      const data = await response.json();
      const movie = data.movie || data.data?.item;
      if (movie?.name) return movie;
    } catch {
      // Metadata has a safe fallback below; the client still handles source failover.
    }
  }

  try {
    const response = await fetch(`${apiUrl}/movies/custom/${slug}`, {
      next: { revalidate: 1800 },
    });
    if (response.ok) {
      const movie = await response.json();
      if (movie?.name) return movie;
    }
  } catch {
    // Use generic metadata when every configured source is unavailable.
  }
  return null;
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const movie = await getMovieMetadata(params.slug);
  if (!movie) {
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
    alternates: { canonical: `/movie/${params.slug}` },
    openGraph: {
      type: "video.movie",
      locale: "vi_VN",
      siteName: "DlowPhim",
      title,
      description,
      url: `/movie/${params.slug}`,
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

export default function MoviePage({ params }: { params: { slug: string } }) {
  return <MovieDetailClient slug={params.slug} />;
}
