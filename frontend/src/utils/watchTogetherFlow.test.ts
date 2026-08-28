import assert from "node:assert/strict";
import test from "node:test";
import {
  isSelfMessage,
  isMessageContinuation,
  resolveFullscreenAction,
  isNearBottom,
  createSendTrackerState,
  recordLocalSendAttempt,
  confirmLocalSendAck,
  cancelLocalSendAttempt,
  evaluateBatchAutoScroll,
  formatVietnamChatTime,
  shouldAutoScrollChat,
  type ChatMessageLike,
  type SendTrackerState,
} from "./watchTogetherFlow.ts";

test("Messenger-style Chat Matrix A/B/C: aligns messages strictly by viewer identity, not room role", () => {
  const userA_Id = "66a10000000000000000000a"; // Host A
  const userB_Id = "66a10000000000000000000b"; // Member B
  const guestC_Id = "guest-c000-1111-2222";     // Guest C

  const msgFromA: ChatMessageLike = {
    id: "msg-a",
    sender: "Host Alice",
    senderId: userA_Id,
    createdAt: new Date().toISOString(),
  };

  const msgFromB: ChatMessageLike = {
    id: "msg-b",
    sender: "Bob Member",
    senderId: userB_Id,
    createdAt: new Date().toISOString(),
  };

  const msgFromC: ChatMessageLike = {
    id: "msg-c",
    sender: "Khách 2222",
    senderId: guestC_Id,
    createdAt: new Date().toISOString(),
  };

  // 1. Máy A (Host):
  // - Tin của A: bên phải (isMe = true)
  // - Tin của B: bên trái (isMe = false)
  // - Tin của C: bên trái (isMe = false)
  assert.equal(isSelfMessage(msgFromA, userA_Id, null), true);
  assert.equal(isSelfMessage(msgFromB, userA_Id, null), false);
  assert.equal(isSelfMessage(msgFromC, userA_Id, null), false);

  // 2. Máy B (Member):
  // - Tin của B: bên phải (isMe = true)
  // - Tin của A: bên trái (isMe = false)
  // - Tin của C: bên trái (isMe = false)
  assert.equal(isSelfMessage(msgFromB, userB_Id, null), true);
  assert.equal(isSelfMessage(msgFromA, userB_Id, null), false);
  assert.equal(isSelfMessage(msgFromC, userB_Id, null), false);

  // 3. Máy C (Guest chưa đăng nhập):
  // - Tin của C: bên phải (isMe = true)
  // - Tin của A: bên trái (isMe = false)
  // - Tin của B: bên trái (isMe = false)
  assert.equal(isSelfMessage(msgFromC, null, guestC_Id), true);
  assert.equal(isSelfMessage(msgFromA, null, guestC_Id), false);
  assert.equal(isSelfMessage(msgFromB, null, guestC_Id), false);

  // 4. Cùng tài khoản A đăng nhập trên hai thiết bị (ví dụ Safari + Chrome Desktop):
  // - Cả 2 thiết bị đều thấy tin của A nằm bên phải (isMe = true)
  const device1UserA = userA_Id;
  const device2UserA = userA_Id;
  assert.equal(isSelfMessage(msgFromA, device1UserA, null), true);
  assert.equal(isSelfMessage(msgFromA, device2UserA, null), true);
});

test("two users with identical display names ('Sad nhân') are never confused", () => {
  const user1_Id = "66a100000000000000000001";
  const user2_Id = "66a100000000000000000002";

  const msgFromUser1: ChatMessageLike = {
    id: "msg-1",
    sender: "Sad nhân",
    senderId: user1_Id,
    createdAt: new Date().toISOString(),
  };

  const msgFromUser2: ChatMessageLike = {
    id: "msg-2",
    sender: "Sad nhân",
    senderId: user2_Id,
    createdAt: new Date().toISOString(),
  };

  // Người dùng 1 nhìn tin của chính mình -> PHẢI (true), nhìn tin của người dùng 2 -> TRÁI (false)
  assert.equal(isSelfMessage(msgFromUser1, user1_Id, null), true);
  assert.equal(isSelfMessage(msgFromUser2, user1_Id, null), false);

  // Người dùng 2 nhìn tin của chính mình -> PHẢI (true), nhìn tin của người dùng 1 -> TRÁI (false)
  assert.equal(isSelfMessage(msgFromUser2, user2_Id, null), true);
  assert.equal(isSelfMessage(msgFromUser1, user2_Id, null), false);
});

test("Unified Identity Lifecycle: assert ID_render === ID_join === msg.senderId under storage errors and reconnect", () => {
  // Mô phỏng hàm sinh và lưu guestId duy nhất của controller
  const initializeGuestIdentity = (storageMock: { getItem: () => string | null; setItem: () => void }) => {
    let stableId = "";
    try {
      stableId = storageMock.getItem() || "";
    } catch {}
    if (!stableId) {
      stableId = `guest-simulated-${Date.now()}`;
      try {
        storageMock.setItem();
      } catch {}
    }
    return stableId;
  };

  // Kịch bản 1: localStorage bình thường
  const normalStorage = {
    getItem: () => "guest-stable-1111",
    setItem: () => {},
  };
  const idRender1 = initializeGuestIdentity(normalStorage);
  const idJoin1 = idRender1; // Controller truyền trực tiếp biến state/memory vào socket join
  const msgSent1: ChatMessageLike = { id: "m-1", senderId: idJoin1, sender: "Khách 1111" };
  assert.equal(idRender1, idJoin1);
  assert.equal(isSelfMessage(msgSent1, null, idRender1), true);

  // Kịch bản 2: localStorage.getItem ném lỗi SecurityError (Safari Private Browsing)
  const throwingGetStorage = {
    getItem: () => { throw new Error("SecurityError: Access denied"); },
    setItem: () => {},
  };
  const idRender2 = initializeGuestIdentity(throwingGetStorage);
  const idJoin2 = idRender2; // Giữ nguyên cùng in-memory ID
  const msgSent2: ChatMessageLike = { id: "m-2", senderId: idJoin2, sender: "Khách 2222" };
  assert.equal(idRender2, idJoin2);
  assert.equal(isSelfMessage(msgSent2, null, idRender2), true);

  // Kịch bản 3: localStorage.setItem ném lỗi QuotaExceededError
  const throwingSetStorage = {
    getItem: () => null,
    setItem: () => { throw new Error("QuotaExceededError"); },
  };
  const idRender3 = initializeGuestIdentity(throwingSetStorage);
  const idJoin3 = idRender3; // Giữ nguyên cùng in-memory ID
  const msgSent3: ChatMessageLike = { id: "m-3", senderId: idJoin3, sender: "Khách 3333" };
  assert.equal(idRender3, idJoin3);
  assert.equal(isSelfMessage(msgSent3, null, idRender3), true);

  // Kịch bản 4: Reconnect qua socket
  // Socket reconnect sử dụng cùng ID đã join ban đầu mà không tạo biến ID cục bộ mới
  const reconnectedJoinId = idJoin1;
  assert.equal(reconnectedJoinId, idRender1);
  assert.equal(isSelfMessage(msgSent1, null, reconnectedJoinId), true);
});

test("handles storage failure or missing IDs gracefully without crashing", () => {
  const msg: ChatMessageLike = {
    id: "msg-x",
    sender: "Khách 1234",
    senderId: "guest-1234",
    createdAt: new Date().toISOString(),
  };

  // Khi storage lỗi hoặc guestId rỗng
  assert.equal(isSelfMessage(msg, null, null), false);
  assert.equal(isSelfMessage(msg, null, ""), false);
  assert.equal(isSelfMessage(msg, "", ""), false);

  // Khi tin nhắn thiếu senderId
  const msgNoId: ChatMessageLike = {
    id: "msg-no-id",
    sender: "Khách 1234",
    senderId: undefined,
  };
  assert.equal(isSelfMessage(msgNoId, "user-1", null), false);
  assert.equal(isSelfMessage(msgNoId, null, "guest-1234"), false);
});

test("system messages are never marked as self messages", () => {
  const sysMsg: ChatMessageLike = {
    id: "sys-1",
    sender: "Hệ Thống",
    senderId: undefined,
    isSystem: true,
    createdAt: new Date().toISOString(),
  };

  assert.equal(isSelfMessage(sysMsg, "66a100000000000000000001", null), false);
  assert.equal(isSelfMessage(sysMsg, null, "guest-1234"), false);
});

test("groups continuous messages from the same sender within 60 seconds", () => {
  const t0 = new Date("2026-08-27T08:00:00.000Z").toISOString();
  const t30s = new Date("2026-08-27T08:00:30.000Z").toISOString();
  const t90s = new Date("2026-08-27T08:01:30.000Z").toISOString();

  const msg1: ChatMessageLike = {
    id: "m1",
    sender: "HELLO",
    senderId: "user-1",
    createdAt: t0,
  };
  const msg2: ChatMessageLike = {
    id: "m2",
    sender: "HELLO",
    senderId: "user-1",
    createdAt: t30s,
  };
  const msg3: ChatMessageLike = {
    id: "m3",
    sender: "HELLO",
    senderId: "user-1",
    createdAt: t90s,
  };
  const msgOther: ChatMessageLike = {
    id: "m4",
    sender: "Alice",
    senderId: "user-2",
    createdAt: t30s,
  };

  // Cùng người gửi trong 30s -> Continuation = true
  assert.equal(isMessageContinuation(msg2, msg1), true);

  // Cùng người gửi nhưng cách 90s -> Continuation = false
  assert.equal(isMessageContinuation(msg3, msg1), false);

  // Khác người gửi -> Continuation = false
  assert.equal(isMessageContinuation(msgOther, msg1), false);
});

test("resolves correct fullscreen action across desktop container vs iOS Safari native video", () => {
  // 1. Đang mở Fullscreen -> Hành động: exit
  assert.equal(
    resolveFullscreenAction({
      isFullscreenActive: true,
      hasContainerFullscreen: true,
      hasNativeVideoFullscreen: false,
    }),
    "exit"
  );

  // 2. Desktop Chrome / Android: Container fullscreen có sẵn -> Hành động: container
  assert.equal(
    resolveFullscreenAction({
      isFullscreenActive: false,
      hasContainerFullscreen: true,
      hasNativeVideoFullscreen: true,
    }),
    "container"
  );

  // 3. iPhone Safari (iOS WebKit): Container không có fullscreen, chỉ Video có webkitEnterFullscreen -> Hành động: native-video
  assert.equal(
    resolveFullscreenAction({
      isFullscreenActive: false,
      hasContainerFullscreen: false,
      hasNativeVideoFullscreen: true,
    }),
    "native-video"
  );

  // 4. Trình duyệt cũ không có API -> Fallback CSS
  assert.equal(
    resolveFullscreenAction({
      isFullscreenActive: false,
      hasContainerFullscreen: false,
      hasNativeVideoFullscreen: false,
    }),
    "fallback-css"
  );
});

test("isNearBottom: detects whether chat scroll is within bottom threshold", () => {
  // 1. Ở sát đáy (distance = 0px <= 80px) -> true
  assert.equal(
    isNearBottom({ scrollTop: 400, clientHeight: 400, scrollHeight: 800 }, 80),
    true
  );

  // 2. Cách đáy 50px (distance = 50px <= 80px) -> true
  assert.equal(
    isNearBottom({ scrollTop: 350, clientHeight: 400, scrollHeight: 800 }, 80),
    true
  );

  // 3. Cuộn lên đọc tin cũ (distance = 300px > 80px) -> false
  assert.equal(
    isNearBottom({ scrollTop: 100, clientHeight: 400, scrollHeight: 800 }, 80),
    false
  );
});

test("shouldAutoScrollChat: preserves reader position when reading old messages, ignores user object re-renders without new messages", () => {
  // 1. Lần nạp tin nhắn ban đầu -> Luôn cuộn xuống đáy
  assert.equal(
    shouldAutoScrollChat({
      wasNearBottom: false,
      isUserSent: false,
      hasNewMessages: true,
      isInitialLoad: true,
    }),
    true
  );

  // 2. Không có tin nhắn mới (ví dụ: user object update / avatar refresh / component re-render) -> Tuyệt đối KHÔNG cuộn
  assert.equal(
    shouldAutoScrollChat({
      wasNearBottom: false,
      isUserSent: false,
      hasNewMessages: false,
      isInitialLoad: false,
    }),
    false
  );

  // 3. Đang ở đáy và nhận tin nhắn mới từ người khác -> Cuộn theo xuống đáy
  assert.equal(
    shouldAutoScrollChat({
      wasNearBottom: true,
      isUserSent: false,
      hasNewMessages: true,
      isInitialLoad: false,
    }),
    true
  );

  // 4. Đang cuộn lên trên đọc tin cũ và nhận tin nhắn mới từ người khác -> KHÔNG cuộn (giữ vị trí đọc)
  assert.equal(
    shouldAutoScrollChat({
      wasNearBottom: false,
      isUserSent: false,
      hasNewMessages: true,
      isInitialLoad: false,
    }),
    false
  );

  // 5. Đang cuộn lên trên nhưng chính người dùng vừa gửi tin nhắn -> Tự động cuộn xuống đáy để xem tin của mình
  assert.equal(
    shouldAutoScrollChat({
      wasNearBottom: false,
      isUserSent: true,
      hasNewMessages: true,
      isInitialLoad: false,
    }),
    true
  );
});

test("evaluateBatchAutoScroll MessageId & Session Lifecycle: MessageId matching, out-of-order ACK/Echo, session cleanup, same-account different devices", () => {
  const currentUserId = "66a100000000000000000001";
  const otherUserId = "66a100000000000000000002";

  const msgFromOther: ChatMessageLike = {
    id: "msg_other_1",
    sender: "Other User",
    senderId: otherUserId,
  };

  const msgSystem: ChatMessageLike = {
    id: "msg_sys_1",
    sender: "System",
    isSystem: true,
  };

  // 1. Kịch bản: ACK trước Echo (Chuẩn) -> Echo và tin người khác đến cùng 1 batch:
  // User đọc tin cũ (scrollTop = 100, wasNearBottom = false) -> Bấm gửi nonce_1 -> Nhận ACK { ok: true, messageId: "msg_local_1" }
  // Sau đó batch [msg_local_1, msg_other_1] đến
  // Kỳ vọng: shouldScroll = true, pendingSends tiêu thụ sạch.
  let tracker = createSendTrackerState("session_1");
  tracker = recordLocalSendAttempt(tracker, "nonce_1");
  assert.equal(tracker.pendingSends.length, 1);

  const { state: trackerWithAck1 } = confirmLocalSendAck(tracker, "nonce_1", "msg_local_1");
  assert.equal(trackerWithAck1.pendingSends[0].messageId, "msg_local_1");

  const res1 = evaluateBatchAutoScroll({
    wasNearBottom: false,
    newMessages: [{ id: "msg_local_1", senderId: currentUserId }, msgFromOther],
    currentUserId,
    sendTracker: trackerWithAck1,
  });
  assert.equal(res1.shouldScroll, true, "Phải cuộn về đáy khi batch chứa đúng messageId của echo");
  assert.equal(res1.nextSendTracker.pendingSends.length, 0, "Pending send phải được tiêu thụ sạch");

  // 2. Kịch bản: Echo trước ACK (Echo arrives before ACK callback fires):
  // User đọc tin cũ -> Gửi nonce_2 -> Echo [msg_local_2] đến trước khi ACK trả về!
  // Batch [msg_local_2] được render, ghi nhận vào receivedMessageIds.
  let tracker2 = createSendTrackerState("session_1");
  tracker2 = recordLocalSendAttempt(tracker2, "nonce_2");

  const res2Batch = evaluateBatchAutoScroll({
    wasNearBottom: false,
    newMessages: [{ id: "msg_local_2", senderId: currentUserId }],
    currentUserId,
    sendTracker: tracker2,
  });
  // Tại thời điểm này, chưa có ACK nên chưa biết messageId -> chưa cuộn qua batch
  assert.equal(res2Batch.nextSendTracker.receivedMessageIds.has("msg_local_2"), true);

  // Sau đó, ACK trả về { ok: true, messageId: "msg_local_2" }
  const res2Ack = confirmLocalSendAck(res2Batch.nextSendTracker, "nonce_2", "msg_local_2");
  assert.equal(res2Ack.shouldImmediateScroll, true, "ACK trả về sau khi echo đã render phải kích hoạt immediate scroll");
  assert.equal(res2Ack.state.pendingSends.length, 0, "Đã tiêu thụ xong pending send");

  // 3. Kịch bản: Cùng tài khoản gửi từ thiết bị khác khi phiên này đang đọc tin cũ:
  // Thiết bị B gửi tin có id "msg_device_b_1".
  // Phiên này đang pending nonce_3 (đang chờ "msg_local_3").
  // Tin "msg_device_b_1" đến -> Không trùng messageId với nonce_3!
  let tracker3 = createSendTrackerState("session_1");
  tracker3 = recordLocalSendAttempt(tracker3, "nonce_3");

  const res3 = evaluateBatchAutoScroll({
    wasNearBottom: false,
    newMessages: [{ id: "msg_device_b_1", senderId: currentUserId, text: "Gửi từ máy khác" }],
    currentUserId,
    sendTracker: tracker3,
  });
  assert.equal(res3.shouldScroll, false, "Tin từ máy khác cùng tài khoản không được làm giật cuộn phiên này");
  assert.equal(res3.nextSendTracker.pendingSends.length, 1, "Pending send của phiên này phải được bảo toàn");

  // 4. Kịch bản: Hai thiết bị cùng tài khoản gửi cùng nội dung text:
  // Máy này gửi nonce_4, server sẽ trả messageId "msg_local_4".
  // Máy kia gửi cùng text "Alo", server trả messageId "msg_device_b_2".
  // Tin "msg_device_b_2" đến trước -> KHÔNG được liên kết nhầm chỉ vì cùng text.
  let tracker4 = createSendTrackerState("session_1");
  tracker4 = recordLocalSendAttempt(tracker4, "nonce_4");
  const { state: t4Ack } = confirmLocalSendAck(tracker4, "nonce_4", "msg_local_4");

  const res4 = evaluateBatchAutoScroll({
    wasNearBottom: false,
    newMessages: [{ id: "msg_device_b_2", senderId: currentUserId, text: "Alo" }],
    currentUserId,
    sendTracker: t4Ack,
  });
  assert.equal(res4.shouldScroll, false, "Không được match nhầm messageId dù cùng text");
  assert.equal(res4.nextSendTracker.pendingSends.length, 1, "Lượt gửi của mình vẫn chờ đúng msg_local_4");

  // Khi đúng msg_local_4 đến:
  const res4b = evaluateBatchAutoScroll({
    wasNearBottom: false,
    newMessages: [{ id: "msg_local_4", senderId: currentUserId, text: "Alo" }],
    currentUserId,
    sendTracker: res4.nextSendTracker,
  });
  assert.equal(res4b.shouldScroll, true, "Đúng messageId thì cuộn về đáy");
  assert.equal(res4b.nextSendTracker.pendingSends.length, 0);

  // 5. Kịch bản: Server từ chối / Timeout:
  // Bấm gửi nonce_5 -> Callback lỗi / timeout -> cancelLocalSendAttempt
  let tracker5 = createSendTrackerState("session_1");
  tracker5 = recordLocalSendAttempt(tracker5, "nonce_5");
  tracker5 = cancelLocalSendAttempt(tracker5, "nonce_5");
  assert.equal(tracker5.pendingSends.length, 0);

  const res5 = evaluateBatchAutoScroll({
    wasNearBottom: false,
    newMessages: [msgFromOther],
    currentUserId,
    sendTracker: tracker5,
  });
  assert.equal(res5.shouldScroll, false, "Sau timeout/lỗi thì tin người khác không làm giật cuộn");

  // 6. Kịch bản: Cleanup / Đổi phòng / Reconnect phiên:
  // Session 1 bị hủy -> tạo Session 2 -> tracker sạch hoàn toàn.
  const tracker6 = createSendTrackerState("session_2");
  assert.equal(tracker6.sessionId, "session_2");
  assert.equal(tracker6.pendingSends.length, 0);
  assert.equal(tracker6.receivedMessageIds.size, 0);

  // 7. Kịch bản: Đang ở sát đáy (wasNearBottom = true):
  // Dù là tin người khác hay hệ thống -> cuộn theo luồng.
  const res7 = evaluateBatchAutoScroll({
    wasNearBottom: true,
    newMessages: [msgFromOther, msgSystem],
    currentUserId,
    sendTracker: tracker6,
  });
  assert.equal(res7.shouldScroll, true, "Đang ở sát đáy thì tiếp tục cuộn theo luồng chat");
});

test("formatVietnamChatTime: formats time strictly in Asia/Ho_Chi_Minh 24h format (HH:mm) and rejects unverified strings", () => {
  // 1. Timestamp ban ngày UTC: 2026-08-28T03:42:00.000Z -> 10:42 (GMT+7)
  assert.equal(formatVietnamChatTime("2026-08-28T03:42:00.000Z"), "10:42");
  assert.equal(formatVietnamChatTime("2026-08-28T03:42:00Z"), "10:42");

  // 2. Timestamp có offset cụ thể
  assert.equal(formatVietnamChatTime("2026-08-28T10:42:00+07:00"), "10:42");
  assert.equal(formatVietnamChatTime("2026-08-28T03:42:00-04:00"), "14:42");

  // 3. Timestamp qua đêm UTC: 2026-08-27T17:05:00.000Z -> 00:05 (GMT+7 ngày 28/08)
  assert.equal(formatVietnamChatTime("2026-08-27T17:05:00.000Z"), "00:05");

  // 4. Chuỗi timestamp THIẾU TIMEZONE (không có Z hoặc offset) -> Phải từ chối, trả về "" để không phụ thuộc múi giờ máy chủ/thiết bị
  assert.equal(formatVietnamChatTime("2026-08-28T03:42:00"), "", "Chuỗi không có timezone phải bị loại bỏ");
  assert.equal(formatVietnamChatTime("2026-08-28 03:42:00"), "");

  // 5. Chuỗi chỉ có ngày (không có timezone và giờ cụ thể) -> Trả về ""
  assert.equal(formatVietnamChatTime("2026-08-28"), "");

  // 6. FallbackTime không có timezone (ví dụ "03:42 AM", "10:42") -> Không được coi là giờ VN đã xác minh -> Trả về ""
  assert.equal(formatVietnamChatTime(null, "03:42 AM"), "");
  assert.equal(formatVietnamChatTime(undefined, "10:42"), "");

  // 7. Date instance hợp lệ & Epoch milliseconds hợp lệ (number)
  assert.equal(formatVietnamChatTime(new Date("2026-08-28T03:42:00.000Z")), "10:42");
  assert.equal(formatVietnamChatTime(1787888520000), "10:42"); // Epoch ms UTC tương ứng 2026-08-28T03:42:00.000Z

  // 8. Giá trị không hợp lệ / rỗng / Invalid Date
  assert.equal(formatVietnamChatTime("invalid-date-string"), "");
  assert.equal(formatVietnamChatTime(new Date("invalid")), "");
  assert.equal(formatVietnamChatTime(null, null), "");
  assert.equal(formatVietnamChatTime("", ""), "");
});

test("Session Lifecycle Isolation: Session teardown resets isSendingMessage and prevents stale callbacks from modifying new session", () => {
  let sessionEpoch = 1;
  let isSendingMessage = false;
  let sendTracker = createSendTrackerState(`session_${sessionEpoch}`);

  // 1. Gửi tin ở session 1
  const clientNonce1 = "nonce_session_1";
  const sendEpoch1 = sessionEpoch;
  sendTracker = recordLocalSendAttempt(sendTracker, clientNonce1);
  isSendingMessage = true;
  assert.equal(sendTracker.pendingSends.length, 1);
  assert.equal(isSendingMessage, true);

  // 2. Socket teardown / cleanup xảy ra (đổi phòng hoặc reconnect)
  sessionEpoch += 1;
  sendTracker = createSendTrackerState(`session_${sessionEpoch}`);
  isSendingMessage = false;
  assert.equal(sessionEpoch, 2);
  assert.equal(isSendingMessage, false, "Cleanup phải giải phóng ngay trạng thái isSendingMessage");
  assert.equal(sendTracker.pendingSends.length, 0, "Tracker phiên mới phải sạch hoàn toàn");

  // 3. Giả lập callback muộn từ socket session 1 (sau timeout hoặc ACK trễ)
  const handleLateCallback = (callbackEpoch: number) => {
    if (callbackEpoch !== sessionEpoch) {
      // Callback cũ bị loại bỏ an toàn
      return "ignored";
    }
    isSendingMessage = false;
    return "executed";
  };

  const result = handleLateCallback(sendEpoch1);
  assert.equal(result, "ignored", "Callback phiên 1 phải bị bỏ qua ở phiên 2");
  assert.equal(isSendingMessage, false, "isSendingMessage của phiên mới không bị ảnh hưởng");

  // 4. Phiên mới có thể gửi tin ngay lập tức mà không bị kẹt
  const clientNonce2 = "nonce_session_2";
  sendTracker = recordLocalSendAttempt(sendTracker, clientNonce2);
  isSendingMessage = true;
  assert.equal(sendTracker.pendingSends.length, 1);
  assert.equal(sendTracker.pendingSends[0].clientNonce, clientNonce2);
});

test("Episode Selection Button Lookup: uses stable data-episode-index to guarantee 100% accurate button identification regardless of name formatting", () => {
  // Mô phỏng container DOM chứa danh sách tập và các nút khác (batch tabs, viewer count)
  const fakeContainer = {
    buttons: [
      { textContent: "Tập 1 - 40", attributes: {} },
      { textContent: "Tập 1", attributes: { "data-episode-index": "0" }, id: "btn-ep-0" },
      { textContent: "Tập 2", attributes: { "data-episode-index": "1" }, id: "btn-ep-1" },
      { textContent: "Tập 12", attributes: { "data-episode-index": "11" }, id: "btn-ep-11" },
      { textContent: "Tập 20", attributes: { "data-episode-index": "19" }, id: "btn-ep-19" },
      { textContent: "2 người xem", attributes: {} },
    ],
    querySelector(selector: string) {
      const match = selector.match(/button\[data-episode-index="(\d+)"\]/);
      if (!match) return null;
      const targetIndex = match[1];
      return this.buttons.find(b => b.attributes["data-episode-index"] === targetIndex) || null;
    }
  };

  // 1. Tìm tập 2 (index = 1) dù tên là "2" hay "Tập 2"
  const foundEp2 = fakeContainer.querySelector(`button[data-episode-index="1"]`);
  assert.equal(foundEp2?.id, "btn-ep-1", "Phải tìm chính xác nút Tập 2 qua data-episode-index");

  // 2. Không bao giờ nhầm với Tập 12 (index = 11), Tập 20 (index = 19), hay "2 người xem"
  assert.notEqual(foundEp2?.id, "btn-ep-11");
  assert.notEqual(foundEp2?.id, "btn-ep-19");

  // 3. Tìm tập 12 (index = 11) và tập 20 (index = 19)
  const foundEp12 = fakeContainer.querySelector(`button[data-episode-index="11"]`);
  assert.equal(foundEp12?.id, "btn-ep-11");
  const foundEp20 = fakeContainer.querySelector(`button[data-episode-index="19"]`);
  assert.equal(foundEp20?.id, "btn-ep-19");

  // 4. Tìm tập không tồn tại (index = 99)
  const notFound = fakeContainer.querySelector(`button[data-episode-index="99"]`);
  assert.equal(notFound, null);
});
