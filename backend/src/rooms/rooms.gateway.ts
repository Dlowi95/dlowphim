import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RoomsService } from './rooms.service';

@WebSocketGateway({
  cors: {
    origin: '*', // Hỗ trợ CORS kết nối client-side
  },
})
export class RoomsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // Quản lý thông tin client socket đang kết nối
  private clients = new Map<string, { roomId: string; userId: string; isHost: boolean; name: string }>();

  // Quản lý các timeout đóng phòng của Host bị ngắt kết nối
  private hostDisconnectTimeouts = new Map<string, NodeJS.Timeout>();

  // Quản lý trạng thái AI hoạt động của từng phòng (roomId -> isActive)
  private roomAiStates = new Map<string, boolean>();

  constructor(private readonly roomsService: RoomsService) { }

  handleConnection(client: Socket) {
    console.log(`[Socket] Client connected: ${client.id}`);
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
            this.roomAiStates.delete(info.roomId);

            // Phát sự kiện đóng phòng để đẩy mọi người ra ngoài
            this.server.to(info.roomId).emit('room_closed');
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
      // Thành viên thường ngắt kết nối
      this.server.to(info.roomId).emit('message', {
        id: `sys-left-${Date.now()}`,
        senderName: 'Hệ Thống',
        text: `${info.name} đã rời phòng.`,
        isSystem: true,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
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
    const { roomId, userId, name, avatar, isHost } = data;

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
    } else {
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

    // Cập nhật số lượng người xem cho cả phòng
    this.broadcastViewerCount(roomId);
  }

  // Sự kiện Bật/Tắt AI xem chung
  @SubscribeMessage('toggle_ai')
  async handleToggleAi(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; active: boolean; userName: string },
  ) {
    const { roomId, active, userName } = data;
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

  // Sự kiện gửi tin nhắn trò chuyện
  @SubscribeMessage('send_message')
  async handleSendMessage(
    @MessageBody() data: { roomId: string; userId: string; name: string; avatar?: string; text: string },
  ) {
    const { roomId, userId, name, avatar, text } = data;

    // 1. Lưu tin nhắn của user vào database
    const savedMsg: any = await this.roomsService.saveMessage(roomId, userId, name, avatar, text, false);

    // 2. Phát tin nhắn realtime cho tất cả mọi người trong phòng
    const chatMsg = {
      id: savedMsg._id.toString(),
      senderName: savedMsg.senderName,
      senderId: savedMsg.sender?.toString(),
      senderAvatar: savedMsg.senderAvatar,
      text: savedMsg.text,
      isSystem: savedMsg.isSystem,
      time: new Date(savedMsg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    this.server.to(roomId).emit('message', chatMsg);

    // 3. Nếu AI của phòng đang Bật, tự động kích hoạt AI phản hồi
    const isAiActive = this.roomAiStates.get(roomId) || false;
    if (isAiActive) {
      try {
        const room = await this.roomsService.getRoomDetails(roomId);
        if (room) {
          // Trả lời sau 1.5 giây để tạo cảm giác gõ chữ tự nhiên
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
            });
          }, 1500);
        }
      } catch (err) {
        console.error('[Socket] AI response logic error:', err.message);
      }
    }
  }

  // Helper kết nối Google Gemini API bằng REST API thuần (không phụ thuộc SDK tránh lỗi ESM/CommonJS compiler)
  private async askGemini(movieName: string, userMessage: string): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return 'DlowAI chưa được cấu hình API Key. Vui lòng thêm GEMINI_API_KEY vào file .env ở Backend nhé! 🤖';
    }

    const modelsToTry = [
      { name: 'gemini-3.5-flash', url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent' },
      { name: 'gemini-2.5-flash', url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent' },
      { name: 'gemini-1.5-flash', url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent' },
    ];

    const promptText = `Chỉ dẫn hệ thống: Bạn là DlowAI, một người bạn xem phim cùng siêu dễ thương, hài hước và am hiểu điện ảnh. Bạn đang xem bộ phim "${movieName}" cùng người dùng trong phòng xem chung DlowPhim. Hãy đóng vai nhân vật này và trả lời tin nhắn của người dùng một cách tự nhiên, ngắn gọn (khoảng 1 đến 3 câu), đúng trọng tâm và giàu cảm xúc. Tuyệt đối không viết dở dang câu, không ngắt lời giữa chừng. Thỉnh thoảng sử dụng emoji cảm xúc phù hợp.

Tin nhắn của người dùng: "${userMessage}"`;

    let lastError: any = null;

    for (const model of modelsToTry) {
      try {
        console.log(`[Gemini REST] Sending request to ${model.name}...`);
        const response = await fetch(`${model.url}?key=${apiKey}`, {
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
          const parts = resData.candidates?.[0]?.content?.parts || [];
          // Lọc bỏ các part chứa suy nghĩ nội bộ (thought: true) của Gemini 3.5
          const textParts = parts.filter((p: any) => !p.thought && p.text);

          let aiReply = '';
          if (textParts.length > 0) {
            aiReply = textParts.map((p: any) => p.text).join('').trim();
          } else if (parts.length > 0) {
            aiReply = parts[parts.length - 1]?.text?.trim() || '';
          }

          if (aiReply) {
            console.log(`[Gemini REST] Model ${model.name} responded successfully (extracted clean text)!`);
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

  // Phát số người xem động cho toàn phòng
  private broadcastViewerCount(roomId: string) {
    try {
      const socketRoom = this.server.sockets.adapter.rooms.get(roomId);
      const realUsersCount = socketRoom ? socketRoom.size : 0;
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
    const { roomId, episodeSlug, episodeIndex, episodeName, userName } = data;

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

      // 3. Phát tin hiệu đồng bộ chuyển tập cho tất cả các client khác trong phòng
      client.to(roomId).emit('episode_changed', { episodeSlug, episodeIndex });

    } catch (err) {
      console.error(`[Socket] change_episode error:`, err.message);
    }
  }
}
