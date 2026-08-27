export interface ChatMessageLike {
  id: string;
  sender?: string;
  senderId?: string;
  isSystem?: boolean;
  createdAt?: string;
  time?: string;
}

/**
 * Xác định chính xác tin nhắn có phải do phiên hiện tại gửi hay không
 * dựa trên senderId ổn định (User ObjectId hoặc Guest UUID).
 * Tuyệt đối không fallback theo tên hiển thị (displayName) để tránh xung đột tên.
 */
export function isSelfMessage(
  msg: ChatMessageLike,
  currentUserId?: string | null,
  currentGuestId?: string | null,
): boolean {
  if (msg.isSystem) return false;
  const mySenderId = currentUserId ? String(currentUserId) : (currentGuestId ? String(currentGuestId) : "");
  if (!mySenderId || !msg.senderId) return false;
  return String(msg.senderId) === mySenderId;
}

/**
 * Kiểm tra xem tin nhắn hiện tại có phải là chuỗi liên tục của cùng một người gửi
 * trong vòng 1 phút hay không.
 */
export function isMessageContinuation(
  currentMsg: ChatMessageLike,
  previousMsg?: ChatMessageLike | null,
): boolean {
  if (!previousMsg || previousMsg.isSystem || currentMsg.isSystem) return false;
  if (!currentMsg.senderId || !previousMsg.senderId) return false;
  if (String(currentMsg.senderId) !== String(previousMsg.senderId)) return false;

  const currentTs = currentMsg.createdAt ? Date.parse(currentMsg.createdAt) : Number.NaN;
  const prevTs = previousMsg.createdAt ? Date.parse(previousMsg.createdAt) : Number.NaN;
  if (Number.isFinite(currentTs) && Number.isFinite(prevTs)) {
    return currentTs >= prevTs && currentTs - prevTs <= 60_000;
  }
  return currentMsg.time === previousMsg.time;
}

export type FullscreenTargetType = "container" | "native-video" | "fallback-css" | "exit";

/**
 * Điều hướng kích hoạt Fullscreen phù hợp với năng lực trình duyệt:
 * - Desktop/Android: Ưu tiên container fullscreen (giữ nguyên UI phòng và controls).
 * - iOS Safari (iPhone): Container fullscreen không hỗ trợ -> Chuyển sang HTMLVideoElement webkitEnterFullscreen.
 * - Thoát: Kiểm tra native fullscreen hoặc standard document exit.
 */
export function resolveFullscreenAction(options: {
  isFullscreenActive: boolean;
  hasContainerFullscreen: boolean;
  hasNativeVideoFullscreen: boolean;
}): FullscreenTargetType {
  if (options.isFullscreenActive) {
    return "exit";
  }
  if (options.hasContainerFullscreen) {
    return "container";
  }
  if (options.hasNativeVideoFullscreen) {
    return "native-video";
  }
  return "fallback-css";
}
