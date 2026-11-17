import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Pencil, Plus, RefreshCw, ShieldAlert, Trash2 } from 'lucide-react';
import type { DisciplineRecord, DisciplineSeverity, DisciplineType, SchoolClass, Student } from '@/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { SearchInput } from '@/components/ui/SearchInput';
import { StatCard } from '@/components/ui/StatCard';
import { Avatar } from '@/components/ui/Avatar';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { useAuth } from '@/hooks/useAuth';
import { useConfirm } from '@/hooks/useConfirm';
import { useDataVersion } from '@/hooks/useDataVersion';
import { useToast } from '@/hooks/useToast';
import { academicsService } from '@/services/academics.service';
import { studentsService } from '@/services/students.service';
import { disciplineService, type DisciplineRow } from '@/services/discipline.service';
import {
  DISCIPLINE_SEVERITY_LABELS,
  DISCIPLINE_SEVERITY_TONES,
  DISCIPLINE_TYPE_LABELS,
  DISCIPLINE_TYPE_TONES,
} from '@/config/labels';
import { formatDate, normalize, todayIso } from '@/utils/format';

interface DisciplineForm {
  studentId: string;
  date: string;
  type: DisciplineType;
  severity: DisciplineSeverity;
  category: string;
  description: string;
  action: string;
  status: DisciplineRecord['status'];
}

const emptyForm: DisciplineForm = {
  studentId: '',
  date: todayIso(),
  type: 'incident',
  severity: 'moyenne',
  category: '',
  description: '',
  action: '',
  status: 'ouvert',
};

const CATEGORY_SUGGESTIONS: Record<DisciplineType, string[]> = {
  incident: ['Retard répété', 'Bagarre', 'Absence injustifiée', 'Matériel endommagé', 'Perturbation du cours'],
  sanction: ['Avertissement écrit', 'Retenue', 'Exclusion temporaire', 'Convocation des parents'],
  observation: ['Manque de concentration', 'Progrès remarquable', 'Attitude positive', 'Participation exceptionnelle'],
};

export function DisciplinePage() {
  const { can } = useAuth();
  const version = useDataVersion();
  const toast = useToast();
  const confirm = useConfirm();

  const [rows, setRows] = useState<DisciplineRow[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<DisciplineType | ''>('');
  const [statusFilter, setStatusFilter] = useState<DisciplineRecord['status'] | ''>('');
  const [classFilter, setClassFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DisciplineRow | null>(null);
  const [form, setForm] = useState<DisciplineForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const canManage = can('discipline.manage');
  const actor = 'Surveillance générale';

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([disciplineService.list(), academicsService.listClasses(), studentsService.list()]).then(
      ([records, classList, studentList]) => {
        if (!active) return;
        setRows(records);
        setClasses(classList);
        setStudents(studentList.filter((student) => student.status === 'actif'));
      },
    ).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [version]);

  const filtered = useMemo(
    () =>
      rows.filter((row) => {
        if (typeFilter && row.type !== typeFilter) return false;
        if (statusFilter && row.status !== statusFilter) return false;
        if (classFilter && row.className !== classes.find((item) => item.id === classFilter)?.name) return false;
        if (search) {
          const haystack = normalize(`${row.studentName} ${row.matricule} ${row.category} ${row.description}`);
          if (!haystack.includes(normalize(search))) return false;
        }
        return true;
      }),
    [rows, typeFilter, statusFilter, classFilter, search, classes],
  );

  const openCount = rows.filter((row) => row.status === 'ouvert').length;
  const incidents = rows.filter((row) => row.type === 'incident').length;
  const sanctions = rows.filter((row) => row.type === 'sanction').length;

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, studentId: students[0]?.id ?? '' });
    setModalOpen(true);
  };

  const openEdit = (row: DisciplineRow) => {
    setEditing(row);
    setForm({
      studentId: row.studentId,
      date: row.date,
      type: row.type,
      severity: row.severity,
      category: row.category,
      description: row.description,
      action: row.action,
      status: row.status,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.studentId) {
      toast.error('Sélectionnez un élève.');
      return;
    }
    if (!form.category.trim() || !form.description.trim()) {
      toast.error('Renseignez la catégorie et la description du fait.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        studentId: form.studentId,
        date: form.date,
        type: form.type,
        severity: form.severity,
        category: form.category.trim(),
        description: form.description.trim(),
        action: form.action.trim(),
        status: form.status,
      };
      if (editing) {
        await disciplineService.update(editing.id, payload);
        toast.success('Le dossier disciplinaire a été mis à jour.');
      } else {
        await disciplineService.create(payload, actor);
        toast.success('Le fait a été consigné.');
      }
      setModalOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  };

  const handleResolve = async (row: DisciplineRow) => {
    try {
      await disciplineService.update(row.id, { status: row.status === 'ouvert' ? 'traite' : 'ouvert' });
      toast.success(row.status === 'ouvert' ? 'Dossier marqué comme traité.' : 'Dossier réouvert.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Mise à jour impossible.');
    }
  };

  const handleDelete = async (row: DisciplineRow) => {
    const confirmed = await confirm({
      title: 'Supprimer le fait disciplinaire ?',
      message: `Le fait « ${row.category} » concernant ${row.studentName} sera définitivement supprimé.`,
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!confirmed) return;
    try {
      await disciplineService.remove(row.id);
      toast.success('Fait disciplinaire supprimé.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Suppression impossible.');
    }
  };

  const columns: Array<Column<DisciplineRow>> = [
    {
      key: 'student',
      header: 'Élève',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <Avatar firstName={row.studentName.split(' ')[0] ?? ''} lastName={row.studentName.split(' ').slice(1).join(' ')} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-800">{row.studentName}</p>
            <p className="text-[11px] text-slate-400">{row.matricule} · {row.className}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      render: (row) => <span className="text-xs text-slate-500">{formatDate(row.date)}</span>,
    },
    {
      key: 'type',
      header: 'Type',
      render: (row) => (
        <Badge tone={DISCIPLINE_TYPE_TONES[row.type]}>
          {DISCIPLINE_TYPE_LABELS[row.type]}
        </Badge>
      ),
    },
    {
      key: 'category',
      header: 'Fait',
      render: (row) => (
        <div className="min-w-0 max-w-[260px]">
          <p className="truncate text-xs font-medium text-slate-700">{row.category}</p>
          <p className="truncate text-[11px] text-slate-400">{row.description}</p>
        </div>
      ),
    },
    {
      key: 'severity',
      header: 'Gravité',
      render: (row) => (
        <Badge tone={DISCIPLINE_SEVERITY_TONES[row.severity]}>{DISCIPLINE_SEVERITY_LABELS[row.severity]}</Badge>
      ),
    },
    {
      key: 'status',
      header: 'Suivi',
      render: (row) => (
        <Badge tone={row.status === 'ouvert' ? 'warning' : 'success'} dot>
          {row.status === 'ouvert' ? 'Ouvert' : 'Traité'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          {canManage ? (
            <>
              <button
                type="button"
                onClick={() => void handleResolve(row)}
                className="rounded-md p-1.5 text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-600"
                title={row.status === 'ouvert' ? 'Marquer comme traité' : 'Réouvrir'}
                aria-label={row.status === 'ouvert' ? 'Marquer comme traité' : 'Réouvrir le dossier'}
              >
                <CheckCircle2 size={15} />
              </button>
              <button
                type="button"
                onClick={() => openEdit(row)}
                className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                title="Modifier"
                aria-label="Modifier"
              >
                <Pencil size={15} />
              </button>
              <button
                type="button"
                onClick={() => void handleDelete(row)}
                className="rounded-md p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                title="Supprimer"
                aria-label="Supprimer"
              >
                <Trash2 size={15} />
              </button>
            </>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Vie scolaire"
        title="Discipline"
        subtitle="Consignez les incidents, observations et sanctions, puis suivez leur traitement."
        actions={
          <>
            <Button
              variant="outline"
              icon={<RefreshCw size={15} className={loading ? 'animate-spin' : ''} />}
              onClick={() => setSearch('')}
            >
              Actualiser
            </Button>
            {canManage ? (
              <Button icon={<Plus size={15} />} onClick={openCreate} disabled={students.length === 0}>
                Nouveau fait
              </Button>
            ) : null}
          </>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Dossiers ouverts" value={String(openCount)} icon={<ShieldAlert size={18} />} tone="amber" />
        <StatCard label="Incidents" value={String(incidents)} icon={<ShieldAlert size={18} />} tone="rose" />
        <StatCard label="Sanctions" value={String(sanctions)} icon={<CheckCircle2 size={18} />} tone="violet" />
        <StatCard label="Total consigné" value={String(rows.length)} icon={<ShieldAlert size={18} />} tone="royal" />
      </div>

      <Card>
        <CardBody className="grid gap-2.5 border-b border-slate-100 sm:grid-cols-2 lg:grid-cols-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Élève, fait, description…" />
          <select
            value={classFilter}
            onChange={(event) => setClassFilter(event.target.value)}
            aria-label="Filtrer par classe"
            className="h-9 rounded-md border border-line bg-white px-3 text-[13px] text-slate-600 focus:border-royal-400 focus:outline-none focus:ring-2 focus:ring-royal-100"
          >
            <option value="">Toutes les classes</option>
            {classes.map((schoolClass) => (
              <option key={schoolClass.id} value={schoolClass.id}>
                {schoolClass.name}
              </option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as DisciplineType | '')}
            aria-label="Filtrer par type"
            className="h-9 rounded-md border border-line bg-white px-3 text-[13px] text-slate-600 focus:border-royal-400 focus:outline-none focus:ring-2 focus:ring-royal-100"
          >
            <option value="">Tous les types</option>
            {Object.entries(DISCIPLINE_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as DisciplineRecord['status'] | '')}
            aria-label="Filtrer par suivi"
            className="h-9 rounded-md border border-line bg-white px-3 text-[13px] text-slate-600 focus:border-royal-400 focus:outline-none focus:ring-2 focus:ring-royal-100"
          >
            <option value="">Tous les suivis</option>
            <option value="ouvert">Ouvert</option>
            <option value="traite">Traité</option>
          </select>
        </CardBody>
        <DataTable
          columns={columns}
          data={filtered}
          rowKey={(row) => row.id}
          loading={loading}
          emptyTitle="Aucun fait disciplinaire"
          emptyDescription="Aucun dossier ne correspond aux filtres sélectionnés."
        />
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Modifier le fait disciplinaire' : 'Consigner un fait disciplinaire'}
        description={editing ? `Dossier de ${editing.studentName}` : 'Incident, sanction ou observation.'}
        size="lg"
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
            label="Élève"
            required
            fieldClassName="sm:col-span-2"
            value={form.studentId}
            onChange={(event) => setForm((current) => ({ ...current, studentId: event.target.value }))}
          >
            <option value="">Sélectionner un élève</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.lastName} {student.firstName} — {student.matricule}
              </option>
            ))}
          </Select>
          <Input
            label="Date"
            type="date"
            required
            value={form.date}
            onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
          />
          <Select
            label="Type"
            value={form.type}
            onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as DisciplineType }))}
          >
            {Object.entries(DISCIPLINE_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Select
            label="Gravité"
            value={form.severity}
            onChange={(event) => setForm((current) => ({ ...current, severity: event.target.value as DisciplineSeverity }))}
          >
            {Object.entries(DISCIPLINE_SEVERITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Select
            label="Suivi"
            value={form.status}
            onChange={(event) =>
              setForm((current) => ({ ...current, status: event.target.value as DisciplineRecord['status'] }))
            }
          >
            <option value="ouvert">Ouvert</option>
            <option value="traite">Traité</option>
          </Select>
          <Input
            label="Catégorie du fait"
            required
            fieldClassName="sm:col-span-2"
            value={form.category}
            onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
            placeholder="Ex. Retard répété"
            hint={`Suggestions : ${CATEGORY_SUGGESTIONS[form.type].join(', ')}`}
          />
          <Textarea
            label="Description"
            required
            fieldClassName="sm:col-span-2"
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            placeholder="Décrivez les faits constatés…"
          />
          <Input
            label="Décision / action"
            fieldClassName="sm:col-span-2"
            value={form.action}
            onChange={(event) => setForm((current) => ({ ...current, action: event.target.value }))}
            placeholder="Ex. Entretien avec l’élève et les parents"
          />
        </div>
      </Modal>
    </>
  );
}
