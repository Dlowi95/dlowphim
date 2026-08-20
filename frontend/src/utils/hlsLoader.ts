"use client";

const HLS_SCRIPT_ID = "dlowphim-hls-script";
export const HLS_LIBRARY_VERSION = "1.6.17";
const HLS_SCRIPT_URL = `https://cdn.jsdelivr.net/npm/hls.js@${HLS_LIBRARY_VERSION}/dist/hls.min.js`;

let hlsLoadPromise: Promise<any> | null = null;

export const WATCH_HLS_CONFIG = {
  enableWorker: true,
  lowLatencyMode: false,
  capLevelToPlayerSize: true,
  startLevel: -1,
  backBufferLength: 60,
  maxBufferLength: 30,
  maxMaxBufferLength: 90,
  manifestLoadingMaxRetry: 2,
  levelLoadingMaxRetry: 3,
  fragLoadingMaxRetry: 4,
  fragLoadingRetryDelay: 500,
  abrEwmaDefaultEstimate: 3_000_000,
};

export const WATCH_TOGETHER_HLS_CONFIG = {
  enableWorker: true,
  lowLatencyMode: false,
  backBufferLength: 30,
  maxBufferLength: 30,
  maxMaxBufferLength: 60,
  manifestLoadingMaxRetry: 2,
  levelLoadingMaxRetry: 3,
  fragLoadingMaxRetry: 4,
  fragLoadingRetryDelay: 500,
};

export function destroyHlsInstance(instance: any) {
  if (!instance) return;
  try { instance.detachMedia?.(); } catch { }
  try { instance.destroy?.(); } catch { }
}

export function resetHlsMediaElement(media: HTMLMediaElement | null | undefined) {
  if (!media) return;
  try { media.pause(); } catch { }
  try {
    media.removeAttribute("src");
    media.load();
  } catch { }
}

export function recoverHlsMediaError(instance: any, attempt: number) {
  if (!instance || attempt < 0 || attempt > 1) return false;
  // The second bounded recovery swaps the audio codec before rebuilding the
  // MediaSource attachment. This follows hls.js' recovery sequence for decode
  // failures without allowing an infinite recover loop.
  if (attempt === 1) {
    try { instance.swapAudioCodec?.(); } catch { }
  }
  try {
    instance.recoverMediaError?.();
    return true;
  } catch {
    return false;
  }
}

export function loadHlsLibrary(): Promise<any> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("HLS chỉ có thể khởi tạo ở trình duyệt"));
  }
  if ((window as any).Hls) return Promise.resolve((window as any).Hls);
  if (hlsLoadPromise) return hlsLoadPromise;

  hlsLoadPromise = new Promise((resolve, reject) => {
    let script = document.getElementById(HLS_SCRIPT_ID) as HTMLScriptElement | null;
    if (script && !(window as any).Hls) {
      script.remove();
      script = null;
    }

    const handleLoad = () => {
      const Hls = (window as any).Hls;
      if (Hls) {
        resolve(Hls);
      } else {
        hlsLoadPromise = null;
        reject(new Error("HLS.js đã tải nhưng không khởi tạo được"));
      }
    };
    const handleError = () => {
      hlsLoadPromise = null;
      script?.remove();
      reject(new Error("Không thể tải thư viện HLS.js"));
    };

    if (!script) {
      script = document.createElement("script");
      script.id = HLS_SCRIPT_ID;
      script.src = HLS_SCRIPT_URL;
      script.async = true;
    }

    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });
    if (!script.isConnected) document.body.appendChild(script);

    // A previously inserted script may have finished between the initial check
    // and listener registration.
    if ((window as any).Hls) handleLoad();
  });

  return hlsLoadPromise;
}
