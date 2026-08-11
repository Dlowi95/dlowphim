"use client";

import { useSyncExternalStore } from "react";

const MOBILE_VIEWPORT_QUERY = "(max-width: 767px)";

function subscribe(callback: () => void) {
  const mediaQuery = window.matchMedia(MOBILE_VIEWPORT_QUERY);
  mediaQuery.addEventListener("change", callback);
  return () => mediaQuery.removeEventListener("change", callback);
}

function getSnapshot() {
  return window.matchMedia(MOBILE_VIEWPORT_QUERY).matches;
}

function getServerSnapshot() {
  return false;
}

/**
 * Chỉ dùng hook này ở ranh giới render của hai giao diện độc lập.
 * CSS breakpoint vẫn phụ trách các thay đổi responsive nhỏ bên trong mỗi giao diện.
 */
export function useIsMobileViewport() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
