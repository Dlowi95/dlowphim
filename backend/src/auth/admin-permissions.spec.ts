import { hasAdminPermission, normalizeAdminRole, permissionsForRole } from './admin-permissions';

describe('admin permissions', () => {
  it('reserves all system permissions for the single super admin role', () => {
    expect(hasAdminPermission('super_admin', 'settings.manage')).toBe(true);
    expect(hasAdminPermission('super_admin', 'roles.manage')).toBe(true);
    expect(hasAdminPermission('content_admin', 'settings.manage')).toBe(false);
    expect(hasAdminPermission('moderator', 'roles.manage')).toBe(false);
  });

  it('keeps staff permissions scoped to their work', () => {
    expect(hasAdminPermission('content_admin', 'movies.manage')).toBe(true);
    expect(hasAdminPermission('content_admin', 'users.manage')).toBe(false);
    expect(hasAdminPermission('moderator', 'comments.moderate')).toBe(true);
    expect(hasAdminPermission('support', 'notifications.manage')).toBe(true);
  });

  it('supports legacy admin only during migration', () => {
    expect(normalizeAdminRole('admin')).toBe('super_admin');
    expect(permissionsForRole('member')).toEqual([]);
  });
});
