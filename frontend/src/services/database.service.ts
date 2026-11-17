import type { Database } from '@/types';
import { apiMutate, apiRequest, remoteFirst } from '@/services/api';
import {
  exportDatabaseJson as exportLocalDatabase,
  getDb,
  importDatabaseJson as importLocalDatabase,
  resetDb,
} from '@/services/db';

export interface DatabaseInfo {
  engine: string;
  version: number;
  file: string;
  counts: {
    students: number;
    staff: number;
    classes: number;
    grades: number;
    invoices: number;
    payments: number;
  };
}

function localInfo(): DatabaseInfo {
  const db = getDb();
  return {
    engine: 'Local (hors ligne)',
    version: db.version,
    file: 'navigateur',
    counts: {
      students: db.students.length,
      staff: db.staff.length,
      classes: db.classes.length,
      grades: db.grades.length,
      invoices: db.invoices.length,
      payments: db.payments.length,
    },
  };
}

const localDatabaseService = {
  async info(): Promise<DatabaseInfo> {
    return localInfo();
  },

  async exportJson(): Promise<string> {
    return exportLocalDatabase();
  },

  async importJson(raw: string): Promise<void> {
    importLocalDatabase(raw);
  },

  async reset(): Promise<void> {
    resetDb();
  },
};

const remoteDatabaseService: typeof localDatabaseService = {
  info: () => apiRequest<DatabaseInfo>('/database'),

  exportJson: async () => {
    const database = await apiRequest<Database>('/database/export');
    return JSON.stringify(database, null, 2);
  },

  importJson: async (raw) => {
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new Error('Fichier de sauvegarde EDUFLOW invalide.');
    }
    await apiMutate('/database/import', {
      method: 'POST',
      body: JSON.stringify({ database: payload }),
    });
  },

  reset: async () => {
    await apiMutate('/database/reset', { method: 'POST' });
  },
};

export const databaseService = remoteFirst(remoteDatabaseService, localDatabaseService);
