export interface ChatMessageLike {
  id: string;
  sender?: string;
  senderId?: string;
  text?: string;
  isSystem?: boolean;
  createdAt?: string;
  time?: string;
}

/**
 * Xác định chính xác tin nhắn có phải do danh tính hiện tại gửi hay không
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

const ISO_WITH_EXPLICIT_TIMEZONE_REGEX = /^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:[zZ]|[+-]\d{2}(?::?\d{2})?)$/;

/**
 * Định dạng thời gian tin nhắn thống nhất theo múi giờ Việt Nam (Asia/Ho_Chi_Minh)
 * định dạng 24h (HH:mm).
 * - CHỈ parse chuỗi timestamp khi có timezone rõ ràng (ISO có Z hoặc offset).
 * - Chuỗi thiếu timezone (như '2026-08-28T03:42:00'), chỉ có ngày hoặc không hợp lệ: trả về "".
 * - Date instance hợp lệ và epoch milliseconds hợp lệ (number) được hỗ trợ đầy đủ.
 * - Không tự thêm Z, không tự đoán múi giờ, không cộng cứng 7 tiếng.
 * - Trả về "" nếu không có thời điểm gửi được xác minh rõ ràng.
 */
export function formatVietnamChatTime(
  createdAt?: string | number | Date | null,
  fallbackTime?: string | null,
): string {
  if (createdAt !== undefined && createdAt !== null && createdAt !== "") {
    if (createdAt instanceof Date) {
      if (!Number.isNaN(createdAt.getTime())) {
        return createdAt.toLocaleTimeString("vi-VN", {
          timeZone: "Asia/Ho_Chi_Minh",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });
      }
    } else if (typeof createdAt === "number") {
      if (Number.isFinite(createdAt)) {
        const date = new Date(createdAt);
        if (!Number.isNaN(date.getTime())) {
          return date.toLocaleTimeString("vi-VN", {
            timeZone: "Asia/Ho_Chi_Minh",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          });
        }
      }
    } else if (typeof createdAt === "string") {
      const trimmed = createdAt.trim();
      if (ISO_WITH_EXPLICIT_TIMEZONE_REGEX.test(trimmed)) {
        const date = new Date(trimmed);
        if (!Number.isNaN(date.getTime())) {
          return date.toLocaleTimeString("vi-VN", {
            timeZone: "Asia/Ho_Chi_Minh",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          });
        }
      }
    }
  }

  // Fallback: chỉ sử dụng nếu fallbackTime cũng là một chuỗi ISO có timezone rõ ràng
  if (fallbackTime && typeof fallbackTime === "string") {
    const trimmedFallback = fallbackTime.trim();
    if (ISO_WITH_EXPLICIT_TIMEZONE_REGEX.test(trimmedFallback)) {
      const date = new Date(trimmedFallback);
      if (!Number.isNaN(date.getTime())) {
        return date.toLocaleTimeString("vi-VN", {
          timeZone: "Asia/Ho_Chi_Minh",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });
      }
    }
  }

  return "";
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

export interface ScrollPositionSnapshot {
  scrollTop: number;
  clientHeight: number;
  scrollHeight: number;
}

/**
 * Kiểm tra xem người dùng có đang ở gần đáy khung chat hay không
 * dựa trên khoảng cách cách đáy (threshold mặc định 80px).
 */
export function isNearBottom(snapshot: ScrollPositionSnapshot, threshold = 80): boolean {
  const { scrollTop, clientHeight, scrollHeight } = snapshot;
  return scrollHeight - (scrollTop + clientHeight) <= threshold;
}

export interface LocalSendEntry {
  clientNonce: string;
  messageId?: string;
  timestamp: number;
  consumed: boolean;
}

export interface SendTrackerState {
  sessionId: string;
  pendingSends: LocalSendEntry[];
  receivedMessageIds: Set<string>;
}

export function createSendTrackerState(sessionId?: string): SendTrackerState {
  return {
    sessionId: sessionId || `session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    pendingSends: [],
    receivedMessageIds: new Set<string>(),
  };
}

export function recordLocalSendAttempt(
  state: SendTrackerState,
  clientNonce: string,
): SendTrackerState {
  const newEntry: LocalSendEntry = {
    clientNonce,
    timestamp: Date.now(),
    consumed: false,
  };
  return {
    ...state,
    pendingSends: [...state.pendingSends, newEntry],
  };
}

export function confirmLocalSendAck(
  state: SendTrackerState,
  clientNonce: string,
  messageId?: string,
): { state: SendTrackerState; shouldImmediateScroll: boolean } {
  if (!messageId) {
    return { state, shouldImmediateScroll: false };
  }

  let matchedAndAlreadyReceived = false;
  const nextPending = state.pendingSends.map((entry) => {
    if (entry.clientNonce === clientNonce) {
      // Nếu echo của messageId này đã xuất hiện trong danh sách messages trước khi ACK trả về
      if (state.receivedMessageIds.has(messageId)) {
        matchedAndAlreadyReceived = !entry.consumed;
        return { ...entry, messageId, consumed: true };
      }
      return { ...entry, messageId };
    }
    return entry;
  });

  return {
    state: {
      ...state,
      pendingSends: nextPending.filter((e) => !e.consumed),
    },
    shouldImmediateScroll: matchedAndAlreadyReceived,
  };
}

export function cancelLocalSendAttempt(
  state: SendTrackerState,
  clientNonce: string,
): SendTrackerState {
  return {
    ...state,
    pendingSends: state.pendingSends.filter((e) => e.clientNonce !== clientNonce),
  };
}

/**
 * Đánh giá quyết định tự động cuộn (Auto-Scroll) khi có batch tin nhắn mới:
 * 1. Lưu lại các `msg.id` đã nhận vào `receivedMessageIds`.
 * 2. Đối chiếu chính xác `msg.id` với `entry.messageId` của các lượt gửi cục bộ đã được server xác nhận qua ACK.
 * 3. Nếu tìm thấy tin nhắn trùng khớp với `messageId` của phiên này -> Cuộn xuống đáy và đánh dấu tiêu thụ.
 * 4. Nếu người dùng đang ở gần đáy (`wasNearBottom = true`) -> Cuộn theo dòng tin mới.
 * 5. Nếu đang đọc tin cũ và không có echo của phiên này (kể cả cùng tài khoản từ máy khác) -> Giữ nguyên vị trí đọc.
 */
export function evaluateBatchAutoScroll(options: {
  wasNearBottom: boolean;
  newMessages: ChatMessageLike[];
  isInitialLoad?: boolean;
  currentUserId?: string | null;
  currentGuestId?: string | null;
  sendTracker: SendTrackerState;
}): { shouldScroll: boolean; nextSendTracker: SendTrackerState } {
  if (options.isInitialLoad) {
    const nextReceived = new Set(options.sendTracker.receivedMessageIds);
    for (const msg of options.newMessages) {
      if (msg.id) nextReceived.add(String(msg.id));
    }
    return {
      shouldScroll: true,
      nextSendTracker: {
        ...options.sendTracker,
        receivedMessageIds: nextReceived,
      },
    };
  }

  if (!options.newMessages || options.newMessages.length === 0) {
    return { shouldScroll: false, nextSendTracker: options.sendTracker };
  }

  const nextReceived = new Set(options.sendTracker.receivedMessageIds);
  let hasConfirmedLocalEcho = false;
  const remainingPending: LocalSendEntry[] = [];

  // 1. Ghi nhận tất cả id tin nhắn trong batch
  for (const msg of options.newMessages) {
    if (msg.id) nextReceived.add(String(msg.id));
  }

  // 2. Đối chiếu chính xác từng pending send với message.id
  for (const entry of options.sendTracker.pendingSends) {
    if (entry.consumed) continue;

    if (entry.messageId) {
      const matchInBatch = options.newMessages.some((m) => String(m.id) === String(entry.messageId));
      if (matchInBatch) {
        hasConfirmedLocalEcho = true;
        // Đã tiêu thụ xong echo của lượt gửi này
        continue;
      }
    }
    remainingPending.push(entry);
  }

  const nextSendTracker: SendTrackerState = {
    ...options.sendTracker,
    pendingSends: remainingPending,
    receivedMessageIds: nextReceived,
  };

  if (hasConfirmedLocalEcho) {
    return {
      shouldScroll: true,
      nextSendTracker,
    };
  }

  if (options.wasNearBottom) {
    return {
      shouldScroll: true,
      nextSendTracker,
    };
  }

  return {
    shouldScroll: false,
    nextSendTracker,
  };
}

/**
 * Helper tương thích ngược.
 */
export function shouldAutoScrollChat(options: {
  wasNearBottom: boolean;
  isUserSent?: boolean;
  hasNewMessages?: boolean;
  isInitialLoad?: boolean;
}): boolean {
  if (options.isInitialLoad) return true;
  if (options.hasNewMessages === false) return false;
  if (options.isUserSent) return true;
  return options.wasNearBottom;
}
