import { Router } from 'express';
import type { PermissionKey, Role, SchoolSettings, UserAccount } from '../types';
import { ALL_PERMISSIONS } from '../config/permissions';
import { getDb, saveDb } from '../db/store';
import { createDefaultSettings } from '../db/seed';
import { currentUser, requireAuth, requirePermission } from '../middleware/auth';
import { asyncHandler, assert } from '../middleware/http';
import { logActivity } from '../services/activity';
import { todayIso, uid } from '../utils/format';
import { hashPassword } from '../utils/password';

const ROLES: Role[] = ['admin', 'director', 'secretary', 'accountant', 'teacher'];
const SETTINGS_ROLES: Role[] = ['superadmin', ...ROLES];
const PERMISSION_KEYS = new Set<string>(ALL_PERMISSIONS.map((item) => item.key));

function publicUser(user: UserAccount): Omit<UserAccount, 'password'> {
  const { password: _password, ...rest } = user;
  void _password;
  return rest;
}

export const settingsRouter = Router();

// Paramètres publics génériques : aucune identité d'établissement n'est exposée
// avant authentification sur une plateforme multi-établissements.
settingsRouter.get(
  '/public',
  asyncHandler(async (_req, res) => {
    res.json(createDefaultSettings());
  }),
);

settingsRouter.use(requireAuth);

settingsRouter.get(
  '/',
  requirePermission('settings.view'),
  asyncHandler(async (_req, res) => {
    res.json(getDb().settings);
  }),
);

settingsRouter.put(
  '/',
  requirePermission('settings.manage'),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const input = (req.body ?? {}) as Partial<SchoolSettings>;
    if (input.rolePermissions) {
      for (const role of Object.keys(input.rolePermissions) as Role[]) {
        assert(SETTINGS_ROLES.includes(role), 400, `Rôle inconnu : ${role}.`);
        validatePermissions(input.rolePermissions[role]);
        if (role === 'superadmin') {
          assert(
            Array.isArray(input.rolePermissions[role]) &&
              input.rolePermissions[role].length === 0,
            400,
            'Les permissions du super-administrateur sont gérées par la plateforme.',
          );
        }
      }
    }
    db.settings = { ...db.settings, ...input };
    await saveDb(db);
    res.json(db.settings);
  }),
);

settingsRouter.put(
  '/permissions/:role',
  requirePermission('settings.manage'),
  asyncHandler(async (req, res) => {
    const role = req.params.role as Role;
    assert(ROLES.includes(role), 400, 'Rôle inconnu.');
    const { permissions } = (req.body ?? {}) as { permissions?: PermissionKey[] };
    validatePermissions(permissions);
    const db = getDb();
    db.settings.rolePermissions = { ...db.settings.rolePermissions, [role]: permissions! };
    await saveDb(db);
    res.json({ role, permissions: db.settings.rolePermissions[role] });
  }),
);

function validatePermissions(permissions: unknown): void {
  assert(Array.isArray(permissions), 400, 'La liste des permissions est obligatoire.');
  permissions.forEach((permission) => {
    assert(
      typeof permission === 'string' && PERMISSION_KEYS.has(permission),
      400,
      `Permission inconnue : ${String(permission)}.`,
    );
  });
}

// ---------------------------------------------------------------------------
// Comptes utilisateurs
// ---------------------------------------------------------------------------

export const usersRouter = Router();
usersRouter.use(requireAuth);

usersRouter.get(
  '/',
  requirePermission('users.manage'),
  asyncHandler(async (_req, res) => {
    res.json(getDb().users.map(publicUser));
  }),
);

usersRouter.post(
  '/',
  requirePermission('users.manage'),
  asyncHandler(async (req, res) => {
    const input = (req.body ?? {}) as Partial<UserAccount>;
    assert(typeof input.name === 'string' && input.name.trim(), 400, 'Le nom est obligatoire.');
    assert(
      typeof input.username === 'string' && input.username.trim(),
      400,
      'Le nom d’utilisateur est obligatoire.',
    );
    assert(input.role !== undefined && ROLES.includes(input.role), 400, 'Le rôle est invalide.');

    const db = getDb();
    assert(
      !db.users.some(
        (user) => user.username.toLowerCase() === input.username!.trim().toLowerCase(),
      ),
      409,
      'Ce nom d’utilisateur est déjà utilisé.',
    );
    assert(
      typeof input.password === 'string' && input.password.length >= 8,
      400,
      'Le mot de passe doit contenir au moins 8 caractères.',
    );

    const user: UserAccount = {
      id: uid('usr'),
      name: input.name,
      username: input.username!.trim(),
      email: input.email ?? '',
      password: hashPassword(input.password),
      role: input.role,
      phone: input.phone ?? '',
      active: input.active ?? true,
      createdAt: todayIso(),
      staffId: input.staffId ?? null,
      establishmentId: currentUser(res).establishmentId,
    };
    db.users.push(user);
    logActivity(db, {
      type: 'system',
      title: 'Utilisateur créé',
      description: `${user.name} — rôle ${user.role}`,
      actor: currentUser(res).name,
    });
    await saveDb(db);
    res.status(201).json(publicUser(user));
  }),
);

usersRouter.put(
  '/:id',
  requirePermission('users.manage'),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const index = db.users.findIndex((user) => user.id === req.params.id);
    assert(index !== -1, 404, 'Utilisateur introuvable.');
    const input = (req.body ?? {}) as Partial<UserAccount>;
    const {
      id: _id,
      createdAt: _createdAt,
      establishmentId: _establishmentId,
      ...updates
    } = input;
    void _id;
    void _createdAt;
    void _establishmentId;

    if (updates.username) {
      assert(
        !db.users.some(
          (user) =>
            user.id !== req.params.id &&
            user.username.toLowerCase() === updates.username!.trim().toLowerCase(),
        ),
        409,
        'Ce nom d’utilisateur est déjà utilisé.',
      );
    }
    if (updates.password !== undefined) {
      assert(
        typeof updates.password === 'string' && updates.password.length >= 8,
        400,
        'Le mot de passe doit contenir au moins 8 caractères.',
      );
      updates.password = hashPassword(updates.password);
    }
    if (updates.role) {
      assert(ROLES.includes(updates.role), 400, 'Le rôle est invalide.');
    }

    db.users[index] = { ...db.users[index], ...updates, id: db.users[index].id };
    await saveDb(db);
    res.json(publicUser(db.users[index]));
  }),
);

usersRouter.delete(
  '/:id',
  requirePermission('users.manage'),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const user = db.users.find((item) => item.id === req.params.id);
    assert(user, 404, 'Utilisateur introuvable.');
    assert(
      !(user.role === 'admin' && db.users.filter((item) => item.role === 'admin').length <= 1),
      400,
      'Impossible de supprimer le dernier administrateur.',
    );
    assert(user.id !== currentUser(res).id, 400, 'Impossible de supprimer votre propre compte.');
    db.users = db.users.filter((item) => item.id !== user.id);
    await saveDb(db);
    res.status(204).end();
  }),
);
