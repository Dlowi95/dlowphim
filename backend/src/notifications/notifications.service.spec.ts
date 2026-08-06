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

  it('scopes admin read state to the authenticated admin', async () => {
    const adminId = new Types.ObjectId().toString();
    const findQuery = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([
        { _id: notificationId, title: 'Báo lỗi', readBy: [new Types.ObjectId(adminId)] },
      ]),
    };
    const notificationModel = {
      find: jest.fn().mockReturnValue(findQuery),
      countDocuments: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(1) }),
    };
    const service = new NotificationsService(
      notificationModel as any,
      {} as any,
      {} as any,
      { emitToUser: jest.fn() } as any,
    );

    const result = await service.getNotifications(adminId, 1, 10, { read: 'read' });

    expect(notificationModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        archivedBy: { $ne: expect.any(Types.ObjectId) },
        readBy: expect.any(Types.ObjectId),
      }),
    );
    expect(result.items[0].isRead).toBe(true);
  });

  it('queues a bounded broadcast campaign instead of creating one promise per user', async () => {
    const adminId = new Types.ObjectId().toString();
    const campaignId = new Types.ObjectId();
    const campaign = {
      _id: campaignId,
      title: 'Bảo trì hệ thống',
      content: 'DlowPhim sẽ bảo trì trong ít phút.',
      status: 'queued',
    };
    const campaignModel = {
      countDocuments: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue(campaign),
      findOneAndUpdate: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
      }),
    };
    const userModel = { countDocuments: jest.fn().mockResolvedValue(42) };
    const userNotificationModel = { insertMany: jest.fn() };
    const service = new NotificationsService(
      {} as any,
      userNotificationModel as any,
      userModel as any,
      { emitToUser: jest.fn(), emitToAllUsers: jest.fn() } as any,
      campaignModel as any,
    );

    const result = await service.createBroadcast(adminId, {
      title: 'Bảo trì hệ thống',
      content: 'DlowPhim sẽ bảo trì trong ít phút.',
      link: '/user/notifications',
      expiresInDays: 7,
    });

    expect(result.message).toContain('42 người dùng');
    expect(campaignModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ recipientCount: 42, status: 'queued' }),
    );
    expect(userNotificationModel.insertMany).not.toHaveBeenCalled();
  });
});
