import type { Staff, StaffRole } from '@/types';
import { apiMutate, apiRequest, clone, delay, logActivity, queryString, remoteFirst } from '@/services/api';
import { getDb, saveDb } from '@/services/db';
import { normalize, uid } from '@/utils/format';

export interface StaffFilters {
  search?: string;
  role?: StaffRole | '';
  status?: '' | 'actif' | 'inactif';
}

export type StaffInput = Omit<Staff, 'id' | 'matricule'>;

export type StaffDirectoryEntry = Pick<
  Staff,
  'id' | 'matricule' | 'firstName' | 'lastName' | 'role' | 'status' | 'subjectIds' | 'classIds'
>;

const localStaffService = {
  async list(filters: StaffFilters = {}): Promise<Staff[]> {
    await delay(120);
    return clone(
      getDb().staff.filter((member) => {
        if (filters.role && member.role !== filters.role) return false;
        if (filters.status && member.status !== filters.status) return false;
        if (filters.search) {
          const haystack = normalize(
            `${member.firstName} ${member.lastName} ${member.matricule} ${member.email} ${member.qualification}`,
          );
          if (!haystack.includes(normalize(filters.search))) return false;
        }
        return true;
      }),
    );
  },

  async directory(): Promise<StaffDirectoryEntry[]> {
    await delay(60);
    return clone(
      getDb().staff.map((member) => ({
        id: member.id,
        matricule: member.matricule,
        firstName: member.firstName,
        lastName: member.lastName,
        role: member.role,
        status: member.status,
        subjectIds: member.subjectIds,
        classIds: member.classIds,
      })),
    );
  },

  async create(input: StaffInput): Promise<Staff> {
    await delay(200);
    const db = getDb();
    const year = new Date().getFullYear();
    const highest = db.staff.reduce((max, member) => {
      const match = member.matricule.match(/(\d+)$/);
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0);
    const member: Staff = {
      ...input,
      id: uid('stf'),
      matricule: `EMP-${year}-${String(highest + 1).padStart(3, '0')}`,
    };
    db.staff.unshift(member);
    logActivity(db, {
      type: 'system',
      title: 'Nouveau membre du personnel',
      description: `${member.firstName} ${member.lastName} a été ajouté(e) à l'équipe`,
      actor: 'Administration',
    });
    saveDb(db);
    return clone(member);
  },

  async update(id: string, input: Partial<StaffInput>): Promise<Staff> {
    await delay(180);
    const db = getDb();
    const index = db.staff.findIndex((member) => member.id === id);
    if (index === -1) throw new Error('Membre du personnel introuvable.');
    db.staff[index] = { ...db.staff[index], ...input };
    saveDb(db);
    return clone(db.staff[index]);
  },

  async remove(id: string): Promise<void> {
    await delay(180);
    const db = getDb();
    const member = db.staff.find((item) => item.id === id);
    if (!member) throw new Error('Membre du personnel introuvable.');
    db.staff = db.staff.filter((item) => item.id !== id);
    db.classes = db.classes.map((schoolClass) =>
      schoolClass.mainTeacherId === id ? { ...schoolClass, mainTeacherId: null } : schoolClass,
    );
    logActivity(db, {
      type: 'system',
      title: 'Départ du personnel',
      description: `${member.firstName} ${member.lastName} a été retiré(e) de l'équipe`,
      actor: 'Administration',
    });
    saveDb(db);
  },
};

const remoteStaffService: typeof localStaffService = {
  list: (filters = {}) =>
    apiRequest<Staff[]>(
      `/staff${queryString({
        search: filters.search,
        role: filters.role,
        status: filters.status,
      })}`,
    ),

  directory: () => apiRequest<StaffDirectoryEntry[]>('/staff/directory'),

  create: (input) =>
    apiMutate<Staff>('/staff', { method: 'POST', body: JSON.stringify(input) }),

  update: (id, input) =>
    apiMutate<Staff>(`/staff/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),

  remove: async (id) => {
    await apiMutate<void>(`/staff/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
};

export const staffService = remoteFirst(remoteStaffService, localStaffService);
