"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  ChevronRight,
  Gauge,
  Maximize,
  Minimize,
  MonitorUp,
  Pause,
  Play,
  Settings,
  Tv,
  Volume2,
  VolumeX,
} from "lucide-react";

type SettingsView = "main" | "quality" | "speed" | null;

interface PlyrController {
  currentTime: number;
  duration: number;
  muted: boolean;
  volume: number;
  paused: boolean;
  speed: number;
  media?: HTMLMediaElement;
  play: () => Promise<void> | void;
  pause: () => void;
  on: (event: string, callback: () => void) => void;
  off: (event: string, callback: () => void) => void;
  fullscreen: {
    active: boolean;
    enter: () => Promise<void> | void;
    exit: () => Promise<void> | void;
  };
}

type IOSFullscreenVideo = HTMLVideoElement & {
  webkitDisplayingFullscreen?: boolean;
  webkitEnterFullscreen?: () => void;
  webkitExitFullscreen?: () => void;
  webkitSupportsFullscreen?: boolean;
};

interface MobileWatchPlayerControlsProps {
  player: PlyrController | null;
  title: string;
  episodeLabel?: string;
  hasEpisodes: boolean;
  qualityOptions: number[];
  selectedQuality: number;
  currentQuality: number;
  onQualityChange: (quality: number) => void;
  onOpenEpisodes: () => void;
  cinemaMode: boolean;
  onExitCinemaMode: () => void;
}

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const TAP_DELAY_MS = 280;
const CONTROLS_HIDE_DELAY_MS = 3000;

function formatTime(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0:00";
  const rounded = Math.floor(value);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const seconds = rounded % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function MobileOverlayPortal({ children }: { children: React.ReactNode }) {
  if (typeof document === "undefined") return null;
  const target = document.fullscreenElement || document.body;
  return createPortal(children, target);
}

export default function MobileWatchPlayerControls({
  player,
  title,
  episodeLabel,
  hasEpisodes,
  qualityOptions,
  selectedQuality,
  currentQuality,
  onQualityChange,
  onOpenEpisodes,
  cinemaMode,
  onExitCinemaMode,
}: MobileWatchPlayerControlsProps) {
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [volumeOpen, setVolumeOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [settingsView, setSettingsView] = useState<SettingsView>(null);
  const [seekFeedback, setSeekFeedback] = useState<"backward" | "forward" | null>(null);
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapRef = useRef<{ time: number; zone: "left" | "right" | "center" } | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);

  const clearSingleTapTimer = useCallback(() => {
    if (singleTapTimerRef.current) {
      clearTimeout(singleTapTimerRef.current);
      singleTapTimerRef.current = null;
    }
  }, []);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const showControls = useCallback(() => {
    clearHideTimer();
    setControlsVisible(true);
  }, [clearHideTimer]);

  const togglePlayback = useCallback(() => {
    if (!player) return;
    if (player.paused) {
      const playResult = player.play();
      if (playResult && typeof playResult.catch === "function") {
        playResult.catch(() => undefined);
      }
    } else {
      player.pause();
    }
  }, [player]);

  const seekBy = useCallback((amount: number) => {
    if (!player) return;
    const nextTime = Math.min(Math.max(0, player.currentTime + amount), player.duration || Infinity);
    player.currentTime = nextTime;
    setCurrentTime(nextTime);
    setSeekFeedback(amount < 0 ? "backward" : "forward");
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => setSeekFeedback(null), 650);
    showControls();
  }, [player, showControls]);

  useEffect(() => {
    if (!player) return;

    const syncPlayback = () => {
      setIsPlaying(!player.paused);
      if (player.paused) showControls();
    };
    const syncTime = () => {
      setCurrentTime(player.currentTime || player.media?.currentTime || 0);
      setDuration(player.duration || player.media?.duration || 0);
    };
    const syncVolume = () => {
      setIsMuted(player.muted);
      setVolume(player.volume);
    };
    const syncSpeed = () => setSpeed(player.speed || 1);
    const media = player.media as IOSFullscreenVideo | undefined;
    const syncFullscreen = () => {
      setIsFullscreen(Boolean(player.fullscreen.active || media?.webkitDisplayingFullscreen));
    };

    syncPlayback();
    syncTime();
    syncVolume();
    syncSpeed();
    syncFullscreen();

    player.on("play", syncPlayback);
    player.on("pause", syncPlayback);
    player.on("timeupdate", syncTime);
    player.on("durationchange", syncTime);
    player.on("loadedmetadata", syncTime);
    player.on("canplay", syncTime);
    player.on("volumechange", syncVolume);
    player.on("ratechange", syncSpeed);
    player.on("enterfullscreen", syncFullscreen);
    player.on("exitfullscreen", syncFullscreen);
    document.addEventListener("fullscreenchange", syncFullscreen);
    document.addEventListener("webkitfullscreenchange", syncFullscreen);
    media?.addEventListener("webkitbeginfullscreen", syncFullscreen);
    media?.addEventListener("webkitendfullscreen", syncFullscreen);
    player.media?.addEventListener("loadedmetadata", syncTime);
    player.media?.addEventListener("durationchange", syncTime);
    player.media?.addEventListener("canplay", syncTime);

    return () => {
      player.off("play", syncPlayback);
      player.off("pause", syncPlayback);
      player.off("timeupdate", syncTime);
      player.off("durationchange", syncTime);
      player.off("loadedmetadata", syncTime);
      player.off("canplay", syncTime);
      player.off("volumechange", syncVolume);
      player.off("ratechange", syncSpeed);
      player.off("enterfullscreen", syncFullscreen);
      player.off("exitfullscreen", syncFullscreen);
      document.removeEventListener("fullscreenchange", syncFullscreen);
      document.removeEventListener("webkitfullscreenchange", syncFullscreen);
      media?.removeEventListener("webkitbeginfullscreen", syncFullscreen);
      media?.removeEventListener("webkitendfullscreen", syncFullscreen);
      player.media?.removeEventListener("loadedmetadata", syncTime);
      player.media?.removeEventListener("durationchange", syncTime);
      player.media?.removeEventListener("canplay", syncTime);
    };
  }, [player, showControls]);

  useEffect(() => {
    document.body.classList.toggle("dlowphim-player-fullscreen", isFullscreen);
    return () => document.body.classList.remove("dlowphim-player-fullscreen");
  }, [isFullscreen]);

  useEffect(() => {
    clearHideTimer();
    if (isPlaying && controlsVisible && !settingsView && !volumeOpen) {
      hideTimerRef.current = setTimeout(() => setControlsVisible(false), CONTROLS_HIDE_DELAY_MS);
    }
    return clearHideTimer;
  }, [clearHideTimer, controlsVisible, isPlaying, settingsView, volumeOpen]);

  useEffect(() => {
    if (!settingsView) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSettingsView(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [settingsView]);

  useEffect(() => () => {
    clearSingleTapTimer();
    clearHideTimer();
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
  }, [clearHideTimer, clearSingleTapTimer]);

  const handleSurfacePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
  };

  const handleSurfacePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!player || event.pointerType === "mouse" && event.button > 0) return;
    if ((event.target as HTMLElement).closest("[data-player-interactive='true']")) {
      pointerStartRef.current = null;
      return;
    }
    const pointerStart = pointerStartRef.current;
    pointerStartRef.current = null;
    if (pointerStart) {
      const deltaX = event.clientX - pointerStart.x;
      const deltaY = event.clientY - pointerStart.y;
      if (deltaY >= 72 && Math.abs(deltaY) > Math.abs(deltaX) * 1.2) {
        clearSingleTapTimer();
        lastTapRef.current = null;
        if (player.fullscreen.active) {
          const result = player.fullscreen.exit();
          if (result && typeof (result as Promise<void>).catch === "function") {
            (result as Promise<void>).catch(() => undefined);
          }
        } else if (cinemaMode) {
          onExitCinemaMode();
        }
        return;
      }
    }
    if (volumeOpen) {
      setVolumeOpen(false);
      showControls();
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const position = (event.clientX - bounds.left) / bounds.width;
    const zone = position < 0.36 ? "left" : position > 0.64 ? "right" : "center";
    const now = performance.now();
    const lastTap = lastTapRef.current;

    if (
      zone !== "center" &&
      lastTap &&
      lastTap.zone === zone &&
      now - lastTap.time <= TAP_DELAY_MS
    ) {
      clearSingleTapTimer();
      lastTapRef.current = null;
      seekBy(zone === "left" ? -5 : 5);
      return;
    }

    lastTapRef.current = { time: now, zone };
    if (!controlsVisible) {
      showControls();
      return;
    }

    clearSingleTapTimer();
    singleTapTimerRef.current = setTimeout(() => {
      lastTapRef.current = null;
      togglePlayback();
    }, TAP_DELAY_MS);
  };

  const handleSeek = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!player) return;
    const nextTime = Number(event.target.value);
    player.currentTime = nextTime;
    setCurrentTime(nextTime);
    showControls();
  };

  const toggleMute = () => {
    if (!player) return;
    player.muted = !player.muted;
    setIsMuted(player.muted);
    showControls();
  };

  const handleVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!player) return;
    const nextVolume = Number(event.target.value);
    player.volume = nextVolume;
    player.muted = nextVolume === 0;
    setVolume(nextVolume);
    setIsMuted(nextVolume === 0);
    showControls();
  };

  const toggleFullscreen = () => {
    if (!player) return;
    const media = player.media as IOSFullscreenVideo | undefined;
    const nativeFullscreenActive = Boolean(media?.webkitDisplayingFullscreen);

    // iPhone Safari only guarantees native video fullscreen. Calling this
    // directly from the tap keeps the required user gesture intact.
    if (!player.fullscreen.active && !nativeFullscreenActive && media?.webkitEnterFullscreen) {
      try {
        media.webkitEnterFullscreen();
        showControls();
        return;
      } catch {
        // Older/embedded WebKit builds can reject native fullscreen; Plyr's
        // full-window fallback below remains available in that case.
      }
    }

    if (nativeFullscreenActive && media?.webkitExitFullscreen) {
      try {
        media.webkitExitFullscreen();
        showControls();
        return;
      } catch {
        // Fall through to Plyr so non-native fullscreen can still be closed.
      }
    }

    const result = player.fullscreen.active
      ? player.fullscreen.exit()
      : player.fullscreen.enter();
    if (result && typeof (result as Promise<void>).catch === "function") {
      (result as Promise<void>).catch(() => undefined);
    }
    showControls();
  };

  const chooseSpeed = (nextSpeed: number) => {
    if (!player) return;
    player.speed = nextSpeed;
    setSpeed(nextSpeed);
    localStorage.setItem("dlowphim_playback_speed", String(nextSpeed));
    setSettingsView(null);
  };

  const qualityLabel = selectedQuality === 0
    ? `Tự động${currentQuality > 0 ? ` · ${currentQuality}p` : ""}`
    : `${selectedQuality}p`;

  const settingsTitle = settingsView === "quality"
    ? "Chất lượng video"
    : settingsView === "speed"
      ? "Tốc độ phát"
      : "Cài đặt";

  const progressMax = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const progressValue = Math.min(currentTime, progressMax || 0);
  const progressPercent = progressMax > 0 ? (progressValue / progressMax) * 100 : 0;
  const sortedQualityOptions = useMemo(
    () => [...qualityOptions].sort((left, right) => right - left),
    [qualityOptions],
  );

  return (
    <div
      data-mobile-watch-controls="true"
      data-controls-visible={controlsVisible}
      className={`absolute inset-0 select-none ${settingsView ? "z-[90]" : "z-30"}`}
      onPointerDown={handleSurfacePointerDown}
      onPointerUp={handleSurfacePointerUp}
      style={{ touchAction: isFullscreen || cinemaMode ? "none" : "manipulation" }}
    >
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-b from-black/75 via-black/10 to-black/85 transition-opacity duration-200 ${controlsVisible ? "opacity-100" : "opacity-0"}`}
      />

      <div className={`absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3 transition-opacity duration-200 ${controlsVisible ? "opacity-100" : "pointer-events-none opacity-0"}`}>
        <div className="min-w-0 text-left text-white">
          <p className="truncate text-[13px] font-extrabold leading-tight">{title}</p>
          {episodeLabel && (
            <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-300">
              {episodeLabel}
            </p>
          )}
        </div>
        {hasEpisodes && (
          <button
            type="button"
            data-player-interactive="true"
            onClick={onOpenEpisodes}
            className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl border border-white/15 bg-black/55 px-3 text-[11px] font-extrabold text-white backdrop-blur-md"
          >
            <Tv size={14} className="text-pink-400" />
            Danh sách tập
          </button>
        )}
      </div>

      <button
        type="button"
        data-player-interactive="true"
        onClick={togglePlayback}
        aria-label={isPlaying ? "Tạm dừng" : "Phát phim"}
        className={`absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-pink-500/90 text-white shadow-[0_0_28px_rgba(236,72,153,0.45)] transition-all duration-200 ${controlsVisible ? "scale-100 opacity-100" : "pointer-events-none scale-90 opacity-0"}`}
      >
        {isPlaying ? <Pause size={25} fill="currentColor" /> : <Play size={25} fill="currentColor" className="translate-x-0.5" />}
      </button>

      {seekFeedback && (
        <div
          className={`pointer-events-none absolute top-1/2 flex -translate-y-1/2 flex-col items-center gap-1 text-white ${seekFeedback === "backward" ? "left-[14%]" : "right-[14%]"}`}
          aria-live="polite"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/55 text-sm font-black backdrop-blur-sm">
            {seekFeedback === "backward" ? "−5" : "+5"}
          </span>
          <span className="text-[9px] font-bold">giây</span>
        </div>
      )}

      <div className={`absolute inset-x-0 bottom-0 px-3 pb-1.5 transition-opacity duration-200 ${controlsVisible ? "opacity-100" : "pointer-events-none opacity-0"}`}>
        <div data-player-interactive="true" className="mb-1 flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={progressMax}
            step={0.1}
            value={progressValue}
            onChange={handleSeek}
            aria-label="Tiến trình phim"
            className="mobile-watch-progress h-[2px] min-w-0 flex-1 cursor-pointer accent-pink-500"
            style={{
              background: `linear-gradient(to right, #ec4899 0%, #ec4899 ${progressPercent}%, rgba(255,255,255,0.34) ${progressPercent}%, rgba(255,255,255,0.34) 100%)`,
            }}
          />
          <span className="shrink-0 text-[10px] font-bold tabular-nums text-white">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>

        <div data-player-interactive="true" className="flex items-center justify-between">
          <button
            type="button"
            onClick={togglePlayback}
            aria-label={isPlaying ? "Tạm dừng" : "Phát phim"}
            className="flex h-9 w-9 items-center justify-center rounded-full text-white"
          >
            {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
          </button>
          <div className="relative" data-player-interactive="true">
            {volumeOpen && (
              <div className="absolute bottom-11 left-1/2 flex h-28 w-11 -translate-x-1/2 flex-col items-center justify-between rounded-2xl border border-white/10 bg-black/80 py-2 shadow-xl backdrop-blur-md">
                <Volume2 size={13} className="text-zinc-300" />
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  aria-label="Âm lượng"
                  className="h-16 w-1 cursor-pointer accent-pink-500"
                  style={{ writingMode: "vertical-lr", direction: "rtl" }}
                />
                <button
                  type="button"
                  onClick={toggleMute}
                  aria-label={isMuted ? "Bật tiếng" : "Tắt tiếng"}
                  className="flex h-5 w-7 items-center justify-center text-white"
                >
                  {isMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                showControls();
                setVolumeOpen((value) => !value);
              }}
              aria-label={volumeOpen ? "Đóng âm lượng" : "Mở âm lượng"}
              aria-expanded={volumeOpen}
              className="flex h-9 w-9 items-center justify-center rounded-full text-white"
            >
              {isMuted ? <VolumeX size={19} /> : <Volume2 size={19} />}
            </button>
          </div>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => {
              showControls();
              setVolumeOpen(false);
              setSettingsView("main");
            }}
            aria-label="Mở cài đặt phát"
            className="flex h-9 w-9 items-center justify-center rounded-full text-white"
          >
            <Settings size={19} />
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}
            className="flex h-9 w-9 items-center justify-center rounded-full text-white"
          >
            {isFullscreen ? <Minimize size={19} /> : <Maximize size={19} />}
          </button>
        </div>
      </div>

      {settingsView && (
        <MobileOverlayPortal>
          <div
            data-mobile-watch-settings="true"
            data-player-interactive="true"
            className="fixed inset-0 z-[120] flex items-end bg-black/65 backdrop-blur-[2px]"
            onClick={() => setSettingsView(null)}
          >
          <section
            role="dialog"
            aria-modal="true"
            aria-label={settingsTitle}
            onClick={(event) => event.stopPropagation()}
            className="mobile-watch-settings-panel w-full rounded-t-[26px] border-t border-white/10 bg-[#15161d] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2.5 text-left text-white shadow-[0_-22px_70px_rgba(0,0,0,0.7)]"
          >
            <button type="button" onClick={() => setSettingsView(null)} className="sr-only">
              Đóng cài đặt
            </button>
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-zinc-600" />
            <div className="mb-3 flex items-center gap-3">
              <div>
                <h3 className="text-base font-extrabold">{settingsTitle}</h3>
                {settingsView === "quality" && (
                  <p className="mt-0.5 text-[11px] font-semibold text-zinc-500">Hiện tại: {qualityLabel}</p>
                )}
              </div>
            </div>

            {settingsView === "main" && (
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => setSettingsView("quality")}
                  className="flex min-h-14 w-full items-center gap-3 rounded-xl px-2 text-left hover:bg-white/5"
                >
                  <MonitorUp size={20} className="text-pink-400" />
                  <span className="flex-1">
                    <span className="block text-sm font-extrabold">Chất lượng</span>
                    <span className="block text-[11px] font-semibold text-zinc-500">{qualityLabel}</span>
                  </span>
                  <ChevronRight size={18} className="text-zinc-600" />
                </button>
                <button
                  type="button"
                  onClick={() => setSettingsView("speed")}
                  className="flex min-h-14 w-full items-center gap-3 rounded-xl px-2 text-left hover:bg-white/5"
                >
                  <Gauge size={20} className="text-pink-400" />
                  <span className="flex-1">
                    <span className="block text-sm font-extrabold">Tốc độ phát</span>
                    <span className="block text-[11px] font-semibold text-zinc-500">{speed === 1 ? "Bình thường" : `${speed}×`}</span>
                  </span>
                  <ChevronRight size={18} className="text-zinc-600" />
                </button>
              </div>
            )}

            {settingsView === "quality" && (
              <div className="max-h-[58dvh] space-y-1 overflow-y-auto overscroll-contain">
                <button
                  type="button"
                  onClick={() => {
                    onQualityChange(0);
                    setSettingsView(null);
                  }}
                  className="flex min-h-14 w-full items-center gap-3 rounded-xl px-2 text-left hover:bg-white/5"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-pink-500/10 text-pink-400">
                    {selectedQuality === 0 && <Check size={18} />}
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-extrabold">Tự động — khuyên dùng</span>
                    <span className="block text-[11px] font-semibold text-zinc-500">
                      {currentQuality > 0 ? `Đang phát ${currentQuality}p` : "Điều chỉnh theo kết nối mạng"}
                    </span>
                  </span>
                </button>
                {sortedQualityOptions.map((quality) => (
                  <button
                    type="button"
                    key={quality}
                    onClick={() => {
                      onQualityChange(quality);
                      setSettingsView(null);
                    }}
                    className="flex min-h-12 w-full items-center gap-3 rounded-xl px-2 text-left hover:bg-white/5"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full text-pink-400">
                      {selectedQuality === quality && <Check size={18} />}
                    </span>
                    <span className="text-sm font-bold">{quality}p</span>
                  </button>
                ))}
              </div>
            )}

            {settingsView === "speed" && (
              <div className="grid grid-cols-3 gap-2">
                {SPEED_OPTIONS.map((option) => {
                  const selected = Math.abs(speed - option) < 0.01;
                  return (
                    <button
                      type="button"
                      key={option}
                      onClick={() => chooseSpeed(option)}
                      className={`min-h-12 rounded-xl border text-sm font-extrabold transition-colors ${selected
                        ? "border-pink-500 bg-pink-500 text-white"
                        : "border-zinc-800 bg-[#1b1c24] text-zinc-300"
                      }`}
                    >
                      {option === 1 ? "1×" : `${option}×`}
                    </button>
                  );
                })}
              </div>
            )}
          </section>
          </div>
        </MobileOverlayPortal>
      )}
    </div>
  );
}
