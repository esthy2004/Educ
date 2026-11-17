import { Router } from 'express';
import { createToken, currentUser, requireAuth, toSessionUser } from '../middleware/auth';
import { asyncHandler, assert } from '../middleware/http';
import { getDb, getPlatformDb, savePlatformDb } from '../db/store';
import {
  hashPassword,
  isLegacyPasswordHash,
  isPasswordHash,
  verifyPassword,
} from '../utils/password';

export const authRouter = Router();

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const attempts = new Map<string, { count: number; resetAt: number }>();

function rateLimitKey(req: { ip?: string }, username: string): string {
  return `${req.ip ?? 'unknown'}:${username.trim().toLowerCase()}`;
}

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt <= now) {
    attempts.delete(key);
    return true;
  }
  return entry.count < MAX_ATTEMPTS;
}

function registerFailure(key: string): void {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  entry.count += 1;
}

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { username, password } = (req.body ?? {}) as { username?: unknown; password?: unknown };
    assert(
      typeof username === 'string' && username.trim(),
      400,
      'Le nom d’utilisateur est obligatoire.',
    );
    assert(typeof password === 'string' && password, 400, 'Le mot de passe est obligatoire.');

    const key = rateLimitKey(req, username);
    assert(
      checkRateLimit(key),
      429,
      'Trop de tentatives de connexion. Réessayez dans quelques minutes.',
    );

    const db = getPlatformDb();
    const user = db.users.find(
      (candidate) =>
        candidate.username.toLowerCase() === username.trim().toLowerCase() && candidate.active,
    );
    const valid = Boolean(user && verifyPassword(password, user.password));
    if (!valid || !user) {
      registerFailure(key);
      assert(false, 401, 'Identifiant ou mot de passe incorrect. Vérifiez vos accès.');
    }

    attempts.delete(key);

    if (!isPasswordHash(user.password) || isLegacyPasswordHash(user.password)) {
      user.password = hashPassword(password);
      await savePlatformDb(db);
    }

    const session = toSessionUser(user.id);
    assert(session, 401, 'Compte utilisateur indisponible.');

    const permissions =
      user.role === 'superadmin'
        ? []
        : db.establishments.find((item) => item.id === user.establishmentId)?.settings
            .rolePermissions[user.role] ?? [];

    res.json({
      token: createToken(user.id),
      user: session,
      permissions,
    });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const user = currentUser(res);
    res.json({
      user,
      permissions:
        user.role === 'superadmin'
          ? []
          : getDb().settings.rolePermissions[user.role] ?? [],
    });
  }),
);

authRouter.put(
  '/password',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = (req.body ?? {}) as {
      currentPassword?: unknown;
      newPassword?: unknown;
    };
    assert(
      typeof currentPassword === 'string' && currentPassword,
      400,
      'Le mot de passe actuel est obligatoire.',
    );
    assert(
      typeof newPassword === 'string' && newPassword.length >= 8,
      400,
      'Le nouveau mot de passe doit contenir au moins 8 caractères.',
    );

    const db = getPlatformDb();
    const user = db.users.find((candidate) => candidate.id === currentUser(res).id);
    assert(user, 404, 'Compte utilisateur introuvable.');
    assert(
      verifyPassword(currentPassword, user.password),
      400,
      'Le mot de passe actuel est incorrect.',
    );
    user.password = hashPassword(newPassword);
    await savePlatformDb(db);
    res.json({ success: true });
  }),
);

authRouter.post(
  '/logout',
  requireAuth,
  asyncHandler(async (_req, res) => {
    res.json({ success: true });
  }),
);
