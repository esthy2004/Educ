import { useEffect, useMemo, useState } from 'react';
import { Download, Plus, Receipt, RefreshCw, Trash2, TrendingUp, Wallet } from 'lucide-react';
import type { PaymentMethod, SchoolClass } from '@/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { SearchInput } from '@/components/ui/SearchInput';
import { StatCard } from '@/components/ui/StatCard';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { useAuth } from '@/hooks/useAuth';
import { useConfirm } from '@/hooks/useConfirm';
import { useDataVersion } from '@/hooks/useDataVersion';
import { useToast } from '@/hooks/useToast';
import { academicsService } from '@/services/academics.service';
import { paymentsService, type PaymentRow } from '@/services/finance.service';
import { PaymentModal } from '@/modules/finance/PaymentModal';
import { PAYMENT_METHOD_LABELS } from '@/config/labels';
import { exportToExcel } from '@/utils/excel';
import { formatCurrency, formatDate, normalize, todayIso } from '@/utils/format';

const METHODS: PaymentMethod[] = ['espece', 'mobile', 'virement', 'cheque'];

export function PaymentsPage() {
  const { can } = useAuth();
  const version = useDataVersion();
  const toast = useToast();
  const confirm = useConfirm();

  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState<PaymentMethod | ''>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const canManage = can('finance.manage');

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([paymentsService.list(), academicsService.listClasses()])
      .then(([payments, classList]) => {
        if (!active) return;
        setRows(payments);
        setClasses(classList);
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
      rows.filter((row) => {
        if (methodFilter && row.method !== methodFilter) return false;
        if (classFilter && row.className !== classes.find((item) => item.id === classFilter)?.name) return false;
        if (from && row.date < from) return false;
        if (to && row.date > to) return false;
        if (search) {
          const haystack = normalize(`${row.studentName} ${row.matricule} ${row.receiptNumber} ${row.invoiceLabel}`);
          if (!haystack.includes(normalize(search))) return false;
        }
        return true;
      }),
    [rows, methodFilter, classFilter, from, to, search, classes],
  );

  const filteredTotal = filtered.reduce((sum, row) => sum + row.amount, 0);
  const today = todayIso();
  const todayTotal = rows.filter((row) => row.date === today).reduce((sum, row) => sum + row.amount, 0);
  const totalAll = rows.reduce((sum, row) => sum + row.amount, 0);

  const handleDelete = async (row: PaymentRow) => {
    const confirmed = await confirm({
      title: 'Annuler ce paiement ?',
      message: `Le paiement de ${formatCurrency(row.amount)} encaissé pour ${row.studentName} (reçu ${row.receiptNumber}) sera supprimé et la facture redeviendra due.`,
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!confirmed) return;
    try {
      await paymentsService.remove(row.id);
      toast.success('Paiement supprimé.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Suppression impossible.');
    }
  };

  const handleExport = () => {
    if (filtered.length === 0) {
      toast.error('Aucun paiement à exporter.');
      return;
    }
    exportToExcel(
      filtered.map((row) => ({
        Reçu: row.receiptNumber,
        Élève: row.studentName,
        Matricule: row.matricule,
        Classe: row.className,
        Facture: row.invoiceLabel,
        Montant: row.amount,
        'Mode de paiement': PAYMENT_METHOD_LABELS[row.method],
        Date: formatDate(row.date),
        Encaissé_par: row.recordedBy,
        Note: row.note,
      })),
      'paiements-eduflow.xlsx',
      'Paiements',
    );
    toast.success(`${filtered.length} paiement(s) exporté(s).`);
  };

  const columns: Array<Column<PaymentRow>> = [
    {
      key: 'receipt',
      header: 'Reçu',
      render: (row) => (
        <span className="font-mono text-[11px] font-semibold text-royal-700">{row.receiptNumber}</span>
      ),
    },
    {
      key: 'student',
      header: 'Élève',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-800">{row.studentName}</p>
          <p className="text-[11px] text-slate-400">
            {row.matricule} · {row.className}
          </p>
        </div>
      ),
    },
    {
      key: 'invoice',
      header: 'Facture',
      render: (row) => <span className="text-xs text-slate-600">{row.invoiceLabel}</span>,
    },
    {
      key: 'amount',
      header: 'Montant',
      align: 'right',
      render: (row) => <span className="text-sm font-semibold text-emerald-600">{formatCurrency(row.amount)}</span>,
    },
    {
      key: 'method',
      header: 'Mode',
      render: (row) => <Badge tone="neutral">{PAYMENT_METHOD_LABELS[row.method]}</Badge>,
    },
    {
      key: 'date',
      header: 'Date',
      render: (row) => <span className="text-xs text-slate-500">{formatDate(row.date)}</span>,
    },
    {
      key: 'recordedBy',
      header: 'Encaissé par',
      render: (row) => <span className="text-xs text-slate-500">{row.recordedBy}</span>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) =>
        canManage ? (
          <button
            type="button"
            onClick={() => void handleDelete(row)}
            className="rounded-md p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
            aria-label="Supprimer le paiement"
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
        title="Paiements"
        subtitle="Encaissez les versements, générez les reçus et suivez les modes de règlement."
        actions={
          <>
            <Button variant="outline" icon={<Download size={15} />} onClick={handleExport}>
              Exporter
            </Button>
            {canManage ? (
              <Button icon={<Plus size={15} />} onClick={() => setModalOpen(true)}>
                Encaisser un paiement
              </Button>
            ) : null}
          </>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Encaissé aujourd’hui" value={formatCurrency(todayTotal)} icon={<Wallet size={18} />} tone="emerald" />
        <StatCard label="Total des recettes" value={formatCurrency(totalAll)} icon={<TrendingUp size={18} />} tone="royal" />
        <StatCard label="Paiements affichés" value={formatCurrency(filteredTotal)} icon={<Receipt size={18} />} tone="teal" />
        <StatCard label="Nombre de reçus" value={String(filtered.length)} icon={<Receipt size={18} />} tone="violet" />
      </div>

      <Card>
        <CardBody className="grid gap-2.5 border-b border-slate-100 sm:grid-cols-2 lg:grid-cols-6">
          <SearchInput value={search} onChange={setSearch} placeholder="Élève, reçu, facture…" className="lg:col-span-2" />
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
            value={methodFilter}
            onChange={(event) => setMethodFilter(event.target.value as PaymentMethod | '')}
            aria-label="Filtrer par mode de paiement"
            className="h-9 rounded-md border border-line bg-white px-3 text-[13px] text-slate-600 focus:border-royal-400 focus:outline-none focus:ring-2 focus:ring-royal-100"
          >
            <option value="">Tous les modes</option>
            {METHODS.map((method) => (
              <option key={method} value={method}>
                {PAYMENT_METHOD_LABELS[method]}
              </option>
            ))}
          </select>
          <Input type="date" aria-label="Date de début" value={from} onChange={(event) => setFrom(event.target.value)} />
          <Input type="date" aria-label="Date de fin" value={to} onChange={(event) => setTo(event.target.value)} />
        </CardBody>
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
          <p className="text-[11px] text-slate-400">
            {filtered.length} paiement(s) · total affiché {formatCurrency(filteredTotal)}
          </p>
          <Button
            variant="ghost"
            size="sm"
            icon={<RefreshCw size={13} className={loading ? 'animate-spin' : ''} />}
            onClick={() => {
              setSearch('');
              setClassFilter('');
              setMethodFilter('');
              setFrom('');
              setTo('');
            }}
          >
            Réinitialiser
          </Button>
        </div>
        <DataTable
          columns={columns}
          data={filtered}
          rowKey={(row) => row.id}
          loading={loading}
          emptyTitle="Aucun paiement"
          emptyDescription="Aucun encaissement ne correspond aux filtres sélectionnés."
        />
      </Card>

      <PaymentModal open={modalOpen} onClose={() => setModalOpen(false)} onSaved={() => undefined} />
    </>
  );
}
