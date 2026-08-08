import { AuthService } from './auth.service';

function createService(userModel: any, configuredEmail = '') {
  return new AuthService(
    userModel,
    { deleteMany: jest.fn() } as any,
    { sign: jest.fn() } as any,
    { get: jest.fn((key: string) => key === 'SUPER_ADMIN_EMAIL' ? configuredEmail : 'google-client') } as any,
  );
}

describe('Super Admin bootstrap', () => {
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

  it('promotes the first legacy admin when no owner is configured', async () => {
    const legacy = { email: 'admin@example.com', role: 'admin', isActive: true, tokenVersion: 0, save: jest.fn().mockResolvedValue(undefined) };
    const findOne = jest.fn()
      .mockReturnValueOnce({ sort: jest.fn().mockResolvedValue(null) })
      .mockReturnValueOnce({ sort: jest.fn().mockResolvedValue(legacy) });
    const userModel = { findOne, updateMany: jest.fn().mockResolvedValue({ modifiedCount: 0 }) };

    await createService(userModel).onModuleInit();

    expect(legacy.role).toBe('super_admin');
    expect(legacy.tokenVersion).toBe(1);
    expect(legacy.save).toHaveBeenCalled();
  });
});
