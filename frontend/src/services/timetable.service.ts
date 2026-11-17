import type { TimetableSlot } from '@/types';
import { apiMutate, apiRequest, clone, delay, queryString, remoteFirst } from '@/services/api';
import { getDb, saveDb } from '@/services/db';
import { uid } from '@/utils/format';

export type SlotInput = Omit<TimetableSlot, 'id'> & { id?: string };

function overlap(a: { start: string; end: string }, b: { start: string; end: string }): boolean {
  return a.start < b.end && a.end > b.start;
}

const localTimetableService = {
  async list(classId?: string, teacherId?: string): Promise<TimetableSlot[]> {
    await delay(100);
    return clone(
      getDb().timetable.filter(
        (slot) => (!classId || slot.classId === classId) && (!teacherId || slot.teacherId === teacherId),
      ),
    );
  },

  async save(input: SlotInput): Promise<{ success: boolean; message: string }> {
    await delay(220);
    const db = getDb();
    if (input.start >= input.end) {
      return { success: false, message: 'L’heure de fin doit être postérieure à l’heure de début.' };
    }
    const others = db.timetable.filter((slot) => slot.id !== input.id);
    const teacherConflict = others.find(
      (slot) => slot.teacherId === input.teacherId && slot.day === input.day && overlap(slot, input),
    );
    if (teacherConflict) {
      return { success: false, message: 'Cet enseignant a déjà cours sur ce créneau.' };
    }
    const roomConflict = others.find(
      (slot) => slot.room === input.room && slot.day === input.day && overlap(slot, input),
    );
    if (roomConflict) {
      return { success: false, message: 'Cette salle est déjà occupée sur ce créneau.' };
    }
    const classConflict = others.find(
      (slot) => slot.classId === input.classId && slot.day === input.day && overlap(slot, input),
    );
    if (classConflict) {
      return { success: false, message: 'Cette classe a déjà un cours sur ce créneau.' };
    }

    if (input.id) {
      db.timetable = db.timetable.map((slot) => (slot.id === input.id ? ({ ...input, id: input.id } as TimetableSlot) : slot));
    } else {
      const { id: _ignored, ...rest } = input;
      void _ignored;
      db.timetable.push({ ...rest, id: uid('tt') });
    }
    saveDb(db);
    return { success: true, message: 'Créneau enregistré.' };
  },

  async remove(id: string): Promise<void> {
    await delay(150);
    const db = getDb();
    db.timetable = db.timetable.filter((slot) => slot.id !== id);
    saveDb(db);
  },
};

const remoteTimetableService: typeof localTimetableService = {
  list: (classId, teacherId) =>
    apiRequest<TimetableSlot[]>(`/timetable${queryString({ classId, teacherId })}`),

  save: (input) =>
    apiMutate<{ success: boolean; message: string }>('/timetable', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  remove: async (id) => {
    await apiMutate<void>(`/timetable/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
};

export const timetableService = remoteFirst(remoteTimetableService, localTimetableService);
