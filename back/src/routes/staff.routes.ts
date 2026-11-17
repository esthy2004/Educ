import { Router } from 'express';
import type { Staff } from '../types';
import { getDb, saveDb } from '../db/store';
import { currentUser, requireAuth, requirePermission } from '../middleware/auth';
import { asyncHandler, assert } from '../middleware/http';
import { logActivity } from '../services/activity';
import { normalize, uid } from '../utils/format';

export const staffRouter = Router();

staffRouter.use(requireAuth);

staffRouter.get(
  '/',
  requirePermission('staff.view'),
  asyncHandler(async (req, res) => {
    const search = typeof req.query.search === 'string' ? req.query.search : '';
    const role = typeof req.query.role === 'string' ? req.query.role : '';
    const status = typeof req.query.status === 'string' ? req.query.status : '';
    res.json(
      getDb().staff.filter((member) => {
        if (role && member.role !== role) return false;
        if (status && member.status !== status) return false;
        if (search) {
          const haystack = normalize(
            `${member.firstName} ${member.lastName} ${member.matricule} ${member.email} ${member.qualification}`,
          );
          if (!haystack.includes(normalize(search))) return false;
        }
        return true;
      }),
    );
  }),
);

// Annuaire minimal accessible à tous les utilisateurs authentifiés
// (emploi du temps, affectation d'un professeur principal).
staffRouter.get(
  '/directory',
  asyncHandler(async (_req, res) => {
    res.json(
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
  }),
);

staffRouter.get(
  '/:id',
  requirePermission('staff.view'),
  asyncHandler(async (req, res) => {
    const member = getDb().staff.find((item) => item.id === req.params.id);
    assert(member, 404, 'Membre du personnel introuvable.');
    res.json(member);
  }),
);

staffRouter.post(
  '/',
  requirePermission('staff.manage'),
  asyncHandler(async (req, res) => {
    const input = (req.body ?? {}) as Partial<Staff>;
    assert(
      typeof input.firstName === 'string' && input.firstName.trim(),
      400,
      'Le prénom est obligatoire.',
    );
    assert(typeof input.lastName === 'string' && input.lastName.trim(), 400, 'Le nom est obligatoire.');
    assert(input.gender === 'M' || input.gender === 'F', 400, 'Le sexe doit être « M » ou « F ».');

    const db = getDb();
    const year = new Date().getFullYear();
    const highest = db.staff.reduce((max, member) => {
      const match = member.matricule.match(/(\d+)$/);
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0);

    const member: Staff = {
      id: uid('stf'),
      matricule: `EMP-${year}-${String(highest + 1).padStart(3, '0')}`,
      firstName: input.firstName,
      lastName: input.lastName,
      gender: input.gender,
      role: input.role ?? 'other',
      email: input.email ?? '',
      phone: input.phone ?? '',
      address: input.address ?? '',
      hireDate: input.hireDate ?? '',
      contractType: input.contractType ?? 'CDI',
      qualification: input.qualification ?? '',
      salary: Number(input.salary ?? 0),
      subjectIds: Array.isArray(input.subjectIds) ? input.subjectIds : [],
      classIds: Array.isArray(input.classIds) ? input.classIds : [],
      status: input.status ?? 'actif',
    };

    db.staff.unshift(member);
    logActivity(db, {
      type: 'system',
      title: 'Nouveau membre du personnel',
      description: `${member.firstName} ${member.lastName} a été ajouté(e) à l'équipe`,
      actor: currentUser(res).name,
    });
    await saveDb(db);
    res.status(201).json(member);
  }),
);

staffRouter.put(
  '/:id',
  requirePermission('staff.manage'),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const index = db.staff.findIndex((member) => member.id === req.params.id);
    assert(index !== -1, 404, 'Membre du personnel introuvable.');
    const input = (req.body ?? {}) as Partial<Staff>;
    const { id: _id, matricule: _matricule, ...updates } = input;
    void _id;
    void _matricule;
    db.staff[index] = { ...db.staff[index], ...updates };
    await saveDb(db);
    res.json(db.staff[index]);
  }),
);

staffRouter.delete(
  '/:id',
  requirePermission('staff.manage'),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const member = db.staff.find((item) => item.id === req.params.id);
    assert(member, 404, 'Membre du personnel introuvable.');

    db.staff = db.staff.filter((item) => item.id !== member.id);
    db.classes = db.classes.map((schoolClass) =>
      schoolClass.mainTeacherId === member.id ? { ...schoolClass, mainTeacherId: null } : schoolClass,
    );
    db.timetable = db.timetable.filter((slot) => slot.teacherId !== member.id);
    db.users = db.users.map((user) =>
      user.staffId === member.id ? { ...user, staffId: null } : user,
    );

    logActivity(db, {
      type: 'system',
      title: 'Départ du personnel',
      description: `${member.firstName} ${member.lastName} a été retiré(e) de l'équipe`,
      actor: currentUser(res).name,
    });
    await saveDb(db);
    res.status(204).end();
  }),
);
