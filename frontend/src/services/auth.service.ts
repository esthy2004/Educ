import type { PermissionKey, SessionUser } from '@/types';
import { apiRequest, getAuthToken, setAuthToken } from '@/services/api';

const SESSION_KEY = 'eduflow:session';
const PERMISSIONS_KEY = 'eduflow:permissions';

interface LoginResponse {
  token: string;
  user: SessionUser;
  permissions: PermissionKey[];
}

interface SessionResponse {
  user: SessionUser;
  permissions: PermissionKey[];
}

function persistSession(user: SessionUser, permissions: PermissionKey[]): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    localStorage.setItem(PERMISSIONS_KEY, JSON.stringify(permissions));
  } catch {
    // La session reste utilisable jusqu'au rechargement de la page.
  }
}

function clearStoredSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(PERMISSIONS_KEY);
  } catch {
    // Ignorer un stockage indisponible.
  }
}

export const authService = {
  async login(username: string, password: string): Promise<SessionUser> {
    setAuthToken(null);
    const result = await apiRequest<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: username.trim(), password }),
    });
    setAuthToken(result.token);
    persistSession(result.user, result.permissions);
    return result.user;
  },

  getSession(): SessionUser | null {
    try {
      if (!getAuthToken()) return null;
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as SessionUser;
    } catch {
      return null;
    }
  },

  getPermissions(): PermissionKey[] {
    try {
      const raw = localStorage.getItem(PERMISSIONS_KEY);
      if (!raw) return [];
      const permissions = JSON.parse(raw) as PermissionKey[];
      return Array.isArray(permissions) ? permissions : [];
    } catch {
      return [];
    }
  },

  /** Revalide la session et les permissions auprès du serveur. */
  async refresh(): Promise<SessionUser | null> {
    const cached = this.getSession();
    if (!cached) return null;

    try {
      const result = await apiRequest<SessionResponse>('/auth/me');
      persistSession(result.user, result.permissions);
      return result.user;
    } catch (error) {
      if (error instanceof Error && 'status' in error && (error.status === 401 || error.status === 403)) {
        clearStoredSession();
        setAuthToken(null);
        return null;
      }
      return cached;
    }
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await apiRequest('/auth/password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },

  logout(): void {
    const token = getAuthToken();
    if (token) {
      void apiRequest('/auth/logout', { method: 'POST' }).catch(() => undefined);
    }
    setAuthToken(null);
    clearStoredSession();
  },
};
