import { Permission, Role } from '@htown/admin-shared';

export const permissionsByRole: Record<Role, Permission[]> = {
  OWNER: [
    'logs:read',
    'players:read',
    'players:write',
    'rooms:read',
    'rooms:write',
    'matches:read',
    'matches:write',
    'config:read',
    'config:write',
    'audit:read',
    'metrics:read',
    'admin:manage'
  ],
  ADMIN: [
    'logs:read',
    'players:read',
    'players:write',
    'rooms:read',
    'rooms:write',
    'matches:read',
    'matches:write',
    'config:read',
    'config:write',
    'audit:read',
    'metrics:read'
  ],
  MOD: [
    'logs:read',
    'players:read',
    'players:write',
    'rooms:read',
    'rooms:write',
    'matches:read',
    'matches:write'
  ],
  VIEWER: ['logs:read', 'players:read', 'rooms:read', 'matches:read', 'config:read', 'audit:read', 'metrics:read']
};

export const hasPermission = (role: Role, permission: Permission) =>
  permissionsByRole[role]?.includes(permission) ?? false;
