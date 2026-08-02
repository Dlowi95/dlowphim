import { RoomsGateway } from './rooms.gateway';

describe('RoomsGateway socket safety', () => {
  function createGateway() {
    const roomsService = {
      getRoomDetails: jest.fn().mockResolvedValue({
        roomId: 'ROOM01',
        host: { _id: 'real-host' },
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
      closeRoom: jest.fn().mockResolvedValue({
        roomId: 'ROOM01',
        status: 'closed',
      }),
    };
    const roomEmit = jest.fn();
    const gateway = new RoomsGateway(roomsService as any, {
      verify: jest.fn(() => ({ sub: 'authenticated-user' })),
    } as any);
    (gateway as any).server = {
      to: jest.fn().mockReturnValue({ emit: roomEmit }),
      sockets: { adapter: { rooms: new Map() } },
    };
    return { gateway, roomsService, roomEmit };
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

    expect(result).toBeUndefined();
    expect((gateway as any).clients.get(client.id)).toEqual(
      expect.objectContaining({
        userId: 'authenticated-user',
        isHost: false,
      }),
    );
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
    });
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
});
