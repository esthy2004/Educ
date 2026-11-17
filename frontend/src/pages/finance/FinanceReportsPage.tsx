import { useEffect, useMemo, useState } from 'react';
import { Download, RefreshCw, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { StatCard } from '@/components/ui/StatCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { useDataVersion } from '@/hooks/useDataVersion';
import { useToast } from '@/hooks/useToast';
import { expensesService, invoicesService, paymentsService } from '@/services/finance.service';
import { exportToExcel } from '@/utils/excel';
import { monthlyFinanceSeries, revenueByMethod } from '@/utils/calculations';
import { formatCompactCurrency, formatCurrency, formatNumber, percent } from '@/utils/format';

const CHART_COLORS = ['#244b3c', '#527663', '#c69b57', '#648a9a'];

export function FinanceReportsPage() {
  const version = useDataVersion();
  const toast = useToast();
  const [payments, setPayments] = useState<Awaited<ReturnType<typeof paymentsService.list>>>([]);
  const [expenses, setExpenses] = useState<Awaited<ReturnType<typeof expensesService.list>>>([]);
  const [invoices, setInvoices] = useState<Awaited<ReturnType<typeof invoicesService.list>>>([]);
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState(12);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([paymentsService.list(), expensesService.list(), invoicesService.list()])
      .then(([paymentRows, expenseRows, invoiceRows]) => {
        if (!active) return;
        setPayments(paymentRows);
        setExpenses(expenseRows);
        setInvoices(invoiceRows);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [version, reloadKey]);

  const series = useMemo(() => monthlyFinanceSeries(payments, expenses, months), [payments, expenses, months]);
  const methodSplit = useMemo(() => revenueByMethod(payments), [payments]);

  const totals = useMemo(() => {
    const revenue = payments.reduce((sum, payment) => sum + payment.amount, 0);
    const spending = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const invoiced = invoices.reduce((sum, row) => sum + row.invoice.amount, 0);
    const collected = invoices.reduce((sum, row) => sum + row.paid, 0);
    return {
      revenue,
      spending,
      result: revenue - spending,
      invoiced,
      collected,
      outstanding: invoices.reduce((sum, row) => sum + row.balance, 0),
      collectionRate: percent(collected, invoiced),
    };
  }, [payments, expenses, invoices]);

  const handleExport = () => {
    if (series.length === 0) {
      toast.error('Aucune donnée à exporter.');
      return;
    }
    exportToExcel(
      series.map((month) => ({
        Mois: month.label,
        Recettes: month.recettes,
        Dépenses: month.depenses,
        Solde: month.solde,
      })),
      'rapport-financier-eduflow.xlsx',
      'Rapport',
    );
    toast.success('Rapport financier exporté.');
  };

  return (
    <>
      <PageHeader
        eyebrow="Finances"
        title="Rapports financiers"
        subtitle="Analyse des recettes, des dépenses et du recouvrement sur la période choisie."
        actions={
          <>
            <select
              value={months}
              onChange={(event) => setMonths(Number(event.target.value))}
              aria-label="Période d’analyse"
              className="h-9 rounded-md border border-line bg-white px-3 text-[13px] text-slate-600 focus:border-royal-400 focus:outline-none focus:ring-2 focus:ring-royal-100"
            >
              <option value={6}>6 derniers mois</option>
              <option value={12}>12 derniers mois</option>
              <option value={24}>24 derniers mois</option>
            </select>
            <Button
              variant="outline"
              icon={<RefreshCw size={15} className={loading ? 'animate-spin' : ''} />}
              onClick={() => setReloadKey((key) => key + 1)}
            >
              Actualiser
            </Button>
            <Button icon={<Download size={15} />} onClick={handleExport}>
              Exporter
            </Button>
          </>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Recettes cumulées" value={formatCurrency(totals.revenue)} icon={<TrendingUp size={18} />} tone="emerald" />
        <StatCard label="Dépenses cumulées" value={formatCurrency(totals.spending)} icon={<TrendingDown size={18} />} tone="rose" />
        <StatCard
          label="Résultat"
          value={formatCurrency(totals.result)}
          hint={`${formatNumber(payments.length)} encaissement(s)`}
          icon={<Wallet size={18} />}
          tone={totals.result >= 0 ? 'teal' : 'rose'}
        />
        <StatCard
          label="Taux de recouvrement"
          value={`${totals.collectionRate} %`}
          hint={`${formatCurrency(totals.outstanding)} restant dû`}
          icon={<Wallet size={18} />}
          tone="royal"
        />
      </div>

      <div className="space-y-5">
        <Card>
          <CardHeader
            title="Recettes et dépenses"
            subtitle={`Flux financiers sur les ${months} derniers mois`}
            action={<Badge tone="royal">Solde : {formatCompactCurrency(totals.result)}</Badge>}
          />
          <CardBody>
            <div className="mb-3 flex items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-royal-500" /> Recettes
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-slate-300" /> Dépenses
              </span>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series} margin={{ top: 4, right: 8, left: -6, bottom: 0 }} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e1dccf" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#747b73' }} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10, fill: '#747b73' }}
                    tickFormatter={(value: number) =>
                      value >= 1_000_000 ? `${(value / 1_000_000).toFixed(1)}M` : `${Math.round(value / 1000)}k`
                    }
                  />
                  <Tooltip
                    cursor={{ fill: '#f3f0e7' }}
                    contentStyle={{ borderRadius: 6, border: '1px solid #e1dccf', fontSize: 12 }}
                    formatter={(value, name) => [formatCurrency(Number(value)), name === 'recettes' ? 'Recettes' : 'Dépenses']}
                  />
                  <Bar dataKey="recettes" fill="#244b3c" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="depenses" fill="#d8d2c4" radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>

        <div className="grid gap-5 lg:grid-cols-3">
          <Card>
            <CardHeader title="Modes d’encaissement" subtitle="Répartition des recettes" />
            <CardBody>
              {methodSplit.length === 0 ? (
                <EmptyState title="Aucun paiement" compact />
              ) : (
                <div className="flex items-center gap-4">
                  <div className="h-36 w-36 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={methodSplit} dataKey="value" nameKey="name" innerRadius={36} outerRadius={60} paddingAngle={3} strokeWidth={0}>
                          {methodSplit.map((entry, index) => (
                            <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ borderRadius: 6, border: '1px solid #e1dccf', fontSize: 12 }}
                          formatter={(value) => formatCurrency(Number(value))}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="min-w-0 flex-1 space-y-2">
                    {methodSplit.map((entry, index) => (
                      <li key={entry.name} className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="flex items-center gap-1.5 text-slate-600">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                          />
                          {entry.name}
                        </span>
                        <span className="font-semibold text-slate-700">{formatCompactCurrency(entry.value)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardBody>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader title="Détail mensuel" subtitle="Recettes, dépenses et solde par mois" />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70">
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Mois</th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Recettes</th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Dépenses</th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Solde</th>
                  </tr>
                </thead>
                <tbody>
                  {series.map((month) => (
                    <tr key={month.key} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-2.5 text-xs font-medium capitalize text-slate-700">{month.label}</td>
                      <td className="px-4 py-2.5 text-right text-xs text-emerald-600">{formatCurrency(month.recettes)}</td>
                      <td className="px-4 py-2.5 text-right text-xs text-rose-600">{formatCurrency(month.depenses)}</td>
                      <td
                        className={
                          month.solde >= 0
                            ? 'px-4 py-2.5 text-right text-xs font-semibold text-slate-800'
                            : 'px-4 py-2.5 text-right text-xs font-semibold text-rose-600'
                        }
                      >
                        {formatCurrency(month.solde)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
