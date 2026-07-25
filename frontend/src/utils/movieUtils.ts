export function cleanMovieName(name: string): string {
  if (!name) return "";
  let cleaned = name
    // Remove (Phần X) or Phần X or Phần IV
    .replace(/\s*\(?\s*Phần\s+(?:\d+|[IVXLCDM]+)\s*\)?/gi, "")
    // Remove (Season X) or Season X or Season IV
    .replace(/\s*\(?\s*Season\s+(?:\d+|[IVXLCDM]+)\s*\)?/gi, "")
    // Remove (SSX) or SS X or (SS X)
    .replace(/\s*\(?\s*SS\s*\d+\s*\)?/gi, "")
    // Remove (ssX) or ss X or (ss X)
    .replace(/\s*\(?\s*ss\s*\d+\s*\)?/gi, "");

  // Remove trailing dashes, colons, slashes, or whitespace left over
  cleaned = cleaned.replace(/[\s\-:/\\]+$/, "").trim();
  
  return cleaned;
}

export function cleanSlug(slug: string): string {
  if (!slug) return "";
  let cleaned = slug
    .replace(/-phan-\d+/gi, "")
    .replace(/-season-\d+/gi, "")
    .replace(/-ss\d+/gi, "")
    .replace(/-p\d+/gi, "")
    .replace(/-evolution/gi, "")
    .replace(/-genesis/gi, "")
    .replace(/-movie/gi, "")
    .replace(/-ova/gi, "")
    .replace(/-special/gi, "")
    // Remove trailing years (e.g. -2009, -2006)
    .replace(/-\d{4}$/g, "")
    .trim();

  // Remove trailing dashes or colons if any
  cleaned = cleaned.replace(/[\s\-:/\\]+$/, "").trim();
  return cleaned;
}

export function getImageUrl(path?: string): string {
  if (!path) return "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&q=80";
  let url = path.trim();
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  const cleanPath = url.replace(/^\/+/, "");
  if (cleanPath.startsWith("public/")) {
    return `https://phim.nguonc.com/${cleanPath}`;
  }
  // Nếu là tên file tương đối đơn thuần của OPhim (không chứa dấu gạch chéo /)
  if (!cleanPath.includes("/")) {
    return `https://img.ophim.live/uploads/movies/${cleanPath}`;
  }
  return `https://phimimg.com/${cleanPath}`;
}

export function isValidMovieImage(path?: string): boolean {
  if (!path || !path.trim()) return false;
  const p = path.toLowerCase().trim();
  if (p.endsWith("-1.png")) return false;
  if (p.includes("no-image") || p.includes("placeholder") || p.includes("default")) return false;
  return true;
}

export function getBestMovieImage(movie: any, preferAspect: 'poster' | 'thumb' = 'thumb'): string {
  if (!movie) return "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&q=80";
  const poster = movie.poster_url || movie.poster;
  const thumb = movie.thumb_url || movie.thumbnail;

  const validPoster = isValidMovieImage(poster) ? poster : null;
  const validThumb = isValidMovieImage(thumb) ? thumb : null;

  if (preferAspect === 'poster') {
    return getImageUrl(validPoster || validThumb || poster || thumb);
  }
  return getImageUrl(validThumb || validPoster || thumb || poster);
}
