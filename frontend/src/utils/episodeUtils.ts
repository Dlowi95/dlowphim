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

function episodeBoundary(name: string | undefined, edge: "start" | "end"): string | null {
  const tokens = normalizeEpisodeKey(name || "")
    .split("-")
    .filter((token) => /^\d+(?:\.\d+)?$/.test(token));
  if (!tokens.length) return null;
  return edge === "start" ? tokens[0] : tokens[tokens.length - 1];
}

export function getEpisodeBatchRange<T extends { name?: string }>(
  episodes: T[],
  batchIndex: number,
  batchSize: number,
): { start: string; end: string; count: number } {
  const safeBatchIndex = Math.max(0, Math.floor(batchIndex));
  const safeBatchSize = Math.max(1, Math.floor(batchSize));
  const startIndex = safeBatchIndex * safeBatchSize;
  const batch = episodes.slice(startIndex, startIndex + safeBatchSize);
  const fallbackStart = startIndex + 1;
  const fallbackEnd = startIndex + Math.max(batch.length, 1);

  return {
    start: episodeBoundary(batch[0]?.name, "start") || String(fallbackStart),
    end: episodeBoundary(batch[batch.length - 1]?.name, "end") || String(fallbackEnd),
    count: batch.length,
  };
}
