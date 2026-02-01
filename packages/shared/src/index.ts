import { z } from 'zod';

export const roleSchema = z.enum(['OWNER', 'ADMIN', 'MOD', 'VIEWER']);
export type Role = z.infer<typeof roleSchema>;

export const permissionSchema = z.enum([
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
]);
export type Permission = z.infer<typeof permissionSchema>;

export const featureFlagsSchema = z
  .object({
    soloMode: z.boolean().default(true),
    crewMode: z.boolean().default(true),
    experimentalWeapons: z.boolean().default(false),
    enableFriendlyFire: z.boolean().default(false)
  })
  .strict();

export const economySchema = z
  .object({
    baseEnemyHealth: z.number().min(0.5).max(5).default(1),
    baseEnemyDamage: z.number().min(0.5).max(5).default(1),
    dropRateMultiplier: z.number().min(0.1).max(5).default(1),
    upgradeCostMultiplier: z.number().min(0.5).max(3).default(1),
    xpGainMultiplier: z.number().min(0.5).max(3).default(1)
  })
  .strict();

export const adminConfigSchema = z
  .object({
    version: z.string().default('1'),
    featureFlags: featureFlagsSchema.default({}),
    economy: economySchema.default({})
  })
  .strict();
export type AdminConfig = z.infer<typeof adminConfigSchema>;

export const loginRequestSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6)
});

export const loginResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  mustChangePassword: z.boolean(),
  user: z.object({
    id: z.string(),
    username: z.string(),
    role: roleSchema
  })
});

export type LoginResponse = z.infer<typeof loginResponseSchema>;

export const auditEntrySchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  actorId: z.string().nullable(),
  actorRole: roleSchema.optional(),
  action: z.string(),
  targetType: z.string(),
  targetId: z.string().nullable(),
  before: z.record(z.any()).nullable(),
  after: z.record(z.any()).nullable(),
  ip: z.string().nullable()
});
export type AuditEntry = z.infer<typeof auditEntrySchema>;

export const playerSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  createdAt: z.string(),
  lastSeenAt: z.string().nullable(),
  bannedUntil: z.string().nullable(),
  mutedUntil: z.string().nullable(),
  flags: z.array(z.string()),
  notes: z.string().nullable()
});
export type Player = z.infer<typeof playerSchema>;

export const roomSchema = z.object({
  id: z.string(),
  status: z.enum(['open', 'closed', 'in-progress']),
  createdAt: z.string(),
  updatedAt: z.string(),
  playerCount: z.number(),
  maxPlayers: z.number(),
  mode: z.string().optional()
});
export type Room = z.infer<typeof roomSchema>;

export const matchSchema = z.object({
  id: z.string(),
  roomId: z.string().nullable(),
  status: z.enum(['active', 'ended']),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  summary: z.record(z.any()).nullable()
});
export type Match = z.infer<typeof matchSchema>;

export const logEntrySchema = z.object({
  id: z.string(),
  ts: z.string(),
  level: z.enum(['debug', 'info', 'warn', 'error']),
  message: z.string(),
  context: z.record(z.any()).optional()
});
export type LogEntry = z.infer<typeof logEntrySchema>;

export const configVersionSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  createdBy: z.string().nullable(),
  message: z.string(),
  data: adminConfigSchema,
  previousVersionId: z.string().nullable()
});
export type ConfigVersion = z.infer<typeof configVersionSchema>;

export const paginationSchema = z.object({
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(100).default(25),
  total: z.number().default(0)
});
export type Pagination = z.infer<typeof paginationSchema>;

export type Paginated<T> = {
  data: T[];
  pagination: Pagination;
};

export type HealthStatus = {
  ok: boolean;
  uptime: number;
  timestamp: string;
};

export type MetricsStatus = {
  uptime: number;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
  };
  cpu: {
    user: number;
    system: number;
  };
  rps: number;
  errorRate: number;
  db: {
    connected: boolean;
    provider: 'sqlite' | 'postgres';
  };
};

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(6),
  nextPassword: z.string().min(8)
});

export type ChangePasswordRequest = z.infer<typeof changePasswordSchema>;

export const configPublishSchema = z.object({
  message: z.string().min(3),
  data: adminConfigSchema
});

export const configRollbackSchema = z.object({
  versionId: z.string(),
  message: z.string().min(3)
});

export type ConfigPublishRequest = z.infer<typeof configPublishSchema>;
export type ConfigRollbackRequest = z.infer<typeof configRollbackSchema>;

export const adminUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  role: roleSchema,
  createdAt: z.string(),
  mustChangePassword: z.boolean()
});
export type AdminUser = z.infer<typeof adminUserSchema>;

export const adminUserCreateSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(8),
  role: roleSchema
});
export type AdminUserCreateRequest = z.infer<typeof adminUserCreateSchema>;

export const banRequestSchema = z.object({
  until: z.string().nullable(),
  reason: z.string().optional()
});
export type BanRequest = z.infer<typeof banRequestSchema>;

export const muteRequestSchema = z.object({
  until: z.string().nullable(),
  reason: z.string().optional()
});
export type MuteRequest = z.infer<typeof muteRequestSchema>;

export const notesRequestSchema = z.object({
  notes: z.string().nullable()
});
export type NotesRequest = z.infer<typeof notesRequestSchema>;

export const flagsRequestSchema = z.object({
  flags: z.array(z.string())
});
export type FlagsRequest = z.infer<typeof flagsRequestSchema>;

export const roomActionSchema = z.object({
  action: z.enum(['kick', 'close']),
  reason: z.string().optional()
});
export type RoomActionRequest = z.infer<typeof roomActionSchema>;

export const matchActionSchema = z.object({
  action: z.enum(['close']),
  reason: z.string().optional()
});
export type MatchActionRequest = z.infer<typeof matchActionSchema>;

export type SessionInfo = {
  user: AdminUser;
  permissions: Permission[];
};

export type UpdateStatus = {
  status: 'unknown' | 'running' | 'success' | 'failed' | 'blocked';
  startedAt?: string;
  finishedAt?: string;
  message?: string;
  commit?: string;
};

export type DataSource = {
  id: string;
  label: string;
};

export type DataColumn = {
  name: string;
  type: string;
  notNull: boolean;
  primaryKey: boolean;
  editable: boolean;
};

export type DataTable = {
  name: string;
  primaryKey: string | null;
  columns: DataColumn[];
  canInsert: boolean;
  canUpdate: boolean;
  canDelete: boolean;
};

export type DataRow = Record<string, any>;

export type AssetEntry = {
  path: string;
  url: string;
  size: number;
  updatedAt: string;
};

export type ListQuery = {
  q?: string;
  page?: number;
  pageSize?: number;
};

export function defaultAdminConfig(): AdminConfig {
  return adminConfigSchema.parse({});
}

export * from './apiClient';
