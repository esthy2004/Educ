import { useEffect, useMemo, useState } from 'react';
import { Download, Pencil, Plus, RefreshCw, TrendingDown, Trash2, Wallet } from 'lucide-react';
import type { Expense, PaymentMethod } from '@/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { SearchInput } from '@/components/ui/SearchInput';
import { StatCard } from '@/components/ui/StatCard';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { useAuth } from '@/hooks/useAuth';
import { useConfirm } from '@/hooks/useConfirm';
import { useDataVersion } from '@/hooks/useDataVersion';
import { useToast } from '@/hooks/useToast';
import { expensesService } from '@/services/finance.service';
import { PAYMENT_METHOD_LABELS } from '@/config/labels';
import { exportToExcel } from '@/utils/excel';
import { formatCurrency, formatDate, normalize, percent, todayIso } from '@/utils/format';

interface ExpenseForm {
  label: string;
  category: string;
  amount: string;
  date: string;
  method: PaymentMethod;
  note: string;
}

const emptyForm: ExpenseForm = {
  label: '',
  category: '',
  amount: '',
  date: todayIso(),
  method: 'espece',
  note: '',
};

const METHODS: PaymentMethod[] = ['espece', 'mobile', 'virement', 'cheque'];
const CATEGORIES = ['Salaires', 'Fournitures', 'Énergie', 'Maintenance', 'Entretien', 'Cantine', 'Transport', 'Communication', 'Pédagogie', 'Sécurité', 'Autre'];

export function ExpensesPage() {
  const { can } = useAuth();
  const version = useDataVersion();
  const toast = useToast();
  const confirm = useConfirm();

  const [rows, setRows] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState<ExpenseForm>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof ExpenseForm, string>>>({});
  const [saving, setSaving] = useState(false);

  const canManage = can('finance.manage');

  useEffect(() => {
    let active = true;
    setLoading(true);
    expensesService
      .list()
      .then((list) => {
        if (active) setRows(list);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [version]);

  const filtered = useMemo(
    () =>
      rows.filter((expense) => {
        if (categoryFilter && expense.category !== categoryFilter) return false;
        if (from && expense.date < from) return false;
        if (to && expense.date > to) return false;
        if (search) {
          if (!normalize(`${expense.label} ${expense.category}`).includes(normalize(search))) return false;
        }
        return true;
      }),
    [rows, categoryFilter, from, to, search],
  );

  const filteredTotal = filtered.reduce((sum, expense) => sum + expense.amount, 0);
  const totalAll = rows.reduce((sum, expense) => sum + expense.amount, 0);
  const biggestCategory = useMemo(() => {
    const totals = new Map<string, number>();
    rows.forEach((expense) => totals.set(expense.category, (totals.get(expense.category) ?? 0) + expense.amount));
    const entry = [...totals.entries()].sort((a, b) => b[1] - a[1])[0];
    return entry ? { name: entry[0], amount: entry[1] } : null;
  }, [rows]);

  const openCreate = () => {
    setEditing(null);
    setErrors({});
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (expense: Expense) => {
    setEditing(expense);
    setErrors({});
    setForm({
      label: expense.label,
      category: expense.category,
      amount: String(expense.amount),
      date: expense.date,
      method: expense.method,
      note: expense.note,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    const next: Partial<Record<keyof ExpenseForm, string>> = {};
    if (!form.label.trim()) next.label = 'Le libellé est obligatoire.';
    if (!form.category.trim()) next.category = 'La catégorie est obligatoire.';
    if (!form.amount || Number(form.amount) <= 0) next.amount = 'Saisissez un montant valide.';
    if (!form.date) next.date = 'La date est obligatoire.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      const payload = {
        label: form.label.trim(),
        category: form.category.trim(),
        amount: Number(form.amount),
        date: form.date,
        method: form.method,
        note: form.note.trim(),
      };
      if (editing) {
        await expensesService.update(editing.id, payload);
        toast.success('Dépense mise à jour.');
      } else {
        await expensesService.create(payload, 'Comptabilité');
        toast.success('Dépense enregistrée.');
      }
      setModalOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (expense: Expense) => {
    const confirmed = await confirm({
      title: 'Supprimer la dépense ?',
      message: `« ${expense.label} » (${formatCurrency(expense.amount)}) sera définitivement supprimée.`,
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!confirmed) return;
    try {
      await expensesService.remove(expense.id);
      toast.success('Dépense supprimée.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Suppression impossible.');
    }
  };

  const handleExport = () => {
    if (filtered.length === 0) {
      toast.error('Aucune dépense à exporter.');
      return;
    }
    exportToExcel(
      filtered.map((expense) => ({
        Libellé: expense.label,
        Catégorie: expense.category,
        Montant: expense.amount,
        Date: formatDate(expense.date),
        'Mode de paiement': PAYMENT_METHOD_LABELS[expense.method],
        Enregistré_par: expense.recordedBy,
        Note: expense.note,
      })),
      'depenses-eduflow.xlsx',
      'Dépenses',
    );
    toast.success(`${filtered.length} dépense(s) exportée(s).`);
  };

  const columns: Array<Column<Expense>> = [
    {
      key: 'label',
      header: 'Dépense',
      render: (expense) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-800">{expense.label}</p>
          <p className="text-[11px] text-slate-400">{expense.recordedBy || '—'}</p>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Catégorie',
      render: (expense) => <Badge tone="neutral">{expense.category}</Badge>,
    },
    {
      key: 'date',
      header: 'Date',
      render: (expense) => <span className="text-xs text-slate-500">{formatDate(expense.date)}</span>,
    },
    {
      key: 'method',
      header: 'Mode',
      render: (expense) => <span className="text-xs text-slate-500">{PAYMENT_METHOD_LABELS[expense.method]}</span>,
    },
    {
      key: 'amount',
      header: 'Montant',
      align: 'right',
      render: (expense) => <span className="text-sm font-semibold text-rose-600">{formatCurrency(expense.amount)}</span>,
    },
    {
      key: 'note',
      header: 'Note',
      render: (expense) => <span className="text-xs text-slate-500">{expense.note || '—'}</span>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (expense) =>
        canManage ? (
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={() => openEdit(expense)}
              className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Modifier la dépense"
              title="Modifier"
            >
              <Pencil size={15} />
            </button>
            <button
              type="button"
              onClick={() => void handleDelete(expense)}
              className="rounded-md p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
              aria-label="Supprimer la dépense"
              title="Supprimer"
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
        eyebrow="Finances"
        title="Dépenses"
        subtitle="Enregistrez les charges de l’établissement et suivez leur répartition."
        actions={
          <>
            <Button variant="outline" icon={<Download size={15} />} onClick={handleExport}>
              Exporter
            </Button>
            {canManage ? (
              <Button icon={<Plus size={15} />} onClick={openCreate}>
                Nouvelle dépense
              </Button>
            ) : null}
          </>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total des dépenses" value={formatCurrency(totalAll)} icon={<TrendingDown size={18} />} tone="rose" />
        <StatCard label="Dépenses affichées" value={formatCurrency(filteredTotal)} icon={<Wallet size={18} />} tone="amber" />
        <StatCard
          label="Premier poste"
          value={biggestCategory?.name ?? '—'}
          hint={biggestCategory ? formatCurrency(biggestCategory.amount) : undefined}
          icon={<Wallet size={18} />}
          tone="violet"
        />
        <StatCard
          label="Part dans le total"
          value={`${percent(filteredTotal, totalAll)} %`}
          hint={`${filtered.length} écriture(s)`}
          icon={<Wallet size={18} />}
          tone="teal"
        />
      </div>

      <Card>
        <CardBody className="grid gap-2.5 border-b border-slate-100 sm:grid-cols-2 lg:grid-cols-5">
          <SearchInput value={search} onChange={setSearch} placeholder="Libellé ou catégorie…" className="lg:col-span-1" />
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            aria-label="Filtrer par catégorie"
            className="h-9 rounded-md border border-line bg-white px-3 text-[13px] text-slate-600 focus:border-royal-400 focus:outline-none focus:ring-2 focus:ring-royal-100"
          >
            <option value="">Toutes les catégories</option>
            {[...new Set(rows.map((expense) => expense.category))].sort().map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <Input type="date" aria-label="Date de début" value={from} onChange={(event) => setFrom(event.target.value)} />
          <Input type="date" aria-label="Date de fin" value={to} onChange={(event) => setTo(event.target.value)} />
          <Button
            variant="outline"
            icon={<RefreshCw size={15} className={loading ? 'animate-spin' : ''} />}
            onClick={() => {
              setSearch('');
              setCategoryFilter('');
              setFrom('');
              setTo('');
            }}
          >
            Réinitialiser
          </Button>
        </CardBody>
        <DataTable
          columns={columns}
          data={filtered}
          rowKey={(expense) => expense.id}
          loading={loading}
          emptyTitle="Aucune dépense"
          emptyDescription="Aucune dépense ne correspond aux filtres sélectionnés."
        />
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Modifier la dépense' : 'Nouvelle dépense'}
        description={editing ? `Saisie du ${formatDate(editing.date)}` : 'Charge ponctuelle ou récurrente de l’établissement.'}
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
          <Input
            label="Libellé"
            required
            fieldClassName="sm:col-span-2"
            value={form.label}
            error={errors.label}
            onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
            placeholder="Ex. Fournitures de bureau"
          />
          <Select
            label="Catégorie"
            required
            value={form.category}
            error={errors.category}
            onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
          >
            <option value="">Sélectionner une catégorie</option>
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </Select>
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
            label="Date"
            type="date"
            required
            value={form.date}
            error={errors.date}
            onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
          />
          <Select
            label="Mode de règlement"
            value={form.method}
            onChange={(event) => setForm((current) => ({ ...current, method: event.target.value as PaymentMethod }))}
          >
            {METHODS.map((method) => (
              <option key={method} value={method}>
                {PAYMENT_METHOD_LABELS[method]}
              </option>
            ))}
          </Select>
          <Textarea
            label="Note"
            fieldClassName="sm:col-span-2"
            value={form.note}
            onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
            placeholder="Justificatif, fournisseur, référence…"
          />
        </div>
      </Modal>
    </>
  );
}
