"use client";

const HLS_SCRIPT_ID = "dlowphim-hls-script";
const HLS_SCRIPT_URL = "https://cdn.jsdelivr.net/npm/hls.js@1.4.12/dist/hls.min.js";

let hlsLoadPromise: Promise<any> | null = null;

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
