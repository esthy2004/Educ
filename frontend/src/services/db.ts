import type { Database } from '@/types';
import { seedDatabase } from '@/data/seed';

const DB_KEY = 'eduflow:database:v1';
// Version 3 : purge les anciennes données et aligne le stockage local sur le multi-établissement.
const DB_VERSION = 3;
let cache: Database | null = null;

function persist(db: Database): void {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch (error) {
    // Quota dépassé : l'application continue en mémoire, le backend prendra le relais.
    console.warn('[EDUFLOW] Impossible de persister les données locales.', error);
  }
}

export function getDb(): Database {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Database;
      if (parsed.version === DB_VERSION && Array.isArray(parsed.students)) {
        cache = parsed;
        return cache;
      }
    }
  } catch (error) {
    console.warn('[EDUFLOW] Données locales illisibles, réinitialisation.', error);
  }
  cache = seedDatabase();
  persist(cache);
  return cache;
}

export function notifyDataChanged(): void {
  window.dispatchEvent(new CustomEvent('eduflow:data-changed'));
}

export function saveDb(db: Database): void {
  cache = db;
  persist(db);
  notifyDataChanged();
}

export function mutateDb<T>(mutator: (db: Database) => T): T {
  const db = getDb();
  const result = mutator(db);
  saveDb(db);
  return result;
}

export function resetDb(): Database {
  cache = seedDatabase();
  persist(cache);
  notifyDataChanged();
  return cache;
}

export function exportDatabaseJson(): string {
  return JSON.stringify(getDb(), null, 2);
}

export function importDatabaseJson(raw: string): Database {
  const parsed = JSON.parse(raw) as Database;
  if (!parsed || !Array.isArray(parsed.students) || !Array.isArray(parsed.classes)) {
    throw new Error('Fichier de sauvegarde EDUFLOW invalide.');
  }
  cache = { ...seedDatabase(), ...parsed, version: DB_VERSION };
  persist(cache);
  notifyDataChanged();
  return cache;
}
