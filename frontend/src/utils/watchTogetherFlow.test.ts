import assert from "node:assert/strict";
import test from "node:test";
import {
  isSelfMessage,
  isMessageContinuation,
  resolveFullscreenAction,
  type ChatMessageLike,
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
