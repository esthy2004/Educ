import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { PermissionKey, SessionUser } from '@/types';
import { authService } from '@/services/auth.service';

interface AuthContextValue {
  user: SessionUser | null;
  permissions: PermissionKey[];
  login: (username: string, password: string) => Promise<SessionUser>;
  logout: () => void;
  can: (permission: PermissionKey) => boolean;
  refresh: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(() => authService.getSession());
  const [permissions, setPermissions] = useState<PermissionKey[]>(() => authService.getPermissions());

  const refresh = useCallback(() => {
    const session = authService.getSession();
    setUser(session);
    setPermissions(session ? authService.getPermissions() : []);

    if (!session) return;
    void authService
      .refresh()
      .then((validSession) => {
        if (!validSession) {
          setUser(null);
          setPermissions([]);
          return;
        }
        setUser(validSession);
        setPermissions(authService.getPermissions());
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    refresh();
    const onDataChanged = () => refresh();
    const onUnauthorized = () => {
      authService.logout();
      setUser(null);
      setPermissions([]);
    };
    window.addEventListener('eduflow:data-changed', onDataChanged);
    window.addEventListener('eduflow:unauthorized', onUnauthorized);
    return () => {
      window.removeEventListener('eduflow:data-changed', onDataChanged);
      window.removeEventListener('eduflow:unauthorized', onUnauthorized);
    };
  }, [refresh]);

  const login = useCallback(async (username: string, password: string) => {
    const session = await authService.login(username, password);
    setUser(session);
    setPermissions(authService.getPermissions());
    return session;
  }, []);

  const logout = useCallback(() => {
    authService.logout();
    setUser(null);
    setPermissions([]);
  }, []);

  const can = useCallback(
    (permission: PermissionKey) => permissions.includes(permission),
    [permissions],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ user, permissions, login, logout, can, refresh }),
    [user, permissions, login, logout, can, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth doit être utilisé dans AuthProvider.');
  return context;
}
