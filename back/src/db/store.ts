import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Pool } from 'pg';
import type {
  Database,
  Establishment,
  SchoolSettings,
  UserAccount,
} from '../types';
import { currentRequestContext } from '../context';
import { createDefaultSettings, createSuperAdmin, seedDatabase } from './seed';
import { migratePasswordHashes } from '../utils/password';

const BACKEND_ROOT = path.resolve(__dirname, '../..');
const DATA_FILE = path.resolve(BACKEND_ROOT, process.env.DB_FILE || './data/eduflow.sqlite');
const DATABASE_URL = (process.env.DATABASE_URL || '').trim();
const USE_POSTGRES = DATABASE_URL.length > 0;
const DB_VERSION = 3;

type SchoolData = Omit<Database, 'version' | 'establishments' | 'users' | 'settings'>;

interface PlatformState {
  establishments: Establishment[];
  users: UserAccount[];
  schoolData: Map<string, SchoolData>;
  settings: SchoolSettings;
}

let state: PlatformState | null = null;
let sqliteConnection: DatabaseSync | null = null;
let postgresPool: Pool | null = null;
let initialization: Promise<void> | null = null;
let writeQueue: Promise<void> = Promise.resolve();

function emptySchoolData(): SchoolData {
  return {
    academicYears: [],
    terms: [],
    levels: [],
    classes: [],
    subjects: [],
    students: [],
    staff: [],
    grades: [],
    attendance: [],
    feeStructures: [],
    invoices: [],
    payments: [],
    expenses: [],
    timetable: [],
    discipline: [],
    activities: [],
  };
}

const SCHOOL_DATA_KEYS: Array<keyof SchoolData> = [
  'academicYears',
  'terms',
  'levels',
  'classes',
  'subjects',
  'students',
  'staff',
  'grades',
  'attendance',
  'feeStructures',
  'invoices',
  'payments',
  'expenses',
  'timetable',
  'discipline',
  'activities',
];

function normalizeSchoolData(value: unknown): SchoolData {
  const data = emptySchoolData();
  if (!value || typeof value !== 'object') return data;
  const source = value as Partial<Record<keyof SchoolData, unknown>>;
  for (const key of SCHOOL_DATA_KEYS) {
    if (Array.isArray(source[key])) {
      (data[key] as unknown[]) = source[key] as unknown[];
    }
  }
  return data;
}

function seedPlatformState(): PlatformState {
  const seeded = seedDatabase();
  return {
    establishments: seeded.establishments,
    users: seeded.users,
    schoolData: new Map(),
    settings: seeded.settings,
  };
}

function extractSchoolData(db: Database): SchoolData {
  const data = emptySchoolData();
  for (const key of SCHOOL_DATA_KEYS) {
    (data[key] as unknown[]) = db[key] as unknown[];
  }
  return data;
}

function currentState(): PlatformState {
  if (!state) throw new Error('La base de données n’est pas encore initialisée.');
  return state;
}

function platformView(): Database {
  const platform = currentState();
  return {
    version: DB_VERSION,
    establishments: platform.establishments,
    ...emptySchoolData(),
    users: platform.users,
    settings: platform.settings,
  };
}

function tenantView(establishmentId: string): Database {
  const platform = currentState();
  const establishment = platform.establishments.find((item) => item.id === establishmentId);
  if (!establishment) throw new Error('Établissement introuvable.');
  return {
    version: DB_VERSION,
    establishments: [establishment],
    ...(platform.schoolData.get(establishmentId) ?? emptySchoolData()),
    users: platform.users.filter((user) => user.establishmentId === establishmentId),
    settings: establishment.settings,
  };
}

// ---------------------------------------------------------------------------
// SQLite
// ---------------------------------------------------------------------------

function sqliteColumns(db: DatabaseSync, table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as unknown as Array<{ name: string }>).map(
    (row) => row.name,
  );
}

function initializeSqliteSchema(db: DatabaseSync): void {
  db.exec(`
    PRAGMA journal_mode = DELETE;
    PRAGMA synchronous = FULL;

    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS establishments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      country TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      director TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      settings TEXT NOT NULL,
      data TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      phone TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      staff_id TEXT,
      establishment_id TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_users_establishment ON users(establishment_id);
  `);

  if (!sqliteColumns(db, 'users').includes('establishment_id')) {
    db.exec('ALTER TABLE users ADD COLUMN establishment_id TEXT');
  }
}

function getSqliteConnection(): DatabaseSync {
  if (sqliteConnection) return sqliteConnection;
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  sqliteConnection = new DatabaseSync(DATA_FILE);
  initializeSqliteSchema(sqliteConnection);
  return sqliteConnection;
}

function readSqlitePlatform(db: DatabaseSync): PlatformState {
  const establishmentRows = db
    .prepare('SELECT * FROM establishments ORDER BY created_at, id')
    .all() as unknown as Array<Record<string, string | number>>;
  const establishments: Establishment[] = establishmentRows.map((row) => {
    let settings = createDefaultSettings();
    let data = emptySchoolData();
    try {
      settings = { ...settings, ...(JSON.parse(String(row.settings)) as Partial<SchoolSettings>) };
    } catch {
      // Paramètres illisibles : valeurs par défaut.
    }
    try {
      data = normalizeSchoolData(JSON.parse(String(row.data)));
    } catch {
      // Données illisibles : établissement vide.
    }
    const establishment: Establishment = {
      id: String(row.id),
      name: String(row.name),
      code: String(row.code),
      type: String(row.type),
      address: String(row.address),
      city: String(row.city),
      country: String(row.country),
      phone: String(row.phone),
      email: String(row.email),
      director: String(row.director),
      active: Number(row.active) === 1,
      createdAt: String(row.created_at),
      settings,
    };
    return establishment;
  });

  const userRows = db
    .prepare('SELECT * FROM users ORDER BY created_at, id')
    .all() as unknown as Array<Record<string, string | number | null>>;
  const users: UserAccount[] = userRows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    username: String(row.username),
    email: String(row.email),
    password: String(row.password),
    role: String(row.role) as UserAccount['role'],
    phone: String(row.phone),
    active: Number(row.active) === 1,
    createdAt: String(row.created_at),
    staffId: row.staff_id == null ? null : String(row.staff_id),
    establishmentId: row.establishment_id == null ? null : String(row.establishment_id),
  }));

  const dataMap = new Map<string, SchoolData>();
  for (const establishment of establishments) {
    const row = establishmentRows.find((item) => String(item.id) === establishment.id);
    if (!row) continue;
    try {
      dataMap.set(establishment.id, normalizeSchoolData(JSON.parse(String(row.data))));
    } catch {
      dataMap.set(establishment.id, emptySchoolData());
    }
  }

  return {
    establishments,
    users,
    schoolData: dataMap,
    settings: establishments[0]?.settings ?? createDefaultSettings(),
  };
}

function persistSqlite(): void {
  const platform = currentState();
  const db = getSqliteConnection();
  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec('DELETE FROM establishments');
    db.exec('DELETE FROM users');

    const establishmentInsert = db.prepare(`
      INSERT INTO establishments (
        id, name, code, type, address, city, country, phone, email, director,
        active, created_at, settings, data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const establishment of platform.establishments) {
      establishmentInsert.run(
        establishment.id,
        establishment.name,
        establishment.code,
        establishment.type,
        establishment.address,
        establishment.city,
        establishment.country,
        establishment.phone,
        establishment.email,
        establishment.director,
        establishment.active ? 1 : 0,
        establishment.createdAt,
        JSON.stringify(establishment.settings),
        JSON.stringify(platform.schoolData.get(establishment.id) ?? emptySchoolData()),
      );
    }

    const userInsert = db.prepare(`
      INSERT INTO users (
        id, name, username, email, password, role, phone, active, created_at,
        staff_id, establishment_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const user of platform.users) {
      userInsert.run(
        user.id,
        user.name,
        user.username,
        user.email,
        user.password,
        user.role,
        user.phone,
        user.active ? 1 : 0,
        user.createdAt,
        user.staffId ?? null,
        user.establishmentId,
      );
    }

    db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run(
      'version',
      String(DB_VERSION),
    );
    db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run('engine', 'SQLite');
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

// ---------------------------------------------------------------------------
// PostgreSQL
// ---------------------------------------------------------------------------

function getPostgresPool(): Pool {
  if (postgresPool) return postgresPool;
  postgresPool = new Pool({
    connectionString: DATABASE_URL,
    max: Number(process.env.PG_POOL_SIZE || 5),
    ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });
  postgresPool.on('error', (error) => {
    console.error('[EDUFLOW] Erreur du pool PostgreSQL :', error);
  });
  return postgresPool;
}

async function initializePostgresSchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS establishments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      country TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      director TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      settings TEXT NOT NULL,
      data TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      phone TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      staff_id TEXT,
      establishment_id TEXT
    );
  `);
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS establishment_id TEXT');
  await pool.query(
    'CREATE INDEX IF NOT EXISTS idx_users_establishment ON users(establishment_id)',
  );
}

async function readPostgresPlatform(pool: Pool): Promise<PlatformState> {
  const establishmentResult = await pool.query(
    'SELECT * FROM establishments ORDER BY created_at, id',
  );
  const establishments: Establishment[] = establishmentResult.rows.map((row) => {
    let settings = createDefaultSettings();
    try {
      settings = { ...settings, ...(JSON.parse(String(row.settings)) as Partial<SchoolSettings>) };
    } catch {
      // Paramètres illisibles : valeurs par défaut.
    }
    return {
      id: String(row.id),
      name: String(row.name),
      code: String(row.code),
      type: String(row.type),
      address: String(row.address),
      city: String(row.city),
      country: String(row.country),
      phone: String(row.phone),
      email: String(row.email),
      director: String(row.director),
      active: Number(row.active) === 1,
      createdAt: String(row.created_at),
      settings,
    };
  });

  const userResult = await pool.query('SELECT * FROM users ORDER BY created_at, id');
  const users: UserAccount[] = userResult.rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    username: String(row.username),
    email: String(row.email),
    password: String(row.password),
    role: String(row.role) as UserAccount['role'],
    phone: String(row.phone),
    active: Number(row.active) === 1,
    createdAt: String(row.created_at),
    staffId: row.staff_id == null ? null : String(row.staff_id),
    establishmentId: row.establishment_id == null ? null : String(row.establishment_id),
  }));

  const schoolData = new Map<string, SchoolData>();
  for (const row of establishmentResult.rows) {
    try {
      schoolData.set(String(row.id), normalizeSchoolData(JSON.parse(String(row.data))));
    } catch {
      schoolData.set(String(row.id), emptySchoolData());
    }
  }

  return {
    establishments,
    users,
    schoolData,
    settings: establishments[0]?.settings ?? createDefaultSettings(),
  };
}

async function persistPostgres(): Promise<void> {
  const platform = currentState();
  const pool = getPostgresPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM establishments');
    await client.query('DELETE FROM users');

    for (const establishment of platform.establishments) {
      await client.query(
        `INSERT INTO establishments (
          id, name, code, type, address, city, country, phone, email, director,
          active, created_at, settings, data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          establishment.id,
          establishment.name,
          establishment.code,
          establishment.type,
          establishment.address,
          establishment.city,
          establishment.country,
          establishment.phone,
          establishment.email,
          establishment.director,
          establishment.active ? 1 : 0,
          establishment.createdAt,
          JSON.stringify(establishment.settings),
          JSON.stringify(platform.schoolData.get(establishment.id) ?? emptySchoolData()),
        ],
      );
    }

    for (const user of platform.users) {
      await client.query(
        `INSERT INTO users (
          id, name, username, email, password, role, phone, active, created_at,
          staff_id, establishment_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          user.id,
          user.name,
          user.username,
          user.email,
          user.password,
          user.role,
          user.phone,
          user.active ? 1 : 0,
          user.createdAt,
          user.staffId ?? null,
          user.establishmentId,
        ],
      );
    }

    await client.query(
      `INSERT INTO meta (key, value) VALUES ('version', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [String(DB_VERSION)],
    );
    await client.query(
      `INSERT INTO meta (key, value) VALUES ('engine', 'PostgreSQL')
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Initialisation et migration
// ---------------------------------------------------------------------------

function ensureSuperAdmin(platform: PlatformState): boolean {
  let changed = false;
  const existing = platform.users.find((user) => user.role === 'superadmin');
  if (existing) {
    if (existing.establishmentId !== null) {
      existing.establishmentId = null;
      changed = true;
    }
    return changed;
  }

  const candidate =
    platform.users.find((user) => user.username.toLowerCase() === 'admin') ??
    platform.users.find((user) => user.role === 'admin');
  if (candidate) {
    candidate.role = 'superadmin';
    candidate.establishmentId = null;
    changed = true;
  } else {
    platform.users.push(createSuperAdmin());
    changed = true;
  }

  const orphans = platform.users.filter(
    (user) => user.role !== 'superadmin' && !user.establishmentId,
  );
  if (orphans.length > 0 && platform.establishments.length === 0) {
    const settings = createDefaultSettings();
    settings.name = 'Établissement principal';
    settings.shortName = 'Établissement';
    const establishment: Establishment = {
      id: 'etb_legacy',
      name: settings.name,
      code: 'ETB-LEGACY',
      type: '',
      address: '',
      city: '',
      country: '',
      phone: '',
      email: '',
      director: '',
      active: true,
      createdAt: new Date().toISOString(),
      settings,
    };
    platform.establishments.push(establishment);
    platform.schoolData.set(establishment.id, emptySchoolData());
    for (const user of orphans) user.establishmentId = establishment.id;
    changed = true;
  }
  return changed;
}

async function initializePostgres(): Promise<void> {
  const pool = getPostgresPool();
  await initializePostgresSchema(pool);
  const loaded = await readPostgresPlatform(pool);
  const hasContent = loaded.users.length > 0 || loaded.establishments.length > 0;
  state = hasContent ? loaded : seedPlatformState();
  const changed = ensureSuperAdmin(state);
  if (migratePasswordHashes(state)) {
    console.log('[EDUFLOW] Mots de passe migrés vers le hachage PBKDF2.');
  }
  if (changed || !hasContent) {
    await persistPostgres();
  }
  console.log(
    `[EDUFLOW] Plateforme initialisée : ${state.establishments.length} établissement(s), ${state.users.length} compte(s).`,
  );
}

function initializeSqlite(): void {
  const db = getSqliteConnection();
  const loaded = readSqlitePlatform(db);
  const hasContent = loaded.users.length > 0 || loaded.establishments.length > 0;
  state = hasContent ? loaded : seedPlatformState();
  const changed = ensureSuperAdmin(state);
  if (migratePasswordHashes(state)) {
    console.log('[EDUFLOW] Mots de passe migrés vers le hachage PBKDF2.');
  }
  if (changed || !hasContent) persistSqlite();
}

export function initializeDb(): Promise<void> {
  if (!initialization) {
    initialization = USE_POSTGRES ? initializePostgres() : Promise.resolve().then(initializeSqlite);
  }
  return initialization;
}

// ---------------------------------------------------------------------------
// Accès applicatif
// ---------------------------------------------------------------------------

/**
 * Retourne les données de l'établissement de l'utilisateur connecté.
 * Le super-administrateur n'obtient aucune donnée métier : il utilise
 * exclusivement les routes plateforme.
 */
export function getDb(): Database {
  const context = currentRequestContext();
  if (!context || context.role === 'superadmin' || !context.establishmentId) {
    return platformView();
  }
  return tenantView(context.establishmentId);
}

/** Vue plateforme réservée aux routes de gestion des établissements. */
export function getPlatformDb(): Database {
  return platformView();
}

export interface EstablishmentStats {
  students: number;
  staff: number;
  classes: number;
  users: number;
}

export function establishmentStats(establishmentId: string): EstablishmentStats {
  const platform = currentState();
  const data = platform.schoolData.get(establishmentId) ?? emptySchoolData();
  return {
    students: data.students.length,
    staff: data.staff.length,
    classes: data.classes.length,
    users: platform.users.filter((user) => user.establishmentId === establishmentId).length,
  };
}

function persist(): Promise<void> {
  const write = writeQueue.then(() => (USE_POSTGRES ? persistPostgres() : Promise.resolve().then(persistSqlite)));
  writeQueue = write.catch(() => undefined);
  return write;
}

export function saveDb(db: Database): Promise<void> {
  const context = currentRequestContext();
  if (!context || context.role === 'superadmin' || !context.establishmentId) {
    throw new Error('Aucun établissement actif pour enregistrer ces données.');
  }
  const platform = currentState();
  const establishment = platform.establishments.find(
    (item) => item.id === context.establishmentId,
  );
  if (!establishment) throw new Error('Établissement introuvable.');

  migratePasswordHashes(db);
  platform.schoolData.set(establishment.id, extractSchoolData(db));
  establishment.settings = db.settings;
  if (db.settings.name.trim()) establishment.name = db.settings.name.trim();
  platform.settings = db.settings;

  const tenantUsers = db.users.map((user) => ({
    ...user,
    role: user.role === 'superadmin' ? ('admin' as const) : user.role,
    establishmentId: establishment.id,
  }));
  platform.users = [
    ...platform.users.filter((user) => user.establishmentId !== establishment.id),
    ...tenantUsers,
  ];

  return persist();
}

export function savePlatformDb(db: Database): Promise<void> {
  const platform = currentState();
  const previousIds = new Set(platform.establishments.map((item) => item.id));
  platform.establishments = db.establishments.map((establishment) => ({
    ...establishment,
    settings: establishment.settings ?? createDefaultSettings(),
  }));
  platform.users = db.users.map((user) => ({
    ...user,
    establishmentId: user.role === 'superadmin' ? null : user.establishmentId,
  }));
  for (const establishment of platform.establishments) {
    if (!previousIds.has(establishment.id)) {
      platform.schoolData.set(establishment.id, emptySchoolData());
    }
  }
  for (const id of [...platform.schoolData.keys()]) {
    if (!platform.establishments.some((establishment) => establishment.id === id)) {
      platform.schoolData.delete(id);
    }
  }
  platform.settings = platform.establishments[0]?.settings ?? platform.settings;
  return persist();
}

export async function mutateDb<T>(mutator: (db: Database) => T): Promise<T> {
  const db = getDb();
  const result = mutator(db);
  await saveDb(db);
  return result;
}

export async function resetDb(): Promise<Database> {
  const context = currentRequestContext();
  if (!context?.establishmentId) throw new Error('Aucun établissement actif.');
  const platform = currentState();
  const establishment = platform.establishments.find(
    (item) => item.id === context.establishmentId,
  );
  if (!establishment) throw new Error('Établissement introuvable.');
  const settings = createDefaultSettings();
  settings.name = establishment.name;
  settings.shortName = establishment.name;
  platform.schoolData.set(establishment.id, emptySchoolData());
  establishment.settings = settings;
  await persist();
  return tenantView(establishment.id);
}

export function exportDatabaseJson(): string {
  return JSON.stringify(getDb(), null, 2);
}

export async function importDatabaseJson(
  raw: string | Record<string, unknown>,
): Promise<Database> {
  const context = currentRequestContext();
  if (!context?.establishmentId) throw new Error('Aucun établissement actif.');
  const parsed = typeof raw === 'string' ? (JSON.parse(raw) as unknown) : raw;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Fichier de sauvegarde EDUFLOW invalide.');
  }
  const candidate = parsed as Partial<Database>;
  if (!Array.isArray(candidate.students) || !Array.isArray(candidate.classes)) {
    throw new Error('Fichier de sauvegarde EDUFLOW invalide.');
  }
  const db = getDb();
  const imported: Database = {
    ...db,
    ...normalizeSchoolData(candidate),
    settings: {
      ...db.settings,
      ...(candidate.settings && typeof candidate.settings === 'object'
        ? candidate.settings
        : {}),
      rolePermissions: createDefaultSettings().rolePermissions,
    },
  };
  await saveDb(imported);
  return getDb();
}

function postgresLocation(): string {
  try {
    const url = new URL(DATABASE_URL);
    const database = url.pathname.replace(/^\//, '') || 'eduflow';
    return `PostgreSQL ${url.hostname}:${url.port || '5432'}/${database}`;
  } catch {
    return 'PostgreSQL';
  }
}

export function dataFilePath(): string {
  return USE_POSTGRES ? postgresLocation() : DATA_FILE;
}

export async function closeDb(): Promise<void> {
  await writeQueue.catch(() => undefined);
  if (postgresPool) {
    await postgresPool.end();
    postgresPool = null;
  }
  if (sqliteConnection) {
    try {
      sqliteConnection.exec('PRAGMA optimize');
    } catch {
      // La fermeture reste prioritaire même si l'optimisation échoue.
    }
    sqliteConnection.close();
    sqliteConnection = null;
  }
  state = null;
  initialization = null;
}

export function databaseEngine(): string {
  return USE_POSTGRES ? 'PostgreSQL' : 'SQLite';
}
