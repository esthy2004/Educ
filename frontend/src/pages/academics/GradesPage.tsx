import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, CheckCircle2, Info, Save, Users } from 'lucide-react';
import type { Grade, GradeType, Student } from '@/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/hooks/useAuth';
import { useDataVersion } from '@/hooks/useDataVersion';
import { useToast } from '@/hooks/useToast';
import { academicsService } from '@/services/academics.service';
import { studentsService } from '@/services/students.service';
import { cn } from '@/utils/format';

type GradeKey = GradeType;

const gradeColumns: Array<{ key: GradeKey; label: string; weight: number }> = [
  { key: 'devoir', label: 'Devoir', weight: 1 },
  { key: 'composition', label: 'Composition', weight: 2 },
];

type EntryValues = Record<string, Record<GradeKey, string>>;

const emptyValues = (): Record<GradeKey, string> => ({ devoir: '', composition: '' });

function parseScore(value: string): number | null {
  if (value.trim() === '') return null;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function localAverage(values: Record<GradeKey, string> | undefined): number | null {
  if (!values) return null;
  const parts = gradeColumns.map((column) => ({ score: parseScore(values[column.key]), weight: column.weight })).filter(
    (part): part is { score: number; weight: number } => part.score !== null,
  );
  if (parts.length === 0) return null;
  const totalWeight = parts.reduce((sum, part) => sum + part.weight, 0);
  return parts.reduce((sum, part) => sum + part.score * part.weight, 0) / totalWeight;
}

export function GradesPage() {
  const { can } = useAuth();
  const version = useDataVersion();
  const toast = useToast();
  const [classes, setClasses] = useState<Awaited<ReturnType<typeof academicsService.listClasses>>>([]);
  const [terms, setTerms] = useState<Awaited<ReturnType<typeof academicsService.listTerms>>>([]);
  const [subjects, setSubjects] = useState<Awaited<ReturnType<typeof academicsService.overview>>['subjects']>([]);
  const [classId, setClassId] = useState('');
  const [termId, setTermId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [values, setValues] = useState<EntryValues>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const canManage = can('grades.manage');

  useEffect(() => {
    let active = true;
    academicsService.overview().then(async (data) => {
      if (!active) return;
      setClasses(data.classes);
      setSubjects(data.subjects);
      const activeYear = data.years.find((year) => year.isActive) ?? data.years[0];
      const yearTerms = await academicsService.listTerms(activeYear?.id);
      if (!active) return;
      setTerms(yearTerms);
      setTermId((current) => current || yearTerms[0]?.id || '');
      setClassId((current) => current || data.classes[0]?.id || '');
    });
    return () => {
      active = false;
    };
  }, [version]);

  const selectedClass = classes.find((schoolClass) => schoolClass.id === classId);
  const availableSubjects = useMemo(
    () => subjects.filter((subject) => selectedClass && subject.levelIds.includes(selectedClass.levelId)),
    [subjects, selectedClass],
  );

  useEffect(() => {
    setSubjectId((current) =>
      availableSubjects.some((subject) => subject.id === current) ? current : availableSubjects[0]?.id ?? '',
    );
  }, [availableSubjects]);

  useEffect(() => {
    let active = true;
    if (!classId || !termId || !subjectId) {
      setStudents([]);
      setValues({});
      return;
    }
    setLoading(true);
    Promise.all([
      studentsService.list({ classId, status: 'actif' }),
      academicsService.listGrades({ classId, termId, subjectId }),
    ])
      .then(([studentList, grades]) => {
        if (!active) return;
        const sorted = studentList.sort((a, b) => a.lastName.localeCompare(b.lastName));
        const nextValues: EntryValues = {};
        sorted.forEach((student) => {
          const record: Record<GradeKey, string> = emptyValues();
          grades
            .filter((grade) => grade.studentId === student.id)
            .forEach((grade: Grade) => {
              record[grade.type] = String(grade.score);
            });
          nextValues[student.id] = record;
        });
        setStudents(sorted);
        setValues(nextValues);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [classId, termId, subjectId, version]);

  const subject = subjects.find((item) => item.id === subjectId);
  const term = terms.find((item) => item.id === termId);
  const filledCount = Object.values(values).reduce(
    (sum, entry) => sum + gradeColumns.filter((column) => entry[column.key].trim() !== '').length,
    0,
  );
  const averages = students.map((student) => localAverage(values[student.id])).filter((value): value is number => value !== null);
  const classAverage = averages.length > 0 ? averages.reduce((sum, value) => sum + value, 0) / averages.length : 0;

  const setScore = (studentId: string, key: GradeKey, value: string) => {
    setValues((current) => ({
      ...current,
      [studentId]: { ...(current[studentId] ?? emptyValues()), [key]: value },
    }));
  };

  const handleSave = async () => {
    if (!canManage || !classId || !termId || !subjectId) return;
    const entries: Array<{ studentId: string; type: GradeType; score: number | null }> = [];
    for (const student of students) {
      for (const column of gradeColumns) {
        const raw = values[student.id]?.[column.key] ?? '';
        const score = parseScore(raw);
        if (score === null && raw.trim() !== '') {
          toast.error(`Note invalide pour ${student.firstName} ${student.lastName} (${column.label}).`);
          return;
        }
        if (score !== null && (score < 0 || score > 20)) {
          toast.error(`La note de ${student.firstName} ${student.lastName} doit être comprise entre 0 et 20.`);
          return;
        }
        entries.push({ studentId: student.id, type: column.key, score });
      }
    }
    setSaving(true);
    try {
      const saved = await academicsService.saveGrades({ classId, subjectId, termId, entries });
      toast.success(`${saved} note(s) enregistrée(s) pour ${selectedClass?.name ?? 'la classe'}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Évaluation"
        title="Saisie des notes"
        subtitle="Devoirs et compositions par classe, matière et trimestre. La composition compte double."
        actions={
          <>
            <Link
              to="/academics/report-cards"
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
            >
              <BookOpen size={14} /> Bulletins
            </Link>
            <Button icon={<Save size={15} />} loading={saving} disabled={!canManage || !subjectId} onClick={() => void handleSave()}>
              Enregistrer
            </Button>
          </>
        }
      />

      <Card className="mb-5">
        <CardBody>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">Classe</span>
              <select
                value={classId}
                onChange={(event) => setClassId(event.target.value)}
                className="h-9 w-full rounded-md border border-line bg-white px-3 text-[13px] text-slate-700 focus:border-royal-400 focus:outline-none focus:ring-2 focus:ring-royal-100"
              >
                <option value="">Sélectionner une classe</option>
                {classes.map((schoolClass) => (
                  <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">Trimestre</span>
              <select
                value={termId}
                onChange={(event) => setTermId(event.target.value)}
                className="h-9 w-full rounded-md border border-line bg-white px-3 text-[13px] text-slate-700 focus:border-royal-400 focus:outline-none focus:ring-2 focus:ring-royal-100"
              >
                <option value="">Sélectionner un trimestre</option>
                {terms.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">Matière</span>
              <select
                value={subjectId}
                onChange={(event) => setSubjectId(event.target.value)}
                className="h-9 w-full rounded-md border border-line bg-white px-3 text-[13px] text-slate-700 focus:border-royal-400 focus:outline-none focus:ring-2 focus:ring-royal-100"
              >
                <option value="">Sélectionner une matière</option>
                {availableSubjects.map((item) => (
                  <option key={item.id} value={item.id}>{item.name} (coef. {item.coefficient})</option>
                ))}
              </select>
            </label>
          </div>
        </CardBody>
      </Card>

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg bg-white p-4 shadow-card border border-line">
          <p className="text-2xs font-semibold uppercase tracking-[0.06em] text-muted">Élèves dans la classe</p>
          <p className="mt-1.5 text-[22px] font-semibold tracking-tight text-navy-900 tabular">{students.length}</p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-card border border-line">
          <p className="text-2xs font-semibold uppercase tracking-[0.06em] text-muted">Notes saisies</p>
          <p className="mt-1.5 text-[22px] font-semibold tracking-tight text-royal-600 tabular">
            {filledCount} <span className="text-xs font-normal text-slate-400">/ {students.length * gradeColumns.length}</span>
          </p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-card border border-line">
          <p className="text-2xs font-semibold uppercase tracking-[0.06em] text-muted">Moyenne de la matière</p>
          <p className={cn('mt-1 text-xl font-semibold', classAverage >= 10 ? 'text-emerald-600' : 'text-rose-600')}>
            {averages.length > 0 ? `${classAverage.toFixed(2)} / 20` : '—'}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader
          title={`${selectedClass?.name ?? 'Classe'} · ${subject?.name ?? 'Matière'}`}
          subtitle={term ? `${term.name} · Coefficient ${subject?.coefficient ?? '—'}` : 'Sélectionnez un trimestre'}
          action={
            <Badge tone={canManage ? 'success' : 'neutral'} dot>
              {canManage ? 'Saisie autorisée' : 'Lecture seule'}
            </Badge>
          }
        />
        {!classId || !subjectId || !termId ? (
          <EmptyState
            title="Sélectionnez une classe, un trimestre et une matière"
            description="La grille de saisie s’affichera avec les élèves inscrits."
            icon={<Users size={20} />}
          />
        ) : loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-10 animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        ) : students.length === 0 ? (
          <EmptyState title="Aucun élève actif dans cette classe" description="Inscrivez des élèves pour saisir leurs notes." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="border-y border-slate-100 bg-slate-50/60 text-left text-2xs font-semibold uppercase tracking-[0.06em] text-muted">
                    <th className="px-4 py-2.5 font-semibold">Élève</th>
                    {gradeColumns.map((column) => (
                      <th key={column.key} className="px-3 py-2.5 font-semibold">
                        {column.label} <span className="font-normal normal-case text-slate-400">/20</span>
                      </th>
                    ))}
                    <th className="px-4 py-2.5 text-right font-semibold">Moyenne matière</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {students.map((student) => {
                    const average = localAverage(values[student.id]);
                    return (
                      <tr key={student.id} className="transition hover:bg-slate-50/60">
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2.5">
                            <Avatar firstName={student.firstName} lastName={student.lastName} size="sm" />
                            <div>
                              <p className="text-xs font-medium text-slate-800">{student.lastName} {student.firstName}</p>
                              <p className="text-[10px] text-slate-400">{student.matricule}</p>
                            </div>
                          </div>
                        </td>
                        {gradeColumns.map((column) => (
                          <td key={column.key} className="px-3 py-2">
                            <input
                              type="number"
                              inputMode="decimal"
                              min={0}
                              max={20}
                              step={0.25}
                              value={values[student.id]?.[column.key] ?? ''}
                              onChange={(event) => setScore(student.id, column.key, event.target.value)}
                              disabled={!canManage}
                              aria-label={`${column.label} de ${student.firstName} ${student.lastName}`}
                              placeholder="—"
                              className={cn(
                                'h-8 w-20 rounded-md border px-2 text-center text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-royal-100 disabled:bg-slate-50 disabled:text-slate-400',
                                values[student.id]?.[column.key] &&
                                  (parseScore(values[student.id][column.key]) ?? 0) < 10
                                  ? 'border-rose-200 bg-rose-50/40'
                                  : 'border-slate-200 bg-white focus:border-royal-400',
                              )}
                            />
                          </td>
                        ))}
                        <td className="px-4 py-2 text-right">
                          {average !== null ? (
                            <span className={cn('text-xs font-semibold', average >= 10 ? 'text-emerald-600' : 'text-rose-600')}>
                              {average.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
              <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <Info size={12} /> Laisser vide supprime la note existante. La composition est pondérée ×2.
              </p>
              <Button icon={<CheckCircle2 size={15} />} loading={saving} disabled={!canManage} onClick={() => void handleSave()}>
                Enregistrer les notes
              </Button>
            </div>
          </>
        )}
      </Card>
    </>
  );
}
