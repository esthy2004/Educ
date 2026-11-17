import { useEffect, useMemo, useState } from 'react';
import {
  Calculator,
  Download,
  Pencil,
  Plus,
  Receipt,
  RefreshCw,
  Trash2,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import type { AcademicYear, FeeStructure, Level, SchoolClass } from '@/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Select } from '@/components/ui/Input';
import { SearchInput } from '@/components/ui/SearchInput';
import { StatCard } from '@/components/ui/StatCard';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { useAuth } from '@/hooks/useAuth';
import { useConfirm } from '@/hooks/useConfirm';
import { useDataVersion } from '@/hooks/useDataVersion';
import { useToast } from '@/hooks/useToast';
import { academicsService } from '@/services/academics.service';
import { feesService, invoicesService, type InvoiceRow } from '@/services/finance.service';
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_TONES } from '@/config/labels';
import { exportToExcel } from '@/utils/excel';
import { formatCurrency, formatDate, normalize } from '@/utils/format';

interface FeeForm {
  levelId: string;
  academicYearId: string;
  label: string;
  amount: string;
  dueDate: string;
}

export function FinancePage() {
  const { can } = useAuth();
  const version = useDataVersion();
  const toast = useToast();
  const confirm = useConfirm();

  const [years, setYears] = useState<AcademicYear[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [fees, setFees] = useState<FeeStructure[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceRow['status'] | ''>('');
  const [classFilter, setClassFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FeeStructure | null>(null);
  const [form, setForm] = useState<FeeForm>({
    levelId: '',
    academicYearId: '',
    label: '',
    amount: '',
    dueDate: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FeeForm, string>>>({});
  const [saving, setSaving] = useState(false);

  const canManage = can('finance.manage');

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      academicsService.listYears(),
      academicsService.overview(),
      feesService.list(),
      invoicesService.list(),
    ]).then(([yearList, overview, feeList, invoiceList]) => {
      if (!active) return;
      setYears(yearList);
      setLevels(overview.levels);
      setClasses(overview.classes);
      setFees(feeList);
      setInvoices(invoiceList);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [version]);

  const activeYear = years.find((year) => year.isActive) ?? years[0] ?? null;
  const levelNames = useMemo(() => new Map(levels.map((level) => [level.id, level.name])), [levels]);
  const yearNames = useMemo(() => new Map(years.map((year) => [year.id, year.name])), [years]);

  const totals = useMemo(() => {
    const invoiced = invoices.reduce((sum, row) => sum + row.invoice.amount, 0);
    const paid = invoices.reduce((sum, row) => sum + row.paid, 0);
    const balance = invoices.reduce((sum, row) => sum + row.balance, 0);
    return { invoiced, paid, balance };
  }, [invoices]);

  const filteredInvoices = useMemo(
    () =>
      invoices.filter((row) => {
        if (statusFilter && row.status !== statusFilter) return false;
        if (classFilter && row.student?.classId !== classFilter) return false;
        if (search) {
          const haystack = normalize(`${row.studentName} ${row.student?.matricule ?? ''} ${row.invoice.label}`);
          if (!haystack.includes(normalize(search))) return false;
        }
        return true;
      }),
    [invoices, statusFilter, classFilter, search],
  );

  const openCreate = () => {
    setEditing(null);
    setErrors({});
    setForm({
      levelId: levels[0]?.id ?? '',
      academicYearId: activeYear?.id ?? '',
      label: '',
      amount: '',
      dueDate: '',
    });
    setModalOpen(true);
  };

  const openEdit = (fee: FeeStructure) => {
    setEditing(fee);
    setErrors({});
    setForm({
      levelId: fee.levelId,
      academicYearId: fee.academicYearId,
      label: fee.label,
      amount: String(fee.amount),
      dueDate: fee.dueDate,
    });
    setModalOpen(true);
  };

  const handleSaveFee = async () => {
    const next: Partial<Record<keyof FeeForm, string>> = {};
    if (!form.levelId) next.levelId = 'Sélectionnez un niveau.';
    if (!form.academicYearId) next.academicYearId = 'Sélectionnez une année scolaire.';
    if (!form.label.trim()) next.label = 'Le libellé est obligatoire.';
    if (!form.amount || Number(form.amount) <= 0) next.amount = 'Saisissez un montant valide.';
    if (!form.dueDate) next.dueDate = 'La date d’échéance est obligatoire.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      const payload = {
        levelId: form.levelId,
        academicYearId: form.academicYearId,
        label: form.label.trim(),
        amount: Number(form.amount),
        dueDate: form.dueDate,
      };
      if (editing) {
        await feesService.update(editing.id, payload);
        toast.success('Frais mis à jour.');
      } else {
        await feesService.create(payload);
        toast.success('Nouveau frais enregistré.');
      }
      setModalOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFee = async (fee: FeeStructure) => {
    const confirmed = await confirm({
      title: 'Supprimer ce frais ?',
      message: `« ${fee.label} » (${formatCurrency(fee.amount)}) sera retiré de la grille tarifaire. Les factures déjà générées ne sont pas modifiées.`,
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!confirmed) return;
    try {
      await feesService.remove(fee.id);
      toast.success('Frais supprimé.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Suppression impossible.');
    }
  };

  const handleGenerate = async () => {
    if (!activeYear) {
      toast.error('Aucune année scolaire active.');
      return;
    }
    const confirmed = await confirm({
      title: 'Générer la facturation ?',
      message: `Les factures manquantes seront créées pour tous les élèves actifs sur l’année ${activeYear.name}, à partir de la grille tarifaire.`,
      confirmLabel: 'Générer',
    });
    if (!confirmed) return;
    setGenerating(true);
    try {
      const created = await feesService.generateInvoices(activeYear.id);
      toast.success(created > 0 ? `${created} facture(s) créée(s).` : 'Aucune nouvelle facture à générer.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Génération impossible.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteInvoice = async (row: InvoiceRow) => {
    const confirmed = await confirm({
      title: 'Supprimer la facture ?',
      message: `La facture « ${row.invoice.label} » de ${row.studentName} sera supprimée. Une facture déjà réglée ne peut pas être supprimée.`,
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!confirmed) return;
    try {
      await invoicesService.remove(row.invoice.id);
      toast.success('Facture supprimée.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Suppression impossible.');
    }
  };

  const handleExport = () => {
    if (filteredInvoices.length === 0) {
      toast.error('Aucune facture à exporter.');
      return;
    }
    exportToExcel(
      filteredInvoices.map((row) => ({
        Élève: row.studentName,
        Matricule: row.student?.matricule ?? '',
        Classe: row.className,
        Libellé: row.invoice.label,
        'Montant facturé': row.invoice.amount,
        Payé: row.paid,
        Solde: row.balance,
        Échéance: formatDate(row.invoice.dueDate),
        Statut: INVOICE_STATUS_LABELS[row.status],
      })),
      'factures-eduflow.xlsx',
      'Factures',
    );
    toast.success(`${filteredInvoices.length} facture(s) exportée(s).`);
  };

  const feeColumns: Array<Column<FeeStructure>> = [
    {
      key: 'label',
      header: 'Frais',
      render: (fee) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-800">{fee.label}</p>
          <p className="text-[11px] text-slate-400">{yearNames.get(fee.academicYearId) ?? '—'}</p>
        </div>
      ),
    },
    {
      key: 'level',
      header: 'Niveau',
      render: (fee) => <Badge tone="royal">{levelNames.get(fee.levelId) ?? '—'}</Badge>,
    },
    {
      key: 'amount',
      header: 'Montant',
      align: 'right',
      render: (fee) => <span className="text-sm font-semibold text-slate-700">{formatCurrency(fee.amount)}</span>,
    },
    {
      key: 'dueDate',
      header: 'Échéance',
      render: (fee) => <span className="text-xs text-slate-500">{formatDate(fee.dueDate)}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (fee) => (
        <div className="flex items-center justify-end gap-1">
          {canManage ? (
            <>
              <button
                type="button"
                onClick={() => openEdit(fee)}
                className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Modifier le frais"
                title="Modifier"
              >
                <Pencil size={15} />
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteFee(fee)}
                className="rounded-md p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                aria-label="Supprimer le frais"
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

  const invoiceColumns: Array<Column<InvoiceRow>> = [
    {
      key: 'student',
      header: 'Élève',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-800">{row.studentName}</p>
          <p className="text-[11px] text-slate-400">
            {row.student?.matricule ?? '—'} · {row.className}
          </p>
        </div>
      ),
    },
    {
      key: 'label',
      header: 'Libellé',
      render: (row) => <span className="text-xs text-slate-600">{row.invoice.label}</span>,
    },
    {
      key: 'dueDate',
      header: 'Échéance',
      render: (row) => <span className="text-xs text-slate-500">{formatDate(row.invoice.dueDate)}</span>,
    },
    {
      key: 'amount',
      header: 'Montant',
      align: 'right',
      render: (row) => <span className="text-sm text-slate-700">{formatCurrency(row.invoice.amount)}</span>,
    },
    {
      key: 'paid',
      header: 'Payé',
      align: 'right',
      render: (row) => <span className="text-sm text-emerald-600">{formatCurrency(row.paid)}</span>,
    },
    {
      key: 'balance',
      header: 'Solde',
      align: 'right',
      render: (row) => (
        <span className={row.balance > 0 ? 'text-sm font-semibold text-rose-600' : 'text-sm text-slate-400'}>
          {formatCurrency(row.balance)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Statut',
      render: (row) => (
        <Badge tone={INVOICE_STATUS_TONES[row.status]} dot>
          {INVOICE_STATUS_LABELS[row.status]}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) =>
        canManage && row.paid === 0 ? (
          <button
            type="button"
            onClick={() => void handleDeleteInvoice(row)}
            className="rounded-md p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
            aria-label="Supprimer la facture"
            title="Supprimer"
          >
            <Trash2 size={15} />
          </button>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Finances"
        title="Frais & factures"
        subtitle="Définissez la grille tarifaire par niveau et générez les factures de l’année scolaire."
        actions={
          <>
            <Button
              variant="outline"
              icon={<Download size={15} />}
              onClick={handleExport}
            >
              Exporter
            </Button>
            {canManage ? (
              <>
                <Button
                  variant="outline"
                  icon={<Calculator size={15} />}
                  loading={generating}
                  onClick={() => void handleGenerate()}
                >
                  Générer la facturation
                </Button>
                <Button icon={<Plus size={15} />} onClick={openCreate}>
                  Nouveau frais
                </Button>
              </>
            ) : null}
          </>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total facturé" value={formatCurrency(totals.invoiced)} icon={<Receipt size={18} />} tone="royal" />
        <StatCard label="Encaissé" value={formatCurrency(totals.paid)} icon={<TrendingUp size={18} />} tone="emerald" />
        <StatCard label="Impayés" value={formatCurrency(totals.balance)} icon={<Wallet size={18} />} tone="rose" />
        <StatCard
          label="Factures"
          value={String(invoices.length)}
          hint={activeYear ? `Année ${activeYear.name}` : 'Aucune année active'}
          icon={<Receipt size={18} />}
          tone="teal"
        />
      </div>

      <div className="space-y-5">
        <Card>
          <CardHeader
            title="Grille tarifaire"
            subtitle="Frais d’inscription et tranches de scolarité par niveau."
            action={<Badge tone="neutral">{fees.length} frais</Badge>}
          />
          <DataTable
            columns={feeColumns}
            data={fees}
            rowKey={(fee) => fee.id}
            loading={loading}
            compact
            emptyTitle="Aucun frais défini"
            emptyDescription="Ajoutez des frais pour permettre la génération des factures."
          />
        </Card>

        <Card>
          <CardHeader
            title="Factures des élèves"
            subtitle="Suivi des montants facturés, payés et restant dus."
            action={<Badge tone="royal">{filteredInvoices.length} facture(s)</Badge>}
          />
          <CardBody className="grid gap-2.5 border-b border-slate-100 sm:grid-cols-2 lg:grid-cols-4">
            <SearchInput value={search} onChange={setSearch} placeholder="Élève, matricule, libellé…" />
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
              onChange={(event) => setStatusFilter(event.target.value as InvoiceRow['status'] | '')}
              aria-label="Filtrer par statut"
              className="h-9 rounded-md border border-line bg-white px-3 text-[13px] text-slate-600 focus:border-royal-400 focus:outline-none focus:ring-2 focus:ring-royal-100"
            >
              <option value="">Tous les statuts</option>
              {Object.entries(INVOICE_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              icon={<RefreshCw size={15} className={loading ? 'animate-spin' : ''} />}
              onClick={() => {
                setSearch('');
                setClassFilter('');
                setStatusFilter('');
              }}
            >
              Réinitialiser
            </Button>
          </CardBody>
          <DataTable
            columns={invoiceColumns}
            data={filteredInvoices}
            rowKey={(row) => row.invoice.id}
            loading={loading}
            emptyTitle="Aucune facture"
            emptyDescription="Générez la facturation pour créer les factures des élèves actifs."
          />
        </Card>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Modifier le frais' : 'Nouveau frais'}
        description="Montant appliqué à chaque élève du niveau lors de la facturation."
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Annuler
            </Button>
            <Button loading={saving} onClick={() => void handleSaveFee()}>
              Enregistrer
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Niveau"
            required
            value={form.levelId}
            error={errors.levelId}
            onChange={(event) => setForm((current) => ({ ...current, levelId: event.target.value }))}
          >
            <option value="">Sélectionner un niveau</option>
            {levels.map((level) => (
              <option key={level.id} value={level.id}>
                {level.name}
              </option>
            ))}
          </Select>
          <Select
            label="Année scolaire"
            required
            value={form.academicYearId}
            error={errors.academicYearId}
            onChange={(event) => setForm((current) => ({ ...current, academicYearId: event.target.value }))}
          >
            <option value="">Sélectionner une année</option>
            {years.map((year) => (
              <option key={year.id} value={year.id}>
                {year.name}
                {year.isActive ? ' (active)' : ''}
              </option>
            ))}
          </Select>
          <Input
            label="Libellé"
            required
            fieldClassName="sm:col-span-2"
            value={form.label}
            error={errors.label}
            onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
            placeholder="Ex. Scolarité — 1ère tranche"
          />
          <Input
            label="Montant (FCFA)"
            type="number"
            min={0}
            required
            value={form.amount}
            error={errors.amount}
            onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
          />
          <Input
            label="Date d’échéance"
            type="date"
            required
            value={form.dueDate}
            error={errors.dueDate}
            onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))}
          />
        </div>
      </Modal>
    </>
  );
}
