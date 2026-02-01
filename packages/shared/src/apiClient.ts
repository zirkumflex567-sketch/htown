import type {
  LoginResponse,
  ChangePasswordRequest,
  ConfigVersion,
  ConfigPublishRequest,
  ConfigRollbackRequest,
  Paginated,
  Player,
  Room,
  Match,
  AuditEntry,
  AdminUser,
  AdminUserCreateRequest,
  BanRequest,
  MuteRequest,
  NotesRequest,
  FlagsRequest,
  RoomActionRequest,
  MatchActionRequest,
  MetricsStatus,
  HealthStatus,
  SessionInfo,
  LogEntry
} from './index';
import type { UpdateStatus } from './index';

export type ApiClientOptions = {
  baseUrl: string;
  getAccessToken: () => string | null;
  onUnauthorized?: () => void;
};

export class AdminApiClient {
  private baseUrl: string;
  private getAccessToken: () => string | null;
  private onUnauthorized?: () => void;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.getAccessToken = options.getAccessToken;
    this.onUnauthorized = options.onUnauthorized;
  }

  private async request<T>(path: string, options: RequestInit = {}) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    const token = this.getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        ...headers,
        ...(options.headers ?? {})
      }
    });

    if (response.status === 401 && this.onUnauthorized) {
      this.onUnauthorized();
    }

    const contentType = response.headers.get('content-type') ?? '';
    const isJson = contentType.includes('application/json');
    if (!response.ok) {
      const errorBody = isJson ? await response.json() : { error: response.statusText };
      throw new Error(errorBody.error ?? 'REQUEST_FAILED');
    }
    return (isJson ? await response.json() : ({} as T)) as T;
  }

  login(username: string, password: string) {
    return this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
  }

  refresh(refreshToken: string) {
    return this.request<{ accessToken: string; refreshToken: string }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken })
    });
  }

  logout(refreshToken: string) {
    return this.request<{ ok: boolean }>('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken })
    });
  }

  me() {
    return this.request<SessionInfo>('/auth/me');
  }

  changePassword(payload: ChangePasswordRequest) {
    return this.request<{ ok: boolean }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  health() {
    return this.request<HealthStatus>('/health');
  }

  metrics() {
    return this.request<MetricsStatus>('/metrics');
  }

  queryLogs(params: { from?: string; to?: string; level?: string; q?: string; limit?: number }) {
    const qs = new URLSearchParams();
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    if (params.level) qs.set('level', params.level);
    if (params.q) qs.set('q', params.q);
    if (params.limit) qs.set('limit', String(params.limit));
    return this.request<{ data: LogEntry[] }>(`/logs/query?${qs.toString()}`);
  }

  getConfigCurrent() {
    return this.request<ConfigVersion>('/config/current');
  }

  getConfigVersions() {
    return this.request<ConfigVersion[]>('/config/versions');
  }

  publishConfig(payload: ConfigPublishRequest) {
    return this.request<ConfigVersion>('/config/publish', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  rollbackConfig(payload: ConfigRollbackRequest) {
    return this.request<ConfigVersion>('/config/rollback', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  listPlayers(params: { q?: string; page?: number; pageSize?: number }) {
    const qs = new URLSearchParams();
    if (params.q) qs.set('q', params.q);
    if (params.page) qs.set('page', String(params.page));
    if (params.pageSize) qs.set('pageSize', String(params.pageSize));
    return this.request<Paginated<Player>>(`/players?${qs.toString()}`);
  }

  getPlayer(id: string) {
    return this.request<Player>(`/players/${id}`);
  }

  banPlayer(id: string, payload: BanRequest) {
    return this.request<{ ok: boolean }>(`/players/${id}/ban`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  mutePlayer(id: string, payload: MuteRequest) {
    return this.request<{ ok: boolean }>(`/players/${id}/mute`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  updatePlayerNotes(id: string, payload: NotesRequest) {
    return this.request<{ ok: boolean }>(`/players/${id}/notes`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  updatePlayerFlags(id: string, payload: FlagsRequest) {
    return this.request<{ ok: boolean }>(`/players/${id}/flags`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  listRooms(params: { q?: string; page?: number; pageSize?: number }) {
    const qs = new URLSearchParams();
    if (params.q) qs.set('q', params.q);
    if (params.page) qs.set('page', String(params.page));
    if (params.pageSize) qs.set('pageSize', String(params.pageSize));
    return this.request<Paginated<Room>>(`/rooms?${qs.toString()}`);
  }

  getRoom(id: string) {
    return this.request<Room>(`/rooms/${id}`);
  }

  actOnRoom(id: string, payload: RoomActionRequest) {
    return this.request<{ ok: boolean }>(`/rooms/${id}/action`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  listMatches(params: { q?: string; page?: number; pageSize?: number }) {
    const qs = new URLSearchParams();
    if (params.q) qs.set('q', params.q);
    if (params.page) qs.set('page', String(params.page));
    if (params.pageSize) qs.set('pageSize', String(params.pageSize));
    return this.request<Paginated<Match>>(`/matches?${qs.toString()}`);
  }

  getMatch(id: string) {
    return this.request<Match>(`/matches/${id}`);
  }

  actOnMatch(id: string, payload: MatchActionRequest) {
    return this.request<{ ok: boolean }>(`/matches/${id}/action`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  listAudit(params: { page?: number; pageSize?: number }) {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.pageSize) qs.set('pageSize', String(params.pageSize));
    return this.request<Paginated<AuditEntry>>(`/audit?${qs.toString()}`);
  }

  listAdminUsers() {
    return this.request<AdminUser[]>('/admin/users');
  }

  createAdminUser(payload: AdminUserCreateRequest) {
    return this.request<{ id: string }>('/admin/users', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  getUpdateStatus() {
    return this.request<UpdateStatus>('/admin/update');
  }

  triggerUpdate() {
    return this.request<{ ok: boolean; started: boolean }>('/admin/update', { method: 'POST' });
  }
}
