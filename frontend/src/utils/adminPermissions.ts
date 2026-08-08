export type AdminRole = "super_admin" | "content_admin" | "moderator" | "support";
export type AdminPermission =
  | "dashboard.read" | "movies.manage" | "banners.manage" | "users.read" | "users.manage"
  | "roles.manage" | "comments.moderate" | "reports.manage" | "playback.read"
  | "notifications.manage" | "settings.manage" | "audit.read" | "jobs.manage";

const ROLE_PERMISSIONS: Record<AdminRole, AdminPermission[]> = {
  super_admin: ["dashboard.read", "movies.manage", "banners.manage", "users.read", "users.manage", "roles.manage", "comments.moderate", "reports.manage", "playback.read", "notifications.manage", "settings.manage", "audit.read", "jobs.manage"],
  content_admin: ["dashboard.read", "movies.manage", "banners.manage", "playback.read", "jobs.manage"],
  moderator: ["dashboard.read", "users.read", "users.manage", "comments.moderate", "reports.manage"],
  support: ["dashboard.read", "reports.manage", "playback.read", "notifications.manage"],
};

export function normalizeAdminRole(role?: string): AdminRole | null {
  if (role === "admin") return "super_admin";
  return role && role in ROLE_PERMISSIONS ? role as AdminRole : null;
}

export function hasAdminPermission(role: string | undefined, permission: AdminPermission) {
  const normalized = normalizeAdminRole(role);
  return normalized ? ROLE_PERMISSIONS[normalized].includes(permission) : false;
}

export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: "Super Admin",
  content_admin: "Quản lý nội dung",
  moderator: "Kiểm duyệt viên",
  support: "Hỗ trợ vận hành",
};
