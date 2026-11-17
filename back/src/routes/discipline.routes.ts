import { Router } from 'express';
import type { DisciplineRecord } from '../types';
import { getDb, saveDb } from '../db/store';
import { currentUser, requireAuth, requirePermission } from '../middleware/auth';
import { asyncHandler, assert } from '../middleware/http';
import { logActivity } from '../services/activity';
import { normalize, todayIso, uid } from '../utils/format';

export const disciplineRouter = Router();

disciplineRouter.use(requireAuth);

function buildRows(): Array<DisciplineRecord & { studentName: string; matricule: string; className: string }> {
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

disciplineRouter.get(
  '/',
  requirePermission('discipline.view'),
  asyncHandler(async (req, res) => {
    const filters = {
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      studentId: typeof req.query.studentId === 'string' ? req.query.studentId : undefined,
      classId: typeof req.query.classId === 'string' ? req.query.classId : undefined,
      type: typeof req.query.type === 'string' ? req.query.type : undefined,
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
    };
    const db = getDb();
    res.json(
      buildRows()
        .filter((row) => {
          if (filters.studentId && row.studentId !== filters.studentId) return false;
          if (filters.type && row.type !== filters.type) return false;
          if (filters.status && row.status !== filters.status) return false;
          if (filters.classId) {
            const student = db.students.find((item) => item.id === row.studentId);
            if (student?.classId !== filters.classId) return false;
          }
          if (filters.search) {
            return normalize(`${row.studentName} ${row.category} ${row.description}`).includes(
              normalize(filters.search),
            );
          }
          return true;
        })
        .sort((a, b) => b.date.localeCompare(a.date)),
    );
  }),
);

disciplineRouter.post(
  '/',
  requirePermission('discipline.manage'),
  asyncHandler(async (req, res) => {
    const input = (req.body ?? {}) as Partial<DisciplineRecord>;
    assert(typeof input.studentId === 'string' && input.studentId, 400, 'L’élève est obligatoire.');
    assert(
      input.type === 'incident' || input.type === 'sanction' || input.type === 'observation',
      400,
      'Le type de fait est invalide.',
    );

    const db = getDb();
    const record: DisciplineRecord = {
      id: uid('dis'),
      studentId: input.studentId,
      date: input.date || todayIso(),
      type: input.type,
      severity: input.severity ?? 'faible',
      category: input.category ?? '',
      description: input.description ?? '',
      action: input.action ?? '',
      reportedBy: currentUser(res).name,
      status: input.status ?? 'ouvert',
    };
    db.discipline.unshift(record);

    logActivity(db, {
      type: 'discipline',
      title: record.type === 'observation' ? 'Observation consignée' : 'Fait disciplinaire consigné',
      description: record.category,
      actor: currentUser(res).name,
    });
    await saveDb(db);
    res.status(201).json(record);
  }),
);

disciplineRouter.put(
  '/:id',
  requirePermission('discipline.manage'),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const id = req.params.id;
    assert(db.discipline.some((record) => record.id === id), 404, 'Dossier disciplinaire introuvable.');
    const { id: _id, reportedBy: _reportedBy, ...updates } = (req.body ?? {}) as Partial<DisciplineRecord>;
    void _id;
    void _reportedBy;
    db.discipline = db.discipline.map((record) =>
      record.id === id ? { ...record, ...updates } : record,
    );
    await saveDb(db);
    res.json(db.discipline.find((record) => record.id === id));
  }),
);

disciplineRouter.delete(
  '/:id',
  requirePermission('discipline.manage'),
  asyncHandler(async (req, res) => {
    const db = getDb();
    assert(
      db.discipline.some((record) => record.id === req.params.id),
      404,
      'Dossier disciplinaire introuvable.',
    );
    db.discipline = db.discipline.filter((record) => record.id !== req.params.id);
    await saveDb(db);
    res.status(204).end();
  }),
);
