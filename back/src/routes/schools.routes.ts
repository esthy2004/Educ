import { Router } from 'express';
import type { Establishment, UserAccount } from '../types';
import { ALL_PERMISSIONS, ROLE_LABELS } from '../config/permissions';
import { createDefaultSettings } from '../db/seed';
import {
  establishmentStats,
  getPlatformDb,
  savePlatformDb,
} from '../db/store';
import { requireAuth, requireSuperAdmin } from '../middleware/auth';
import { asyncHandler, assert } from '../middleware/http';
import { todayIso, uid } from '../utils/format';
import { hashPassword } from '../utils/password';

export const schoolsRouter = Router();

schoolsRouter.use(requireAuth, requireSuperAdmin);

function publicUser(user: UserAccount): Omit<UserAccount, 'password'> {
  const { password: _password, ...rest } = user;
  void _password;
  return rest;
}

function serializeEstablishment(establishment: Establishment) {
  const db = getPlatformDb();
  return {
    ...establishment,
    stats: establishmentStats(establishment.id),
    admins: db.users
      .filter(
        (user) =>
          user.establishmentId === establishment.id &&
          (user.role === 'admin' || user.role === 'director'),
      )
      .map(publicUser),
  };
}

function assertUsernameAvailable(username: string): void {
  const db = getPlatformDb();
  assert(
    !db.users.some((user) => user.username.toLowerCase() === username.trim().toLowerCase()),
    409,
    'Ce nom d’utilisateur est déjà utilisé.',
  );
}

function createAdminAccount(input: {
  name?: unknown;
  username?: unknown;
  email?: unknown;
  password?: unknown;
  phone?: unknown;
}, establishmentId: string): UserAccount {
  assert(
    typeof input.name === 'string' && input.name.trim(),
    400,
    'Le nom de l’administrateur est obligatoire.',
  );
  assert(
    typeof input.username === 'string' && input.username.trim(),
    400,
    'L’identifiant de l’administrateur est obligatoire.',
  );
  assert(
    typeof input.password === 'string' && input.password.length >= 8,
    400,
    'Le mot de passe doit contenir au moins 8 caractères.',
  );
  assertUsernameAvailable(input.username);
  return {
    id: uid('usr'),
    name: input.name.trim(),
    username: input.username.trim(),
    email: typeof input.email === 'string' ? input.email.trim() : '',
    password: hashPassword(input.password),
    role: 'admin',
    phone: typeof input.phone === 'string' ? input.phone.trim() : '',
    active: true,
    createdAt: todayIso(),
    staffId: null,
    establishmentId,
  };
}

schoolsRouter.get(
  '/roles',
  asyncHandler(async (_req, res) => {
    res.json({
      roles: ROLE_LABELS,
      permissions: ALL_PERMISSIONS,
    });
  }),
);

schoolsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const db = getPlatformDb();
    res.json(db.establishments.map(serializeEstablishment));
  }),
);

schoolsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const db = getPlatformDb();
    const establishment = db.establishments.find((item) => item.id === req.params.id);
    assert(establishment, 404, 'Établissement introuvable.');
    res.json(serializeEstablishment(establishment));
  }),
);

schoolsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = (req.body ?? {}) as {
      name?: unknown;
      code?: unknown;
      type?: unknown;
      address?: unknown;
      city?: unknown;
      country?: unknown;
      phone?: unknown;
      email?: unknown;
      director?: unknown;
      admin?: {
        name?: unknown;
        username?: unknown;
        email?: unknown;
        password?: unknown;
        phone?: unknown;
      };
    };
    assert(
      typeof input.name === 'string' && input.name.trim(),
      400,
      'Le nom de l’établissement est obligatoire.',
    );
    assert(
      typeof input.code === 'string' && input.code.trim(),
      400,
      'Le code de l’établissement est obligatoire.',
    );
    assert(
      input.admin && typeof input.admin === 'object',
      400,
      'Le compte administrateur de l’établissement est obligatoire.',
    );

    const name = input.name as string;
    const code = (input.code as string).trim().toUpperCase();
    const adminInput = input.admin as NonNullable<typeof input.admin>;
    const db = getPlatformDb();
    assert(
      !db.establishments.some(
        (item) =>
          item.code.toLowerCase() === code.toLowerCase() ||
          item.name.toLowerCase() === name.trim().toLowerCase(),
      ),
      409,
      'Un établissement porte déjà ce nom ou ce code.',
    );

    const settings = createDefaultSettings();
    settings.name = name.trim();
    settings.shortName = code;
    settings.type = typeof input.type === 'string' ? input.type.trim() : '';
    settings.address = typeof input.address === 'string' ? input.address.trim() : '';
    settings.city = typeof input.city === 'string' ? input.city.trim() : '';
    settings.country = typeof input.country === 'string' ? input.country.trim() : '';
    settings.phone = typeof input.phone === 'string' ? input.phone.trim() : '';
    settings.email = typeof input.email === 'string' ? input.email.trim() : '';
    settings.director = typeof input.director === 'string' ? input.director.trim() : '';

    const establishment: Establishment = {
      id: uid('etb'),
      name: name.trim(),
      code,
      type: settings.type,
      address: settings.address,
      city: settings.city,
      country: settings.country,
      phone: settings.phone,
      email: settings.email,
      director: settings.director,
      active: true,
      createdAt: todayIso(),
      settings,
    };
    const admin = createAdminAccount(adminInput, establishment.id);
    db.establishments.push(establishment);
    db.users.push(admin);
    await savePlatformDb(db);
    res.status(201).json({
      establishment: serializeEstablishment(establishment),
      admin: publicUser(admin),
    });
  }),
);

schoolsRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const db = getPlatformDb();
    const establishment = db.establishments.find((item) => item.id === req.params.id);
    assert(establishment, 404, 'Établissement introuvable.');
    const input = (req.body ?? {}) as Partial<Establishment>;

    if (typeof input.code === 'string' && input.code.trim()) {
      const code = input.code.trim().toUpperCase();
      assert(
        !db.establishments.some(
          (item) => item.id !== establishment.id && item.code.toLowerCase() === code.toLowerCase(),
        ),
        409,
        'Ce code est déjà utilisé par un autre établissement.',
      );
      establishment.code = code;
    }
    const fields: Array<keyof Pick<Establishment, 'name' | 'type' | 'address' | 'city' | 'country' | 'phone' | 'email' | 'director'>> = [
      'name',
      'type',
      'address',
      'city',
      'country',
      'phone',
      'email',
      'director',
    ];
    for (const field of fields) {
      const value = input[field];
      if (typeof value === 'string') establishment[field] = value.trim();
    }
    if (typeof input.active === 'boolean') establishment.active = input.active;
    establishment.settings = {
      ...establishment.settings,
      name: establishment.name,
      shortName: establishment.code,
      type: establishment.type,
      address: establishment.address,
      city: establishment.city,
      country: establishment.country,
      phone: establishment.phone,
      email: establishment.email,
      director: establishment.director,
    };
    await savePlatformDb(db);
    res.json(serializeEstablishment(establishment));
  }),
);

schoolsRouter.post(
  '/:id/admins',
  asyncHandler(async (req, res) => {
    const db = getPlatformDb();
    const establishment = db.establishments.find((item) => item.id === req.params.id);
    assert(establishment, 404, 'Établissement introuvable.');
    const admin = createAdminAccount(req.body ?? {}, establishment.id);
    db.users.push(admin);
    await savePlatformDb(db);
    res.status(201).json(publicUser(admin));
  }),
);
