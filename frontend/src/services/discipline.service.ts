import type { DisciplineRecord } from '@/types';
import { apiMutate, apiRequest, clone, delay, logActivity, queryString, remoteFirst } from '@/services/api';
import { getDb, saveDb } from '@/services/db';
import { normalize, todayIso, uid } from '@/utils/format';

export interface DisciplineRow extends DisciplineRecord {
  studentName: string;
  matricule: string;
  className: string;
}

export type DisciplineInput = Omit<DisciplineRecord, 'id' | 'reportedBy'>;

export interface DisciplineFilters {
  search?: string;
  studentId?: string;
  classId?: string;
  type?: '' | DisciplineRecord['type'];
  status?: '' | DisciplineRecord['status'];
}

function rows(): DisciplineRow[] {
  const db = getDb();
  return db.discipline.map((record) => {
    const student = db.students.find((item) => item.id === record.studentId);
    const schoolClass = db.classes.find((item) => item.id === student?.classId);
    return {
      ...record,
      studentName: student ? `${student.firstName} ${student.lastName}` : 'Élève supprimé',
      matricule: student?.matricule ?? '—',
      className: schoolClass?.name ?? '—',
    };
  });
}

const localDisciplineService = {
  async list(filters: DisciplineFilters = {}): Promise<DisciplineRow[]> {
    await delay(110);
    const db = getDb();
    return clone(
      rows()
        .filter((row) => {
          if (filters.studentId && row.studentId !== filters.studentId) return false;
          if (filters.type && row.type !== filters.type) return false;
          if (filters.status && row.status !== filters.status) return false;
          if (filters.classId) {
            const student = db.students.find((item) => item.id === row.studentId);
            if (student?.classId !== filters.classId) return false;
          }
          if (filters.search) {
            return normalize(`${row.studentName} ${row.category} ${row.description}`).includes(normalize(filters.search));
          }
          return true;
        })
        .sort((a, b) => b.date.localeCompare(a.date)),
    );
  },

  async create(input: DisciplineInput, actor: string): Promise<void> {
    await delay(200);
    const db = getDb();
    db.discipline.unshift({
      ...input,
      id: uid('dis'),
      date: input.date || todayIso(),
      reportedBy: actor,
    });
    logActivity(db, {
      type: 'discipline',
      title: input.type === 'observation' ? 'Observation consignée' : 'Fait disciplinaire consigné',
      description: input.category,
      actor,
    });
    saveDb(db);
  },

  async update(id: string, input: Partial<DisciplineInput>): Promise<void> {
    await delay(160);
    const db = getDb();
    db.discipline = db.discipline.map((record) => (record.id === id ? { ...record, ...input } : record));
    saveDb(db);
  },

  async remove(id: string): Promise<void> {
    await delay(150);
    const db = getDb();
    db.discipline = db.discipline.filter((record) => record.id !== id);
    saveDb(db);
  },
};

const remoteDisciplineService: typeof localDisciplineService = {
  list: (filters = {}) =>
    apiRequest<DisciplineRow[]>(
      `/discipline${queryString({
        search: filters.search,
        studentId: filters.studentId,
        classId: filters.classId,
        type: filters.type,
        status: filters.status,
      })}`,
    ),

  create: async (input) => {
    await apiMutate<DisciplineRecord>('/discipline', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  update: async (id, input) => {
    await apiMutate<DisciplineRecord>(`/discipline/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  remove: async (id) => {
    await apiMutate<void>(`/discipline/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
};

export const disciplineService = remoteFirst(remoteDisciplineService, localDisciplineService);
