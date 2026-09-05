import { AuthService } from './auth.service';

function createService(userModel: any, configuredEmail = '', revokedAdminEmails = '') {
  return new AuthService(
    userModel,
    { deleteMany: jest.fn() } as any,
    { sign: jest.fn() } as any,
    {
      get: jest.fn((key: string) => {
        if (key === 'SUPER_ADMIN_EMAIL') return configuredEmail;
        if (key === 'REVOKED_ADMIN_EMAILS') return revokedAdminEmails;
        return 'google-client';
      }),
    } as any,
  );
}

describe('Super Admin bootstrap', () => {
  it('transfers ownership to the configured email and revokes the former owner session', async () => {
    const current = {
      email: 'test@gmail.com',
      role: 'super_admin',
      tokenVersion: 4,
      save: jest.fn().mockResolvedValue(undefined),
    };
    const configured = {
      email: 'dailoivo23@gmail.com',
      role: 'content_admin',
      isActive: true,
      tokenVersion: 2,
      save: jest.fn().mockResolvedValue(undefined),
    };
    const findOne = jest.fn()
      .mockReturnValueOnce({ sort: jest.fn().mockResolvedValue(current) })
      .mockResolvedValueOnce(configured);
    const userModel = { findOne, updateMany: jest.fn().mockResolvedValue({ modifiedCount: 0 }) };

    await createService(userModel, ' DAILOIVO23@gmail.com ').onModuleInit();

    expect(current.role).toBe('member');
    expect(current.tokenVersion).toBe(5);
    expect(configured.role).toBe('super_admin');
    expect(configured.tokenVersion).toBe(3);
    expect(current.save).toHaveBeenCalledTimes(1);
    expect(configured.save).toHaveBeenCalledTimes(1);
  });

  it('keeps the current owner when configured transfer email does not exist', async () => {
    const current = { email: 'owner@example.com', role: 'super_admin', tokenVersion: 3, save: jest.fn() };
    const findOne = jest.fn()
      .mockReturnValueOnce({ sort: jest.fn().mockResolvedValue(current) })
      .mockResolvedValueOnce(null);
    const userModel = { findOne, updateMany: jest.fn().mockResolvedValue({ modifiedCount: 0 }) };

    await createService(userModel, 'typo@example.com').onModuleInit();

    expect(current.role).toBe('super_admin');
    expect(current.save).not.toHaveBeenCalled();
    expect(userModel.updateMany).toHaveBeenCalled();
  });

  it('does not promote a legacy admin when no owner is configured', async () => {
    const findOne = jest.fn().mockReturnValueOnce({ sort: jest.fn().mockResolvedValue(null) });
    const userModel = { findOne, updateMany: jest.fn().mockResolvedValue({ modifiedCount: 0 }) };

    await createService(userModel).onModuleInit();

    expect(findOne).toHaveBeenCalledTimes(1);
    expect(userModel.updateMany).toHaveBeenCalledWith(
      { role: 'admin' },
      { $set: { role: 'member' }, $inc: { tokenVersion: 1 } },
    );
  });

  it('restores the configured owner before issuing a new login session', async () => {
    const configured = {
      _id: 'configured-id',
      email: 'dailoivo23@gmail.com',
      role: 'content_admin',
      isActive: true,
      tokenVersion: 2,
      save: jest.fn().mockResolvedValue(undefined),
    };
    const findOne = jest.fn()
      .mockReturnValueOnce({ sort: jest.fn().mockResolvedValue(null) })
      .mockResolvedValueOnce(configured);
    const userModel = {
      findOne,
      findById: jest.fn().mockResolvedValue(configured),
      updateMany: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
    };
    const service = createService(userModel, 'dailoivo23@gmail.com');

    const result = await service.signToken(configured);

    expect(configured.role).toBe('super_admin');
    expect(result.user.role).toBe('super_admin');
    expect(userModel.findById).toHaveBeenCalledWith('configured-id');
  });

  it('revokes remaining legacy admin roles because they imply super admin access', async () => {
    const current = { email: 'owner@example.com', role: 'super_admin', tokenVersion: 1, save: jest.fn() };
    const findOne = jest.fn().mockReturnValueOnce({ sort: jest.fn().mockResolvedValue(current) });
    const updateMany = jest.fn().mockResolvedValue({ modifiedCount: 1 });

    await createService({ findOne, updateMany }, 'owner@example.com').onModuleInit();

    expect(updateMany).toHaveBeenCalledWith(
      { role: 'admin' },
      { $set: { role: 'member' }, $inc: { tokenVersion: 1 } },
    );
  });

  it('revokes explicitly retired staff accounts without hard-coding an email', async () => {
    const current = { email: 'dailoivo23@gmail.com', role: 'super_admin', tokenVersion: 1, save: jest.fn() };
    const findOne = jest.fn().mockReturnValueOnce({ sort: jest.fn().mockResolvedValue(current) });
    const updateMany = jest.fn().mockResolvedValue({ modifiedCount: 1 });

    await createService(
      { findOne, updateMany },
      'dailoivo23@gmail.com',
      ' test@gmail.com, TEST@gmail.com, dailoivo23@gmail.com ',
    ).onModuleInit();

    expect(updateMany).toHaveBeenLastCalledWith(
      {
        email: { $in: ['test@gmail.com'] },
        role: { $in: ['super_admin', 'content_admin', 'moderator', 'support', 'admin'] },
      },
      { $set: { role: 'member' }, $inc: { tokenVersion: 1 } },
    );
  });
});
