"use client";

import { useSyncExternalStore } from "react";

const MOBILE_BREAKPOINT_PX = 768;

function subscribe(callback: () => void) {
  window.addEventListener("resize", callback);
  window.visualViewport?.addEventListener("resize", callback);
  return () => {
    window.removeEventListener("resize", callback);
    window.visualViewport?.removeEventListener("resize", callback);
  };
}

function getSnapshot() {
  // Tailwind's `md` branch starts when the rounded CSS viewport is 768px.
  // Reading the same value avoids fractional matchMedia overlap/gaps at 767/768px.
  return window.innerWidth < MOBILE_BREAKPOINT_PX;
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
