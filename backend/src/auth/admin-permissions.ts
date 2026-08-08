export const ADMIN_ROLES = ['super_admin', 'content_admin', 'moderator', 'support'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const ADMIN_PERMISSIONS = [
  'dashboard.read',
  'movies.manage',
  'banners.manage',
  'users.read',
  'users.manage',
  'roles.manage',
  'comments.moderate',
  'reports.manage',
  'playback.read',
  'notifications.manage',
  'settings.manage',
  'audit.read',
  'jobs.manage',
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<AdminRole, readonly AdminPermission[]> = {
  super_admin: ADMIN_PERMISSIONS,
  content_admin: ['dashboard.read', 'movies.manage', 'banners.manage', 'playback.read', 'jobs.manage'],
  moderator: ['dashboard.read', 'users.read', 'users.manage', 'comments.moderate', 'reports.manage'],
  support: ['dashboard.read', 'reports.manage', 'playback.read', 'notifications.manage'],
};

export function normalizeAdminRole(role?: string): AdminRole | null {
  if (role === 'admin') return 'super_admin';
  return ADMIN_ROLES.includes(role as AdminRole) ? (role as AdminRole) : null;
}

export function hasAdminPermission(role: string | undefined, permission: AdminPermission): boolean {
  const normalized = normalizeAdminRole(role);
  return normalized ? ROLE_PERMISSIONS[normalized].includes(permission) : false;
}

export function permissionsForRole(role?: string): readonly AdminPermission[] {
  const normalized = normalizeAdminRole(role);
  return normalized ? ROLE_PERMISSIONS[normalized] : [];
}
