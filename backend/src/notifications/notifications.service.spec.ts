import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { NotificationsService } from './notifications.service';

describe('NotificationsService user isolation', () => {
  const userId = new Types.ObjectId().toString();
  const notificationId = new Types.ObjectId().toString();

  function createService(userNotificationModel: Record<string, jest.Mock>) {
    const gateway = { emitToUser: jest.fn() };
    const service = new NotificationsService(
      {} as any,
      userNotificationModel as any,
      {} as any,
      gateway as any,
    );
    return { service, gateway };
  }

  it('scopes mark-as-read to the authenticated user and emits the exact unread count', async () => {
    const updated = { _id: notificationId, userId, isRead: true };
    const userNotificationModel = {
      findOneAndUpdate: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(updated),
      }),
      countDocuments: jest.fn().mockResolvedValue(2),
    };
    const { service, gateway } = createService(userNotificationModel);

    const result = await service.markUserNotifAsRead(userId, notificationId);

    expect(userNotificationModel.findOneAndUpdate).toHaveBeenCalledWith(
      {
        _id: expect.any(Types.ObjectId),
        userId: expect.any(Types.ObjectId),
      },
      { $set: { isRead: true } },
      { returnDocument: 'after' },
    );
    expect(result).toEqual({ notification: updated, unreadCount: 2 });
    expect(gateway.emitToUser).toHaveBeenCalledWith(
      userId,
      'notifications:changed',
      expect.objectContaining({ action: 'read', unreadCount: 2 }),
    );
  });

  it('does not delete a notification that is not owned by the authenticated user', async () => {
    const userNotificationModel = {
      findOneAndDelete: jest.fn().mockResolvedValue(null),
    };
    const { service, gateway } = createService(userNotificationModel);

    await expect(
      service.deleteUserNotification(userId, notificationId),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(gateway.emitToUser).not.toHaveBeenCalled();
  });

  it('returns the existing record without emitting realtime twice on a duplicate key', async () => {
    const duplicateError = Object.assign(new Error('duplicate'), { code: 11000 });
    const existing = { _id: notificationId, title: 'Thông báo cũ' };
    const userNotificationModel = {
      create: jest.fn().mockRejectedValue(duplicateError),
      findOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(existing),
      }),
    };
    const { service, gateway } = createService(userNotificationModel);

    await expect(
      service.createUserNotification({
        userId,
        type: 'reply',
        title: 'Phản hồi bình luận mới',
        link: '/movie/test#movie-comments',
        dedupKey: 'reply:test',
      }),
    ).resolves.toBe(existing);
    expect(gateway.emitToUser).not.toHaveBeenCalled();
  });
});
