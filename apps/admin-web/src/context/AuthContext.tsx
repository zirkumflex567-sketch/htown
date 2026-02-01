import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AdminApiClient, LoginResponse, SessionInfo } from '@htown/admin-shared';

const ACCESS_TOKEN_KEY = 'admin_access_token';
const REFRESH_TOKEN_KEY = 'admin_refresh_token';

const baseUrl = import.meta.env.VITE_ADMIN_API_URL ?? 'http://localhost:8080';

type AuthContextValue = {
  api: AdminApiClient;
  user: SessionInfo['user'] | null;
  permissions: SessionInfo['permissions'];
  loading: boolean;
  mustChangePassword: boolean;
  login: (username: string, password: string) => Promise<LoginResponse>;
  logout: () => void;
  refreshSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const getStored = (key: string) => localStorage.getItem(key);
const setStored = (key: string, value: string) => localStorage.setItem(key, value);
const clearStored = (key: string) => localStorage.removeItem(key);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionInfo['user'] | null>(null);
  const [permissions, setPermissions] = useState<SessionInfo['permissions']>([]);
  const [loading, setLoading] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);

  const logout = useCallback(() => {
    clearStored(ACCESS_TOKEN_KEY);
    clearStored(REFRESH_TOKEN_KEY);
    setUser(null);
    setPermissions([]);
    setMustChangePassword(false);
  }, []);

  const api = useMemo(() => {
    return new AdminApiClient({
      baseUrl,
      getAccessToken: () => getStored(ACCESS_TOKEN_KEY),
      onUnauthorized: logout
    });
  }, [logout]);

  const refreshSession = useCallback(async () => {
    const refreshToken = getStored(REFRESH_TOKEN_KEY);
    if (!refreshToken) return;
    try {
      const tokens = await api.refresh(refreshToken);
      setStored(ACCESS_TOKEN_KEY, tokens.accessToken);
      setStored(REFRESH_TOKEN_KEY, tokens.refreshToken);
      const me = await api.me();
      setUser(me.user);
      setPermissions(me.permissions);
      setMustChangePassword(me.user.mustChangePassword);
    } catch {
      logout();
    }
  }, [api, logout]);

  const login = useCallback(
    async (username: string, password: string) => {
      const response = await api.login(username, password);
      setStored(ACCESS_TOKEN_KEY, response.accessToken);
      setStored(REFRESH_TOKEN_KEY, response.refreshToken);
      setUser(response.user);
      setPermissions([]);
      setMustChangePassword(response.mustChangePassword);
      try {
        const me = await api.me();
        setUser(me.user);
        setPermissions(me.permissions);
        setMustChangePassword(me.user.mustChangePassword);
      } catch {
        // ignore
      }
      return response;
    },
    [api]
  );

  useEffect(() => {
    const boot = async () => {
      const accessToken = getStored(ACCESS_TOKEN_KEY);
      if (accessToken) {
        try {
          const me = await api.me();
          setUser(me.user);
          setPermissions(me.permissions);
          setMustChangePassword(me.user.mustChangePassword);
        } catch {
          await refreshSession();
        }
      } else {
        await refreshSession();
      }
      setLoading(false);
    };
    void boot();
  }, [api, refreshSession]);

  return (
    <AuthContext.Provider
      value={{
        api,
        user,
        permissions,
        loading,
        mustChangePassword,
        login,
        logout,
        refreshSession
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('AuthContext not available');
  }
  return ctx;
}
