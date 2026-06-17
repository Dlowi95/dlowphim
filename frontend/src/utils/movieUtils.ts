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
