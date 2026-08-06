import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { AuthService } from './auth.service';

function createService(overrides: Record<string, any> = {}) {
  const captured: { findQuery?: any } = {};
  const items = overrides.items || [];
  const lean = jest.fn().mockResolvedValue(items);
  const limit = jest.fn().mockReturnValue({ lean });
  const skip = jest.fn().mockReturnValue({ limit });
  const sort = jest.fn().mockReturnValue({ skip });
  const select = jest.fn().mockReturnValue({ sort });
  const userModel = {
    find: jest.fn((query) => {
      captured.findQuery = query;
      return { select };
    }),
    countDocuments: jest.fn().mockResolvedValue(3),
    findById: jest.fn(),
    findByIdAndDelete: jest.fn(),
    ...overrides.userModel,
  };
  const notificationModel = {
    create: jest.fn().mockResolvedValue({}),
    deleteMany: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({ deletedCount: 0 }) }),
  };
  const service = new AuthService(
    userModel as any,
    notificationModel as any,
    { sign: jest.fn() } as any,
    { get: jest.fn().mockReturnValue('test-google-client') } as any,
  );
  return { service, userModel, notificationModel, captured, skip, limit };
}

describe('AuthService admin users', () => {
  it('paginates in MongoDB and escapes search input', async () => {
    const { service, captured, skip, limit } = createService();

    const result = await service.getAllUsers({ search: 'demo.*', page: '2', limit: '10', activity: 'inactive' });

    expect(skip).toHaveBeenCalledWith(10);
    expect(limit).toHaveBeenCalledWith(10);
    expect(captured.findQuery.$and[0].$or[0].displayName.$regex).toBe('demo\\.\\*');
    expect(result.pagination).toEqual({ page: 2, limit: 10, totalItems: 3, totalPages: 1 });
    expect(result.policy.autoDeleteInactiveUsers).toBe(false);
  });

  it('rejects malformed user ids before mutating data', async () => {
    const { service } = createService();
    await expect(service.updateUserStatus('admin-id', 'not-an-object-id', false)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('revokes existing sessions when locking a member', async () => {
    const userId = new Types.ObjectId().toString();
    const user: any = {
      _id: userId,
      role: 'member',
      isActive: true,
      tokenVersion: 2,
      save: jest.fn().mockResolvedValue(undefined),
    };
    const { service } = createService({ userModel: { findById: jest.fn().mockResolvedValue(user) } });

    await service.updateUserStatus(new Types.ObjectId().toString(), userId, false, 'Spam');

    expect(user.isActive).toBe(false);
    expect(user.tokenVersion).toBe(3);
    expect(user.suspensionReason).toBe('Spam');
    expect(user.save).toHaveBeenCalled();
  });

  it('anonymizes a locked account instead of orphaning community data', async () => {
    const userId = new Types.ObjectId().toString();
    const user: any = {
      _id: userId,
      email: 'member@example.com',
      displayName: 'Member',
      password: 'hashed',
      googleId: 'google-id',
      avatar: '/avatar.jpg',
      favorites: ['movie'],
      watchHistory: [{}],
      playlists: [{}],
      upcomingReminders: [{}],
      role: 'member',
      isActive: false,
      tokenVersion: 1,
      save: jest.fn().mockResolvedValue(undefined),
    };
    const { service, notificationModel } = createService({
      userModel: { findById: jest.fn().mockResolvedValue(user) },
    });

    await service.deleteUser(new Types.ObjectId().toString(), userId);

    expect(user.email).toBe(`deleted-${userId}@deleted.local`);
    expect(user.isDeleted).toBe(true);
    expect(user.favorites).toEqual([]);
    expect(user.save).toHaveBeenCalled();
    expect(notificationModel.deleteMany).toHaveBeenCalled();
  });

  it('verifies a pending email with a one-time hashed token', async () => {
    const user: any = {
      _id: new Types.ObjectId(),
      emailVerificationTokenHash: 'stored-hash',
      emailVerificationExpiresAt: new Date(Date.now() + 60_000),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const select = jest.fn().mockResolvedValue(user);
    const findOne = jest.fn().mockReturnValue({ select });
    const { service, notificationModel } = createService({ userModel: { findOne } });
    const token = 'a'.repeat(64);

    const result = await service.verifyEmail(token);

    expect(findOne).toHaveBeenCalledWith(expect.objectContaining({
      emailVerificationTokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      emailVerificationExpiresAt: expect.objectContaining({ $gt: expect.any(Date) }),
    }));
    expect(user.emailVerifiedAt).toBeInstanceOf(Date);
    expect(user.emailVerificationTokenHash).toBeUndefined();
    expect(user.emailVerificationExpiresAt).toBeUndefined();
    expect(user.save).toHaveBeenCalled();
    expect(notificationModel.create).toHaveBeenCalled();
    expect(result.message).toContain('Xác minh');
  });

  it('rejects malformed email verification tokens', async () => {
    const { service } = createService();
    await expect(service.verifyEmail('short-token')).rejects.toBeInstanceOf(BadRequestException);
  });
});
