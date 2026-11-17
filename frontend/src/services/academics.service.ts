import type {
  AcademicYear,
  AttendanceRecord,
  Grade,
  GradeType,
  Level,
  SchoolClass,
  Student,
  Subject,
  Term,
} from '@/types';
import {
  apiMutate,
  apiRequest,
  clone,
  delay,
  logActivity,
  queryString,
  remoteFirst,
} from '@/services/api';
import { getDb, saveDb } from '@/services/db';
import { uid } from '@/utils/format';
import {
  attendanceRate,
  computeClassRanking,
  computeStudentAverage,
  type RankedStudent,
  type SubjectResult,
} from '@/utils/calculations';

export type YearInput = Omit<AcademicYear, 'id'>;
export type TermInput = Omit<Term, 'id'>;
export type LevelInput = Omit<Level, 'id'>;
export type ClassInput = Omit<SchoolClass, 'id'>;
export type SubjectInput = Omit<Subject, 'id'>;

export interface ReportCardData {
  student: Student;
  schoolClass: SchoolClass;
  term: Term;
  year: AcademicYear | null;
  results: SubjectResult[];
  average: number;
  totalCoefficients: number;
  rank: number;
  classSize: number;
  attendance: { present: number; absent: number; late: number; justified: number; rate: number; total: number };
  teacherComment: string;
  mainTeacher: string;
}

function teacherComment(value: number): string {
  if (value >= 16) return 'Excellent trimestre. Félicitations et poursuivez cet effort remarquable.';
  if (value >= 14) return 'Très bon travail d’ensemble. Continuez sur cette dynamique.';
  if (value >= 12) return 'Résultats satisfaisants. Des progrès sont encore possibles.';
  if (value >= 10) return 'Résultats moyens. Un travail plus régulier est attendu.';
  return 'Résultats insuffisants. Un accompagnement et un suivi renforcé sont nécessaires.';
}

const localAcademicsService = {
  async overview() {
    await delay(80);
    const db = getDb();
    return clone({
      years: db.academicYears,
      terms: db.terms,
      levels: db.levels,
      classes: db.classes,
      subjects: db.subjects,
    });
  },

  async listYears(): Promise<AcademicYear[]> {
    await delay(80);
    return clone(getDb().academicYears);
  },

  async createYear(input: YearInput): Promise<AcademicYear> {
    await delay(160);
    const db = getDb();
    if (input.isActive) db.academicYears = db.academicYears.map((year) => ({ ...year, isActive: false }));
    const year: AcademicYear = { ...input, id: uid('year') };
    db.academicYears.unshift(year);
    saveDb(db);
    return clone(year);
  },

  async updateYear(id: string, input: Partial<YearInput>): Promise<void> {
    await delay(160);
    const db = getDb();
    if (input.isActive) db.academicYears = db.academicYears.map((year) => ({ ...year, isActive: false }));
    db.academicYears = db.academicYears.map((year) => (year.id === id ? { ...year, ...input } : year));
    saveDb(db);
  },

  async removeYear(id: string): Promise<void> {
    await delay(160);
    const db = getDb();
    const year = db.academicYears.find((item) => item.id === id);
    if (!year) throw new Error('Année scolaire introuvable.');
    if (year.isActive) throw new Error('Impossible de supprimer l’année scolaire active.');
    if (db.classes.some((schoolClass) => schoolClass.academicYearId === id)) {
      throw new Error('Des classes sont rattachées à cette année scolaire.');
    }
    db.academicYears = db.academicYears.filter((item) => item.id !== id);
    db.terms = db.terms.filter((term) => term.academicYearId !== id);
    saveDb(db);
  },

  async listTerms(yearId?: string): Promise<Term[]> {
    await delay(80);
    const terms = getDb().terms.filter((term) => !yearId || term.academicYearId === yearId);
    return clone(terms.sort((a, b) => a.order - b.order));
  },

  async createTerm(input: TermInput): Promise<void> {
    await delay(160);
    const db = getDb();
    db.terms.push({ ...input, id: uid('term') });
    saveDb(db);
  },

  async updateTerm(id: string, input: Partial<TermInput>): Promise<void> {
    await delay(140);
    const db = getDb();
    db.terms = db.terms.map((term) => (term.id === id ? { ...term, ...input } : term));
    saveDb(db);
  },

  async removeTerm(id: string): Promise<void> {
    await delay(140);
    const db = getDb();
    if (db.grades.some((grade) => grade.termId === id)) {
      throw new Error('Des notes sont associées à ce trimestre.');
    }
    db.terms = db.terms.filter((term) => term.id !== id);
    saveDb(db);
  },

  async listClasses(): Promise<SchoolClass[]> {
    await delay(90);
    return clone(getDb().classes);
  },

  async createClass(input: ClassInput): Promise<void> {
    await delay(160);
    const db = getDb();
    if (db.classes.some((schoolClass) => schoolClass.name.toLowerCase() === input.name.toLowerCase())) {
      throw new Error('Une classe porte déjà ce nom.');
    }
    db.classes.push({ ...input, id: uid('cls') });
    saveDb(db);
  },

  async updateClass(id: string, input: Partial<ClassInput>): Promise<void> {
    await delay(150);
    const db = getDb();
    db.classes = db.classes.map((schoolClass) => (schoolClass.id === id ? { ...schoolClass, ...input } : schoolClass));
    saveDb(db);
  },

  async removeClass(id: string): Promise<void> {
    await delay(150);
    const db = getDb();
    if (db.students.some((student) => student.classId === id)) {
      throw new Error('Des élèves sont encore inscrits dans cette classe.');
    }
    db.classes = db.classes.filter((schoolClass) => schoolClass.id !== id);
    db.timetable = db.timetable.filter((slot) => slot.classId !== id);
    saveDb(db);
  },

  async createLevel(input: LevelInput): Promise<void> {
    await delay(150);
    const db = getDb();
    db.levels.push({ ...input, id: uid('lvl') });
    db.levels.sort((a, b) => a.order - b.order);
    saveDb(db);
  },

  async updateLevel(id: string, input: Partial<LevelInput>): Promise<void> {
    await delay(140);
    const db = getDb();
    db.levels = db.levels.map((level) => (level.id === id ? { ...level, ...input } : level));
    saveDb(db);
  },

  async removeLevel(id: string): Promise<void> {
    await delay(140);
    const db = getDb();
    if (db.classes.some((schoolClass) => schoolClass.levelId === id)) {
      throw new Error('Des classes utilisent encore ce niveau.');
    }
    db.levels = db.levels.filter((level) => level.id !== id);
    saveDb(db);
  },

  async createSubject(input: SubjectInput): Promise<void> {
    await delay(150);
    const db = getDb();
    if (db.subjects.some((subject) => subject.code.toLowerCase() === input.code.toLowerCase())) {
      throw new Error('Ce code matière est déjà utilisé.');
    }
    db.subjects.push({ ...input, id: uid('sub') });
    saveDb(db);
  },

  async updateSubject(id: string, input: Partial<SubjectInput>): Promise<void> {
    await delay(140);
    const db = getDb();
    db.subjects = db.subjects.map((subject) => (subject.id === id ? { ...subject, ...input } : subject));
    saveDb(db);
  },

  async removeSubject(id: string): Promise<void> {
    await delay(140);
    const db = getDb();
    if (db.grades.some((grade) => grade.subjectId === id)) {
      throw new Error('Des notes sont associées à cette matière.');
    }
    if (db.timetable.some((slot) => slot.subjectId === id)) {
      throw new Error('Cette matière figure dans l’emploi du temps.');
    }
    db.subjects = db.subjects.filter((subject) => subject.id !== id);
    saveDb(db);
  },

  async listGrades(filters: { classId?: string; termId?: string; subjectId?: string }): Promise<Grade[]> {
    await delay(100);
    return clone(
      getDb().grades.filter((grade) => {
        if (filters.classId && grade.classId !== filters.classId) return false;
        if (filters.termId && grade.termId !== filters.termId) return false;
        if (filters.subjectId && grade.subjectId !== filters.subjectId) return false;
        return true;
      }),
    );
  },

  async saveGrades(input: {
    classId: string;
    subjectId: string;
    termId: string;
    entries: Array<{ studentId: string; type: GradeType; score: number | null }>;
  }): Promise<number> {
    await delay(260);
    const db = getDb();
    let saved = 0;
    const today = new Date().toISOString().slice(0, 10);
    input.entries.forEach((entry) => {
      const existing = db.grades.find(
        (grade) =>
          grade.studentId === entry.studentId &&
          grade.subjectId === input.subjectId &&
          grade.termId === input.termId &&
          grade.type === entry.type,
      );
      if (entry.score === null || Number.isNaN(entry.score)) {
        if (existing) db.grades = db.grades.filter((grade) => grade.id !== existing.id);
        return;
      }
      if (existing) {
        existing.score = entry.score;
        existing.date = today;
      } else {
        db.grades.push({
          id: uid('grd'),
          studentId: entry.studentId,
          subjectId: input.subjectId,
          classId: input.classId,
          termId: input.termId,
          type: entry.type,
          score: entry.score,
          date: today,
        });
      }
      saved += 1;
    });
    logActivity(db, {
      type: 'grade',
      title: 'Notes enregistrées',
      description: `${saved} note(s) enregistrée(s) pour une classe`,
      actor: 'Enseignant',
    });
    saveDb(db);
    return saved;
  },

  async rankings(classId: string, termId: string): Promise<RankedStudent[]> {
    await delay(120);
    const db = getDb();
    const students = db.students.filter((student) => student.classId === classId && student.status === 'actif');
    const grades = db.grades.filter((grade) => grade.classId === classId && grade.termId === termId);
    return clone(computeClassRanking(students, grades, db.subjects, termId));
  },

  async reportCard(studentId: string, termId: string): Promise<ReportCardData> {
    await delay(140);
    const db = getDb();
    const student = db.students.find((item) => item.id === studentId);
    if (!student) throw new Error('Élève introuvable.');
    const term = db.terms.find((item) => item.id === termId);
    if (!term) throw new Error('Trimestre introuvable.');
    const schoolClass = db.classes.find((item) => item.id === student.classId);
    if (!schoolClass) throw new Error('Aucune classe associée à cet élève.');

    const classStudents = db.students.filter(
      (item) => item.classId === schoolClass.id && item.status === 'actif',
    );
    const classGrades = db.grades.filter((grade) => grade.classId === schoolClass.id && grade.termId === termId);
    const ranking = computeClassRanking(classStudents, classGrades, db.subjects, termId);
    const computed = computeStudentAverage(student.id, termId, db.grades, db.subjects);
    const rankEntry = ranking.find((entry) => entry.student.id === student.id);

    const records: AttendanceRecord[] = db.attendance.filter(
      (record) =>
        record.studentId === student.id && record.date >= term.startDate && record.date <= term.endDate,
    );
    const count = (status: AttendanceRecord['status']) => records.filter((record) => record.status === status).length;
    const mainTeacher = db.staff.find((member) => member.id === schoolClass.mainTeacherId);

    return clone({
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
  },
};

const remoteAcademicsService: typeof localAcademicsService = {
  overview: () =>
    apiRequest<{
      years: AcademicYear[];
      terms: Term[];
      levels: Level[];
      classes: SchoolClass[];
      subjects: Subject[];
    }>('/academics/overview'),

  listYears: () => apiRequest<AcademicYear[]>('/academics/years'),

  createYear: (input) =>
    apiMutate<AcademicYear>('/academics/years', { method: 'POST', body: JSON.stringify(input) }),

  updateYear: async (id, input) => {
    await apiMutate<AcademicYear>(`/academics/years/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  removeYear: async (id) => {
    await apiMutate<void>(`/academics/years/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  listTerms: (yearId) => requestTerms(yearId),

  createTerm: async (input) => {
    await apiMutate<Term>('/academics/terms', { method: 'POST', body: JSON.stringify(input) });
  },

  updateTerm: async (id, input) => {
    await apiMutate<Term>(`/academics/terms/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  removeTerm: async (id) => {
    await apiMutate<void>(`/academics/terms/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  listClasses: () => apiRequest<SchoolClass[]>('/academics/classes'),

  createClass: async (input) => {
    await apiMutate<SchoolClass>('/academics/classes', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  updateClass: async (id, input) => {
    await apiMutate<SchoolClass>(`/academics/classes/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  removeClass: async (id) => {
    await apiMutate<void>(`/academics/classes/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  createLevel: async (input) => {
    await apiMutate<Level>('/academics/levels', { method: 'POST', body: JSON.stringify(input) });
  },

  updateLevel: async (id, input) => {
    await apiMutate<Level>(`/academics/levels/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  removeLevel: async (id) => {
    await apiMutate<void>(`/academics/levels/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  createSubject: async (input) => {
    await apiMutate<Subject>('/academics/subjects', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  updateSubject: async (id, input) => {
    await apiMutate<Subject>(`/academics/subjects/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  removeSubject: async (id) => {
    await apiMutate<void>(`/academics/subjects/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  listGrades: (filters) =>
    apiRequest<Grade[]>(
      `/academics/grades${queryString({
        classId: filters.classId,
        termId: filters.termId,
        subjectId: filters.subjectId,
      })}`,
    ),

  saveGrades: (input) =>
    apiMutate<number>('/academics/grades', { method: 'POST', body: JSON.stringify(input) }),

  rankings: (classId, termId) =>
    apiRequest<RankedStudent[]>(
      `/academics/rankings${queryString({ classId, termId })}`,
    ),

  reportCard: (studentId, termId) =>
    apiRequest<ReportCardData>(
      `/academics/report-cards/${encodeURIComponent(studentId)}${queryString({ termId })}`,
    ),
};

function requestTerms(yearId?: string): Promise<Term[]> {
  return apiRequest<Term[]>(`/academics/terms${queryString({ yearId })}`);
}

export const academicsService = remoteFirst(remoteAcademicsService, localAcademicsService);
