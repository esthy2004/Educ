import { Router } from 'express';
import type {
  AcademicYear,
  AttendanceRecord,
  GradeType,
  Level,
  SchoolClass,
  Subject,
  Term,
} from '../types';
import { getDb, saveDb } from '../db/store';
import { currentUser, requireAuth, requirePermission } from '../middleware/auth';
import { asyncHandler, assert } from '../middleware/http';
import { logActivity } from '../services/activity';
import {
  attendanceRate,
  computeClassRanking,
  computeStudentAverage,
} from '../utils/calculations';
import { todayIso, uid } from '../utils/format';

export const academicsRouter = Router();

academicsRouter.use(requireAuth);

function teacherComment(value: number): string {
  if (value >= 16) return 'Excellent trimestre. Félicitations et poursuivez cet effort remarquable.';
  if (value >= 14) return 'Très bon travail d’ensemble. Continuez sur cette dynamique.';
  if (value >= 12) return 'Résultats satisfaisants. Des progrès sont encore possibles.';
  if (value >= 10) return 'Résultats moyens. Un travail plus régulier est attendu.';
  return 'Résultats insuffisants. Un accompagnement et un suivi renforcé sont nécessaires.';
}

academicsRouter.get(
  '/overview',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const db = getDb();
    res.json({
      years: db.academicYears,
      terms: db.terms,
      levels: db.levels,
      classes: db.classes,
      subjects: db.subjects,
    });
  }),
);

// ---------------------------------------------------------------------------
// Années scolaires
// ---------------------------------------------------------------------------

academicsRouter.get(
  '/years',
  requireAuth,
  asyncHandler(async (_req, res) => {
    res.json(getDb().academicYears);
  }),
);

academicsRouter.post(
  '/years',
  requirePermission('academics.manage'),
  asyncHandler(async (req, res) => {
    const input = (req.body ?? {}) as Partial<AcademicYear>;
    assert(typeof input.name === 'string' && input.name.trim(), 400, 'Le nom de l’année est obligatoire.');
    assert(typeof input.startDate === 'string' && input.startDate, 400, 'La date de début est obligatoire.');
    assert(typeof input.endDate === 'string' && input.endDate, 400, 'La date de fin est obligatoire.');

    const db = getDb();
    if (input.isActive) db.academicYears = db.academicYears.map((year) => ({ ...year, isActive: false }));
    const year: AcademicYear = {
      id: uid('year'),
      name: input.name,
      startDate: input.startDate,
      endDate: input.endDate,
      isActive: Boolean(input.isActive),
    };
    db.academicYears.unshift(year);
    await saveDb(db);
    res.status(201).json(year);
  }),
);

academicsRouter.put(
  '/years/:id',
  requirePermission('academics.manage'),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const id = req.params.id;
    assert(db.academicYears.some((year) => year.id === id), 404, 'Année scolaire introuvable.');
    const input = (req.body ?? {}) as Partial<AcademicYear>;
    if (input.isActive) db.academicYears = db.academicYears.map((year) => ({ ...year, isActive: false }));
    db.academicYears = db.academicYears.map((year) => (year.id === id ? { ...year, ...input, id } : year));
    await saveDb(db);
    res.json(db.academicYears.find((year) => year.id === id));
  }),
);

academicsRouter.delete(
  '/years/:id',
  requirePermission('academics.manage'),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const id = req.params.id;
    const year = db.academicYears.find((item) => item.id === id);
    assert(year, 404, 'Année scolaire introuvable.');
    assert(!year.isActive, 400, 'Impossible de supprimer l’année scolaire active.');
    assert(
      !db.classes.some((schoolClass) => schoolClass.academicYearId === id),
      400,
      'Des classes sont rattachées à cette année scolaire.',
    );
    assert(
      !db.feeStructures.some((fee) => fee.academicYearId === id),
      400,
      'Des frais scolaires sont rattachés à cette année scolaire.',
    );
    assert(
      !db.invoices.some((invoice) => invoice.academicYearId === id),
      400,
      'Des factures sont rattachées à cette année scolaire.',
    );
    const termIds = new Set(db.terms.filter((term) => term.academicYearId === id).map((term) => term.id));
    assert(
      !db.grades.some((grade) => termIds.has(grade.termId)),
      400,
      'Des notes sont rattachées à cette année scolaire.',
    );
    db.academicYears = db.academicYears.filter((item) => item.id !== id);
    db.terms = db.terms.filter((term) => term.academicYearId !== id);
    await saveDb(db);
    res.status(204).end();
  }),
);

// ---------------------------------------------------------------------------
// Trimestres
// ---------------------------------------------------------------------------

academicsRouter.get(
  '/terms',
  requireAuth,
  asyncHandler(async (req, res) => {
    const yearId = typeof req.query.yearId === 'string' ? req.query.yearId : undefined;
    const terms = getDb().terms.filter((term) => !yearId || term.academicYearId === yearId);
    res.json([...terms].sort((a, b) => a.order - b.order));
  }),
);

academicsRouter.post(
  '/terms',
  requirePermission('academics.manage'),
  asyncHandler(async (req, res) => {
    const input = (req.body ?? {}) as Partial<Term>;
    assert(typeof input.name === 'string' && input.name.trim(), 400, 'Le nom du trimestre est obligatoire.');
    assert(
      typeof input.academicYearId === 'string' && input.academicYearId,
      400,
      'L’année scolaire est obligatoire.',
    );
    assert(typeof input.startDate === 'string' && input.startDate, 400, 'La date de début est obligatoire.');
    assert(typeof input.endDate === 'string' && input.endDate, 400, 'La date de fin est obligatoire.');

    const db = getDb();
    const term: Term = {
      id: uid('term'),
      name: input.name,
      academicYearId: input.academicYearId,
      startDate: input.startDate,
      endDate: input.endDate,
      order: Number(input.order ?? db.terms.length + 1),
    };
    db.terms.push(term);
    await saveDb(db);
    res.status(201).json(term);
  }),
);

academicsRouter.put(
  '/terms/:id',
  requirePermission('academics.manage'),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const id = req.params.id;
    assert(db.terms.some((term) => term.id === id), 404, 'Trimestre introuvable.');
    db.terms = db.terms.map((term) => (term.id === id ? { ...term, ...(req.body as Partial<Term>), id } : term));
    await saveDb(db);
    res.json(db.terms.find((term) => term.id === id));
  }),
);

academicsRouter.delete(
  '/terms/:id',
  requirePermission('academics.manage'),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const id = req.params.id;
    assert(db.terms.some((term) => term.id === id), 404, 'Trimestre introuvable.');
    assert(!db.grades.some((grade) => grade.termId === id), 400, 'Des notes sont associées à ce trimestre.');
    db.terms = db.terms.filter((term) => term.id !== id);
    await saveDb(db);
    res.status(204).end();
  }),
);

// ---------------------------------------------------------------------------
// Niveaux
// ---------------------------------------------------------------------------

academicsRouter.get(
  '/levels',
  requireAuth,
  asyncHandler(async (_req, res) => {
    res.json(getDb().levels);
  }),
);

academicsRouter.post(
  '/levels',
  requirePermission('academics.manage'),
  asyncHandler(async (req, res) => {
    const input = (req.body ?? {}) as Partial<Level>;
    assert(typeof input.name === 'string' && input.name.trim(), 400, 'Le nom du niveau est obligatoire.');
    assert(
      input.cycle === 'primaire' || input.cycle === 'college' || input.cycle === 'lycee',
      400,
      'Le cycle est invalide.',
    );
    const db = getDb();
    const level: Level = {
      id: uid('lvl'),
      name: input.name,
      cycle: input.cycle,
      order: Number(input.order ?? db.levels.length + 1),
    };
    db.levels.push(level);
    db.levels.sort((a, b) => a.order - b.order);
    await saveDb(db);
    res.status(201).json(level);
  }),
);

academicsRouter.put(
  '/levels/:id',
  requirePermission('academics.manage'),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const id = req.params.id;
    assert(db.levels.some((level) => level.id === id), 404, 'Niveau introuvable.');
    db.levels = db.levels.map((level) => (level.id === id ? { ...level, ...(req.body as Partial<Level>), id } : level));
    await saveDb(db);
    res.json(db.levels.find((level) => level.id === id));
  }),
);

academicsRouter.delete(
  '/levels/:id',
  requirePermission('academics.manage'),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const id = req.params.id;
    assert(db.levels.some((level) => level.id === id), 404, 'Niveau introuvable.');
    assert(!db.classes.some((schoolClass) => schoolClass.levelId === id), 400, 'Des classes utilisent encore ce niveau.');
    db.levels = db.levels.filter((level) => level.id !== id);
    db.subjects = db.subjects.map((subject) => ({
      ...subject,
      levelIds: subject.levelIds.filter((levelId) => levelId !== id),
    }));
    db.feeStructures = db.feeStructures.filter((fee) => fee.levelId !== id);
    await saveDb(db);
    res.status(204).end();
  }),
);

// ---------------------------------------------------------------------------
// Classes
// ---------------------------------------------------------------------------

academicsRouter.get(
  '/classes',
  requireAuth,
  asyncHandler(async (_req, res) => {
    res.json(getDb().classes);
  }),
);

academicsRouter.post(
  '/classes',
  requirePermission('academics.manage'),
  asyncHandler(async (req, res) => {
    const input = (req.body ?? {}) as Partial<SchoolClass>;
    assert(typeof input.name === 'string' && input.name.trim(), 400, 'Le nom de la classe est obligatoire.');
    assert(typeof input.levelId === 'string' && input.levelId, 400, 'Le niveau est obligatoire.');
    assert(
      typeof input.academicYearId === 'string' && input.academicYearId,
      400,
      'L’année scolaire est obligatoire.',
    );
    const db = getDb();
    assert(
      !db.classes.some((schoolClass) => schoolClass.name.toLowerCase() === input.name!.toLowerCase()),
      409,
      'Une classe porte déjà ce nom.',
    );
    const schoolClass: SchoolClass = {
      id: uid('cls'),
      name: input.name,
      levelId: input.levelId,
      academicYearId: input.academicYearId,
      mainTeacherId: input.mainTeacherId ?? null,
      room: input.room ?? '',
      capacity: Number(input.capacity ?? 30),
      tuitionFee: Number(input.tuitionFee ?? 0),
    };
    db.classes.push(schoolClass);
    await saveDb(db);
    res.status(201).json(schoolClass);
  }),
);

academicsRouter.put(
  '/classes/:id',
  requirePermission('academics.manage'),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const id = req.params.id;
    assert(db.classes.some((schoolClass) => schoolClass.id === id), 404, 'Classe introuvable.');
    db.classes = db.classes.map((schoolClass) =>
      schoolClass.id === id ? { ...schoolClass, ...(req.body as Partial<SchoolClass>), id } : schoolClass,
    );
    await saveDb(db);
    res.json(db.classes.find((schoolClass) => schoolClass.id === id));
  }),
);

academicsRouter.delete(
  '/classes/:id',
  requirePermission('academics.manage'),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const id = req.params.id;
    assert(db.classes.some((schoolClass) => schoolClass.id === id), 404, 'Classe introuvable.');
    assert(
      !db.students.some((student) => student.classId === id),
      400,
      'Des élèves sont encore inscrits dans cette classe.',
    );
    db.classes = db.classes.filter((schoolClass) => schoolClass.id !== id);
    db.timetable = db.timetable.filter((slot) => slot.classId !== id);
    db.grades = db.grades.filter((grade) => grade.classId !== id);
    db.attendance = db.attendance.filter((record) => record.classId !== id);
    await saveDb(db);
    res.status(204).end();
  }),
);

// ---------------------------------------------------------------------------
// Matières
// ---------------------------------------------------------------------------

academicsRouter.get(
  '/subjects',
  requireAuth,
  asyncHandler(async (_req, res) => {
    res.json(getDb().subjects);
  }),
);

academicsRouter.post(
  '/subjects',
  requirePermission('academics.manage'),
  asyncHandler(async (req, res) => {
    const input = (req.body ?? {}) as Partial<Subject>;
    assert(typeof input.name === 'string' && input.name.trim(), 400, 'Le nom de la matière est obligatoire.');
    assert(typeof input.code === 'string' && input.code.trim(), 400, 'Le code matière est obligatoire.');
    const db = getDb();
    assert(
      !db.subjects.some((subject) => subject.code.toLowerCase() === input.code!.toLowerCase()),
      409,
      'Ce code matière est déjà utilisé.',
    );
    const subject: Subject = {
      id: uid('sub'),
      name: input.name,
      code: input.code,
      coefficient: Number(input.coefficient ?? 1),
      levelIds: Array.isArray(input.levelIds) ? input.levelIds : [],
    };
    db.subjects.push(subject);
    await saveDb(db);
    res.status(201).json(subject);
  }),
);

academicsRouter.put(
  '/subjects/:id',
  requirePermission('academics.manage'),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const id = req.params.id;
    assert(db.subjects.some((subject) => subject.id === id), 404, 'Matière introuvable.');
    db.subjects = db.subjects.map((subject) =>
      subject.id === id ? { ...subject, ...(req.body as Partial<Subject>), id } : subject,
    );
    await saveDb(db);
    res.json(db.subjects.find((subject) => subject.id === id));
  }),
);

academicsRouter.delete(
  '/subjects/:id',
  requirePermission('academics.manage'),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const id = req.params.id;
    assert(db.subjects.some((subject) => subject.id === id), 404, 'Matière introuvable.');
    assert(!db.grades.some((grade) => grade.subjectId === id), 400, 'Des notes sont associées à cette matière.');
    assert(!db.timetable.some((slot) => slot.subjectId === id), 400, 'Cette matière figure dans l’emploi du temps.');
    db.subjects = db.subjects.filter((subject) => subject.id !== id);
    db.staff = db.staff.map((member) => ({
      ...member,
      subjectIds: member.subjectIds.filter((subjectId) => subjectId !== id),
    }));
    await saveDb(db);
    res.status(204).end();
  }),
);

// ---------------------------------------------------------------------------
// Notes, classements et bulletins
// ---------------------------------------------------------------------------

academicsRouter.get(
  '/grades',
  requirePermission('academics.view'),
  asyncHandler(async (req, res) => {
    const classId = typeof req.query.classId === 'string' ? req.query.classId : undefined;
    const termId = typeof req.query.termId === 'string' ? req.query.termId : undefined;
    const subjectId = typeof req.query.subjectId === 'string' ? req.query.subjectId : undefined;
    res.json(
      getDb().grades.filter((grade) => {
        if (classId && grade.classId !== classId) return false;
        if (termId && grade.termId !== termId) return false;
        if (subjectId && grade.subjectId !== subjectId) return false;
        return true;
      }),
    );
  }),
);

academicsRouter.post(
  '/grades',
  requirePermission('grades.manage'),
  asyncHandler(async (req, res) => {
    const body = (req.body ?? {}) as {
      classId?: string;
      subjectId?: string;
      termId?: string;
      entries?: Array<{ studentId: string; type: GradeType; score: number | null }>;
    };
    assert(typeof body.classId === 'string' && body.classId, 400, 'La classe est obligatoire.');
    assert(typeof body.subjectId === 'string' && body.subjectId, 400, 'La matière est obligatoire.');
    assert(typeof body.termId === 'string' && body.termId, 400, 'Le trimestre est obligatoire.');
    assert(Array.isArray(body.entries), 400, 'Le tableau « entries » est obligatoire.');

    body.entries.forEach((entry) => {
      if (entry.score === null || entry.score === undefined || Number.isNaN(Number(entry.score))) {
        return;
      }
      const score = Number(entry.score);
      assert(score >= 0 && score <= 20, 400, 'Les notes doivent être comprises entre 0 et 20.');
    });

    const db = getDb();
    const today = todayIso();
    let saved = 0;

    body.entries.forEach((entry) => {
      const existing = db.grades.find(
        (grade) =>
          grade.studentId === entry.studentId &&
          grade.subjectId === body.subjectId &&
          grade.termId === body.termId &&
          grade.type === entry.type,
      );
      if (entry.score === null || entry.score === undefined || Number.isNaN(Number(entry.score))) {
        if (existing) db.grades = db.grades.filter((grade) => grade.id !== existing.id);
        return;
      }
      const score = Number(entry.score);
      if (existing) {
        existing.score = score;
        existing.date = today;
      } else {
        db.grades.push({
          id: uid('grd'),
          studentId: entry.studentId,
          subjectId: body.subjectId!,
          classId: body.classId!,
          termId: body.termId!,
          type: entry.type,
          score,
          date: today,
        });
      }
      saved += 1;
    });

    logActivity(db, {
      type: 'grade',
      title: 'Notes enregistrées',
      description: `${saved} note(s) enregistrée(s) pour une classe`,
      actor: currentUser(res).name,
    });
    await saveDb(db);
    res.json(saved);
  }),
);

academicsRouter.get(
  '/rankings',
  requirePermission('academics.view'),
  asyncHandler(async (req, res) => {
    const classId = typeof req.query.classId === 'string' ? req.query.classId : '';
    const termId = typeof req.query.termId === 'string' ? req.query.termId : '';
    assert(classId && termId, 400, 'Les paramètres « classId » et « termId » sont obligatoires.');
    const db = getDb();
    const students = db.students.filter((student) => student.classId === classId && student.status === 'actif');
    const grades = db.grades.filter((grade) => grade.classId === classId && grade.termId === termId);
    res.json(computeClassRanking(students, grades, db.subjects, termId));
  }),
);

academicsRouter.get(
  '/report-cards/:studentId',
  requirePermission('academics.view'),
  asyncHandler(async (req, res) => {
    const termId = typeof req.query.termId === 'string' ? req.query.termId : '';
    assert(termId, 400, 'Le paramètre « termId » est obligatoire.');
    const db = getDb();
    const student = db.students.find((item) => item.id === req.params.studentId);
    assert(student, 404, 'Élève introuvable.');
    const term = db.terms.find((item) => item.id === termId);
    assert(term, 404, 'Trimestre introuvable.');
    const schoolClass = db.classes.find((item) => item.id === student.classId);
    assert(schoolClass, 404, 'Aucune classe associée à cet élève.');

    const classStudents = db.students.filter(
      (item) => item.classId === schoolClass.id && item.status === 'actif',
    );
    const classGrades = db.grades.filter(
      (grade) => grade.classId === schoolClass.id && grade.termId === termId,
    );
    const ranking = computeClassRanking(classStudents, classGrades, db.subjects, termId);
    const computed = computeStudentAverage(student.id, termId, db.grades, db.subjects);
    const rankEntry = ranking.find((entry) => entry.student.id === student.id);

    const records: AttendanceRecord[] = db.attendance.filter(
      (record) =>
        record.studentId === student.id && record.date >= term.startDate && record.date <= term.endDate,
    );
    const count = (status: AttendanceRecord['status']) =>
      records.filter((record) => record.status === status).length;
    const mainTeacher = db.staff.find((member) => member.id === schoolClass.mainTeacherId);

    res.json({
      student,
      schoolClass,
      term,
      year: db.academicYears.find((year) => year.id === term.academicYearId) ?? null,
      results: computed.subjects,
      average: computed.average,
      totalCoefficients: computed.totalCoefficients,
      rank: rankEntry?.rank ?? 0,
      classSize: classStudents.length,
      attendance: {
        present: count('present'),
        absent: count('absent'),
        late: count('retard'),
        justified: count('justifie'),
        total: records.length,
        rate: attendanceRate(records),
      },
      teacherComment: teacherComment(computed.average),
      mainTeacher: mainTeacher ? `${mainTeacher.firstName} ${mainTeacher.lastName}` : '—',
    });
  }),
);

