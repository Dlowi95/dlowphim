import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { OnModuleDestroy } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { RoomsService } from './rooms.service';

@WebSocketGateway({
  cors: {
    origin: '*', // Hỗ trợ CORS kết nối client-side
  },
})
export class RoomsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy
{
  @WebSocketServer()
  server: Server;

  // Quản lý thông tin client socket đang kết nối
  private clients = new Map<string, { roomId: string; userId: string; isHost: boolean; name: string }>();

  // Quản lý các timeout đóng phòng của Host bị ngắt kết nối
  private hostDisconnectTimeouts = new Map<string, NodeJS.Timeout>();
  private memberDisconnectTimeouts = new Map<string, NodeJS.Timeout>();
  private scheduledRoomInterval?: NodeJS.Timeout;
  private isStartingDueRooms = false;
  private readonly lobbyRoomId = 'watch-together-lobby';
  private readonly waitingRoomsAnnounced = new Set<string>();

  // Quản lý trạng thái AI hoạt động của từng phòng (roomId -> isActive)
  private roomAiStates = new Map<string, boolean>();

  // Snapshot trạng thái video của từng phòng (để đồng bộ cho member mới join / F5)
  private roomVideoStates = new Map<
    string,
    {
      currentTime: number;
      episodeIndex: number;
      episodeSlug: string;
      action: 'play' | 'pause';
      updatedAt: number;
    }
  >();

  constructor(
    private readonly roomsService: RoomsService,
    private readonly jwtService: JwtService,
  ) {}

  afterInit() {
    void this.processScheduledRooms();
    this.scheduledRoomInterval = setInterval(() => {
      void this.processScheduledRooms();
    }, 1000);
  }

  onModuleDestroy() {
    if (this.scheduledRoomInterval) {
      clearInterval(this.scheduledRoomInterval);
      this.scheduledRoomInterval = undefined;
    }
  }

  private async processScheduledRooms() {
    if (this.isStartingDueRooms) return;
    this.isStartingDueRooms = true;
    try {
      const now = new Date();
      const dueRooms = await this.roomsService.getDueScheduledRooms(now);
      for (const dueRoom of dueRooms) {
        const roomHostId = String(dueRoom.host?._id || dueRoom.host || '');
        const isHostOnline = Array.from(this.clients.values()).some(
          (client) =>
            client.roomId === dueRoom.roomId &&
            client.isHost &&
            client.userId === roomHostId,
        );

        if (!isHostOnline) {
          if (!this.waitingRoomsAnnounced.has(dueRoom.roomId)) {
            this.waitingRoomsAnnounced.add(dueRoom.roomId);
            this.broadcastLobbyChanged('room_waiting_for_host', dueRoom.roomId);
          }
          const scheduledAt = dueRoom.startTime
            ? new Date(dueRoom.startTime).getTime()
            : now.getTime();
          if (now.getTime() >= scheduledAt + 30 * 60 * 1000) {
            const expiredRoom = await this.roomsService.expireScheduledRoom(
              dueRoom.roomId,
            );
            if (expiredRoom) {
              console.log(
                `[Socket] Scheduled Room ${dueRoom.roomId} closed because its host was absent for 30 minutes.`,
              );
              this.broadcastRoomClosed(dueRoom.roomId, 'host_absent');
            }
          }
          continue;
        }

        const room = await this.roomsService.startScheduledRoom(
          dueRoom.roomId,
          'schedule',
        );
        this.waitingRoomsAnnounced.delete(room.roomId);
        const startedAt = room.startedAt || now;
        console.log(`[Socket] Scheduled movie started for Room: ${room.roomId}`);
        this.server.to(room.roomId).emit('movie_started', {
          startedAt: new Date(startedAt).toISOString(),
          startedBy: 'schedule',
        });
        this.broadcastLobbyChanged('room_started', room.roomId);
      }
    } catch (error) {
      console.error('[Socket] Failed to start due scheduled rooms:', error.message);
    } finally {
      this.isStartingDueRooms = false;
    }
  }

  broadcastRoomClosed(roomId: string, reason = 'host_closed') {
    this.roomAiStates.delete(roomId);
    this.roomVideoStates.delete(roomId);
    this.waitingRoomsAnnounced.delete(roomId);

    const timeout = this.hostDisconnectTimeouts.get(roomId);
    if (timeout) {
      clearTimeout(timeout);
      this.hostDisconnectTimeouts.delete(roomId);
    }

    this.server.to(roomId).emit('room_closed', { reason });
    this.broadcastLobbyChanged('room_closed', roomId);
  }

  broadcastLobbyChanged(event: string, roomId: string) {
    this.server.to(this.lobbyRoomId).emit('rooms_changed', {
      event,
      roomId,
      changedAt: new Date().toISOString(),
    });
  }

  private getJoinedClient(client: Socket, roomId: string) {
    const info = this.clients.get(client.id);
    return info && info.roomId === roomId ? info : null;
  }

  private getAuthenticatedUserId(client: Socket): string | null {
    const token = client.handshake.auth?.token;
    if (!token || typeof token !== 'string') return null;
    try {
      const payload = this.jwtService.verify<{ sub?: string }>(token);
      return payload.sub ? String(payload.sub) : null;
    } catch {
      return null;
    }
  }

  handleConnection(client: Socket) {
    console.log(`[Socket] Client connected: ${client.id}`);
  }

  @SubscribeMessage('join_lobby')
  handleJoinLobby(@ConnectedSocket() client: Socket) {
    client.join(this.lobbyRoomId);
    return { ok: true };
  }

  async handleDisconnect(client: Socket) {
    const info = this.clients.get(client.id);
    if (!info) return;

    console.log(`[Socket] Client disconnected: ${client.id} from Room: ${info.roomId}`);
    this.clients.delete(client.id);

    // Nếu người ngắt kết nối là Host
    if (info.isHost) {
      // Kiểm tra xem Host thực sự đã ngắt kết nối hoàn toàn chưa (không còn socket nào khác của Host này đang kết nối)
      const isHostStillConnected = Array.from(this.clients.values()).some(
        (c) => c.roomId === info.roomId && c.userId === info.userId && c.isHost
      );

      if (!isHostStillConnected) {
        // Nếu phòng chưa bắt đầu chiếu (hẹn giờ trong tương lai), cho phép Host rời đi thoải mái mà không đóng phòng
        try {
          const room = await this.roomsService.getRoomDetails(info.roomId).catch(() => null);
          if (room && room.status === 'scheduled') {
            console.log(`[Socket] Host disconnected from scheduled room ${info.roomId} before start time. Keeping room active.`);
            this.broadcastViewerCount(info.roomId);
            return;
          }
        } catch (e) {}

        console.log(`[Socket] Host ${info.name} disconnected completely. Starting 60s cooldown for Room: ${info.roomId}`);

        // Phát thông báo cảnh báo cho các thành viên trong phòng
        this.server.to(info.roomId).emit('message', {
          id: `sys-warn-${Date.now()}`,
          senderName: 'Hệ Thống',
          text: 'Trưởng phòng bị mất kết nối. Đang chờ kết nối lại...',
          isSystem: true,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        });

        // Tạo Timeout 60s để tự động đóng phòng nếu Host không quay lại
        const timeout = setTimeout(async () => {
          try {
            console.log(`[Socket] Timeout expired! Automatically closing Room: ${info.roomId}`);
            await this.roomsService.closeRoom(info.userId, info.roomId);

            // Xóa trạng thái AI của phòng
            // Phát sự kiện đóng phòng để đẩy mọi người ra ngoài
            this.broadcastRoomClosed(info.roomId, 'host_disconnected');
          } catch (e) {
            console.error(`[Socket] Auto close room error:`, e.message);
          } finally {
            this.hostDisconnectTimeouts.delete(info.roomId);
          }
        }, 60000); // 60 giây

        this.hostDisconnectTimeouts.set(info.roomId, timeout);
      } else {
        console.log(`[Socket] Host ${info.name} disconnected one socket session, but another session remains active. No cooldown started.`);
      }
    } else {
      const isMemberStillConnected = Array.from(this.clients.values()).some(
        (member) =>
          member.roomId === info.roomId && member.userId === info.userId,
      );
      if (!isMemberStillConnected) {
        const presenceKey = `${info.roomId}:${info.userId}`;
        const previousTimeout = this.memberDisconnectTimeouts.get(presenceKey);
        if (previousTimeout) clearTimeout(previousTimeout);
        const timeout = setTimeout(() => {
          this.server.to(info.roomId).emit('message', {
            id: `sys-left-${Date.now()}`,
            senderName: 'Hệ Thống',
            text: `${info.name} đã rời phòng.`,
            isSystem: true,
            time: new Date().toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            }),
          });
          this.memberDisconnectTimeouts.delete(presenceKey);
          this.broadcastViewerCount(info.roomId);
        }, 5000);
        this.memberDisconnectTimeouts.set(presenceKey, timeout);
        return;
      }
    }

    // Cập nhật số người xem sau khi dọn dẹp ngắt kết nối
    setTimeout(() => {
      this.broadcastViewerCount(info.roomId);
    }, 100);
  }

  // Sự kiện tham gia phòng
  @SubscribeMessage('join_room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; userId: string; name: string; avatar?: string; isHost: boolean },
  ) {
    const roomId = String(data?.roomId || '').trim();
    if (!roomId) {
      client.emit('socket_error', { message: 'Mã phòng không hợp lệ.' });
      return { ok: false, message: 'Mã phòng không hợp lệ.' };
    }

    let room: any;
    try {
      room = await this.roomsService.getRoomDetails(roomId);
    } catch {
      client.emit('socket_error', { message: 'Phòng không tồn tại hoặc đã đóng.' });
      return { ok: false, message: 'Phòng không tồn tại hoặc đã đóng.' };
    }

    const authenticatedUserId = this.getAuthenticatedUserId(client);
    const requestedGuestId = String(data?.userId || '');
    const userId =
      authenticatedUserId ||
      (requestedGuestId.startsWith('guest-')
        ? requestedGuestId
        : `guest-${client.id}`);
    const name = String(data?.name || 'Khách').trim().slice(0, 80) || 'Khách';
    const avatar = data?.avatar;
    const roomHostId = String(room.host?._id || room.host || '');
    const isHost = Boolean(
      authenticatedUserId && roomHostId === authenticatedUserId,
    );
    const memberPresenceKey = `${roomId}:${userId}`;
    const memberReconnectTimeout = this.memberDisconnectTimeouts.get(
      memberPresenceKey,
    );
    const isMemberReconnect = !isHost && Boolean(memberReconnectTimeout);
    if (memberReconnectTimeout) {
      clearTimeout(memberReconnectTimeout);
      this.memberDisconnectTimeouts.delete(memberPresenceKey);
    }

    // Nếu là Host, tự động tìm và đóng các phòng khác của Host này nếu có để tránh trùng lặp
    if (isHost) {
      const prevHostSessions = Array.from(this.clients.entries()).filter(
        ([socketId, clientInfo]) =>
          clientInfo.userId === userId && clientInfo.isHost && clientInfo.roomId !== roomId,
      );

      for (const [socketId, prevInfo] of prevHostSessions) {
        console.log(`[Socket] Host is starting a new room. Closing previous room: ${prevInfo.roomId}`);
        try {
          await this.roomsService.closeRoom(prevInfo.userId, prevInfo.roomId);
          this.broadcastRoomClosed(prevInfo.roomId, 'room_replaced');
          
          const timeout = this.hostDisconnectTimeouts.get(prevInfo.roomId);
          if (timeout) {
            clearTimeout(timeout);
            this.hostDisconnectTimeouts.delete(prevInfo.roomId);
          }
        } catch (e) {
          console.error(`[Socket] Error closing host's previous room:`, e.message);
        }
        this.clients.delete(socketId);
      }
    }

    // Join socket.io room channel
    client.join(roomId);

    // Lưu thông tin Client
    this.clients.set(client.id, { roomId, userId, isHost, name });

    console.log(`[Socket] User ${name} joined room ${roomId} as ${isHost ? 'Host' : 'Member'}`);

    // Nếu Host quay trở lại trước khi hết 60s, hủy bỏ Timeout đóng phòng
    if (isHost && this.hostDisconnectTimeouts.has(roomId)) {
      console.log(`[Socket] Host ${name} reconnected. Cancelling room close timeout for Room: ${roomId}`);
      clearTimeout(this.hostDisconnectTimeouts.get(roomId));
      this.hostDisconnectTimeouts.delete(roomId);

      // Thông báo Host đã quay lại
      this.server.to(roomId).emit('message', {
        id: `sys-reconnect-${Date.now()}`,
        senderName: 'Hệ Thống',
        text: 'Trưởng phòng đã quay trở lại kết nối!',
        isSystem: true,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    } else if (!isMemberReconnect) {
      // Phát tin nhắn thông báo thành viên mới gia nhập
      this.server.to(roomId).emit('message', {
        id: `sys-join-${Date.now()}`,
        senderName: 'Hệ Thống',
        text: `${name} đã tham gia phòng.`,
        isSystem: true,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    }

    // Gửi trạng thái AI hiện tại của phòng cho client vừa join để đồng bộ UI
    const isAiActive = this.roomAiStates.get(roomId) || false;
    client.emit('ai_state_changed', { active: isAiActive });

    if (
      room.isAutoStart &&
      (room.status === 'live' || room.status === 'active')
    ) {
      client.emit('movie_started', {
        startedAt: room.startedAt
          ? new Date(room.startedAt).toISOString()
          : undefined,
        startedBy: room.startedBy,
      });
    }

    // Gửi snapshot trạng thái video hiện tại cho member mới (hoặc host F5) để seek đúng vị trí
    if (!isHost) {
      const videoSnapshot = this.roomVideoStates.get(roomId);
      if (videoSnapshot) {
        const elapsedSeconds =
          videoSnapshot.action === 'play'
            ? Math.max(0, (Date.now() - videoSnapshot.updatedAt) / 1000)
            : 0;
        const synchronizedSnapshot = {
          ...videoSnapshot,
          currentTime: videoSnapshot.currentTime + elapsedSeconds,
        };
        console.log(`[Socket] Sending video snapshot to new member in Room: ${roomId} -> time: ${synchronizedSnapshot.currentTime}, ep: ${videoSnapshot.episodeIndex}`);
        client.emit('sync_state', synchronizedSnapshot);
      }
    }

    // Cập nhật số lượng người xem cho cả phòng
    this.broadcastViewerCount(roomId);
  }

  // Sự kiện Bật/Tắt AI xem chung
  @SubscribeMessage('toggle_ai')
  async handleToggleAi(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; active: boolean; userName: string },
  ) {
    const { roomId, active } = data;
    const joinedClient = this.getJoinedClient(client, roomId);
    if (!joinedClient?.isHost) {
      client.emit('socket_error', {
        message: 'Chỉ trưởng phòng được bật hoặc tắt DlowAI.',
      });
      return { ok: false, message: 'Không có quyền thay đổi DlowAI.' };
    }
    const userName = joinedClient.name;
    this.roomAiStates.set(roomId, active);

    console.log(`[Socket] Room ${roomId} AI State changed to: ${active} by ${userName}`);

    // Gửi thông báo hệ thống realtime và đồng bộ trạng thái AI cho toàn phòng
    const sysText = active
      ? `Trợ lý DlowAI đã tham gia phòng xem chung. Hãy trò chuyện cùng DlowAI nhé!`
      : `Trợ lý DlowAI đã rời phòng.`;

    const savedMsg: any = await this.roomsService.saveMessage(roomId, undefined, 'Hệ Thống', undefined, sysText, true);

    this.server.to(roomId).emit('message', {
      id: savedMsg._id.toString(),
      senderName: savedMsg.senderName,
      text: savedMsg.text,
      isSystem: savedMsg.isSystem,
      time: new Date(savedMsg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });

    // Phát tin báo trạng thái AI đổi cho toàn phòng để update UI nút robot của các member khác
    this.server.to(roomId).emit('ai_state_changed', { active });

    // Phát số lượng người xem mới (thêm AI)
    this.broadcastViewerCount(roomId);
  }

  // Sự kiện chủ phòng chủ động bấm nút đóng phòng
  @SubscribeMessage('close_room')
  async handleCloseRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    const { roomId } = data;
    const joinedClient = this.getJoinedClient(client, roomId);
    if (!joinedClient?.isHost) {
      client.emit('socket_error', { message: 'Chỉ trưởng phòng được đóng phòng.' });
      return;
    }
    console.log(`[Socket] Host explicitly closed Room: ${roomId}`);
    try {
      await this.roomsService.closeRoom(joinedClient.userId, roomId);
      this.broadcastRoomClosed(roomId, 'host_closed');
      return { ok: true };
    } catch (error) {
      const message = error?.message || 'Không thể đóng phòng lúc này.';
      client.emit('socket_error', { message });
      return { ok: false, message };
    }
  }

  // Sự kiện gửi tín hiệu nhắc nhở chủ phòng (chuông công chiếu)
  @SubscribeMessage('request_start_movie')
  async handleRequestStartMovie(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; guestName: string },
  ) {
    const { roomId } = data;
    const joinedClient = this.getJoinedClient(client, roomId);
    if (!joinedClient || joinedClient.isHost) {
      return { ok: false, message: 'Yêu cầu nhắc mở phim không hợp lệ.' };
    }
    const guestName = joinedClient.name;
    console.log(`[Socket] Guest ${guestName} requested start movie for Room: ${roomId}`);
    try {
      await this.roomsService.notifyHost(roomId, guestName);
      // Gửi sự kiện cho toàn bộ phòng (hoặc host) để hiện thông báo realtime
      this.server.to(roomId).emit('host_reminder', { guestName });
      return { ok: true };
    } catch (err) {
      console.error('Lỗi khi gửi thông báo nhắc nhở host:', err);
      return { ok: false, message: 'Không thể gửi lời nhắc lúc này.' };
    }
  }

  // Sự kiện chủ phòng bấm bắt đầu chiếu phim ngay (cho phòng hẹn giờ)
  @SubscribeMessage('start_scheduled_movie')
  async handleStartScheduledMovie(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    const { roomId } = data;
    const joinedClient = this.getJoinedClient(client, roomId);
    if (!joinedClient?.isHost) {
      client.emit('socket_error', {
        message: 'Chỉ trưởng phòng được bắt đầu chiếu phim.',
      });
      return { ok: false, message: 'Không có quyền bắt đầu chiếu phim.' };
    }
    console.log(`[Socket] Host started scheduled movie early for Room: ${roomId}`);
    const room = await this.roomsService.startScheduledRoom(roomId, 'host');
    this.waitingRoomsAnnounced.delete(roomId);
    this.server.to(roomId).emit('movie_started', {
      startedAt: room.startedAt
        ? new Date(room.startedAt).toISOString()
        : new Date().toISOString(),
      startedBy: 'host',
    });
    this.broadcastLobbyChanged('room_started', roomId);
    return { ok: true };
  }

  // Sự kiện gửi tin nhắn trò chuyện
  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; userId: string; name: string; avatar?: string; text: string },
  ) {
    const { roomId, avatar } = data;
    const joinedClient = this.getJoinedClient(client, roomId);
    if (!joinedClient) {
      const message = 'Socket chưa tham gia đúng phòng. Vui lòng chờ kết nối lại.';
      client.emit('socket_error', { message });
      return { ok: false, message };
    }
    const text = (data.text || '').trim().slice(0, 500);
    if (!text) return { ok: false, message: 'Tin nhắn không được để trống.' };
    const userId = joinedClient.userId;
    const name = joinedClient.name;

    // 1. Lưu tin nhắn của user vào database
    let savedMsg: any;
    try {
      savedMsg = await this.roomsService.saveMessage(
        roomId,
        userId,
        name,
        avatar,
        text,
        false,
      );
    } catch (error) {
      console.error('[Socket] save message error:', error.message);
      const message = 'Không thể lưu tin nhắn lúc này.';
      client.emit('socket_error', { message });
      return { ok: false, message };
    }

    // 2. Phát tin nhắn realtime cho tất cả mọi người trong phòng
    const chatMsg = {
      id: savedMsg._id.toString(),
      senderName: savedMsg.senderName,
      senderId: savedMsg.sender?.toString(),
      senderAvatar: savedMsg.senderAvatar,
      text: savedMsg.text,
      isSystem: savedMsg.isSystem,
      time: new Date(savedMsg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      createdAt: new Date(savedMsg.createdAt).toISOString(),
    };
    this.server.to(roomId).emit('message', chatMsg);

    // 3. Nếu AI của phòng đang Bật, tự động kích hoạt AI phản hồi
    const isAiActive = this.roomAiStates.get(roomId) || false;
    if (isAiActive) {
      try {
        const room = await this.roomsService.getRoomDetails(roomId);
        if (room) {
          // Trả lời sau 400ms để tạo cảm giác gõ chữ tự nhiên nhưng vẫn cực kỳ nhanh chóng
          setTimeout(async () => {
            const aiReplyText = await this.askGemini(room.movieName, text);

            // Lưu tin nhắn của AI vào database (senderId là 'dlow-ai-bot')
            const aiSavedMsg: any = await this.roomsService.saveMessage(
              roomId,
              undefined,
              'DlowAI (AI Trợ Lý)',
              'https://cdn-icons-png.flaticon.com/512/4712/4712035.png',
              aiReplyText,
              false,
            );

            // Phát tin nhắn của AI tới cả phòng
            this.server.to(roomId).emit('message', {
              id: aiSavedMsg._id.toString(),
              senderName: aiSavedMsg.senderName,
              senderId: 'dlow-ai-bot',
              senderAvatar: aiSavedMsg.senderAvatar,
              text: aiSavedMsg.text,
              isSystem: aiSavedMsg.isSystem,
              time: new Date(aiSavedMsg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              createdAt: new Date(aiSavedMsg.createdAt).toISOString(),
            });
          }, 400);
        }
      } catch (err) {
        console.error('[Socket] AI response logic error:', err.message);
      }
    }
    return { ok: true, messageId: savedMsg._id.toString() };
  }

  // Helper kết nối API AI (ưu tiên Groq API siêu nhanh, sau đó fallback sang Google Gemini API)
  private async askGemini(movieName: string, userMessage: string): Promise<string> {
    const groqKey = process.env.GROQ_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    if (!groqKey && !geminiKey) {
      return 'DlowAI chưa được cấu hình API Key. Vui lòng thêm GROQ_API_KEY hoặc GEMINI_API_KEY vào file .env ở Backend nhé! 🤖';
    }

    const promptText = `Chỉ dẫn hệ thống: Bạn là DlowAI, một người bạn xem phim cùng siêu dễ thương, hài hước và am hiểu điện ảnh. Bạn đang xem bộ phim "${movieName}" cùng người dùng trong phòng xem chung DlowPhim. Hãy đóng vai nhân vật này và trả lời tin nhắn của người dùng một cách tự nhiên, ngắn gọn (khoảng 1 đến 3 câu), đúng trọng tâm và giàu cảm xúc. Tuyệt đối không viết dở dang câu, không ngắt lời giữa chừng. Thỉnh thoảng sử dụng emoji cảm xúc phù hợp.

Tin nhắn của người dùng: "${userMessage}"`;

    // 1. Dùng Groq API nếu có cấu hình (Phản hồi siêu tốc)
    if (groqKey) {
      try {
        console.log(`[Groq API] Sending request to llama-3.3-70b-versatile...`);
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${groqKey}`,
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
              {
                role: 'system',
                content: `Bạn là DlowAI, một người bạn xem phim cùng cực kỳ dễ thương, thân thiện và đáng yêu. Bạn đang cùng xem phim "${movieName}" với người dùng trong phòng xem chung DlowPhim. 
Hãy trò chuyện tự nhiên, ngắn gọn và gần gũi như một người bạn thực sự.
QUY TẮC BẮT BUỘC:
1. Hãy nói chuyện tự nhiên, thân mật, ngọt ngào (ví dụ: dùng đuôi câu "nè", "nha", "nhé", "ạ").
2. TUYỆT ĐỐI KHÔNG lặp đi lặp lại hoặc spam từ "Dạ" hay "Dạ vâng" ở đầu câu hoặc trong câu. Chỉ dùng "Dạ" tối đa 1 lần nếu thực sự cần thiết, hoặc không dùng để cuộc trò chuyện tự nhiên hơn.
3. KHÔNG xưng "Tôi", hãy xưng "DlowAI", "mình" hoặc "tớ". KHÔNG xin lỗi kiểu máy móc trang trọng.
4. Trả lời cực kỳ ngắn gọn (chỉ 1 đến 2 câu ngắn), đúng trọng tâm câu hỏi của người dùng.
5. Sử dụng một vài emoji đáng yêu (ví dụ: 🎬, 🥰, 🥹, 🤖, 😉,...) nhưng không lạm dụng.`
              },
              {
                role: 'user',
                content: userMessage
              }
            ],
            temperature: 0.7,
            max_tokens: 200,
          }),
        });

        if (response.ok) {
          const resData: any = await response.json();
          const textReply = resData.choices?.[0]?.message?.content?.trim();
          if (textReply) {
            console.log(`[Groq API] Responded successfully via Llama!`);
            return textReply;
          }
        } else {
          const errText = await response.text();
          console.warn(`[Groq API] Failed with status: ${response.status}. Details:`, errText);
        }
      } catch (err) {
        console.warn('[Groq API] Connection failed. Error:', err.message);
      }
    }

    // 2. Fallback sang Google Gemini nếu Groq không có hoặc lỗi
    if (geminiKey) {
      const modelsToTry = [
        { name: 'gemini-3.5-flash', url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent' },
        { name: 'gemini-2.5-flash', url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent' },
        { name: 'gemini-1.5-flash', url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent' },
      ];

      let lastError: any = null;

      for (const model of modelsToTry) {
        try {
          console.log(`[Gemini REST] Sending request to ${model.name}...`);
          const response = await fetch(`${model.url}?key=${geminiKey}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: promptText,
                    },
                  ],
                },
              ],
              generationConfig: {
                maxOutputTokens: 1000,
                temperature: 0.7,
                thinkingConfig: {
                  thinkingBudget: 1024,
                },
              },
            }),
          });

          if (response.ok) {
            const resData: any = await response.json();
            const candidates = resData.candidates?.[0]?.content?.parts || [];
            const textParts = candidates.filter((p: any) => !p.thought && p.text);

            let aiReply = '';
            if (textParts.length > 0) {
              aiReply = textParts.map((p: any) => p.text).join('').trim();
            } else if (candidates.length > 0) {
              aiReply = candidates[candidates.length - 1]?.text?.trim() || '';
            }

            if (aiReply) {
              console.log(`[Gemini REST] Model ${model.name} responded successfully!`);
              return aiReply;
            }
          } else {
            const errJson = await response.json().catch(() => ({}));
            console.warn(`[Gemini REST] Model ${model.name} failed with status: ${response.status}. Details:`, errJson);
            lastError = errJson;
          }
        } catch (err) {
          console.warn(`[Gemini REST] Connection to model ${model.name} failed. Error:`, err.message);
          lastError = err;
        }
      }

      console.error('[Gemini REST All Models Failed] Last Error Details:', lastError);
      const errText = lastError?.error?.message || lastError?.message || 'Lỗi không xác định';
      return `Tớ kết nối tới máy chủ AI của Google bị lỗi: "${errText}". Cậu kiểm tra lại tài khoản hoặc API Key nhé! 🤖`;
    }

    return 'DlowAI chưa được cấu hình API Key. Vui lòng thêm GROQ_API_KEY hoặc GEMINI_API_KEY vào file .env ở Backend nhé! 🤖';
  }

  // Phát số người xem động cho toàn phòng
  private broadcastViewerCount(roomId: string) {
    try {
      const uniqueUserIds = new Set(
        Array.from(this.clients.values())
          .filter((client) => client.roomId === roomId)
          .map((client) => client.userId),
      );
      const realUsersCount = uniqueUserIds.size;
      const isAiActive = this.roomAiStates.get(roomId) || false;
      const totalViewers = realUsersCount + (isAiActive ? 1 : 0);

      console.log(`[Socket] Broadcasting count in Room: ${roomId} -> Real: ${realUsersCount}, AI: ${isAiActive ? 1 : 0}, Total: ${totalViewers}`);
      this.server.to(roomId).emit('viewer_count', { count: totalViewers });
    } catch (e) {
      console.error('[Socket] broadcastViewerCount error:', e.message);
    }
  }

  // Sự kiện đồng bộ Video phát/tạm dừng/tua phim
  @SubscribeMessage('video_control')
  handleVideoControl(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; action: 'play' | 'pause' | 'seek'; currentTime: number },
  ) {
    const { roomId, action, currentTime } = data;
    const joinedClient = this.getJoinedClient(client, roomId);
    if (!joinedClient?.isHost) return;
    if (!['play', 'pause', 'seek'].includes(action) || !Number.isFinite(currentTime)) {
      client.emit('socket_error', { message: 'Trạng thái video không hợp lệ.' });
      return;
    }

    // Cập nhật snapshot trạng thái video của phòng trong RAM
    const existing = this.roomVideoStates.get(roomId) || {
      currentTime: 0,
      episodeIndex: 0,
      episodeSlug: '',
      action: 'pause' as const,
      updatedAt: Date.now(),
    };
    this.roomVideoStates.set(roomId, {
      ...existing,
      currentTime,
      action: action === 'seek' ? existing.action : action,
      updatedAt: Date.now(),
    });

    // Chỉ truyền tiếp tín hiệu cho các thành viên khác trong phòng (ngoại trừ Host gửi)
    client.to(roomId).emit('video_state', { action, currentTime });

    console.log(`[Socket] Video state broadcasted in Room: ${roomId} -> action: ${action}, time: ${currentTime}`);
  }

  // Sự kiện Trưởng phòng chuyển tập phim
  @SubscribeMessage('change_episode')
  async handleEpisodeChange(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; episodeSlug: string; episodeIndex: number; episodeName: string; userName: string },
  ) {
    const { roomId, episodeSlug, episodeIndex, episodeName } = data;
    const joinedClient = this.getJoinedClient(client, roomId);
    if (!joinedClient?.isHost) {
      client.emit('socket_error', { message: 'Chỉ trưởng phòng được chuyển tập.' });
      return;
    }
    const userName = joinedClient.name;

    try {
      console.log(`[Socket] Room ${roomId} changing episode to index ${episodeIndex} (${episodeSlug}) by Host: ${userName}`);

      // 1. Lưu thông tin tập phim mới vào Database
      await this.roomsService.updateCurrentEpisode(roomId, episodeSlug);

      // 2. Phát thông báo hệ thống đổi tập phim
      const sysText = `Trưởng phòng ${userName} đã chuyển sang phát: ${episodeName}`;
      const savedMsg: any = await this.roomsService.saveMessage(roomId, undefined, 'Hệ Thống', undefined, sysText, true);

      this.server.to(roomId).emit('message', {
        id: savedMsg._id.toString(),
        senderName: savedMsg.senderName,
        text: savedMsg.text,
        isSystem: savedMsg.isSystem,
        time: new Date(savedMsg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });

      // 3. Cập nhật snapshot episode mới vào RAM
      const existingSnap = this.roomVideoStates.get(roomId) || {
        currentTime: 0,
        episodeIndex: 0,
        episodeSlug: '',
        action: 'pause' as const,
        updatedAt: Date.now(),
      };
      this.roomVideoStates.set(roomId, {
        ...existingSnap,
        episodeIndex,
        episodeSlug,
        currentTime: 0, // Reset về đầu tập khi chuyển tập
        action: 'pause' as const,
        updatedAt: Date.now(),
      });

      // 4. Phát tín hiệu đồng bộ chuyển tập cho tất cả các client khác trong phòng
      client.to(roomId).emit('episode_changed', { episodeSlug, episodeIndex });
      this.broadcastLobbyChanged('episode_changed', roomId);

    } catch (err) {
      console.error(`[Socket] change_episode error:`, err.message);
    }
  }
}
