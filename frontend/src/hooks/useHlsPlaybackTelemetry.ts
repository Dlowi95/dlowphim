"use client";

import { useCallback, useEffect, useRef, type MutableRefObject } from "react";

interface UseHlsPlaybackTelemetryOptions {
  playbackKey: string;
  fallbackStartedAtRef: MutableRefObject<number>;
  reportPlaybackStarted: (startupMs: number) => void;
  reportBuffering: (bufferMs: number) => void;
  onPlaybackHealthy?: () => void;
}

export function useHlsPlaybackTelemetry({
  playbackKey,
  fallbackStartedAtRef,
  reportPlaybackStarted,
  reportBuffering,
  onPlaybackHealthy,
}: UseHlsPlaybackTelemetryOptions) {
  const requestedAtRef = useRef(0);
  const startedRef = useRef(false);
  const bufferingAtRef = useRef(0);

  useEffect(() => {
    requestedAtRef.current = 0;
    startedRef.current = false;
    bufferingAtRef.current = 0;
  }, [playbackKey]);

  const onPlay = useCallback(() => {
    if (!startedRef.current && requestedAtRef.current === 0) {
      requestedAtRef.current = performance.now();
    }
  }, []);

  const onPlaying = useCallback(() => {
    onPlaybackHealthy?.();
    const now = performance.now();
    if (!startedRef.current) {
      const startupMs = requestedAtRef.current > 0
        ? now - requestedAtRef.current
        : now - fallbackStartedAtRef.current;
      reportPlaybackStarted(Math.max(0, Math.round(startupMs)));
      startedRef.current = true;
    }
    if (bufferingAtRef.current > 0) {
      reportBuffering(Math.round(now - bufferingAtRef.current));
      bufferingAtRef.current = 0;
    }
  }, [fallbackStartedAtRef, onPlaybackHealthy, reportBuffering, reportPlaybackStarted]);

  const onWaiting = useCallback(() => {
    if (startedRef.current && bufferingAtRef.current === 0) {
      bufferingAtRef.current = performance.now();
    }
  }, []);

  return { onPlay, onPlaying, onWaiting };
}
