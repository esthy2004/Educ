import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Download, RefreshCw, Search, Wallet } from 'lucide-react';
import type { SchoolClass } from '@/types';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SearchInput } from '@/components/ui/SearchInput';
import { StatCard } from '@/components/ui/StatCard';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { useAuth } from '@/hooks/useAuth';
import { useDataVersion } from '@/hooks/useDataVersion';
import { useToast } from '@/hooks/useToast';
import { academicsService } from '@/services/academics.service';
import { invoicesService, type InvoiceRow } from '@/services/finance.service';
import { PaymentModal } from '@/modules/finance/PaymentModal';
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_TONES } from '@/config/labels';
import { exportToExcel } from '@/utils/excel';
import { formatCurrency, formatDate, normalize, percent, todayIso } from '@/utils/format';

export function DebtsPage() {
  const { can } = useAuth();
  const version = useDataVersion();
  const toast = useToast();

  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState<{ studentId: string; invoiceId: string } | null>(null);

  const canManage = can('finance.manage');
  const today = todayIso();

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([invoicesService.openInvoices(), academicsService.listClasses()])
      .then(([invoiceRows, classList]) => {
        if (!active) return;
        setRows(invoiceRows);
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
      rows
        .filter((row) => {
          if (classFilter && row.student?.classId !== classFilter) return false;
          if (overdueOnly && row.invoice.dueDate >= today) return false;
          if (search) {
            const haystack = normalize(`${row.studentName} ${row.student?.matricule ?? ''} ${row.invoice.label}`);
            if (!haystack.includes(normalize(search))) return false;
          }
          return true;
        })
        .sort((a, b) => a.invoice.dueDate.localeCompare(b.invoice.dueDate)),
    [rows, classFilter, overdueOnly, search, today],
  );

  const totalDue = rows.reduce((sum, row) => sum + row.balance, 0);
  const overdueRows = rows.filter((row) => row.invoice.dueDate < today);
  const overdueTotal = overdueRows.reduce((sum, row) => sum + row.balance, 0);
  const invoicedTotal = rows.reduce((sum, row) => sum + row.invoice.amount, 0);
  const recoveryRate = percent(invoicedTotal - totalDue, invoicedTotal);

  const handleExport = () => {
    if (filtered.length === 0) {
      toast.error('Aucune dette à exporter.');
      return;
    }
    exportToExcel(
      filtered.map((row) => ({
        Élève: row.studentName,
        Matricule: row.student?.matricule ?? '',
        Classe: row.className,
        Facture: row.invoice.label,
        Échéance: formatDate(row.invoice.dueDate),
        'Montant facturé': row.invoice.amount,
        Payé: row.paid,
        Solde: row.balance,
        Statut: INVOICE_STATUS_LABELS[row.status],
        Parent: row.student?.parentName ?? '',
        Téléphone: row.student?.parentPhone ?? '',
      })),
      'dettes-eduflow.xlsx',
      'Dettes',
    );
    toast.success(`${filtered.length} dette(s) exportée(s).`);
  };

  const columns: Array<Column<InvoiceRow>> = [
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
      key: 'contact',
      header: 'Parent / tuteur',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-xs text-slate-600">{row.student?.parentName || '—'}</p>
          <p className="text-[11px] text-slate-400">{row.student?.parentPhone || '—'}</p>
        </div>
      ),
    },
    {
      key: 'invoice',
      header: 'Facture',
      render: (row) => <span className="text-xs text-slate-600">{row.invoice.label}</span>,
    },
    {
      key: 'dueDate',
      header: 'Échéance',
      render: (row) => (
        <span className={row.invoice.dueDate < today ? 'text-xs font-semibold text-rose-600' : 'text-xs text-slate-500'}>
          {formatDate(row.invoice.dueDate)}
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'Facturé',
      align: 'right',
      render: (row) => <span className="text-sm text-slate-600">{formatCurrency(row.invoice.amount)}</span>,
    },
    {
      key: 'paid',
      header: 'Payé',
      align: 'right',
      render: (row) => <span className="text-sm text-emerald-600">{formatCurrency(row.paid)}</span>,
    },
    {
      key: 'balance',
      header: 'Reste dû',
      align: 'right',
      render: (row) => <span className="text-sm font-semibold text-rose-600">{formatCurrency(row.balance)}</span>,
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
        canManage ? (
          <Button
            size="sm"
            variant="outline"
            icon={<Wallet size={13} />}
            onClick={() => setPaymentTarget({ studentId: row.student?.id ?? row.invoice.studentId, invoiceId: row.invoice.id })}
          >
            Encaisser
          </Button>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Finances"
        title="Dettes"
        subtitle="Factures impayées ou partiellement réglées, classées par échéance."
        actions={
          <>
            <Link
              to="/finance"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Toutes les factures
            </Link>
            <Button variant="outline" icon={<Download size={15} />} onClick={handleExport}>
              Exporter
            </Button>
          </>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total restant dû" value={formatCurrency(totalDue)} icon={<Wallet size={18} />} tone="rose" />
        <StatCard
          label="Dont en retard"
          value={formatCurrency(overdueTotal)}
          hint={`${overdueRows.length} facture(s)`}
          icon={<AlertTriangle size={18} />}
          tone="amber"
        />
        <StatCard label="Factures ouvertes" value={String(rows.length)} icon={<Search size={18} />} tone="royal" />
        <StatCard label="Taux de recouvrement" value={`${recoveryRate} %`} icon={<Wallet size={18} />} tone="emerald" />
      </div>

      <Card>
        <CardBody className="grid gap-2.5 border-b border-slate-100 sm:grid-cols-2 lg:grid-cols-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Élève, matricule, facture…" />
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
          <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={overdueOnly}
              onChange={(event) => setOverdueOnly(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-royal-600 focus:ring-royal-500"
            />
            En retard uniquement
          </label>
          <Button
            variant="outline"
            icon={<RefreshCw size={15} className={loading ? 'animate-spin' : ''} />}
            onClick={() => {
              setSearch('');
              setClassFilter('');
              setOverdueOnly(false);
            }}
          >
            Réinitialiser
          </Button>
        </CardBody>
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
          <p className="text-[11px] text-slate-400">
            {filtered.length} facture(s) · {formatCurrency(filtered.reduce((sum, row) => sum + row.balance, 0))} à recouvrer
          </p>
          <Badge tone="danger">Relances recommandées pour les échéances dépassées</Badge>
        </div>
        <DataTable
          columns={columns}
          data={filtered}
          rowKey={(row) => row.invoice.id}
          loading={loading}
          emptyTitle="Aucune dette"
          emptyDescription="Toutes les factures sont réglées pour les filtres sélectionnés."
        />
      </Card>

      <PaymentModal
        open={Boolean(paymentTarget)}
        onClose={() => setPaymentTarget(null)}
        onSaved={() => setPaymentTarget(null)}
        studentId={paymentTarget?.studentId}
        invoiceId={paymentTarget?.invoiceId}
      />
    </>
  );
}
