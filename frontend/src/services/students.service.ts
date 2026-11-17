import type { Gender, Student, StudentStatus } from '@/types';
import { apiMutate, apiRequest, clone, delay, logActivity, queryString, remoteFirst } from '@/services/api';
import { getDb, mutateDb, saveDb } from '@/services/db';
import { nextMatricule, normalize, uid } from '@/utils/format';

export interface StudentFilters {
  search?: string;
  classId?: string;
  status?: StudentStatus | '';
  gender?: Gender | '';
}

export type StudentInput = Omit<Student, 'id' | 'matricule' | 'createdAt' | 'history'>;

function matchesFilters(student: Student, filters: StudentFilters): boolean {
  if (filters.classId && student.classId !== filters.classId) return false;
  if (filters.status && student.status !== filters.status) return false;
  if (filters.gender && student.gender !== filters.gender) return false;
  if (filters.search) {
    const haystack = normalize(
      `${student.firstName} ${student.lastName} ${student.matricule} ${student.parentName} ${student.parentPhone}`,
    );
    if (!haystack.includes(normalize(filters.search))) return false;
  }
  return true;
}

const localStudentsService = {
  async list(filters: StudentFilters = {}): Promise<Student[]> {
    await delay(120);
    return clone(getDb().students.filter((student) => matchesFilters(student, filters)));
  },

  async get(id: string): Promise<Student | null> {
    await delay(80);
    const student = getDb().students.find((item) => item.id === id);
    return student ? clone(student) : null;
  },

  async create(input: StudentInput): Promise<Student> {
    await delay(220);
    const db = getDb();
    const student: Student = {
      ...input,
      id: uid('std'),
      matricule: nextMatricule('ELV', db.students.map((item) => item.matricule)),
      history: [],
      createdAt: new Date().toISOString(),
    };
    if (!student.enrollmentDate) student.enrollmentDate = new Date().toISOString().slice(0, 10);
    db.students.unshift(student);
    logActivity(db, {
      type: 'student',
      title: 'Nouvelle inscription',
      description: `${student.firstName} ${student.lastName} (${student.matricule}) a été inscrit(e)`,
      actor: 'Secrétariat',
    });
    saveDb(db);
    return clone(student);
  },

  async update(id: string, input: Partial<StudentInput>): Promise<Student> {
    await delay(200);
    const db = getDb();
    const index = db.students.findIndex((item) => item.id === id);
    if (index === -1) throw new Error('Élève introuvable.');
    db.students[index] = { ...db.students[index], ...input };
    saveDb(db);
    return clone(db.students[index]);
  },

  async remove(id: string): Promise<void> {
    await delay(200);
    const db = getDb();
    const student = db.students.find((item) => item.id === id);
    if (!student) throw new Error('Élève introuvable.');
    db.students = db.students.filter((item) => item.id !== id);
    db.grades = db.grades.filter((grade) => grade.studentId !== id);
    db.attendance = db.attendance.filter((record) => record.studentId !== id);
    db.invoices = db.invoices.filter((invoice) => invoice.studentId !== id);
    db.payments = db.payments.filter((payment) => payment.studentId !== id);
    db.discipline = db.discipline.filter((record) => record.studentId !== id);
    logActivity(db, {
      type: 'student',
      title: 'Dossier supprimé',
      description: `Le dossier de ${student.firstName} ${student.lastName} a été supprimé`,
      actor: 'Administration',
    });
    saveDb(db);
  },

  async transfer(id: string, newClassId: string, previousClassName: string, yearName: string): Promise<void> {
    await delay(200);
    mutateDb((db) => {
      const student = db.students.find((item) => item.id === id);
      if (!student) throw new Error('Élève introuvable.');
      student.history.push({
        academicYear: yearName,
        className: previousClassName,
        average: null,
        decision: 'Transfert de classe',
      });
      student.classId = newClassId;
      logActivity(db, {
        type: 'student',
        title: 'Changement de classe',
        description: `${student.firstName} ${student.lastName} a été transféré(e) vers une nouvelle classe`,
        actor: 'Secrétariat',
      });
    });
  },

  async importMany(rows: Record<string, string>[]): Promise<{ created: number; skipped: number }> {
    await delay(350);
    const db = getDb();
    const classByName = new Map(db.classes.map((schoolClass) => [normalize(schoolClass.name), schoolClass]));
    let created = 0;
    let skipped = 0;

    rows.forEach((row) => {
      const firstName = row['prénom'] || row['prenom'] || row['firstname'] || '';
      const lastName = row['nom'] || row['lastname'] || '';
      const className = row['classe'] || row['class'] || '';
      if (!firstName || !lastName) {
        skipped += 1;
        return;
      }
      const schoolClass = classByName.get(normalize(className));
      const genderValue = (row['sexe'] || row['genre'] || 'M').toUpperCase();
      const gender: Gender = genderValue.startsWith('F') ? 'F' : 'M';
      const student: Student = {
        id: uid('std'),
        matricule: nextMatricule('ELV', db.students.map((item) => item.matricule)),
        firstName,
        lastName,
        gender,
        birthDate: row['date de naissance'] || row['naissance'] || '2012-01-01',
        birthPlace: row['lieu de naissance'] || 'Cotonou',
        classId: schoolClass?.id ?? null,
        status: 'actif',
        enrollmentDate: new Date().toISOString().slice(0, 10),
        address: row['adresse'] || '',
        parentName: row['parent'] || row['tuteur'] || '',
        parentRelation: row['relation'] || 'Tuteur',
        parentPhone: row['téléphone'] || row['telephone'] || row['phone'] || '',
        parentEmail: row['email'] || '',
        parentAddress: '',
        bloodType: row['groupe sanguin'] || 'Inconnu',
        allergies: '',
        notes: 'Importé depuis un fichier Excel',
        history: [],
        createdAt: new Date().toISOString(),
      };
      db.students.push(student);
      created += 1;
    });

    logActivity(db, {
      type: 'student',
      title: 'Import d’élèves',
      description: `${created} élève(s) importé(s) depuis un fichier Excel`,
      actor: 'Secrétariat',
    });
    saveDb(db);
    return { created, skipped };
  },
};

const remoteStudentsService: typeof localStudentsService = {
  list: (filters = {}) =>
    apiRequest<Student[]>(
      `/students${queryString({
        search: filters.search,
        classId: filters.classId,
        status: filters.status,
        gender: filters.gender,
      })}`,
    ),

  get: async (id) => {
    try {
      return await apiRequest<Student>(`/students/${encodeURIComponent(id)}`);
    } catch (error) {
      if (error instanceof Error && 'status' in error && error.status === 404) return null;
      throw error;
    }
  },

  create: (input) =>
    apiMutate<Student>('/students', { method: 'POST', body: JSON.stringify(input) }),

  update: (id, input) =>
    apiMutate<Student>(`/students/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),

  remove: async (id) => {
    await apiMutate<void>(`/students/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  transfer: async (id, newClassId, previousClassName, yearName) => {
    await apiMutate<Student>(`/students/${encodeURIComponent(id)}/transfer`, {
      method: 'POST',
      body: JSON.stringify({ newClassId, previousClassName, yearName }),
    });
  },

  importMany: (rows) =>
    apiMutate<{ created: number; skipped: number }>('/students/import', {
      method: 'POST',
      body: JSON.stringify({ rows }),
    }),
};

export const studentsService = remoteFirst(remoteStudentsService, localStudentsService);
