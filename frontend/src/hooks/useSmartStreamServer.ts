"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface SmartStreamEpisode {
  name: string;
  link_m3u8?: string;
  link_embed?: string;
}

export interface SmartStreamServer {
  server_name: string;
  server_data: SmartStreamEpisode[];
}

interface StoredServerPreference {
  preferredKey: string;
  updatedAt: number;
  latencies: Record<string, number>;
}

interface UseSmartStreamServerOptions {
  movieSlug: string;
  servers: SmartStreamServer[];
  activeServerIndex: number;
  activeEpisodeIndex: number;
  setActiveServerIndex: (index: number) => void;
  setActiveEpisodeIndex: (index: number) => void;
  setPlayerType: (type: "embed" | "hls") => void;
}

const PREFERENCE_TTL_MS = 6 * 60 * 60 * 1000;
const PROBE_TIMEOUT_MS = 3500;

function normalizeEpisodeName(name = ""): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/tap\s*/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function findEpisodeIndex(
  server: SmartStreamServer,
  targetName: string,
  fallbackIndex: number,
): number {
  const normalizedTarget = normalizeEpisodeName(targetName);
  const matchedIndex = server.server_data.findIndex(
    (episode) => normalizeEpisodeName(episode.name) === normalizedTarget,
  );
  if (matchedIndex >= 0) return matchedIndex;
  return server.server_data[fallbackIndex] ? fallbackIndex : 0;
}

function getServerKey(server: SmartStreamServer): string {
  const firstHls =
    server.server_data.find((episode) => episode.link_m3u8)?.link_m3u8 || "";
  let origin = firstHls;
  try {
    origin = firstHls ? new URL(firstHls).origin : "";
  } catch {
    // Keep the raw value when a provider returns a non-standard URL.
  }
  return `${server.server_name.toLowerCase().trim()}|${origin}`;
}

function getAudioTrackKey(serverName = ""): string {
  const normalized = serverName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
  if (normalized.includes("thuyet minh")) return "thuyet-minh";
  if (normalized.includes("long tieng")) return "long-tieng";
  return "vietsub";
}

async function probeManifest(url: string): Promise<number | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  const startedAt = performance.now();
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return null;
    await response.text();
    return Math.max(1, Math.round(performance.now() - startedAt));
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const worker = async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await mapper(items[index]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
}

export function useSmartStreamServer({
  movieSlug,
  servers,
  activeServerIndex,
  activeEpisodeIndex,
  setActiveServerIndex,
  setActiveEpisodeIndex,
  setPlayerType,
}: UseSmartStreamServerOptions) {
  const [latencies, setLatencies] = useState<Record<number, number>>({});
  const [isProbing, setIsProbing] = useState(false);
  const failedServerKeysRef = useRef(new Set<string>());
  const manualSelectionRef = useRef(false);
  const switchingRef = useRef(false);
  const serversRef = useRef(servers);
  const activeServerIndexRef = useRef(activeServerIndex);
  const activeEpisodeIndexRef = useRef(activeEpisodeIndex);
  const latenciesRef = useRef(latencies);

  serversRef.current = servers;
  activeServerIndexRef.current = activeServerIndex;
  activeEpisodeIndexRef.current = activeEpisodeIndex;
  latenciesRef.current = latencies;

  const serverSignature = useMemo(
    () =>
      servers
        .map(
          (server) =>
            `${getServerKey(server)}:${server.server_data
              .map((episode) => `${episode.name}:${episode.link_m3u8 || ""}`)
              .join(",")}`,
        )
        .join("||"),
    [servers],
  );

  const preferenceKey = `dlowphim_stream_server:${movieSlug}`;
  const readPreference = useCallback((): StoredServerPreference | null => {
    try {
      const raw = localStorage.getItem(preferenceKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, [preferenceKey]);

  const savePreference = useCallback(
    (serverIndex: number, measuredLatencies = latenciesRef.current) => {
      const server = serversRef.current[serverIndex];
      if (!server) return;
      const keyedLatencies: Record<string, number> = {};
      Object.entries(measuredLatencies).forEach(([index, latency]) => {
        const measuredServer = serversRef.current[Number(index)];
        if (measuredServer && Number.isFinite(latency)) {
          keyedLatencies[getServerKey(measuredServer)] = latency;
        }
      });
      const value: StoredServerPreference = {
        preferredKey: getServerKey(server),
        updatedAt: Date.now(),
        latencies: keyedLatencies,
      };
      try {
        localStorage.setItem(preferenceKey, JSON.stringify(value));
      } catch {
        // Browsers in private mode can reject localStorage writes.
      }
    },
    [preferenceKey],
  );

  const switchToServer = useCallback(
    (serverIndex: number, targetEpisodeName: string, type: "embed" | "hls") => {
      const server = serversRef.current[serverIndex];
      if (!server) return;
      const episodeIndex = findEpisodeIndex(
        server,
        targetEpisodeName,
        activeEpisodeIndexRef.current,
      );
      setActiveServerIndex(serverIndex);
      setActiveEpisodeIndex(episodeIndex);
      setPlayerType(type);
    },
    [setActiveEpisodeIndex, setActiveServerIndex, setPlayerType],
  );

  useEffect(() => {
    failedServerKeysRef.current.clear();
    manualSelectionRef.current = false;
    switchingRef.current = false;
    setLatencies({});
  }, [movieSlug]);

  const activeEpisodeName = normalizeEpisodeName(
    servers[activeServerIndex]?.server_data[activeEpisodeIndex]?.name || "",
  );
  const activeAudioTrack = getAudioTrackKey(
    servers[activeServerIndex]?.server_name || "",
  );

  useEffect(() => {
    failedServerKeysRef.current.clear();
    switchingRef.current = false;
  }, [movieSlug, activeEpisodeName]);

  useEffect(() => {
    switchingRef.current = false;
  }, [activeServerIndex]);

  useEffect(() => {
    if (!movieSlug || servers.length < 1 || !activeEpisodeName) return;
    let cancelled = false;
    const stored = readPreference();
    const measurableServerKeys = servers
      .filter((server) =>
        getAudioTrackKey(server.server_name) === activeAudioTrack &&
        server.server_data.some((episode) => episode.link_m3u8),
      )
      .map(getServerKey);
    const storedIsFresh =
      stored &&
      Date.now() - stored.updatedAt < PREFERENCE_TTL_MS &&
      measurableServerKeys.every((key) =>
        Number.isFinite(stored.latencies[key]),
      );

    if (storedIsFresh) {
      const restoredLatencies: Record<number, number> = {};
      servers.forEach((server, index) => {
        const latency = stored.latencies[getServerKey(server)];
        if (Number.isFinite(latency)) restoredLatencies[index] = latency;
      });
      setLatencies(restoredLatencies);
      const preferredIndex = servers.findIndex(
        (server) => getServerKey(server) === stored.preferredKey,
      );
      if (preferredIndex >= 0 && !manualSelectionRef.current) {
        const episodeIndex = findEpisodeIndex(
          servers[preferredIndex],
          activeEpisodeName,
          activeEpisodeIndex,
        );
        const episode = servers[preferredIndex].server_data[episodeIndex];
        if (
          getAudioTrackKey(servers[preferredIndex].server_name) === activeAudioTrack &&
          (episode?.link_m3u8 || episode?.link_embed)
        ) {
          switchToServer(
            preferredIndex,
            activeEpisodeName,
            episode.link_m3u8 ? "hls" : "embed",
          );
        }
      }
      return;
    }

    const timer = setTimeout(async () => {
      setIsProbing(true);
      const candidates = servers
        .map((server, serverIndex) => {
          const episodeIndex = findEpisodeIndex(
            server,
            activeEpisodeName,
            activeEpisodeIndex,
          );
          const episode = server.server_data[episodeIndex];
          return { server, serverIndex, episode };
        })
        .filter(
          (candidate) =>
            getAudioTrackKey(candidate.server.server_name) === activeAudioTrack &&
            Boolean(candidate.episode?.link_m3u8),
        );

      const results = await mapWithConcurrency(
        candidates,
        4,
        async (candidate) => ({
          ...candidate,
          latency: await probeManifest(candidate.episode.link_m3u8 as string),
        }),
      );
      if (cancelled) return;

      const nextLatencies: Record<number, number> = {};
      results.forEach(({ serverIndex, latency }) => {
        if (latency !== null) nextLatencies[serverIndex] = latency;
      });
      setLatencies(nextLatencies);
      latenciesRef.current = nextLatencies;
      const fastest = results
        .filter((result) => result.latency !== null)
        .sort(
          (left, right) => (left.latency as number) - (right.latency as number),
        )[0];

      if (fastest) {
        savePreference(fastest.serverIndex, nextLatencies);
        if (!manualSelectionRef.current) {
          switchToServer(fastest.serverIndex, activeEpisodeName, "hls");
        }
      }
      setIsProbing(false);
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      setIsProbing(false);
    };
  }, [
    activeEpisodeIndex,
    activeEpisodeName,
    activeAudioTrack,
    movieSlug,
    readPreference,
    savePreference,
    serverSignature,
    switchToServer,
  ]);

  const markManualSelection = useCallback(() => {
    manualSelectionRef.current = true;
    failedServerKeysRef.current.clear();
  }, []);

  const getMatchingEpisode = useCallback((serverIndex: number) => {
    const currentServers = serversRef.current;
    const currentServer = currentServers[activeServerIndexRef.current];
    const currentEpisode =
      currentServer?.server_data[activeEpisodeIndexRef.current];
    const targetServer = currentServers[serverIndex];
    if (!targetServer || !currentEpisode) return targetServer?.server_data[0];
    const episodeIndex = findEpisodeIndex(
      targetServer,
      currentEpisode.name,
      activeEpisodeIndexRef.current,
    );
    return targetServer.server_data[episodeIndex];
  }, []);

  const selectServer = useCallback(
    (serverIndex: number, type: "embed" | "hls") => {
      const currentServer = serversRef.current[activeServerIndexRef.current];
      const currentEpisode =
        currentServer?.server_data[activeEpisodeIndexRef.current];
      if (!currentEpisode) return;
      markManualSelection();
      switchToServer(serverIndex, currentEpisode.name, type);
    },
    [markManualSelection, switchToServer],
  );

  const selectAutomaticServer = useCallback(
    (serverIndex: number, type: "embed" | "hls") => {
      const currentServer = serversRef.current[activeServerIndexRef.current];
      const currentEpisode =
        currentServer?.server_data[activeEpisodeIndexRef.current];
      if (!currentEpisode) return;
      manualSelectionRef.current = false;
      failedServerKeysRef.current.clear();
      switchToServer(serverIndex, currentEpisode.name, type);
    },
    [switchToServer],
  );

  const reportPlaybackSuccess = useCallback(
    (latency?: number) => {
      const serverIndex = activeServerIndexRef.current;
      const server = serversRef.current[serverIndex];
      if (!server) return;
      failedServerKeysRef.current.delete(getServerKey(server));
      if (latency && Number.isFinite(latency)) {
        const nextLatencies = {
          ...latenciesRef.current,
          [serverIndex]: latency,
        };
        setLatencies(nextLatencies);
        latenciesRef.current = nextLatencies;
        savePreference(serverIndex, nextLatencies);
      } else {
        savePreference(serverIndex);
      }
    },
    [savePreference],
  );

  const failover = useCallback((): boolean => {
    if (switchingRef.current) return false;
    const currentServers = serversRef.current;
    const currentIndex = activeServerIndexRef.current;
    const currentServer = currentServers[currentIndex];
    const currentEpisode =
      currentServer?.server_data[activeEpisodeIndexRef.current];
    if (!currentServer || !currentEpisode) return false;

    failedServerKeysRef.current.add(getServerKey(currentServer));
    const currentAudioTrack = getAudioTrackKey(currentServer.server_name);
    const candidates = currentServers
      .map((server, serverIndex) => {
        const episodeIndex = findEpisodeIndex(
          server,
          currentEpisode.name,
          activeEpisodeIndexRef.current,
        );
        const episode = server.server_data[episodeIndex];
        return {
          server,
          serverIndex,
          episode,
          episodeIndex,
          latency: latenciesRef.current[serverIndex] ?? Number.MAX_SAFE_INTEGER,
        };
      })
      .filter(
        ({ server, serverIndex, episode }) =>
          serverIndex !== currentIndex &&
          getAudioTrackKey(server.server_name) === currentAudioTrack &&
          !failedServerKeysRef.current.has(getServerKey(server)) &&
          Boolean(episode?.link_m3u8),
      )
      .sort((left, right) => {
        return left.latency - right.latency;
      });

    const next = candidates[0];
    if (!next) return false;
    switchingRef.current = true;
    setTimeout(() => {
      switchingRef.current = false;
    }, 1500);
    switchToServer(
      next.serverIndex,
      currentEpisode.name,
      "hls",
    );
    return true;
  }, [switchToServer]);

  return {
    latencies,
    isProbing,
    markManualSelection,
    getMatchingEpisode,
    selectServer,
    selectAutomaticServer,
    reportPlaybackSuccess,
    failover,
  };
}
