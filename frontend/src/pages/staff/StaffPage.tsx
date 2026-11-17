import { useEffect, useMemo, useState } from 'react';
import { Mail, Pencil, Phone, Plus, RefreshCw, Trash2, UserCog, Users } from 'lucide-react';
import type { SchoolClass, Staff, StaffRole, Subject } from '@/types';
import type { BadgeTone } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { SearchInput } from '@/components/ui/SearchInput';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { StatCard } from '@/components/ui/StatCard';
import { Pagination } from '@/components/ui/Pagination';
import { useAuth } from '@/hooks/useAuth';
import { useDataVersion } from '@/hooks/useDataVersion';
import { useConfirm } from '@/hooks/useConfirm';
import { useToast } from '@/hooks/useToast';
import { staffService } from '@/services/staff.service';
import { academicsService } from '@/services/academics.service';
import { StaffFormModal } from '@/modules/staff/StaffFormModal';
import { STAFF_ROLE_LABELS } from '@/config/labels';
import { formatCurrency, formatDate, formatNumber, normalize } from '@/utils/format';

const roleTones: Record<StaffRole, BadgeTone> = {
  teacher: 'royal',
  director: 'violet',
  secretary: 'teal',
  accountant: 'warning',
  supervisor: 'info',
  librarian: 'neutral',
  other: 'neutral',
};

export function StaffPage() {
  const { can } = useAuth();
  const confirm = useConfirm();
  const toast = useToast();
  const version = useDataVersion();
  const [members, setMembers] = useState<Staff[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<StaffRole | ''>('');
  const [statusFilter, setStatusFilter] = useState<'' | 'actif' | 'inactif'>('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);
  const canManage = can('staff.manage');

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([staffService.list(), academicsService.overview()])
      .then(([staffList, overview]) => {
        if (!active) return;
        setMembers(staffList.sort((a, b) => a.lastName.localeCompare(b.lastName)));
        setSubjects(overview.subjects);
        setClasses(overview.classes);
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
  }, [search, roleFilter, statusFilter, pageSize]);

  const filtered = useMemo(
    () =>
      members.filter((member) => {
        if (roleFilter && member.role !== roleFilter) return false;
        if (statusFilter && member.status !== statusFilter) return false;
        if (search) {
          const haystack = normalize(
            `${member.firstName} ${member.lastName} ${member.matricule} ${member.email} ${member.qualification}`,
          );
          if (!haystack.includes(normalize(search))) return false;
        }
        return true;
      }),
    [members, search, roleFilter, statusFilter],
  );

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  const teachers = members.filter((member) => member.role === 'teacher' && member.status === 'actif').length;
  const payroll = members.filter((member) => member.status === 'actif').reduce((sum, member) => sum + member.salary, 0);
  const refresh = () => setReloadKey((key) => key + 1);

  const subjectNames = (ids: string[]) =>
    ids
      .map((id) => subjects.find((subject) => subject.id === id)?.name)
      .filter(Boolean)
      .join(', ');

  const handleDelete = async (member: Staff) => {
    const confirmed = await confirm({
      title: 'Retirer ce membre ?',
      message: `${member.firstName} ${member.lastName} sera retiré(e) de l’équipe. Les classes dont il/elle était professeur principal seront réassignées.`,
      confirmLabel: 'Retirer',
      danger: true,
    });
    if (!confirmed) return;
    try {
      await staffService.remove(member.id);
      toast.success('Le membre a été retiré de l’équipe.');
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Suppression impossible.');
    }
  };

  const columns: Array<Column<Staff>> = [
    {
      key: 'name',
      header: 'Membre',
      render: (member) => (
        <div className="flex items-center gap-2.5">
          <Avatar firstName={member.firstName} lastName={member.lastName} />
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-800">
              {member.lastName} {member.firstName}
            </p>
            <p className="text-[11px] text-slate-400">{member.matricule}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Fonction',
      render: (member) => (
        <div className="space-y-1">
          <Badge tone={roleTones[member.role]}>{STAFF_ROLE_LABELS[member.role]}</Badge>
          {member.subjectIds.length > 0 ? (
            <p className="max-w-[180px] truncate text-[10px] text-slate-400">{subjectNames(member.subjectIds)}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      render: (member) => (
        <div className="space-y-0.5 text-[11px] text-slate-500">
          <p className="flex items-center gap-1">
            <Phone size={10} /> {member.phone}
          </p>
          <p className="flex items-center gap-1">
            <Mail size={10} /> {member.email}
          </p>
        </div>
      ),
    },
    {
      key: 'contract',
      header: 'Contrat',
      render: (member) => (
        <div>
          <p className="text-xs font-medium text-slate-600">{member.contractType}</p>
          <p className="text-[10px] text-slate-400">depuis le {formatDate(member.hireDate)}</p>
        </div>
      ),
    },
    {
      key: 'salary',
      header: 'Salaire',
      align: 'right',
      render: (member) => <span className="text-xs text-slate-600">{formatCurrency(member.salary)}</span>,
    },
    {
      key: 'status',
      header: 'Statut',
      align: 'center',
      render: (member) => (
        <Badge tone={member.status === 'actif' ? 'success' : 'neutral'} dot>
          {member.status === 'actif' ? 'Actif' : 'Inactif'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (member) =>
        canManage ? (
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={() => {
                setEditing(member);
                setFormOpen(true);
              }}
              className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Modifier"
            >
              <Pencil size={15} />
            </button>
            <button
              type="button"
              onClick={() => void handleDelete(member)}
              className="rounded-md p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
              aria-label="Retirer"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Scolarité"
        title="Personnel"
        subtitle="Enseignants, direction et personnel administratif de l’établissement."
        actions={
          <>
            <Button variant="outline" icon={<RefreshCw size={15} className={loading ? 'animate-spin' : ''} />} onClick={refresh}>
              Actualiser
            </Button>
            {canManage ? (
              <Button
                icon={<Plus size={15} />}
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                Ajouter un membre
              </Button>
            ) : null}
          </>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Effectif total" value={formatNumber(members.length)} hint="Membres enregistrés" icon={<UserCog size={18} />} tone="royal" />
        <StatCard label="Enseignants actifs" value={formatNumber(teachers)} hint="Toutes matières confondues" icon={<Users size={18} />} tone="emerald" />
        <StatCard label="Classes couvertes" value={formatNumber(classes.length)} hint="Année en cours" icon={<Users size={18} />} tone="violet" />
        <StatCard label="Masse salariale" value={formatCurrency(payroll)} hint="Mensuelle, personnel actif" icon={<UserCog size={18} />} tone="amber" />
      </div>

      <Card>
        <CardBody className="border-b border-slate-100">
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <SearchInput value={search} onChange={setSearch} placeholder="Nom, matricule, e-mail…" className="lg:col-span-2" />
            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value as StaffRole | '')}
              aria-label="Filtrer par fonction"
              className="h-9 rounded-md border border-line bg-white px-3 text-[13px] text-slate-600 focus:border-royal-400 focus:outline-none focus:ring-2 focus:ring-royal-100"
            >
              <option value="">Toutes les fonctions</option>
              {Object.entries(STAFF_ROLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as '' | 'actif' | 'inactif')}
              aria-label="Filtrer par statut"
              className="h-9 rounded-md border border-line bg-white px-3 text-[13px] text-slate-600 focus:border-royal-400 focus:outline-none focus:ring-2 focus:ring-royal-100"
            >
              <option value="">Tous les statuts</option>
              <option value="actif">Actif</option>
              <option value="inactif">Inactif</option>
            </select>
          </div>
        </CardBody>
        <DataTable
          columns={columns}
          data={paged}
          rowKey={(member) => member.id}
          loading={loading}
          emptyTitle="Aucun membre trouvé"
          emptyDescription="Modifiez vos filtres ou ajoutez un nouveau membre à l’équipe."
          footer={<Pagination page={page} pageSize={pageSize} total={filtered.length} onPageChange={setPage} onPageSizeChange={setPageSize} />}
        />
      </Card>

      <StaffFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        member={editing}
        subjects={subjects}
        classes={classes}
        onSaved={refresh}
      />
    </>
  );
}
