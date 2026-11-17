import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Clock, MapPin, Pencil, Plus, RefreshCw, Trash2, UserRound } from 'lucide-react';
import type { SchoolClass, Subject, TimetableSlot } from '@/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Select } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/hooks/useAuth';
import { useConfirm } from '@/hooks/useConfirm';
import { useDataVersion } from '@/hooks/useDataVersion';
import { useToast } from '@/hooks/useToast';
import { academicsService } from '@/services/academics.service';
import { staffService, type StaffDirectoryEntry } from '@/services/staff.service';
import { timetableService, type SlotInput } from '@/services/timetable.service';
import { SCHOOL_DAYS } from '@/config/labels';
import { formatTimeRange } from '@/utils/format';

interface SlotForm {
  day: number;
  start: string;
  end: string;
  subjectId: string;
  teacherId: string;
  room: string;
}

const emptyForm: SlotForm = {
  day: 1,
  start: '08:00',
  end: '09:00',
  subjectId: '',
  teacherId: '',
  room: '',
};

const DAYS = [1, 2, 3, 4, 5];

export function TimetablePage() {
  const { can } = useAuth();
  const version = useDataVersion();
  const toast = useToast();
  const confirm = useConfirm();

  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<StaffDirectoryEntry[]>([]);
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [classId, setClassId] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TimetableSlot | null>(null);
  const [form, setForm] = useState<SlotForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const canManage = can('timetable.manage');

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([academicsService.overview(), staffService.directory()]).then(([overview, directory]) => {
      if (!active) return;
      setClasses(overview.classes);
      setSubjects(overview.subjects);
      setTeachers(directory.filter((member) => member.role === 'teacher' && member.status === 'actif'));
      setClassId((current) => current || overview.classes[0]?.id || '');
    });
    return () => {
      active = false;
    };
  }, [version]);

  useEffect(() => {
    if (!classId) {
      setSlots([]);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    timetableService
      .list(classId)
      .then((list) => {
        if (active) setSlots(list);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [classId, version]);

  const subjectNames = useMemo(() => new Map(subjects.map((subject) => [subject.id, subject.name])), [subjects]);
  const teacherNames = useMemo(
    () => new Map(teachers.map((teacher) => [teacher.id, `${teacher.firstName} ${teacher.lastName}`])),
    [teachers],
  );

  const timeRows = useMemo(() => {
    const unique = new Map<string, { start: string; end: string }>();
    slots.forEach((slot) => unique.set(`${slot.start}-${slot.end}`, { start: slot.start, end: slot.end }));
    return [...unique.values()].sort((a, b) => a.start.localeCompare(b.start));
  }, [slots]);

  const cellFor = (day: number, start: string, end: string) =>
    slots.find((slot) => slot.day === day && slot.start === start && slot.end === end);

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...emptyForm,
      subjectId: subjects[0]?.id ?? '',
      teacherId: teachers[0]?.id ?? '',
      room: classes.find((item) => item.id === classId)?.room ?? '',
    });
    setModalOpen(true);
  };

  const openEdit = (slot: TimetableSlot) => {
    setEditing(slot);
    setForm({
      day: slot.day,
      start: slot.start,
      end: slot.end,
      subjectId: slot.subjectId,
      teacherId: slot.teacherId,
      room: slot.room,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    const payload: SlotInput = {
      id: editing?.id,
      classId,
      day: form.day,
      start: form.start,
      end: form.end,
      subjectId: form.subjectId,
      teacherId: form.teacherId,
      room: form.room.trim(),
    };
    if (!payload.subjectId || !payload.teacherId || !payload.room) {
      toast.error('Renseignez la matière, l’enseignant et la salle.');
      return;
    }
    setSaving(true);
    try {
      const result = await timetableService.save(payload);
      if (!result.success) {
        toast.error(result.message);
        return;
      }
      toast.success(editing ? 'Créneau mis à jour.' : 'Créneau ajouté à l’emploi du temps.');
      setModalOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (slot: TimetableSlot) => {
    const confirmed = await confirm({
      title: 'Supprimer le créneau ?',
      message: `${subjectNames.get(slot.subjectId) ?? 'Ce cours'} du ${SCHOOL_DAYS[slot.day - 1]} (${formatTimeRange(slot.start, slot.end)}) sera retiré de l’emploi du temps.`,
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!confirmed) return;
    try {
      await timetableService.remove(slot.id);
      toast.success('Créneau supprimé.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Suppression impossible.');
    }
  };

  const selectedClass = classes.find((item) => item.id === classId);

  return (
    <>
      <PageHeader
        eyebrow="Vie scolaire"
        title="Emploi du temps"
        subtitle="Organisez les cours de chaque classe, avec détection automatique des conflits."
        actions={
          <>
            <Button
              variant="outline"
              icon={<RefreshCw size={15} className={loading ? 'animate-spin' : ''} />}
              onClick={() => setClassId((current) => current)}
            >
              Actualiser
            </Button>
            {canManage ? (
              <Button icon={<Plus size={15} />} onClick={openCreate} disabled={!classId || subjects.length === 0}>
                Nouveau créneau
              </Button>
            ) : null}
          </>
        }
      />

      <Card className="mb-5">
        <CardBody className="flex flex-wrap items-end gap-3">
          <label className="min-w-[220px] flex-1 space-y-1.5">
            <span className="block text-xs font-medium text-slate-600">Classe</span>
            <select
              value={classId}
              onChange={(event) => setClassId(event.target.value)}
              className="h-9 w-full rounded-md border border-line bg-white px-3 text-[13px] text-slate-600 focus:border-royal-400 focus:outline-none focus:ring-2 focus:ring-royal-100"
            >
              {classes.length === 0 ? <option value="">Aucune classe</option> : null}
              {classes.map((schoolClass) => (
                <option key={schoolClass.id} value={schoolClass.id}>
                  {schoolClass.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <Badge tone="royal">{slots.length} créneaux</Badge>
            {selectedClass ? <Badge tone="neutral">Salle {selectedClass.room}</Badge> : null}
            <Badge tone="teal">
              {new Set(slots.map((slot) => slot.subjectId)).size} matières
            </Badge>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={selectedClass ? `Semaine type · ${selectedClass.name}` : 'Semaine type'}
          subtitle="Lundi à vendredi — les conflits d’enseignant, de salle et de classe sont bloqués."
        />
        {loading ? (
          <CardBody>
            <div className="h-72 animate-pulse rounded-lg bg-slate-100" />
          </CardBody>
        ) : timeRows.length === 0 ? (
          <CardBody>
            <EmptyState
              title="Aucun créneau défini"
              description="Ajoutez les cours de cette classe pour construire son emploi du temps hebdomadaire."
              icon={<CalendarDays size={20} />}
              action={
                canManage ? (
                  <Button icon={<Plus size={15} />} onClick={openCreate} disabled={subjects.length === 0}>
                    Ajouter un cours
                  </Button>
                ) : undefined
              }
            />
          </CardBody>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70">
                  <th className="w-28 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Horaire</th>
                  {DAYS.map((day) => (
                    <th key={day} className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      {SCHOOL_DAYS[day - 1]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {timeRows.map((row) => (
                  <tr key={`${row.start}-${row.end}`} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3 align-top">
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                        <Clock size={13} className="text-slate-400" />
                        {formatTimeRange(row.start, row.end)}
                      </span>
                    </td>
                    {DAYS.map((day) => {
                      const slot = cellFor(day, row.start, row.end);
                      if (!slot) {
                        return (
                          <td key={day} className="px-1.5 py-1.5 align-top">
                            <div className="h-full min-h-[62px] rounded-lg border border-dashed border-slate-100" />
                          </td>
                        );
                      }
                      return (
                        <td key={day} className="px-1.5 py-1.5 align-top">
                          <div className="group relative min-h-[62px] rounded-lg border border-royal-100 bg-royal-50/50 px-2.5 py-2">
                            <p className="pr-10 text-[12px] font-semibold leading-snug text-navy-900">
                              {subjectNames.get(slot.subjectId) ?? 'Matière supprimée'}
                            </p>
                            <p className="mt-1 flex items-center gap-1 text-[10px] text-slate-500">
                              <UserRound size={10} /> {teacherNames.get(slot.teacherId) ?? '—'}
                            </p>
                            <p className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-400">
                              <MapPin size={10} /> {slot.room}
                            </p>
                            {canManage ? (
                              <div className="absolute right-1 top-1 flex gap-0.5 opacity-0 transition group-hover:opacity-100">
                                <button
                                  type="button"
                                  onClick={() => openEdit(slot)}
                                  className="rounded p-1 text-slate-400 transition hover:bg-white hover:text-royal-600"
                                  aria-label="Modifier le créneau"
                                  title="Modifier"
                                >
                                  <Pencil size={12} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleDelete(slot)}
                                  className="rounded p-1 text-slate-400 transition hover:bg-white hover:text-rose-600"
                                  aria-label="Supprimer le créneau"
                                  title="Supprimer"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Modifier le créneau' : 'Nouveau créneau'}
        description={selectedClass ? `Classe ${selectedClass.name}` : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Annuler
            </Button>
            <Button loading={saving} onClick={() => void handleSave()}>
              Enregistrer
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Jour"
            value={form.day}
            onChange={(event) => setForm((current) => ({ ...current, day: Number(event.target.value) }))}
          >
            {DAYS.map((day) => (
              <option key={day} value={day}>
                {SCHOOL_DAYS[day - 1]}
              </option>
            ))}
          </Select>
          <Input
            label="Salle"
            required
            value={form.room}
            onChange={(event) => setForm((current) => ({ ...current, room: event.target.value }))}
            placeholder="Ex. Salle 3"
          />
          <Input
            label="Heure de début"
            type="time"
            required
            value={form.start}
            onChange={(event) => setForm((current) => ({ ...current, start: event.target.value }))}
          />
          <Input
            label="Heure de fin"
            type="time"
            required
            value={form.end}
            onChange={(event) => setForm((current) => ({ ...current, end: event.target.value }))}
          />
          <Select
            label="Matière"
            required
            fieldClassName="sm:col-span-2"
            value={form.subjectId}
            onChange={(event) => setForm((current) => ({ ...current, subjectId: event.target.value }))}
          >
            <option value="">Sélectionner une matière</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </Select>
          <Select
            label="Enseignant"
            required
            fieldClassName="sm:col-span-2"
            value={form.teacherId}
            onChange={(event) => setForm((current) => ({ ...current, teacherId: event.target.value }))}
          >
            <option value="">Sélectionner un enseignant</option>
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.firstName} {teacher.lastName}
              </option>
            ))}
          </Select>
        </div>
      </Modal>
    </>
  );
}
