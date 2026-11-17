import type { ActivityLog, Database } from '@/types';
import { uid } from '@/utils/format';

export const API_URL: string = import.meta.env.VITE_API_URL || '/api';
const SERVER_TIMEOUT = Number(import.meta.env.VITE_SERVER_TIMEOUT || 2500);
const TOKEN_KEY = 'eduflow:token';

export function delay(ms = 180): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function logActivity(
  db: Database,
  activity: Omit<ActivityLog, 'id' | 'date'> & { date?: string },
): void {
  db.activities.unshift({
    ...activity,
    id: uid('act'),
    date: activity.date ?? new Date().toISOString(),
  });
  db.activities = db.activities.slice(0, 80);
}

// ---------------------------------------------------------------------------
// Session HTTP
// ---------------------------------------------------------------------------

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Stockage indisponible : la session reste en mémoire pour cette page.
  }
}

export class ApiError extends Error {
  readonly status: number;
  readonly unavailable: boolean;

  constructor(status: number, message: string, unavailable = false) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.unavailable = unavailable;
  }
}

function notifyDataChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('eduflow:data-changed'));
  }
}

function notifyUnauthorized(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('eduflow:unauthorized'));
  }
}

/**
 * Appelle l'API EDUFLOW avec le jeton de session courant.
 * Les erreurs HTTP conservent le message métier renvoyé par le serveur.
 */
export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (init?.headers) Object.assign(headers, init.headers);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers,
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(0, 'Le serveur EDUFLOW est injoignable.', true);
  }

  if (!response.ok) {
    const raw = await response.text();
    let payload: { message?: string } | null = null;
    try {
      payload = raw ? (JSON.parse(raw) as { message?: string }) : null;
    } catch {
      payload = null;
    }
    const unavailable =
      response.status >= 502 ||
      (response.status === 500 && !payload?.message);
    if (response.status === 401 && getAuthToken()) notifyUnauthorized();
    throw new ApiError(
      response.status,
      payload?.message ?? `Erreur API ${response.status} sur ${path}`,
      unavailable,
    );
  }

  if (response.status === 204) return undefined as T;
  const raw = await response.text();
  return (raw ? JSON.parse(raw) : undefined) as T;
}

/** Mutation API : prévient l'interface qu'il faut recharger ses données. */
export async function apiMutate<T>(path: string, init?: RequestInit): Promise<T> {
  const result = await apiRequest<T>(path, init);
  notifyDataChanged();
  return result;
}

/**
 * Les services métier passent exclusivement par l'API : le repli local ne
 * permettait pas d'appliquer l'isolation par établissement côté serveur.
 */
export function remoteFirst<T extends object>(remote: T, _local: T): T {
  void _local;
  return remote;
}

/** Construit une query string en ignorant les valeurs vides. */
export function queryString(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  });
  const query = search.toString();
  return query ? `?${query}` : '';
}

/**
 * Vérifie la disponibilité de l'API EDUFLOW.
 * En l'absence de backend (déploiement local/hors connexion), le frontend
 * bascule automatiquement sur les données persistées dans le navigateur.
 */
export async function pingServer(): Promise<{ online: boolean; latency: number | null }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SERVER_TIMEOUT);
  const started = performance.now();
  try {
    const response = await fetch(`${API_URL}/health`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    });
    const contentType = response.headers.get('content-type') ?? '';
    if (!response.ok || !contentType.includes('application/json')) {
      return { online: false, latency: null };
    }
    const payload = (await response.json()) as { status?: string };
    const online = payload?.status === 'ok' || payload?.status === 'up';
    return { online, latency: online ? Math.round(performance.now() - started) : null };
  } catch {
    return { online: false, latency: null };
  } finally {
    clearTimeout(timer);
  }
}
