import { normalizeEpisodeKey } from "./episodeUtils.ts";

interface EpisodeLike {
  name: string;
  link_m3u8?: string;
}

interface HistoryLike {
  movieSlug?: string;
  episodeName?: string;
  episodeKey?: string;
  currentTime?: number;
  updatedAt?: string | number | Date;
}

export function findEpisodeHistory(
  history: HistoryLike[] | undefined,
  movieSlug: string,
  episodeName: string,
) {
  if (!Array.isArray(history)) return null;
  const episodeKey = normalizeEpisodeKey(episodeName);
  const latestMovieItem = history
    .filter((item) => item.movieSlug === movieSlug)
    .sort(
      (left, right) =>
        new Date(right.updatedAt || 0).getTime() -
        new Date(left.updatedAt || 0).getTime(),
    )[0];
  if (!latestMovieItem) return null;
  return normalizeEpisodeKey(
    latestMovieItem.episodeKey || latestMovieItem.episodeName || "",
  ) === episodeKey ? latestMovieItem : null;
}

export function getResumeTime(
  historyItem: HistoryLike | null,
  failoverTime = 0,
) {
  const savedTime = Number(historyItem?.currentTime) > 5
    ? Number(historyItem?.currentTime)
    : 0;
  return Math.max(savedTime, Number.isFinite(failoverTime) ? failoverTime : 0);
}

export function findNextEpisode<T extends EpisodeLike>(
  sortedEpisodes: T[],
  currentEpisodeName: string,
) {
  const currentKey = normalizeEpisodeKey(currentEpisodeName);
  const currentIndex = sortedEpisodes.findIndex(
    (episode) => normalizeEpisodeKey(episode.name) === currentKey,
  );
  return currentIndex >= 0 ? sortedEpisodes[currentIndex + 1] || null : null;
}

export function shouldPrefetchNextManifest(currentTime: number, duration: number) {
  return Number.isFinite(currentTime) &&
    Number.isFinite(duration) &&
    duration > 0 &&
    currentTime >= duration * 0.8 &&
    duration - currentTime <= 120;
}
