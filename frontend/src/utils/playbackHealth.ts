export type PlaybackHealthKind = "start" | "success" | "buffer" | "failure";

export interface PlaybackHealthEvent {
  origin: string;
  kind: PlaybackHealthKind;
  durationMs?: number;
  failureType?: string;
}

export interface PlaybackOriginReputation {
  origin: string;
  penaltyMs: number;
  blockedUntil: number;
  samples: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const QUARANTINE_KEY = "dlowphim_hls_quarantine";
const SESSION_ID_KEY = "dlowphim_playback_session";
const QUARANTINE_MS = 10 * 60 * 1000;
const FLUSH_DELAY_MS = 15_000;
const MAX_QUEUE_SIZE = 20;

let queue: PlaybackHealthEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let pageHideBound = false;
let reputationPromise: Promise<PlaybackOriginReputation[]> | null = null;
let reputationCachedAt = 0;

export function getPlaybackOrigin(url = "") {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

function getSessionId() {
  if (typeof window === "undefined") return "server";
  try {
    const stored = sessionStorage.getItem(SESSION_ID_KEY);
    if (stored) return stored;
    const next = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(SESSION_ID_KEY, next);
    return next;
  } catch {
    return "anonymous";
  }
}

function readQuarantine(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(
      sessionStorage.getItem(QUARANTINE_KEY) || "{}",
    ) as Record<string, number>;
    const now = Date.now();
    return Object.fromEntries(
      Object.entries(parsed).filter(([, expiresAt]) => Number(expiresAt) > now),
    );
  } catch {
    return {};
  }
}

export function quarantinePlaybackOrigin(url: string, durationMs = QUARANTINE_MS) {
  const origin = getPlaybackOrigin(url);
  if (!origin || typeof window === "undefined") return;
  try {
    const quarantine = readQuarantine();
    quarantine[origin] = Date.now() + durationMs;
    sessionStorage.setItem(QUARANTINE_KEY, JSON.stringify(quarantine));
  } catch {
    // Private browsing can disable session storage.
  }
}

export function isPlaybackOriginQuarantined(url: string) {
  const origin = getPlaybackOrigin(url);
  return Boolean(origin && readQuarantine()[origin] > Date.now());
}

export function isPlaybackOriginGloballyBlocked(
  url: string,
  reputation: PlaybackOriginReputation[],
) {
  const origin = getPlaybackOrigin(url);
  const entry = reputation.find((item) => item.origin === origin);
  return Boolean(entry && entry.blockedUntil > Date.now());
}

export function getGlobalPlaybackPenalty(
  url: string,
  reputation: PlaybackOriginReputation[],
) {
  const origin = getPlaybackOrigin(url);
  return reputation.find((item) => item.origin === origin)?.penaltyMs || 0;
}

export async function loadPlaybackReputation() {
  if (Date.now() - reputationCachedAt < 60_000 && reputationPromise) {
    return reputationPromise;
  }
  reputationCachedAt = Date.now();
  reputationPromise = fetch(`${API_URL}/playback-health/reputation`, {
    cache: "no-store",
  })
    .then((response) => response.ok ? response.json() : [])
    .then((items) => Array.isArray(items) ? items : [])
    .catch(() => []);
  return reputationPromise;
}

async function flushPlaybackHealth(useBeacon = false) {
  if (!queue.length || typeof window === "undefined") return;
  const events = queue.splice(0, MAX_QUEUE_SIZE);
  const payload = JSON.stringify({ events, sessionId: getSessionId() });
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  if (useBeacon && navigator.sendBeacon) {
    navigator.sendBeacon(
      `${API_URL}/playback-health/events`,
      new Blob([payload], { type: "application/json" }),
    );
    return;
  }

  try {
    await fetch(`${API_URL}/playback-health/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    });
  } catch {
    // Telemetry must never interrupt playback.
  }
}

export function reportPlaybackHealth(
  url: string,
  event: Omit<PlaybackHealthEvent, "origin">,
) {
  if (typeof window === "undefined") return;
  const origin = getPlaybackOrigin(url);
  if (!origin) return;
  if (event.kind === "success" && Math.random() > 0.25) return;

  queue.push({ ...event, origin });
  if (queue.length > MAX_QUEUE_SIZE) queue = queue.slice(-MAX_QUEUE_SIZE);

  if (!pageHideBound) {
    pageHideBound = true;
    window.addEventListener("pagehide", () => void flushPlaybackHealth(true));
  }

  if (queue.length >= 8 || event.kind === "failure") {
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(() => void flushPlaybackHealth(), event.kind === "failure" ? 1000 : 100);
  } else if (!flushTimer) {
    flushTimer = setTimeout(() => void flushPlaybackHealth(), FLUSH_DELAY_MS);
  }
}
