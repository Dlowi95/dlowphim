export function normalizeEpisodeKey(name = ""): string {
  const normalized = String(name)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");

  if (!normalized) return "";
  if (/\b(full|tron bo|complete)\b/.test(normalized)) return "full";

  const numberTokens = normalized.match(/\d+(?:\.\d+)?/g);
  if (numberTokens?.length) {
    return numberTokens
      .map((token) => {
        const value = Number(token);
        return Number.isFinite(value) ? String(value) : token;
      })
      .join("-");
  }

  return normalized
    .replace(/\b(tap|episode|ep)\b/g, "")
    .replace(/[^a-z0-9]+/g, "") || normalized.replace(/\s+/g, "-");
}

export function findMatchingEpisodeIndex<T extends { name?: string }>(
  episodes: T[],
  targetName: string,
  fallbackIndex = 0,
): number {
  const targetKey = normalizeEpisodeKey(targetName);
  const matchedIndex = episodes.findIndex(
    (episode) => normalizeEpisodeKey(episode.name || "") === targetKey,
  );
  if (matchedIndex >= 0) return matchedIndex;
  return episodes[fallbackIndex] ? fallbackIndex : 0;
}
