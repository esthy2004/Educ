import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { PermissionKey, Role, SessionUser } from '../types';
import { getDb } from '../db/store';
import { requestContext } from '../context';

interface TokenPayload {
  sub: string;
  exp: number;
}

const CONFIGURED_SECRET = (process.env.AUTH_SECRET || '').trim();
if (!CONFIGURED_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_SECRET doit être défini en production.');
  }
  console.warn(
    '[EDUFLOW] AUTH_SECRET n’est pas défini. Un secret de développement instable est utilisé ; définissez AUTH_SECRET avant tout déploiement.',
  );
}
const SECRET = CONFIGURED_SECRET || crypto.randomBytes(32).toString('hex');
const TTL = Number(process.env.AUTH_TTL || 43200);

function base64UrlEncode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
}

export function createToken(userId: string): string {
  const payload: TokenPayload = {
    sub: userId,
    exp: Math.floor(Date.now() / 1000) + TTL,
  };
  const encoded = base64UrlEncode(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

function verifyToken(token: string): TokenPayload | null {
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;
  const expected = sign(encoded);
  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length) return null;
  if (!crypto.timingSafeEqual(providedBuffer, expectedBuffer)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as TokenPayload;
    if (!payload.sub || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function toSessionUser(userId: string): SessionUser | null {
  const db = getDb();
  const user = db.users.find((candidate) => candidate.id === userId);
  if (!user || !user.active) return null;

  if (user.role === 'superadmin') {
    return {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      establishmentId: null,
      establishmentName: null,
    };
  }

  if (!user.establishmentId) return null;
  const establishment = db.establishments.find((item) => item.id === user.establishmentId);
  if (!establishment || !establishment.active) return null;

  return {
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    role: user.role,
    establishmentId: establishment.id,
    establishmentName: establishment.name,
  };
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    res.status(401).json({ message: 'Authentification requise.' });
    return;
  }
  const payload = verifyToken(token);
  const user = payload ? toSessionUser(payload.sub) : null;
  if (!user) {
    res.status(401).json({ message: 'Session expirée ou invalide.' });
    return;
  }
  res.locals.user = user;
  requestContext.run(
    {
      userId: user.id,
      role: user.role,
      establishmentId: user.establishmentId,
    },
    next,
  );
}

export function requirePermission(permission: PermissionKey) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    const user = res.locals.user as SessionUser | undefined;
    if (!user) {
      res.status(401).json({ message: 'Authentification requise.' });
      return;
    }
    if (user.role === 'superadmin' || !user.establishmentId) {
      res.status(403).json({
        message:
          'Ce compte plateforme ne peut pas accéder aux données d’un établissement. Utilisez la gestion des établissements.',
      });
      return;
    }
    const permissions = getDb().settings.rolePermissions[user.role as Role] ?? [];
    if (!permissions.includes(permission)) {
      res.status(403).json({ message: "Vous n'avez pas les droits requis pour cette action." });
      return;
    }
    next();
  };
}

export function requireSuperAdmin(
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  const user = res.locals.user as SessionUser | undefined;
  if (!user) {
    res.status(401).json({ message: 'Authentification requise.' });
    return;
  }
  if (user.role !== 'superadmin') {
    res.status(403).json({ message: 'Réservé au super-administrateur.' });
    return;
  }
  next();
}

export function currentUser(res: Response): SessionUser {
  return res.locals.user as SessionUser;
}
