export const PERMISSIONS = [
  "create_rooms",
  "manage_rooms",
  "delete_rooms",
  "create_projects",
  "manage_projects",
  "create_tasks",
  "manage_tasks",
  "invite_members",
  "remove_members",
  "manage_roles",
  "upload_files",
  "delete_files",
  "create_meetings",
  "manage_meetings",
  "create_calendar_events",
  "manage_messages",
  "view_private_rooms",
  "manage_workspace_settings",
];

export const ROLES = ["owner", "admin", "member", "guest"];

export const hasPermission = (membership, rolePermissions, permission) => {
  if (!membership) return false;
  if (membership.role === "owner") return true;
  if (membership.custom_permissions?.includes(permission)) return true;
  return rolePermissions?.some(
    (rp) => rp.role === membership.role && rp.permission === permission
  );
};
