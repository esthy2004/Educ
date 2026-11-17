import { useEffect, useMemo, useState } from 'react';
import {
  BookMarked,
  BookOpen,
  CalendarRange,
  CheckCircle2,
  GraduationCap,
  Layers,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Users,
} from 'lucide-react';
import type { AcademicYear, Level, SchoolClass, Subject, Term } from '@/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { EmptyState } from '@/components/ui/EmptyState';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { useAuth } from '@/hooks/useAuth';
import { useDataVersion } from '@/hooks/useDataVersion';
import { useConfirm } from '@/hooks/useConfirm';
import { useToast } from '@/hooks/useToast';
import { academicsService } from '@/services/academics.service';
import { staffService, type StaffDirectoryEntry } from '@/services/staff.service';
import { studentsService } from '@/services/students.service';
import {
  ClassFormModal,
  LevelFormModal,
  SubjectFormModal,
  TermFormModal,
  YearFormModal,
} from '@/modules/academics/AcademicsForms';
import { CYCLE_LABELS } from '@/config/labels';
import { cn, formatCurrency, formatDate, formatNumber } from '@/utils/format';

type Overview = Awaited<ReturnType<typeof academicsService.overview>>;

const tabs = [
  { key: 'classes', label: 'Classes' },
  { key: 'subjects', label: 'Matières' },
  { key: 'levels', label: 'Niveaux' },
  { key: 'years', label: 'Années & trimestres' },
];

export function AcademicsPage() {
  const { can } = useAuth();
  const confirm = useConfirm();
  const toast = useToast();
  const version = useDataVersion();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [staff, setStaff] = useState<StaffDirectoryEntry[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [tab, setTab] = useState('classes');
  const [yearFilter, setYearFilter] = useState('');
  const canManage = can('academics.manage');

  const [yearModal, setYearModal] = useState(false);
  const [editingYear, setEditingYear] = useState<AcademicYear | null>(null);
  const [termModal, setTermModal] = useState(false);
  const [editingTerm, setEditingTerm] = useState<Term | null>(null);
  const [levelModal, setLevelModal] = useState(false);
  const [editingLevel, setEditingLevel] = useState<Level | null>(null);
  const [classModal, setClassModal] = useState(false);
  const [editingClass, setEditingClass] = useState<SchoolClass | null>(null);
  const [subjectModal, setSubjectModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([academicsService.overview(), staffService.directory(), studentsService.list()])
      .then(([data, staffList, students]) => {
        if (!active) return;
        setOverview(data);
        setStaff(staffList);
        const nextCounts: Record<string, number> = {};
        students
          .filter((student) => student.status === 'actif')
          .forEach((student) => {
            if (!student.classId) return;
            nextCounts[student.classId] = (nextCounts[student.classId] ?? 0) + 1;
          });
        setCounts(nextCounts);
        setYearFilter((current) => current || data.years.find((year) => year.isActive)?.id || data.years[0]?.id || '');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [version, reloadKey]);

  const refresh = () => setReloadKey((key) => key + 1);

  const years = overview?.years ?? [];
  const levels = overview?.levels ?? [];
  const classes = overview?.classes ?? [];
  const subjects = overview?.subjects ?? [];
  const terms = overview?.terms ?? [];

  const filteredClasses = useMemo(
    () => classes.filter((schoolClass) => !yearFilter || schoolClass.academicYearId === yearFilter),
    [classes, yearFilter],
  );
  const selectedYearTerms = useMemo(
    () =>
      terms
        .filter((term) => term.academicYearId === yearFilter)
        .sort((a, b) => a.order - b.order),
    [terms, yearFilter],
  );

  const remove = async (entity: 'year' | 'term' | 'level' | 'class' | 'subject', id: string, label: string) => {
    const confirmed = await confirm({
      title: 'Confirmer la suppression',
      message: `${label} sera définitivement supprimé. Cette action est impossible si des données y sont rattachées.`,
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!confirmed) return;
    try {
      if (entity === 'year') await academicsService.removeYear(id);
      if (entity === 'term') await academicsService.removeTerm(id);
      if (entity === 'level') await academicsService.removeLevel(id);
      if (entity === 'class') await academicsService.removeClass(id);
      if (entity === 'subject') await academicsService.removeSubject(id);
      toast.success('Suppression effectuée.');
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Suppression impossible.');
    }
  };

  const activateYear = async (year: AcademicYear) => {
    try {
      await academicsService.updateYear(year.id, { isActive: true });
      toast.success(`L’année ${year.name} est désormais active.`);
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Activation impossible.');
    }
  };

  const teacherName = (id: string | null) => {
    const member = staff.find((item) => item.id === id);
    return member ? `${member.firstName} ${member.lastName}` : null;
  };

  const classColumns: Array<Column<SchoolClass>> = [
    {
      key: 'class',
      header: 'Classe',
      render: (schoolClass) => (
        <div>
          <p className="text-sm font-medium text-slate-800">{schoolClass.name}</p>
          <p className="text-[11px] text-slate-400">
            {levels.find((level) => level.id === schoolClass.levelId)?.name ?? '—'} · {schoolClass.room || 'Salle non définie'}
          </p>
        </div>
      ),
    },
    {
      key: 'teacher',
      header: 'Professeur principal',
      render: (schoolClass) =>
        schoolClass.mainTeacherId ? (
          <span className="text-xs text-slate-600">{teacherName(schoolClass.mainTeacherId) ?? '—'}</span>
        ) : (
          <span className="text-xs italic text-slate-400">Non assigné</span>
        ),
    },
    {
      key: 'effectif',
      header: 'Effectif',
      render: (schoolClass) => {
        const total = counts[schoolClass.id] ?? 0;
        const ratio = Math.min(100, Math.round((total / Math.max(1, schoolClass.capacity)) * 100));
        return (
          <div className="w-28">
            <p className="text-xs text-slate-600">
              {total} / {schoolClass.capacity}
            </p>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className={cn('h-full rounded-full', ratio > 90 ? 'bg-rose-500' : ratio > 70 ? 'bg-amber-500' : 'bg-royal-500')} style={{ width: `${ratio}%` }} />
            </div>
          </div>
        );
      },
    },
    {
      key: 'tuition',
      header: 'Scolarité',
      align: 'right',
      render: (schoolClass) => <span className="text-xs text-slate-600">{formatCurrency(schoolClass.tuitionFee)}</span>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (schoolClass) =>
        canManage ? (
          <div className="flex justify-end gap-1">
            <button type="button" onClick={() => { setEditingClass(schoolClass); setClassModal(true); }} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Modifier">
              <Pencil size={15} />
            </button>
            <button type="button" onClick={() => void remove('class', schoolClass.id, `La classe ${schoolClass.name}`)} className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Supprimer">
              <Trash2 size={15} />
            </button>
          </div>
        ) : null,
    },
  ];

  const subjectColumns: Array<Column<Subject>> = [
    {
      key: 'name',
      header: 'Matière',
      render: (subject) => (
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-royal-50 text-royal-600">
            <BookOpen size={15} />
          </span>
          <div>
            <p className="text-sm font-medium text-slate-800">{subject.name}</p>
            <p className="font-mono text-[10px] text-slate-400">{subject.code}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'coefficient',
      header: 'Coefficient',
      align: 'center',
      render: (subject) => <Badge tone="royal">Coef. {subject.coefficient}</Badge>,
    },
    {
      key: 'levels',
      header: 'Niveaux',
      render: (subject) => (
        <div className="flex flex-wrap gap-1">
          {subject.levelIds.slice(0, 5).map((id) => (
            <span key={id} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
              {levels.find((level) => level.id === id)?.name ?? '—'}
            </span>
          ))}
          {subject.levelIds.length > 5 ? <span className="text-[10px] text-slate-400">+{subject.levelIds.length - 5}</span> : null}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (subject) =>
        canManage ? (
          <div className="flex justify-end gap-1">
            <button type="button" onClick={() => { setEditingSubject(subject); setSubjectModal(true); }} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Modifier">
              <Pencil size={15} />
            </button>
            <button type="button" onClick={() => void remove('subject', subject.id, `La matière ${subject.name}`)} className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Supprimer">
              <Trash2 size={15} />
            </button>
          </div>
        ) : null,
    },
  ];

  const levelColumns: Array<Column<Level>> = [
    {
      key: 'name',
      header: 'Niveau',
      render: (level) => (
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-royal-50 text-royal-700">
            <Layers size={15} />
          </span>
          <span className="text-sm font-medium text-slate-800">{level.name}</span>
        </div>
      ),
    },
    { key: 'cycle', header: 'Cycle', render: (level) => <Badge tone="neutral">{CYCLE_LABELS[level.cycle]}</Badge> },
    {
      key: 'classes',
      header: 'Classes',
      align: 'center',
      render: (level) => <span className="text-xs text-slate-600">{classes.filter((item) => item.levelId === level.id).length}</span>,
    },
    {
      key: 'subjects',
      header: 'Matières',
      align: 'center',
      render: (level) => <span className="text-xs text-slate-600">{subjects.filter((item) => item.levelIds.includes(level.id)).length}</span>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (level) =>
        canManage ? (
          <div className="flex justify-end gap-1">
            <button type="button" onClick={() => { setEditingLevel(level); setLevelModal(true); }} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Modifier">
              <Pencil size={15} />
            </button>
            <button type="button" onClick={() => void remove('level', level.id, `Le niveau ${level.name}`)} className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Supprimer">
              <Trash2 size={15} />
            </button>
          </div>
        ) : null,
    },
  ];

  const termColumns: Array<Column<Term>> = [
    {
      key: 'name',
      header: 'Trimestre',
      render: (term) => (
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
            <CalendarRange size={15} />
          </span>
          <div>
            <p className="text-sm font-medium text-slate-800">{term.name}</p>
            <p className="text-[11px] text-slate-400">Période {term.order}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'dates',
      header: 'Période',
      render: (term) => (
        <span className="text-xs text-slate-600">
          {formatDate(term.startDate)} → {formatDate(term.endDate)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Statut',
      align: 'center',
      render: () => <Badge tone="neutral">Planifié</Badge>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (term) =>
        canManage ? (
          <div className="flex justify-end gap-1">
            <button type="button" onClick={() => { setEditingTerm(term); setTermModal(true); }} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Modifier">
              <Pencil size={15} />
            </button>
            <button type="button" onClick={() => void remove('term', term.id, `Le trimestre ${term.name}`)} className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Supprimer">
              <Trash2 size={15} />
            </button>
          </div>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Organisation pédagogique"
        title="Académique"
        subtitle="Années scolaires, trimestres, niveaux, classes et matières de l’établissement."
        actions={
          <>
            <Button variant="outline" icon={<RefreshCw size={15} className={loading ? 'animate-spin' : ''} />} onClick={refresh}>
              Actualiser
            </Button>
            {canManage ? (
              <Button
                icon={<Plus size={15} />}
                onClick={() => {
                  if (tab === 'subjects') { setEditingSubject(null); setSubjectModal(true); }
                  else if (tab === 'levels') { setEditingLevel(null); setLevelModal(true); }
                  else if (tab === 'years') { setEditingTerm(null); setTermModal(true); }
                  else { setEditingClass(null); setClassModal(true); }
                }}
              >
                {tab === 'subjects' ? 'Nouvelle matière' : tab === 'levels' ? 'Nouveau niveau' : tab === 'years' ? 'Nouveau trimestre' : 'Nouvelle classe'}
              </Button>
            ) : null}
          </>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Classes"
          value={formatNumber(classes.length)}
          hint={`${formatNumber(Object.values(counts).reduce((sum, value) => sum + value, 0))} élèves affectés`}
          icon={<GraduationCap size={16} />}
          tone="royal"
        />
        <StatCard
          label="Matières"
          value={formatNumber(subjects.length)}
          hint="au programme"
          icon={<BookMarked size={16} />}
          tone="violet"
        />
        <StatCard
          label="Niveaux"
          value={formatNumber(levels.length)}
          hint="du primaire au lycée"
          icon={<Layers size={16} />}
          tone="emerald"
        />
        <StatCard
          label="Enseignants"
          value={formatNumber(staff.filter((member) => member.role === 'teacher' && member.status === 'actif').length)}
          hint="actifs cette année"
          icon={<Users size={16} />}
          tone="amber"
        />
      </div>

      <Card>
        <Tabs items={tabs} value={tab} onChange={setTab} className="px-2" />
        {tab === 'classes' ? (
          <>
            <CardBody className="border-b border-slate-100">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-navy-900">Classes de l’année</h3>
                  <p className="text-[11px] text-slate-400">Effectifs, professeurs principaux et frais de scolarité.</p>
                </div>
                <select
                  value={yearFilter}
                  onChange={(event) => setYearFilter(event.target.value)}
                  aria-label="Année scolaire"
                  className="h-9 rounded-md border border-line bg-white px-3 text-xs text-slate-600 focus:border-royal-400 focus:outline-none focus:ring-2 focus:ring-royal-100"
                >
                  {years.map((year) => (
                    <option key={year.id} value={year.id}>{year.name}{year.isActive ? ' (active)' : ''}</option>
                  ))}
                </select>
              </div>
            </CardBody>
            <DataTable
              columns={classColumns}
              data={filteredClasses}
              rowKey={(schoolClass) => schoolClass.id}
              loading={loading}
              emptyTitle="Aucune classe pour cette année"
              emptyDescription="Créez une classe pour commencer à affecter les élèves."
            />
          </>
        ) : null}

        {tab === 'subjects' ? (
          <DataTable
            columns={subjectColumns}
            data={subjects}
            rowKey={(subject) => subject.id}
            loading={loading}
            emptyTitle="Aucune matière"
            emptyDescription="Ajoutez les matières et leurs coefficients."
          />
        ) : null}

        {tab === 'levels' ? (
          <DataTable
            columns={levelColumns}
            data={levels}
            rowKey={(level) => level.id}
            loading={loading}
            emptyTitle="Aucun niveau"
          />
        ) : null}

        {tab === 'years' ? (
          <div className="grid gap-0 lg:grid-cols-[280px_1fr]">
            <div className="border-b border-slate-100 p-4 lg:border-b-0 lg:border-r">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-navy-900">Années scolaires</h3>
                {canManage ? (
                  <Button variant="ghost" size="sm" icon={<Plus size={13} />} onClick={() => { setEditingYear(null); setYearModal(true); }}>
                    Ajouter
                  </Button>
                ) : null}
              </div>
              <div className="space-y-2">
                {years.map((year) => {
                  const isSelected = yearFilter === year.id;
                  return (
                    <button
                      key={year.id}
                      type="button"
                      onClick={() => setYearFilter(year.id)}
                      className={cn(
                        'w-full rounded-lg border p-3 text-left transition',
                        isSelected ? 'border-royal-300 bg-royal-50/60' : 'border-slate-100 bg-white hover:border-slate-200',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-navy-900">{year.name}</span>
                        {year.isActive ? <Badge tone="success" dot>Active</Badge> : null}
                      </div>
                      <p className="mt-0.5 text-[10px] text-slate-400">{formatDate(year.startDate)} → {formatDate(year.endDate)}</p>
                      <div className="mt-2 flex items-center gap-1.5">
                        {!year.isActive ? (
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(event) => { event.stopPropagation(); void activateYear(year); }}
                            onKeyDown={(event) => { if (event.key === 'Enter') { event.stopPropagation(); void activateYear(year); } }}
                            className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 hover:text-emerald-700"
                          >
                            <CheckCircle2 size={11} /> Activer
                          </span>
                        ) : null}
                        {canManage ? (
                          <>
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(event) => { event.stopPropagation(); setEditingYear(year); setYearModal(true); }}
                              onKeyDown={(event) => { if (event.key === 'Enter') { event.stopPropagation(); setEditingYear(year); setYearModal(true); } }}
                              className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 hover:text-slate-700"
                            >
                              <Pencil size={11} /> Modifier
                            </span>
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(event) => { event.stopPropagation(); void remove('year', year.id, `L’année ${year.name}`); }}
                              onKeyDown={(event) => { if (event.key === 'Enter') { event.stopPropagation(); void remove('year', year.id, `L’année ${year.name}`); } }}
                              className="inline-flex items-center gap-1 text-[10px] font-medium text-rose-500 hover:text-rose-600"
                            >
                              <Trash2 size={11} /> Supprimer
                            </span>
                          </>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
                {years.length === 0 && !loading ? <p className="text-xs text-slate-400">Aucune année configurée.</p> : null}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <div>
                  <h3 className="text-sm font-semibold text-navy-900">Trimestres</h3>
                  <p className="text-[11px] text-slate-400">
                    {years.find((year) => year.id === yearFilter)?.name ?? 'Sélectionnez une année'}
                  </p>
                </div>
                {canManage ? (
                  <Button variant="outline" size="sm" icon={<Plus size={13} />} onClick={() => { setEditingTerm(null); setTermModal(true); }}>
                    Nouveau trimestre
                  </Button>
                ) : null}
              </div>
              {selectedYearTerms.length === 0 ? (
                <EmptyState
                  title="Aucun trimestre"
                  description="Ajoutez les trimestres pour permettre la saisie des notes."
                  icon={<CalendarRange size={20} />}
                />
              ) : (
                <DataTable columns={termColumns} data={selectedYearTerms} rowKey={(term) => term.id} compact />
              )}
            </div>
          </div>
        ) : null}
      </Card>

      <YearFormModal open={yearModal} onClose={() => setYearModal(false)} onSaved={refresh} year={editingYear} />
      <TermFormModal open={termModal} onClose={() => setTermModal(false)} onSaved={refresh} term={editingTerm} years={years} />
      <LevelFormModal open={levelModal} onClose={() => setLevelModal(false)} onSaved={refresh} level={editingLevel} />
      <ClassFormModal
        open={classModal}
        onClose={() => setClassModal(false)}
        onSaved={refresh}
        schoolClass={editingClass}
        levels={levels}
        years={years}
        staff={staff}
      />
      <SubjectFormModal open={subjectModal} onClose={() => setSubjectModal(false)} onSaved={refresh} subject={editingSubject} levels={levels} />
    </>
  );
}
