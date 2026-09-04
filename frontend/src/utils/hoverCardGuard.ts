/**
 * Shared capability, pointer, and touch suppression guards for desktop hover popups across:
 * - MovieCard
 * - CinemaRow
 * - Top10Row
 * - MovieHoverPopup
 *
 * Rules:
 * 1. ONLY allow hover popup if pointerType === "mouse" AND device has fine-pointer hover capability.
 * 2. Any touch or pen interaction immediately cancels pending hover timers and records a monotonic timestamp.
 * 3. Any compatibility/synthetic mouse sequence within the suppression window (default 800ms) after a touch/pen
 *    interaction is strictly suppressed from triggering hover timers or mounting popups.
 * 4. Genuine mouse interactions outside the suppression window with fine capability trigger hover normally.
 * 5. Capability subscriptions track both `(hover: hover) and (pointer: fine)` and `(any-hover: hover) and (any-pointer: fine)`.
 */

let lastTouchTimestamp = 0;

export function recordTouchInteraction(): void {
  lastTouchTimestamp = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
}

export function isRecentTouchSuppressed(windowMs = 800): boolean {
  if (lastTouchTimestamp <= 0) return false;
  const now = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
  const elapsed = now - lastTouchTimestamp;
  return elapsed >= 0 && elapsed < windowMs;
}

export function resetTouchRecordForTest(): void {
  lastTouchTimestamp = 0;
}

export function isFineHoverCapability(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return (
    window.matchMedia("(hover: hover) and (pointer: fine)").matches ||
    window.matchMedia("(any-hover: hover) and (any-pointer: fine)").matches
  );
}

export function canTriggerHoverPopup(
  event?: { pointerType?: string } | null,
  suppressionWindowMs = 800
): boolean {
  // If touch or pen, record interaction and reject
  if (event && (event.pointerType === "touch" || event.pointerType === "pen")) {
    recordTouchInteraction();
    return false;
  }
  // Must be an explicit mouse pointer
  if (!event || event.pointerType !== "mouse") {
    return false;
  }
  // Check if synthetic mouse is suppressed following recent touch
  if (isRecentTouchSuppressed(suppressionWindowMs)) {
    return false;
  }
  // Must have hardware fine-pointer hover capability
  return isFineHoverCapability();
}

export function isTouchOrPenInteraction(event?: { pointerType?: string } | null): boolean {
  if (!event || !event.pointerType) return false;
  return event.pointerType === "touch" || event.pointerType === "pen";
}

export function subscribeToFineHoverCapability(
  onCapabilityChange: (hasCapability: boolean) => void
): () => void {
  if (typeof window === "undefined" || !window.matchMedia) {
    return () => {};
  }
  const mql1 = window.matchMedia("(hover: hover) and (pointer: fine)");
  const mql2 = window.matchMedia("(any-hover: hover) and (any-pointer: fine)");

  const check = () => {
    const hasCap = (mql1?.matches ?? false) || (mql2?.matches ?? false);
    onCapabilityChange(hasCap);
  };

  const handler = () => check();

  mql1.addEventListener?.("change", handler);
  mql2.addEventListener?.("change", handler);

  return () => {
    mql1.removeEventListener?.("change", handler);
    mql2.removeEventListener?.("change", handler);
  };
}

