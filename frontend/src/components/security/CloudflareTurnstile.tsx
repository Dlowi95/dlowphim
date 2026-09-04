"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

type TurnstileOptions = {
  sitekey: string;
  action: string;
  theme: "dark" | "light" | "auto";
  language: string;
  appearance: "always" | "execute" | "interaction-only";
  size: "normal" | "compact" | "flexible";
  callback: (token: string) => void;
  "expired-callback": () => void;
  "error-callback": () => void;
};

type TurnstileApi = {
  render: (container: HTMLElement, options: TurnstileOptions) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

type CloudflareTurnstileProps = {
  siteKey: string;
  action: "login" | "register";
  resetKey: number;
  onToken: (token: string | null) => void;
  onError: () => void;
};

export default function CloudflareTurnstile({
  siteKey,
  action,
  resetKey,
  onToken,
  onError,
}: CloudflareTurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  const onErrorRef = useRef(onError);
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => { onTokenRef.current = onToken; }, [onToken]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  useEffect(() => {
    if (!siteKey || !scriptReady || !containerRef.current || !window.turnstile) return;

    onTokenRef.current(null);
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      action,
      theme: "dark",
      language: "vi",
      appearance: "always",
      size: "flexible",
      callback: (token) => onTokenRef.current(token),
      "expired-callback": () => onTokenRef.current(null),
      "error-callback": () => {
        onTokenRef.current(null);
        onErrorRef.current();
      },
    });

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = null;
    };
  }, [action, resetKey, scriptReady, siteKey]);

  if (!siteKey) {
    return (
      <p role="alert" className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-center text-[11px] font-semibold text-amber-300">
        Xác minh bảo mật chưa được cấu hình. Vui lòng thử lại sau.
      </p>
    );
  }

  return (
    <div className="min-h-[65px] w-full overflow-hidden rounded-lg" aria-label="Xác minh bảo mật Cloudflare">
      <Script
        id="cloudflare-turnstile-script"
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
        onError={() => onErrorRef.current()}
      />
      <div ref={containerRef} className="w-full" />
    </div>
  );
}

