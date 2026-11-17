import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRightLeft, Download, Eye, Pencil, Plus, RefreshCw, Trash2, Upload, Users } from 'lucide-react';
import type { Gender, SchoolClass, Student, StudentStatus } from '@/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { SearchInput } from '@/components/ui/SearchInput';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { useAuth } from '@/hooks/useAuth';
import { useDataVersion } from '@/hooks/useDataVersion';
import { useConfirm } from '@/hooks/useConfirm';
import { useToast } from '@/hooks/useToast';
import { studentsService } from '@/services/students.service';
import { academicsService } from '@/services/academics.service';
import { StudentFormModal } from '@/modules/students/StudentFormModal';
import { StudentImportModal } from '@/modules/students/StudentImportModal';
import { StudentTransferModal } from '@/modules/students/StudentTransferModal';
import {
  GENDER_LABELS,
  STUDENT_STATUS_LABELS,
  STUDENT_STATUS_TONES,
} from '@/config/labels';
import { exportToExcel } from '@/utils/excel';
import { formatDate, normalize } from '@/utils/format';

export function StudentsPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const confirm = useConfirm();
  const toast = useToast();
  const version = useDataVersion();
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<StudentStatus | ''>('');
  const [genderFilter, setGenderFilter] = useState<Gender | ''>('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [transferring, setTransferring] = useState<Student | null>(null);

  const canManage = can('students.manage');

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([studentsService.list(), academicsService.listClasses()])
      .then(([studentList, classList]) => {
        if (!active) return;
        setStudents(studentList.sort((a, b) => a.lastName.localeCompare(b.lastName)));
        setClasses(classList);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [version, reloadKey]);

  useEffect(() => {
    setPage(1);
  }, [search, classFilter, statusFilter, genderFilter, pageSize]);

  const classNames = useMemo(() => new Map(classes.map((item) => [item.id, item.name])), [classes]);

  const filtered = useMemo(
    () =>
      students.filter((student) => {
        if (classFilter && student.classId !== classFilter) return false;
        if (statusFilter && student.status !== statusFilter) return false;
        if (genderFilter && student.gender !== genderFilter) return false;
        if (search) {
          const haystack = normalize(
            `${student.firstName} ${student.lastName} ${student.matricule} ${student.parentName} ${student.parentPhone}`,
          );
          if (!haystack.includes(normalize(search))) return false;
        }
        return true;
      }),
    [students, classFilter, statusFilter, genderFilter, search],
  );

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  const activeCount = students.filter((student) => student.status === 'actif').length;
  const girlsCount = students.filter((student) => student.gender === 'F').length;

  const refresh = () => setReloadKey((key) => key + 1);

  const handleDelete = async (student: Student) => {
    const confirmed = await confirm({
      title: 'Supprimer le dossier ?',
      message: `Le dossier de ${student.firstName} ${student.lastName} (${student.matricule}) sera supprimé, ainsi que ses notes, présences et factures. Cette action est irréversible.`,
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!confirmed) return;
    try {
      await studentsService.remove(student.id);
      toast.success('Le dossier élève a été supprimé.');
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Suppression impossible.');
    }
  };

  const handleExport = () => {
    if (filtered.length === 0) {
      toast.error('Aucun élève à exporter avec les filtres actuels.');
      return;
    }
    exportToExcel(
      filtered.map((student) => ({
        Matricule: student.matricule,
        Nom: student.lastName,
        Prénom: student.firstName,
        Sexe: GENDER_LABELS[student.gender],
        'Date de naissance': formatDate(student.birthDate),
        Classe: classNames.get(student.classId ?? '') ?? 'Non affecté',
        Statut: STUDENT_STATUS_LABELS[student.status],
        'Parent / tuteur': student.parentName,
        Téléphone: student.parentPhone,
        Inscription: formatDate(student.enrollmentDate),
      })),
      'eleves-eduflow.xlsx',
      'Élèves',
    );
    toast.success(`${filtered.length} élève(s) exporté(s) vers Excel.`);
  };

  const columns: Array<Column<Student>> = [
    {
      key: 'student',
      header: 'Élève',
      render: (student) => (
        <div className="flex items-center gap-2.5">
          <Avatar firstName={student.firstName} lastName={student.lastName} size="md" />
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-800">
              {student.lastName} {student.firstName}
            </p>
            <p className="text-[11px] text-slate-400">
              {student.matricule} · {GENDER_LABELS[student.gender]}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'class',
      header: 'Classe',
      render: (student) => (
        <span className="text-sm text-slate-600">{classNames.get(student.classId ?? '') ?? 'Non affecté'}</span>
      ),
    },
    {
      key: 'parent',
      header: 'Parent / tuteur',
      render: (student) => (
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-slate-700">{student.parentName || '—'}</p>
          <p className="text-[11px] text-slate-400">{student.parentPhone || '—'}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Statut',
      render: (student) => (
        <Badge tone={STUDENT_STATUS_TONES[student.status]} dot>
          {STUDENT_STATUS_LABELS[student.status]}
        </Badge>
      ),
    },
    {
      key: 'enrollment',
      header: 'Inscription',
      render: (student) => <span className="text-xs text-slate-500">{formatDate(student.enrollmentDate)}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (student) => (
        <div className="flex items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            onClick={() => navigate(`/students/${student.id}`)}
            className="rounded-md p-1.5 text-slate-400 transition hover:bg-royal-50 hover:text-royal-600"
            aria-label={`Voir la fiche de ${student.firstName} ${student.lastName}`}
            title="Voir la fiche"
          >
            <Eye size={15} />
          </button>
          {canManage ? (
            <>
              <button
                type="button"
                onClick={() => setTransferring(student)}
                className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-royal-600"
                aria-label="Changer de classe"
                title="Changer de classe"
              >
                <ArrowRightLeft size={15} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(student);
                  setFormOpen(true);
                }}
                className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Modifier"
                title="Modifier"
              >
                <Pencil size={15} />
              </button>
              <button
                type="button"
                onClick={() => void handleDelete(student)}
                className="rounded-md p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                aria-label="Supprimer"
                title="Supprimer"
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
        eyebrow="Scolarité"
        title="Élèves"
        subtitle="Gérez les inscriptions, les dossiers et les affectations de classe."
        actions={
          <>
            <Button variant="outline" icon={<Download size={15} />} onClick={handleExport}>
              Exporter
            </Button>
            {canManage ? (
              <>
                <Button variant="outline" icon={<Upload size={15} />} onClick={() => setImportOpen(true)}>
                  Importer
                </Button>
                <Button
                  icon={<Plus size={15} />}
                  onClick={() => {
                    setEditing(null);
                    setFormOpen(true);
                  }}
                >
                  Nouvel élève
                </Button>
              </>
            ) : null}
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone="royal">
          <Users size={11} /> {students.length} dossiers
        </Badge>
        <Badge tone="success" dot>
          {activeCount} actifs
        </Badge>
        <Badge tone="teal">{girlsCount} filles</Badge>
        <Badge tone="neutral">{students.length - girlsCount} garçons</Badge>
        <Button
          variant="ghost"
          size="sm"
          icon={<RefreshCw size={13} className={loading ? 'animate-spin' : ''} />}
          onClick={refresh}
          className="ml-auto"
        >
          Actualiser
        </Button>
      </div>

      <Card>
        <CardBody className="border-b border-slate-100">
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Nom, matricule, parent, téléphone…"
              className="sm:col-span-2 lg:col-span-1"
            />
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
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StudentStatus | '')}
              aria-label="Filtrer par statut"
              className="h-9 rounded-md border border-line bg-white px-3 text-[13px] text-slate-600 focus:border-royal-400 focus:outline-none focus:ring-2 focus:ring-royal-100"
            >
              <option value="">Tous les statuts</option>
              {Object.entries(STUDENT_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              value={genderFilter}
              onChange={(event) => setGenderFilter(event.target.value as Gender | '')}
              aria-label="Filtrer par sexe"
              className="h-9 rounded-md border border-line bg-white px-3 text-[13px] text-slate-600 focus:border-royal-400 focus:outline-none focus:ring-2 focus:ring-royal-100"
            >
              <option value="">Tous les sexes</option>
              <option value="M">Masculin</option>
              <option value="F">Féminin</option>
            </select>
          </div>
        </CardBody>

        <DataTable
          columns={columns}
          data={paged}
          rowKey={(student) => student.id}
          loading={loading}
          onRowClick={(student) => navigate(`/students/${student.id}`)}
          emptyTitle="Aucun élève trouvé"
          emptyDescription={
            students.length === 0
              ? 'Commencez par inscrire un élève ou importez votre liste depuis Excel.'
              : 'Modifiez vos filtres pour retrouver un élève.'
          }
          footer={<Pagination page={page} pageSize={pageSize} total={filtered.length} onPageChange={setPage} onPageSizeChange={setPageSize} />}
        />
      </Card>

      <StudentFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        student={editing}
        classes={classes}
        onSaved={refresh}
      />
      <StudentImportModal open={importOpen} onClose={() => setImportOpen(false)} onImported={refresh} />
      <StudentTransferModal
        open={Boolean(transferring)}
        onClose={() => setTransferring(null)}
        student={transferring}
        classes={classes}
        onSaved={refresh}
      />
    </>
  );
}
