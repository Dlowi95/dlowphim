import { RoomsGateway } from './rooms.gateway';

describe('RoomsGateway socket safety', () => {
  function createGateway() {
    const roomsService = {
      getRoomDetails: jest.fn().mockResolvedValue({
        roomId: 'ROOM01',
        host: { _id: 'real-host' },
        movieName: 'Phim đang xem',
      }),
      saveMessage: jest.fn().mockResolvedValue({
        _id: { toString: () => 'message-1' },
        senderName: 'Khách 1234',
        senderAvatar: undefined,
        text: 'Xin chào',
        isSystem: false,
        createdAt: new Date(),
      }),
      startScheduledRoom: jest.fn().mockResolvedValue({
        roomId: 'ROOM01',
        startedAt: new Date('2026-08-02T08:00:00.000Z'),
      }),
      getDueScheduledRooms: jest.fn().mockResolvedValue([]),
      expireScheduledRoom: jest.fn().mockResolvedValue(null),
      assertRoomAccess: jest.fn().mockResolvedValue(undefined),
      closeRoom: jest.fn().mockResolvedValue({
        roomId: 'ROOM01',
        status: 'closed',
      }),
    };
    const roomEmit = jest.fn();
    const authService = {
      getValidSessionUser: jest.fn().mockResolvedValue({
        _id: 'authenticated-user',
        tokenVersion: 0,
        isActive: true,
      }),
    };
    const jwtService = {
      verifyAsync: jest.fn().mockResolvedValue({ sub: 'authenticated-user', tokenVersion: 0 }),
      verify: jest.fn().mockReturnValue({ sub: 'authenticated-user', tokenVersion: 0 }),
    };
    const gateway = new RoomsGateway(
      roomsService as any,
      jwtService as any,
      authService as any,
    );
    (gateway as any).server = {
      to: jest.fn().mockReturnValue({ emit: roomEmit }),
      sockets: { adapter: { rooms: new Map() } },
    };
    return { gateway, roomsService, authService, jwtService, roomEmit };
  }

  it('derives host permission from JWT and room data instead of client input', async () => {
    const { gateway } = createGateway();
    const client = {
      id: 'socket-1',
      handshake: { auth: { token: 'valid-token' } },
      join: jest.fn(),
      emit: jest.fn(),
    } as any;

    const result = await gateway.handleJoinRoom(client, {
      roomId: 'ROOM01',
      userId: 'real-host',
      name: 'Spoofed host',
      isHost: true,
    });

    expect(result).toEqual({ ok: true });
    expect((gateway as any).clients.get(client.id)).toEqual(
      expect.objectContaining({
        userId: 'authenticated-user',
        isHost: false,
      }),
    );
  });

  it('rejects a private-room socket before joining when room access is missing', async () => {
    const { gateway, roomsService } = createGateway();
    roomsService.getRoomDetails.mockResolvedValueOnce({
      roomId: 'ROOM01',
      isPrivate: true,
      host: { _id: 'real-host' },
    });
    roomsService.assertRoomAccess.mockRejectedValueOnce({
      response: { message: 'Phòng riêng tư yêu cầu mã PIN.' },
    });
    const client = {
      id: 'socket-private',
      handshake: { auth: {} },
      join: jest.fn(),
      emit: jest.fn(),
    } as any;

    await expect(
      gateway.handleJoinRoom(client, {
        roomId: 'ROOM01',
        userId: 'guest-private',
        name: 'Guest',
        isHost: false,
      }),
    ).resolves.toEqual(
      expect.objectContaining({ ok: false, requiresPin: true }),
    );
    expect(client.join).not.toHaveBeenCalled();
  });

  it('rejects chat from sockets that have not joined the room', async () => {
    const { gateway, roomsService } = createGateway();
    const client = { id: 'socket-1', emit: jest.fn() } as any;

    const result = await gateway.handleSendMessage(client, {
      roomId: 'ROOM01',
      userId: 'spoofed-user',
      name: 'Spoofed',
      text: 'Xin chào',
    });

    expect(result.ok).toBe(false);
    expect(client.emit).toHaveBeenCalledWith(
      'socket_error',
      expect.objectContaining({ message: expect.any(String) }),
    );
    expect(roomsService.saveMessage).not.toHaveBeenCalled();
  });

  it('uses the joined socket identity and acknowledges a valid chat message', async () => {
    const { gateway, roomsService, roomEmit } = createGateway();
    const client = { id: 'socket-1', emit: jest.fn() } as any;
    (gateway as any).clients.set(client.id, {
      roomId: 'ROOM01',
      userId: 'guest-stable-id',
      isHost: false,
      name: 'Khách 1234',
    });

    const result = await gateway.handleSendMessage(client, {
      roomId: 'ROOM01',
      userId: 'spoofed-user',
      name: 'Spoofed',
      text: '  Xin chào  ',
    });

    expect(result).toEqual({ ok: true, messageId: 'message-1' });
    expect(roomsService.saveMessage).toHaveBeenCalledWith(
      'ROOM01',
      'guest-stable-id',
      'Khách 1234',
      undefined,
      'Xin chào',
      false,
    );
    expect(roomEmit).toHaveBeenCalledWith(
      'message',
      expect.objectContaining({
        id: 'message-1',
        text: 'Xin chào',
        createdAt: expect.any(String),
      }),
    );
  });

  it('groups nearby room messages into one contextual AI request', async () => {
    const { gateway, roomsService } = createGateway();
    const firstClient = { id: 'socket-1', emit: jest.fn() } as any;
    const secondClient = { id: 'socket-2', emit: jest.fn() } as any;
    (gateway as any).clients.set(firstClient.id, {
      roomId: 'ROOM01',
      userId: 'member-1',
      isHost: false,
      name: 'An',
    });
    (gateway as any).clients.set(secondClient.id, {
      roomId: 'ROOM01',
      userId: 'member-2',
      isHost: false,
      name: 'Bình',
    });
    (gateway as any).roomAiStates.set('ROOM01', true);
    const requestAiReply = jest
      .spyOn(gateway as any, 'requestAiReply')
      .mockResolvedValue('Hai ý này nối với nhau khá hay đó mọi người 🎬');

    await gateway.handleSendMessage(firstClient, {
      roomId: 'ROOM01',
      userId: 'spoofed-1',
      name: 'Spoofed',
      text: 'Đoạn này có phải hồi tưởng không?',
    });
    await gateway.handleSendMessage(secondClient, {
      roomId: 'ROOM01',
      userId: 'spoofed-2',
      name: 'Spoofed',
      text: 'Mình cũng nghĩ vậy á',
    });

    expect(requestAiReply).not.toHaveBeenCalled();
    await (gateway as any).flushAiRoom('ROOM01');

    expect(requestAiReply).toHaveBeenCalledTimes(1);
    expect(requestAiReply.mock.calls[0][1]).toContain('"sender":"An"');
    expect(requestAiReply.mock.calls[0][1]).toContain('"sender":"Bình"');
    expect(roomsService.saveMessage).toHaveBeenLastCalledWith(
      'ROOM01',
      undefined,
      'DlowAI',
      expect.any(String),
      'Hai ý này nối với nhau khá hay đó mọi người 🎬',
      false,
    );
    gateway.onModuleDestroy();
  });

  it('allows only one in-flight AI request per room and keeps later messages queued', async () => {
    const { gateway } = createGateway();
    (gateway as any).roomAiStates.set('ROOM01', true);
    let resolveFirstReply!: (value: string) => void;
    const firstReply = new Promise<string>((resolve) => {
      resolveFirstReply = resolve;
    });
    const requestAiReply = jest
      .spyOn(gateway as any, 'requestAiReply')
      .mockImplementationOnce(() => firstReply)
      .mockResolvedValueOnce('Câu trả lời thứ hai');

    (gateway as any).enqueueAiMessage('ROOM01', {
      senderId: 'member-1',
      senderName: 'An',
      text: 'Tin đầu tiên',
      createdAt: Date.now(),
    });
    const firstFlush = (gateway as any).flushAiRoom('ROOM01');
    await Promise.resolve();
    await Promise.resolve();

    (gateway as any).enqueueAiMessage('ROOM01', {
      senderId: 'member-2',
      senderName: 'Bình',
      text: 'Tin đến trong lúc AI đang trả lời',
      createdAt: Date.now(),
    });
    await (gateway as any).flushAiRoom('ROOM01');
    expect(requestAiReply).toHaveBeenCalledTimes(1);

    resolveFirstReply('Câu trả lời thứ nhất');
    await firstFlush;
    await (gateway as any).flushAiRoom('ROOM01');

    expect(requestAiReply).toHaveBeenCalledTimes(2);
    expect(requestAiReply.mock.calls[1][1]).toContain(
      'Tin đến trong lúc AI đang trả lời',
    );
    expect(requestAiReply.mock.calls[1][2]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'assistant',
          content: 'Câu trả lời thứ nhất',
        }),
      ]),
    );
    gateway.onModuleDestroy();
  });

  it('does not post a bot bubble when DlowAI decides not to interrupt people', async () => {
    const { gateway, roomsService } = createGateway();
    const client = { id: 'socket-1', emit: jest.fn() } as any;
    (gateway as any).clients.set(client.id, {
      roomId: 'ROOM01',
      userId: 'member-1',
      isHost: false,
      name: 'An',
    });
    (gateway as any).roomAiStates.set('ROOM01', true);
    jest
      .spyOn(gateway as any, 'requestAiReply')
      .mockResolvedValue('[DLOWAI_SKIP]');

    await gateway.handleSendMessage(client, {
      roomId: 'ROOM01',
      userId: 'member-1',
      name: 'An',
      text: 'Bình ơi, lát nữa nhớ chờ mình nha',
    });
    await (gateway as any).flushAiRoom('ROOM01');

    expect(roomsService.saveMessage).toHaveBeenCalledTimes(1);
    expect((gateway as any).aiRoomRuntimes.get('ROOM01').history).toEqual([
      expect.objectContaining({ role: 'user' }),
    ]);
    gateway.onModuleDestroy();
  });

  it('sends DlowAI chat through the configured Cloudflare Workers AI account', async () => {
    const { gateway } = createGateway();
    const previousAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const previousAiToken = process.env.CLOUDFLARE_AI_TOKEN;
    const previousAiModel = process.env.CLOUDFLARE_AI_MODEL;
    const previousFetch = global.fetch;
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        choices: [{ message: { content: 'Cloudflare hoạt động rồi nha' } }],
      }),
    });

    try {
      process.env.CLOUDFLARE_ACCOUNT_ID = 'account-123';
      process.env.CLOUDFLARE_AI_TOKEN = 'secret-token';
      process.env.CLOUDFLARE_AI_MODEL = '@cf/zai-org/glm-4.7-flash';
      global.fetch = fetchMock as any;

      const reply = await (gateway as any).requestAiReply(
        'Phim đang xem',
        'Tin nhắn mới',
        [],
        new AbortController().signal,
      );

      expect(reply).toBe('Cloudflare hoạt động rồi nha');
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.cloudflare.com/client/v4/accounts/account-123/ai/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer secret-token',
          }),
        }),
      );
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body).toEqual(
        expect.objectContaining({
          model: '@cf/zai-org/glm-4.7-flash',
          reasoning_effort: null,
          chat_template_kwargs: {
            enable_thinking: false,
            clear_thinking: true,
          },
          max_completion_tokens: 220,
        }),
      );
      expect(body.messages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({ role: 'user', content: 'Tin nhắn mới' }),
        ]),
      );
    } finally {
      global.fetch = previousFetch;
      if (previousAccountId === undefined) {
        delete process.env.CLOUDFLARE_ACCOUNT_ID;
      } else {
        process.env.CLOUDFLARE_ACCOUNT_ID = previousAccountId;
      }
      if (previousAiToken === undefined) {
        delete process.env.CLOUDFLARE_AI_TOKEN;
      } else {
        process.env.CLOUDFLARE_AI_TOKEN = previousAiToken;
      }
      if (previousAiModel === undefined) {
        delete process.env.CLOUDFLARE_AI_MODEL;
      } else {
        process.env.CLOUDFLARE_AI_MODEL = previousAiModel;
      }
    }
  });

  it('extracts only text blocks from a Cloudflare structured reply', () => {
    const { gateway } = createGateway();

    expect(
      (gateway as any).normalizeCloudflareAiReply([
        { type: 'thinking', thinking: 'Không đưa phần này cho người dùng' },
        { type: 'text', text: 'Phim này cuốn ' },
        { type: 'text', text: 'thiệt đó nha 🎬' },
      ]),
    ).toBe('Phim này cuốn thiệt đó nha 🎬');

    gateway.onModuleDestroy();
  });

  it('accepts video controls only from the joined host', () => {
    const { gateway } = createGateway();
    const broadcast = jest.fn();
    const client = {
      id: 'socket-1',
      emit: jest.fn(),
      to: jest.fn().mockReturnValue({ emit: broadcast }),
    } as any;
    (gateway as any).clients.set(client.id, {
      roomId: 'ROOM01',
      userId: 'host-1',
      isHost: false,
      name: 'Member',
    });

    gateway.handleVideoControl(client, {
      roomId: 'ROOM01',
      action: 'play',
      currentTime: 12,
    });
    expect(broadcast).not.toHaveBeenCalled();

    (gateway as any).clients.get(client.id).isHost = true;
    gateway.handleVideoControl(client, {
      roomId: 'ROOM01',
      action: 'play',
      currentTime: 12,
    });
    expect(broadcast).toHaveBeenCalledWith('video_state', {
      action: 'play',
      currentTime: 12,
      serverTime: expect.any(Number),
    });
  });

  it('accepts heartbeat only from the host and broadcasts a timestamped snapshot', () => {
    const { gateway } = createGateway();
    const broadcast = jest.fn();
    const client = {
      id: 'socket-1',
      to: jest.fn().mockReturnValue({ emit: broadcast }),
    } as any;
    (gateway as any).clients.set(client.id, {
      roomId: 'ROOM01',
      userId: 'host-1',
      isHost: false,
      name: 'Host',
    });

    const heartbeat = {
      roomId: 'ROOM01',
      currentTime: 42,
      paused: false,
      episodeIndex: 2,
      episodeSlug: 'tap-03',
    };
    expect(gateway.handleVideoHeartbeat(client, heartbeat)).toEqual({ ok: false });
    expect(broadcast).not.toHaveBeenCalled();

    (gateway as any).clients.get(client.id).isHost = true;
    expect(gateway.handleVideoHeartbeat(client, heartbeat)).toEqual({ ok: true });
    expect(broadcast).toHaveBeenCalledWith(
      'video_heartbeat',
      expect.objectContaining({
        currentTime: 42,
        action: 'play',
        episodeIndex: 2,
        episodeSlug: 'tap-03',
        serverTime: expect.any(Number),
      }),
    );
  });

  it('returns a fresh latency-compensated snapshot when a member requests sync', () => {
    const { gateway } = createGateway();
    const client = { id: 'socket-1', emit: jest.fn() } as any;
    (gateway as any).clients.set(client.id, {
      roomId: 'ROOM01',
      userId: 'member-1',
      isHost: false,
      name: 'Member',
    });
    (gateway as any).roomVideoStates.set('ROOM01', {
      currentTime: 10,
      episodeIndex: 0,
      episodeSlug: 'tap-01',
      action: 'play',
      updatedAt: Date.now() - 2000,
    });

    expect(gateway.handleRequestSync(client, { roomId: 'ROOM01' })).toEqual({
      ok: true,
    });
    expect(client.emit).toHaveBeenCalledWith(
      'sync_state',
      expect.objectContaining({
        currentTime: expect.any(Number),
        action: 'play',
        serverTime: expect.any(Number),
      }),
    );
    const snapshot = client.emit.mock.calls.find(
      ([event]: [string]) => event === 'sync_state',
    )?.[1];
    expect(snapshot.currentTime).toBeGreaterThanOrEqual(11.9);
  });

  it('joins lobby clients to the realtime room list channel', () => {
    const { gateway } = createGateway();
    const client = { join: jest.fn() } as any;

    expect(gateway.handleJoinLobby(client)).toEqual({ ok: true });
    expect(client.join).toHaveBeenCalledWith('watch-together-lobby');
  });

  it('counts one viewer per user even when the user opens multiple tabs', () => {
    const { gateway, roomEmit } = createGateway();
    (gateway as any).clients.set('socket-1', {
      roomId: 'ROOM01',
      userId: 'same-user',
      isHost: false,
      name: 'Member',
    });
    (gateway as any).clients.set('socket-2', {
      roomId: 'ROOM01',
      userId: 'same-user',
      isHost: false,
      name: 'Member',
    });

    (gateway as any).broadcastViewerCount('ROOM01');

    expect(roomEmit).toHaveBeenCalledWith('viewer_count', { count: 1 });
  });

  it('persists an early scheduled start before broadcasting it', async () => {
    const { gateway, roomsService, roomEmit } = createGateway();
    const client = { id: 'socket-1', emit: jest.fn() } as any;
    (gateway as any).clients.set(client.id, {
      roomId: 'ROOM01',
      userId: 'host-1',
      isHost: true,
      name: 'Host',
    });

    const result = await gateway.handleStartScheduledMovie(client, {
      roomId: 'ROOM01',
    });

    expect(result).toEqual({ ok: true });
    expect(roomsService.startScheduledRoom).toHaveBeenCalledWith(
      'ROOM01',
      'host',
    );
    expect(roomEmit).toHaveBeenCalledWith('movie_started', {
      startedAt: '2026-08-02T08:00:00.000Z',
      startedBy: 'host',
    });
  });

  it('persists a host close before redirecting everyone in the room', async () => {
    const { gateway, roomsService, roomEmit } = createGateway();
    const client = { id: 'socket-1', emit: jest.fn() } as any;
    (gateway as any).clients.set(client.id, {
      roomId: 'ROOM01',
      userId: 'host-1',
      isHost: true,
      name: 'Host',
    });

    const result = await gateway.handleCloseRoom(client, { roomId: 'ROOM01' });

    expect(result).toEqual({ ok: true });
    expect(roomsService.closeRoom).toHaveBeenCalledWith('host-1', 'ROOM01');
    expect(roomEmit).toHaveBeenCalledWith('room_closed', {
      reason: 'host_closed',
    });
  });

  it('starts and broadcasts a due room only when its host is online', async () => {
    const { gateway, roomsService, roomEmit } = createGateway();
    roomsService.getDueScheduledRooms.mockResolvedValueOnce([
      {
        roomId: 'ROOM01',
        host: { _id: 'host-1' },
        startTime: new Date(Date.now() - 1000),
      },
    ]);
    (gateway as any).clients.set('host-socket', {
      roomId: 'ROOM01',
      userId: 'host-1',
      isHost: true,
      name: 'Host',
    });

    await (gateway as any).processScheduledRooms();

    expect(roomsService.startScheduledRoom).toHaveBeenCalledWith(
      'ROOM01',
      'schedule',
    );
    expect(roomEmit).toHaveBeenCalledWith('movie_started', {
      startedAt: '2026-08-02T08:00:00.000Z',
      startedBy: 'schedule',
    });
  });

  it('closes a scheduled room after its host is absent for 30 minutes', async () => {
    const { gateway, roomsService, roomEmit } = createGateway();
    roomsService.getDueScheduledRooms.mockResolvedValueOnce([
      {
        roomId: 'ROOM01',
        host: { _id: 'host-1' },
        startTime: new Date(Date.now() - 31 * 60 * 1000),
      },
    ]);
    roomsService.expireScheduledRoom.mockResolvedValueOnce({
      roomId: 'ROOM01',
      status: 'closed',
    });

    await (gateway as any).processScheduledRooms();

    expect(roomsService.startScheduledRoom).not.toHaveBeenCalled();
    expect(roomsService.expireScheduledRoom).toHaveBeenCalledWith('ROOM01');
    expect(roomEmit).toHaveBeenCalledWith('room_closed', {
      reason: 'host_absent',
    });
  });

  describe('Session validation in RoomsGateway', () => {
    it('authenticates user when JWT is valid and tokenVersion matches active session', async () => {
      const { gateway, authService, jwtService } = createGateway();
      jwtService.verifyAsync.mockResolvedValueOnce({ sub: 'user-123', tokenVersion: 2 });
      authService.getValidSessionUser.mockResolvedValueOnce({
        _id: 'user-123',
        tokenVersion: 2,
        isActive: true,
      });

      const client = {
        id: 'socket-auth',
        handshake: { auth: { token: 'Bearer valid.jwt.token' } },
        join: jest.fn(),
        emit: jest.fn(),
      } as any;

      const result = await gateway.handleJoinRoom(client, {
        roomId: 'ROOM01',
        userId: 'user-123',
        name: 'Valid Member',
        isHost: false,
      });

      expect(result).toEqual({ ok: true });
      expect((gateway as any).clients.get(client.id)).toEqual(
        expect.objectContaining({
          userId: 'user-123',
          name: 'Valid Member',
        }),
      );
    });

    it('falls back to guest when JWT has an outdated/revoked tokenVersion', async () => {
      const { gateway, authService, jwtService } = createGateway();
      jwtService.verifyAsync.mockResolvedValueOnce({ sub: 'user-123', tokenVersion: 1 });
      authService.getValidSessionUser.mockResolvedValueOnce(null); // tokenVersion mismatch

      const client = {
        id: 'socket-revoked',
        handshake: { auth: { token: 'Bearer revoked.jwt.token' } },
        join: jest.fn(),
        emit: jest.fn(),
      } as any;

      const result = await gateway.handleJoinRoom(client, {
        roomId: 'ROOM01',
        userId: 'guest-123',
        name: 'Guest Tester',
        isHost: false,
      });

      expect(result).toEqual({ ok: true });
      expect((gateway as any).clients.get(client.id)).toEqual(
        expect.objectContaining({
          userId: 'guest-123',
          name: 'Guest Tester',
          isHost: false,
        }),
      );
    });

    it('falls back to guest when user account is inactive or deleted', async () => {
      const { gateway, authService, jwtService } = createGateway();
      jwtService.verifyAsync.mockResolvedValueOnce({ sub: 'banned-user', tokenVersion: 0 });
      authService.getValidSessionUser.mockResolvedValueOnce(null); // inactive user

      const client = {
        id: 'socket-inactive',
        handshake: { auth: { token: 'Bearer inactive.jwt.token' } },
        join: jest.fn(),
        emit: jest.fn(),
      } as any;

      const result = await gateway.handleJoinRoom(client, {
        roomId: 'ROOM01',
        userId: '',
        name: 'Banned User',
        isHost: false,
      });

      expect(result).toEqual({ ok: true });
      expect((gateway as any).clients.get(client.id)).toEqual(
        expect.objectContaining({
          userId: 'guest-socket-inactive',
          name: 'Banned User',
          isHost: false,
        }),
      );
    });

    it('preserves guest flow for users without tokens', async () => {
      const { gateway } = createGateway();
      const client = {
        id: 'socket-guest-only',
        handshake: { auth: {} },
        join: jest.fn(),
        emit: jest.fn(),
      } as any;

      const result = await gateway.handleJoinRoom(client, {
        roomId: 'ROOM01',
        userId: 'guest-999',
        name: 'Pure Guest',
        isHost: false,
      });

      expect(result).toEqual({ ok: true });
      expect((gateway as any).clients.get(client.id)).toEqual(
        expect.objectContaining({
          userId: 'guest-999',
          name: 'Pure Guest',
          isHost: false,
        }),
      );
    });
  });
});
