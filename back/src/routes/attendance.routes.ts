import { Router } from 'express';
import type { AttendanceRecord, AttendanceStatus } from '../types';
import { getDb, saveDb } from '../db/store';
import { currentUser, requireAuth, requirePermission } from '../middleware/auth';
import { asyncHandler, assert } from '../middleware/http';
import { logActivity } from '../services/activity';
import { normalize, todayIso, uid } from '../utils/format';

export const attendanceRouter = Router();

attendanceRouter.use(requireAuth);

attendanceRouter.get(
  '/session',
  requirePermission('attendance.view'),
  asyncHandler(async (req, res) => {
    const classId = typeof req.query.classId === 'string' ? req.query.classId : '';
    const date = typeof req.query.date === 'string' ? req.query.date : todayIso();
    assert(classId, 400, 'Le paramètre « classId » est obligatoire.');
    const db = getDb();
    const students = db.students.filter(
      (student) => student.classId === classId && student.status === 'actif',
    );
    res.json(
      students.map((student) => {
        const record = db.attendance.find(
          (item) => item.studentId === student.id && item.date === date,
        );
        return {
          student,
          status: record?.status ?? 'present',
          minutesLate: record?.minutesLate ?? 0,
          justification: record?.justification ?? '',
          recordId: record?.id,
        };
      }),
    );
  }),
);

attendanceRouter.post(
  '/session',
  requirePermission('attendance.manage'),
  asyncHandler(async (req, res) => {
    const body = (req.body ?? {}) as {
      classId?: string;
      date?: string;
      entries?: Array<{
        studentId: string;
        status: AttendanceStatus;
        minutesLate: number;
        justification: string;
      }>;
    };
    assert(typeof body.classId === 'string' && body.classId, 400, 'La classe est obligatoire.');
    assert(typeof body.date === 'string' && body.date, 400, 'La date est obligatoire.');
    assert(Array.isArray(body.entries), 400, 'Le tableau « entries » est obligatoire.');

    const db = getDb();
    const actor = currentUser(res).name;
    db.attendance = db.attendance.filter(
      (record) => !(record.classId === body.classId && record.date === body.date),
    );
    body.entries.forEach((entry) => {
      db.attendance.push({
        id: uid('att'),
        studentId: entry.studentId,
        classId: body.classId!,
        date: body.date!,
        status: entry.status,
        minutesLate: entry.status === 'retard' ? Number(entry.minutesLate || 0) : 0,
        justification: entry.justification ?? '',
        justifiedBy: entry.status === 'justifie' ? actor : '',
      });
    });

    logActivity(db, {
      type: 'attendance',
      title: 'Appel enregistré',
      description: `Présences du ${body.date} enregistrées pour ${body.entries.length} élève(s)`,
      actor,
    });
    await saveDb(db);
    res.json(body.entries.length);
  }),
);

attendanceRouter.get(
  '/',
  requirePermission('attendance.view'),
  asyncHandler(async (req, res) => {
    const filters = {
      classId: typeof req.query.classId === 'string' ? req.query.classId : undefined,
      studentId: typeof req.query.studentId === 'string' ? req.query.studentId : undefined,
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
      from: typeof req.query.from === 'string' ? req.query.from : undefined,
      to: typeof req.query.to === 'string' ? req.query.to : undefined,
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
    };
    const db = getDb();
    res.json(
      db.attendance
        .filter((record) => {
          if (filters.classId && record.classId !== filters.classId) return false;
          if (filters.studentId && record.studentId !== filters.studentId) return false;
          if (filters.status && record.status !== filters.status) return false;
          if (filters.from && record.date < filters.from) return false;
          if (filters.to && record.date > filters.to) return false;
          return true;
        })
        .map((record) => {
          const student = db.students.find((item) => item.id === record.studentId);
          const schoolClass = db.classes.find((item) => item.id === record.classId);
          return {
            ...record,
            studentName: student ? `${student.firstName} ${student.lastName}` : 'Élève supprimé',
            matricule: student?.matricule ?? '—',
            className: schoolClass?.name ?? '—',
          };
        })
        .filter((row) =>
          filters.search
            ? normalize(`${row.studentName} ${row.matricule}`).includes(normalize(filters.search))
            : true,
        )
        .sort((a, b) => b.date.localeCompare(a.date)),
    );
  }),
);

attendanceRouter.patch(
  '/:id/justify',
  requirePermission('attendance.manage'),
  asyncHandler(async (req, res) => {
    const { justification } = (req.body ?? {}) as { justification?: string };
    assert(
      typeof justification === 'string' && justification.trim(),
      400,
      'Le motif de justification est obligatoire.',
    );
    const db = getDb();
    const record = db.attendance.find((item) => item.id === req.params.id);
    assert(record, 404, 'Enregistrement de présence introuvable.');
    record.status = 'justifie';
    record.justification = justification.trim();
    record.justifiedBy = currentUser(res).name;
    await saveDb(db);
    res.json(record);
  }),
);

attendanceRouter.delete(
  '/:id',
  requirePermission('attendance.manage'),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const exists = db.attendance.some((record) => record.id === req.params.id);
    assert(exists, 404, 'Enregistrement de présence introuvable.');
    db.attendance = db.attendance.filter((record) => record.id !== req.params.id);
    await saveDb(db);
    res.status(204).end();
  }),
);

export type { AttendanceRecord };
