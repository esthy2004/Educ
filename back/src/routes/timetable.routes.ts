import { Router } from 'express';
import type { TimetableSlot } from '../types';
import { getDb, saveDb } from '../db/store';
import { requireAuth, requirePermission } from '../middleware/auth';
import { asyncHandler, assert } from '../middleware/http';
import { uid } from '../utils/format';

export const timetableRouter = Router();

timetableRouter.use(requireAuth);

function overlap(a: { start: string; end: string }, b: { start: string; end: string }): boolean {
  return a.start < b.end && a.end > b.start;
}

timetableRouter.get(
  '/',
  requirePermission('timetable.view'),
  asyncHandler(async (req, res) => {
    const classId = typeof req.query.classId === 'string' ? req.query.classId : undefined;
    const teacherId = typeof req.query.teacherId === 'string' ? req.query.teacherId : undefined;
    res.json(
      getDb().timetable.filter(
        (slot) =>
          (!classId || slot.classId === classId) && (!teacherId || slot.teacherId === teacherId),
      ),
    );
  }),
);

timetableRouter.post(
  '/',
  requirePermission('timetable.manage'),
  asyncHandler(async (req, res) => {
    const input = (req.body ?? {}) as Partial<TimetableSlot>;
    assert(typeof input.classId === 'string' && input.classId, 400, 'La classe est obligatoire.');
    assert(Number.isInteger(Number(input.day)), 400, 'Le jour est obligatoire.');
    assert(typeof input.start === 'string' && input.start, 400, 'L’heure de début est obligatoire.');
    assert(typeof input.end === 'string' && input.end, 400, 'L’heure de fin est obligatoire.');

    if (input.start >= input.end) {
      res.json({ success: false, message: 'L’heure de fin doit être postérieure à l’heure de début.' });
      return;
    }

    const db = getDb();
    const others = db.timetable.filter((slot) => slot.id !== input.id);
    const teacherConflict = others.find(
      (slot) => slot.teacherId === input.teacherId && slot.day === input.day && overlap(slot, input as TimetableSlot),
    );
    if (teacherConflict) {
      res.json({ success: false, message: 'Cet enseignant a déjà cours sur ce créneau.' });
      return;
    }
    const roomConflict = others.find(
      (slot) => slot.room === input.room && slot.day === input.day && overlap(slot, input as TimetableSlot),
    );
    if (roomConflict) {
      res.json({ success: false, message: 'Cette salle est déjà occupée sur ce créneau.' });
      return;
    }
    const classConflict = others.find(
      (slot) => slot.classId === input.classId && slot.day === input.day && overlap(slot, input as TimetableSlot),
    );
    if (classConflict) {
      res.json({ success: false, message: 'Cette classe a déjà un cours sur ce créneau.' });
      return;
    }

    if (input.id) {
      const slot = db.timetable.find((item) => item.id === input.id);
      assert(slot, 404, 'Créneau introuvable.');
      db.timetable = db.timetable.map((item) =>
        item.id === input.id ? ({ ...item, ...input, id: item.id } as TimetableSlot) : item,
      );
      await saveDb(db);
      res.json({ success: true, message: 'Créneau modifié.', slot: db.timetable.find((item) => item.id === input.id) });
      return;
    }

    const slot: TimetableSlot = {
      id: uid('tt'),
      classId: input.classId,
      day: Number(input.day),
      start: input.start,
      end: input.end,
      subjectId: input.subjectId ?? '',
      teacherId: input.teacherId ?? '',
      room: input.room ?? '',
    };
    db.timetable.push(slot);
    await saveDb(db);
    res.status(201).json({ success: true, message: 'Créneau enregistré.', slot });
  }),
);

timetableRouter.delete(
  '/:id',
  requirePermission('timetable.manage'),
  asyncHandler(async (req, res) => {
    const db = getDb();
    assert(db.timetable.some((slot) => slot.id === req.params.id), 404, 'Créneau introuvable.');
    db.timetable = db.timetable.filter((slot) => slot.id !== req.params.id);
    await saveDb(db);
    res.status(204).end();
  }),
);
