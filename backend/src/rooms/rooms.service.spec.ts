import { BadRequestException, HttpException } from '@nestjs/common';
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
    const service = new RoomsService({} as any, {} as any, {} as any);

    await expect(
      service.createRoom('host-1', {
        ...baseRoomDto,
        startTime: '2026-08-03T15:00',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects scheduled rooms in the past', async () => {
    const service = new RoomsService({} as any, {} as any, {} as any);

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
    );

    await expect(service.notifyHost('ROOM01', 'Guest')).resolves.toEqual({
      success: true,
    });
    await expect(service.notifyHost('ROOM01', 'Guest')).rejects.toMatchObject<
      Partial<HttpException>
    >({ status: 429 });
    expect(notificationsService.createUserNotification).toHaveBeenCalledTimes(1);
  });
});
