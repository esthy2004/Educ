import type { AttendanceRecord, AttendanceStatus, Student } from '@/types';
import { apiMutate, apiRequest, clone, delay, logActivity, queryString, remoteFirst } from '@/services/api';
import { getDb, saveDb } from '@/services/db';
import { normalize, uid } from '@/utils/format';

export interface AttendanceFilters {
  classId?: string;
  studentId?: string;
  status?: AttendanceStatus | '';
  from?: string;
  to?: string;
  search?: string;
}

export interface AttendanceSessionEntry {
  student: Student;
  status: AttendanceStatus;
  minutesLate: number;
  justification: string;
  recordId?: string;
}

export interface AttendanceRow extends AttendanceRecord {
  studentName: string;
  matricule: string;
  className: string;
}

const localAttendanceService = {
  async session(classId: string, date: string): Promise<AttendanceSessionEntry[]> {
    await delay(100);
    const db = getDb();
    const students = db.students.filter((student) => student.classId === classId && student.status === 'actif');
    return clone(
      students.map((student) => {
        const record = db.attendance.find((item) => item.studentId === student.id && item.date === date);
        return {
          student,
          status: record?.status ?? 'present',
          minutesLate: record?.minutesLate ?? 0,
          justification: record?.justification ?? '',
          recordId: record?.id,
        };
      }),
    );
  },

  async saveSession(
    classId: string,
    date: string,
    entries: Array<{ studentId: string; status: AttendanceStatus; minutesLate: number; justification: string }>,
    actor: string,
  ): Promise<number> {
    await delay(240);
    const db = getDb();
    db.attendance = db.attendance.filter((record) => !(record.classId === classId && record.date === date));
    entries.forEach((entry) => {
      db.attendance.push({
        id: uid('att'),
        studentId: entry.studentId,
        classId,
        date,
        status: entry.status,
        minutesLate: entry.status === 'retard' ? entry.minutesLate : 0,
        justification: entry.justification,
        justifiedBy: entry.status === 'justifie' ? actor : '',
      });
    });
    logActivity(db, {
      type: 'attendance',
      title: 'Appel enregistré',
      description: `Présences du ${date} enregistrées pour ${entries.length} élève(s)`,
      actor,
    });
    saveDb(db);
    return entries.length;
  },

  async history(filters: AttendanceFilters = {}): Promise<AttendanceRow[]> {
    await delay(120);
    const db = getDb();
    return clone(
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
  },

  async justify(recordId: string, justification: string, actor: string): Promise<void> {
    await delay(160);
    const db = getDb();
    const record = db.attendance.find((item) => item.id === recordId);
    if (!record) throw new Error('Enregistrement de présence introuvable.');
    if (!justification.trim()) throw new Error('Le motif de justification est obligatoire.');
    record.status = 'justifie';
    record.justification = justification.trim();
    record.justifiedBy = actor;
    saveDb(db);
  },

  async remove(recordId: string): Promise<void> {
    await delay(120);
    const db = getDb();
    db.attendance = db.attendance.filter((record) => record.id !== recordId);
    saveDb(db);
  },
};

const remoteAttendanceService: typeof localAttendanceService = {
  session: (classId, date) =>
    apiRequest<AttendanceSessionEntry[]>(
      `/attendance/session${queryString({ classId, date })}`,
    ),

  saveSession: (classId, date, entries) =>
    apiMutate<number>('/attendance/session', {
      method: 'POST',
      body: JSON.stringify({ classId, date, entries }),
    }),

  history: (filters = {}) =>
    apiRequest<AttendanceRow[]>(
      `/attendance${queryString({
        classId: filters.classId,
        studentId: filters.studentId,
        status: filters.status,
        from: filters.from,
        to: filters.to,
        search: filters.search,
      })}`,
    ),

  justify: async (recordId, justification) => {
    await apiMutate<AttendanceRecord>(`/attendance/${encodeURIComponent(recordId)}/justify`, {
      method: 'PATCH',
      body: JSON.stringify({ justification }),
    });
  },

  remove: async (recordId) => {
    await apiMutate<void>(`/attendance/${encodeURIComponent(recordId)}`, { method: 'DELETE' });
  },
};

export const attendanceService = remoteFirst(remoteAttendanceService, localAttendanceService);
