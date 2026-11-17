import { Router } from 'express';
import type { Gender, Student, StudentStatus } from '../types';
import { getDb, saveDb } from '../db/store';
import { currentUser, requireAuth, requirePermission } from '../middleware/auth';
import { asyncHandler, assert, notFound } from '../middleware/http';
import { logActivity } from '../services/activity';
import { nextMatricule, normalize, todayIso, uid } from '../utils/format';

export const studentsRouter = Router();

studentsRouter.use(requireAuth);

function matchesFilters(
  student: Student,
  filters: { search?: string; classId?: string; status?: string; gender?: string },
): boolean {
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

function defaultStudentFields() {
  return {
    gender: 'M' as Gender,
    birthDate: '',
    birthPlace: '',
    classId: null as string | null,
    status: 'actif' as StudentStatus,
    enrollmentDate: todayIso(),
    address: '',
    parentName: '',
    parentRelation: 'Tuteur',
    parentPhone: '',
    parentEmail: '',
    parentAddress: '',
    bloodType: 'Inconnu',
    allergies: '',
    notes: '',
  };
}

studentsRouter.get(
  '/',
  requirePermission('students.view'),
  asyncHandler(async (req, res) => {
    const filters = {
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      classId: typeof req.query.classId === 'string' ? req.query.classId : undefined,
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
      gender: typeof req.query.gender === 'string' ? req.query.gender : undefined,
    };
    res.json(getDb().students.filter((student) => matchesFilters(student, filters)));
  }),
);

studentsRouter.post(
  '/import',
  requirePermission('students.manage'),
  asyncHandler(async (req, res) => {
    const rows = (req.body ?? {}).rows as Record<string, string>[] | undefined;
    assert(Array.isArray(rows), 400, 'Le tableau « rows » est obligatoire.');

    const db = getDb();
    const actor = currentUser(res).name;
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
        ...defaultStudentFields(),
        id: uid('std'),
        matricule: nextMatricule('ELV', db.students.map((item) => item.matricule)),
        firstName,
        lastName,
        gender,
        birthDate: row['date de naissance'] || row['naissance'] || '2012-01-01',
        birthPlace: row['lieu de naissance'] || 'Cotonou',
        classId: schoolClass?.id ?? null,
        address: row['adresse'] || '',
        parentName: row['parent'] || row['tuteur'] || '',
        parentRelation: row['relation'] || 'Tuteur',
        parentPhone: row['téléphone'] || row['telephone'] || row['phone'] || '',
        parentEmail: row['email'] || '',
        bloodType: row['groupe sanguin'] || 'Inconnu',
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
      actor,
    });
    await saveDb(db);
    res.json({ created, skipped });
  }),
);

studentsRouter.get(
  '/:id',
  requirePermission('students.view'),
  asyncHandler(async (req, res) => {
    const student = getDb().students.find((item) => item.id === req.params.id);
    assert(student, 404, 'Élève introuvable.');
    res.json(student);
  }),
);

studentsRouter.post(
  '/',
  requirePermission('students.manage'),
  asyncHandler(async (req, res) => {
    const input = (req.body ?? {}) as Partial<Student>;
    assert(
      typeof input.firstName === 'string' && input.firstName.trim(),
      400,
      'Le prénom est obligatoire.',
    );
    assert(typeof input.lastName === 'string' && input.lastName.trim(), 400, 'Le nom est obligatoire.');
    assert(input.gender === 'M' || input.gender === 'F', 400, 'Le sexe doit être « M » ou « F ».');

    const db = getDb();
    const student: Student = {
      ...defaultStudentFields(),
      ...input,
      id: uid('std'),
      matricule: nextMatricule('ELV', db.students.map((item) => item.matricule)),
      firstName: input.firstName,
      lastName: input.lastName,
      gender: input.gender,
      history: [],
      createdAt: new Date().toISOString(),
    };

    db.students.unshift(student);
    logActivity(db, {
      type: 'student',
      title: 'Nouvelle inscription',
      description: `${student.firstName} ${student.lastName} (${student.matricule}) a été inscrit(e)`,
      actor: currentUser(res).name,
    });
    await saveDb(db);
    res.status(201).json(student);
  }),
);

studentsRouter.put(
  '/:id',
  requirePermission('students.manage'),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const index = db.students.findIndex((item) => item.id === req.params.id);
    assert(index !== -1, 404, 'Élève introuvable.');
    const input = (req.body ?? {}) as Partial<Student>;
    const { id: _id, matricule: _matricule, createdAt: _createdAt, history: _history, ...updates } = input;
    void _id;
    void _matricule;
    void _createdAt;
    void _history;
    db.students[index] = { ...db.students[index], ...updates };
    await saveDb(db);
    res.json(db.students[index]);
  }),
);

studentsRouter.delete(
  '/:id',
  requirePermission('students.manage'),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const student = db.students.find((item) => item.id === req.params.id);
    assert(student, 404, 'Élève introuvable.');

    db.students = db.students.filter((item) => item.id !== student.id);
    db.grades = db.grades.filter((grade) => grade.studentId !== student.id);
    db.attendance = db.attendance.filter((record) => record.studentId !== student.id);
    db.invoices = db.invoices.filter((invoice) => invoice.studentId !== student.id);
    db.payments = db.payments.filter((payment) => payment.studentId !== student.id);
    db.discipline = db.discipline.filter((record) => record.studentId !== student.id);

    logActivity(db, {
      type: 'student',
      title: 'Dossier supprimé',
      description: `Le dossier de ${student.firstName} ${student.lastName} a été supprimé`,
      actor: currentUser(res).name,
    });
    await saveDb(db);
    res.status(204).end();
  }),
);

studentsRouter.post(
  '/:id/transfer',
  requirePermission('students.manage'),
  asyncHandler(async (req, res) => {
    const { newClassId, previousClassName, yearName } = (req.body ?? {}) as {
      newClassId?: string;
      previousClassName?: string;
      yearName?: string;
    };
    assert(typeof newClassId === 'string' && newClassId, 400, 'La nouvelle classe est obligatoire.');

    const db = getDb();
    const student = db.students.find((item) => item.id === req.params.id);
    assert(student, 404, 'Élève introuvable.');
    assert(
      db.classes.some((schoolClass) => schoolClass.id === newClassId),
      400,
      'Classe de destination introuvable.',
    );

    const previousClass = db.classes.find((schoolClass) => schoolClass.id === student.classId);
    const activeYear = db.academicYears.find((year) => year.isActive);
    student.history.push({
      academicYear: yearName || activeYear?.name || '—',
      className: previousClassName || previousClass?.name || '—',
      average: null,
      decision: 'Transfert de classe',
    });
    student.classId = newClassId;

    logActivity(db, {
      type: 'student',
      title: 'Changement de classe',
      description: `${student.firstName} ${student.lastName} a été transféré(e) vers une nouvelle classe`,
      actor: currentUser(res).name,
    });
    await saveDb(db);
    res.json(student);
  }),
);

studentsRouter.get(
  '/:id/finance',
  requirePermission('finance.view'),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const student = db.students.find((item) => item.id === req.params.id);
    assert(student, 404, 'Élève introuvable.');
    const invoices = db.invoices.filter((invoice) => invoice.studentId === student.id);
    const payments = db.payments.filter((payment) => payment.studentId === student.id);
    const invoiced = invoices.reduce((sum, invoice) => sum + invoice.amount, 0);
    const paid = payments.reduce((sum, payment) => sum + payment.amount, 0);
    res.json({ invoiced, paid, balance: invoiced - paid });
  }),
);
