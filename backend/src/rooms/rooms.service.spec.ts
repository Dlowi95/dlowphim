import { BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { RoomsService } from './rooms.service';

describe('RoomsService scheduling', () => {
  const baseRoomDto = {
    movieSlug: 'movie-slug',
    movieName: 'Movie',
    moviePoster: 'poster.jpg',
    roomName: 'Room',
    posterOption: 'poster.jpg',
    isAutoStart: true,
    isPrivate: false,
  };

  it('rejects scheduled rooms without a timezone-aware start time', async () => {
    const service = new RoomsService({} as any, {} as any, {} as any, {} as any, {} as any);

    await expect(
      service.createRoom('host-1', {
        ...baseRoomDto,
        startTime: '2026-08-03T15:00',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects scheduled rooms in the past', async () => {
    const service = new RoomsService({} as any, {} as any, {} as any, {} as any, {} as any);

    await expect(
      service.createRoom('host-1', {
        ...baseRoomDto,
        startTime: new Date(Date.now() - 60_000).toISOString(),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rate-limits repeated host reminders for the same room', async () => {
    const room = {
      roomId: 'ROOM01',
      movieName: 'Movie',
      host: { _id: 'host-1' },
    };
    const roomModel = {
      findOne: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(room),
        }),
      }),
    };
    const notificationsService = {
      createUserNotification: jest.fn().mockResolvedValue({}),
    };
    const service = new RoomsService(
      roomModel as any,
      {} as any,
      notificationsService as any,
      {} as any,
      {} as any,
    );

    await expect(service.notifyHost('ROOM01', 'Guest')).resolves.toEqual({
      success: true,
    });
    await expect(service.notifyHost('ROOM01', 'Guest')).rejects.toMatchObject({
      status: 429,
    });
    expect(notificationsService.createUserNotification).toHaveBeenCalledTimes(1);
  });

  it('issues a room-scoped access token for a correct private PIN', async () => {
    const privatePinHash = await bcrypt.hash('5829', 4);
    const roomModel = {
      findOne: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            roomId: 'ROOM01',
            isPrivate: true,
            privatePinHash,
            privateAccessVersion: 'version-1',
          }),
        }),
      }),
    };
    const accessAttemptModel = {
      findOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
    };
    const jwtService = { sign: jest.fn().mockReturnValue('room-token') };
    const service = new RoomsService(
      roomModel as any,
      {} as any,
      {} as any,
      jwtService as any,
      accessAttemptModel as any,
    );

    await expect(
      service.verifyPrivatePin('ROOM01', '5829', 'visitor-key'),
    ).resolves.toEqual({ accessToken: 'room-token' });
    expect(jwtService.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        purpose: 'private-room',
        roomId: 'ROOM01',
        version: 'version-1',
      }),
      { expiresIn: '12h' },
    );
  });

  it('locks a visitor for 15 minutes after three incorrect PIN attempts', async () => {
    const privatePinHash = await bcrypt.hash('5829', 4);
    let savedAttempt: any = null;
    const roomModel = {
      findOne: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            roomId: 'ROOM01',
            isPrivate: true,
            privatePinHash,
            privateAccessVersion: 'version-1',
          }),
        }),
      }),
    };
    const accessAttemptModel = {
      findOne: jest.fn().mockImplementation(() => ({
        exec: jest.fn().mockResolvedValue(savedAttempt),
      })),
      findOneAndUpdate: jest.fn().mockImplementation((_filter, update) => ({
        exec: jest.fn().mockImplementation(() => {
          savedAttempt = { ...update.$set };
          return Promise.resolve(savedAttempt);
        }),
      })),
    };
    const service = new RoomsService(
      roomModel as any,
      {} as any,
      {} as any,
      { sign: jest.fn() } as any,
      accessAttemptModel as any,
    );

    await expect(service.verifyPrivatePin('ROOM01', '9999', 'visitor-key')).rejects.toMatchObject({ status: 403 });
    await expect(service.verifyPrivatePin('ROOM01', '9999', 'visitor-key')).rejects.toMatchObject({ status: 403 });
    await expect(service.verifyPrivatePin('ROOM01', '9999', 'visitor-key')).rejects.toMatchObject({ status: 429 });
    await expect(service.verifyPrivatePin('ROOM01', '5829', 'visitor-key')).rejects.toMatchObject({ status: 429 });
  });

  it('reports an existing lock before the PIN form is shown again', async () => {
    const lockedUntil = new Date(Date.now() + 10 * 60 * 1000);
    const accessAttemptModel = {
      find: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([{ lockedUntil }]),
        }),
      }),
    };
    const service = new RoomsService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      accessAttemptModel as any,
    );

    await expect(
      service.getPrivateAccessStatus('ROOM01', ['visitor-key']),
    ).resolves.toEqual({
      locked: true,
      lockedUntil: lockedUntil.toISOString(),
    });
  });
});
