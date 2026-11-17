import type { PermissionKey, Role, SchoolSettings, UserAccount } from '@/types';
import { apiMutate, apiRequest, clone, delay, logActivity, remoteFirst } from '@/services/api';
import { getDb, saveDb } from '@/services/db';
import { todayIso, uid } from '@/utils/format';
import { hashPassword } from '@/utils/password';

export type UserInput = Omit<UserAccount, 'id' | 'createdAt' | 'establishmentId'>;

const localSettingsService = {
  async get(): Promise<SchoolSettings> {
    await delay(80);
    return clone(getDb().settings);
  },

  async getPublic(): Promise<SchoolSettings> {
    await delay(40);
    return clone(getDb().settings);
  },

  async update(input: Partial<SchoolSettings>): Promise<SchoolSettings> {
    await delay(200);
    const db = getDb();
    db.settings = { ...db.settings, ...input };
    saveDb(db);
    return clone(db.settings);
  },

  async updatePermissions(role: Role, permissions: PermissionKey[]): Promise<void> {
    await delay(180);
    const db = getDb();
    db.settings.rolePermissions = { ...db.settings.rolePermissions, [role]: permissions };
    saveDb(db);
  },

  async listUsers(): Promise<UserAccount[]> {
    await delay(90);
    return clone(getDb().users);
  },

  async createUser(input: UserInput): Promise<void> {
    await delay(220);
    const db = getDb();
    if (db.users.some((user) => user.username.toLowerCase() === input.username.toLowerCase())) {
      throw new Error('Ce nom d’utilisateur est déjà utilisé.');
    }
    if (!input.password || input.password.length < 8) {
      throw new Error('Le mot de passe doit contenir au moins 8 caractères.');
    }
    db.users.push({
      ...input,
      password: await hashPassword(input.password),
      id: uid('usr'),
      createdAt: todayIso(),
      establishmentId: db.establishments[0]?.id ?? null,
    });
    logActivity(db, {
      type: 'system',
      title: 'Utilisateur créé',
      description: `${input.name} — rôle ${input.role}`,
      actor: 'Administrateur',
    });
    saveDb(db);
  },

  async updateUser(id: string, input: Partial<UserInput>): Promise<void> {
    await delay(180);
    const db = getDb();
    const password = input.password ? await hashPassword(input.password) : undefined;
    db.users = db.users.map((user) =>
      user.id === id ? { ...user, ...input, ...(password ? { password } : {}) } : user,
    );
    saveDb(db);
  },

  async removeUser(id: string): Promise<void> {
    await delay(160);
    const db = getDb();
    const user = db.users.find((item) => item.id === id);
    if (!user) throw new Error('Utilisateur introuvable.');
    if (user.role === 'admin' && db.users.filter((item) => item.role === 'admin').length <= 1) {
      throw new Error('Impossible de supprimer le dernier administrateur.');
    }
    db.users = db.users.filter((item) => item.id !== id);
    saveDb(db);
  },
};

const remoteSettingsService: typeof localSettingsService = {
  get: () => apiRequest<SchoolSettings>('/settings'),

  getPublic: () => apiRequest<SchoolSettings>('/settings/public'),

  update: (input) =>
    apiMutate<SchoolSettings>('/settings', { method: 'PUT', body: JSON.stringify(input) }),

  updatePermissions: async (role, permissions) => {
    await apiMutate(`/settings/permissions/${encodeURIComponent(role)}`, {
      method: 'PUT',
      body: JSON.stringify({ permissions }),
    });
  },

  listUsers: async () => {
    const users = await apiRequest<Array<Omit<UserAccount, 'password'>>>('/users');
    return users.map((user) => ({ ...user, password: '' }));
  },

  createUser: async (input) => {
    await apiMutate('/users', { method: 'POST', body: JSON.stringify(input) });
  },

  updateUser: async (id, input) => {
    await apiMutate(`/users/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  removeUser: async (id) => {
    await apiMutate<void>(`/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
};

export const settingsService = remoteFirst(remoteSettingsService, localSettingsService);
