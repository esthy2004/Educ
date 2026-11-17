import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight, Banknote, RefreshCw, Wallet } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { StatCard } from '@/components/ui/StatCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/hooks/useAuth';
import { useDataVersion } from '@/hooks/useDataVersion';
import { useToast } from '@/hooks/useToast';
import { cashSummary, type CashSummary } from '@/services/finance.service';
import { PaymentModal } from '@/modules/finance/PaymentModal';
import { PAYMENT_METHOD_LABELS } from '@/config/labels';
import { formatCurrency, formatDate } from '@/utils/format';

export function CashPage() {
  const { can } = useAuth();
  const version = useDataVersion();
  const toast = useToast();
  const [summary, setSummary] = useState<CashSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);

  const canManage = can('finance.manage');

  useEffect(() => {
    let active = true;
    setLoading(true);
    cashSummary()
      .then((data) => {
        if (active) setSummary(data);
      })
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : 'Impossible de charger la caisse.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [version, reloadKey]);

  return (
    <>
      <PageHeader
        eyebrow="Finances"
        title="Caisse"
        subtitle="Situation consolidée des encaissements et des sorties de trésorerie."
        actions={
          <>
            <Button
              variant="outline"
              icon={<RefreshCw size={15} className={loading ? 'animate-spin' : ''} />}
              onClick={() => setReloadKey((key) => key + 1)}
            >
              Actualiser
            </Button>
            {canManage ? (
              <Button icon={<Wallet size={15} />} onClick={() => setModalOpen(true)}>
                Encaisser
              </Button>
            ) : null}
          </>
        }
      />

      {!summary ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-lg border border-line bg-white" />
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Encaissé aujourd’hui"
              value={formatCurrency(summary.todayIn)}
              icon={<ArrowUpRight size={18} />}
              tone="emerald"
            />
            <StatCard
              label="Décaissé aujourd’hui"
              value={formatCurrency(summary.todayOut)}
              icon={<ArrowDownRight size={18} />}
              tone="rose"
            />
            <StatCard label="Solde de caisse" value={formatCurrency(summary.balance)} icon={<Wallet size={18} />} tone={summary.balance >= 0 ? 'teal' : 'rose'} />
            <StatCard
              label="Mouvements cumulés"
              value={formatCurrency(summary.totalIn + summary.totalOut)}
              hint={`${formatCurrency(summary.totalIn)} entrées`}
              icon={<Banknote size={18} />}
              tone="royal"
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <Card>
              <CardHeader title="Répartition par mode" subtitle="Encaissements cumulés" />
              <CardBody className="space-y-3">
                {(Object.keys(summary.byMethod) as Array<keyof CashSummary['byMethod']>).map((method) => {
                  const value = summary.byMethod[method];
                  const ratio = summary.totalIn > 0 ? Math.round((value / summary.totalIn) * 100) : 0;
                  return (
                    <div key={method}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-700">{PAYMENT_METHOD_LABELS[method]}</span>
                        <span className="text-slate-500">{formatCurrency(value)}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-royal-500" style={{ width: `${ratio}%` }} />
                      </div>
                    </div>
                  );
                })}
              </CardBody>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader
                title="Derniers encaissements"
                subtitle="Paiements les plus récents"
                action={
                  <Link to="/finance/paiements" className="text-xs font-medium text-royal-600 hover:text-royal-700">
                    Voir tout
                  </Link>
                }
              />
              <CardBody className="divide-y divide-slate-100 py-0">
                {summary.recentPayments.length === 0 ? (
                  <EmptyState title="Aucun paiement" compact />
                ) : (
                  summary.recentPayments.map((payment) => (
                    <div key={payment.id} className="flex items-center gap-3 py-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                        <ArrowUpRight size={14} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-slate-800">{payment.studentName}</p>
                        <p className="text-[11px] text-slate-400">
                          {payment.receiptNumber} · {PAYMENT_METHOD_LABELS[payment.method]} · {formatDate(payment.date)}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-emerald-600">{formatCurrency(payment.amount)}</span>
                    </div>
                  ))
                )}
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardHeader
              title="Dernières dépenses"
              subtitle="Sorties de caisse récentes"
              action={
                <Link to="/finance/depenses" className="text-xs font-medium text-royal-600 hover:text-royal-700">
                  Voir tout
                </Link>
              }
            />
            <CardBody className="divide-y divide-slate-100 py-0">
              {summary.recentExpenses.length === 0 ? (
                <EmptyState title="Aucune dépense" compact />
              ) : (
                summary.recentExpenses.map((expense) => (
                  <div key={expense.id} className="flex items-center gap-3 py-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                      <ArrowDownRight size={14} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-slate-800">{expense.label}</p>
                      <p className="text-[11px] text-slate-400">
                        {expense.category} · {formatDate(expense.date)}
                      </p>
                    </div>
                    <Badge tone="neutral">{PAYMENT_METHOD_LABELS[expense.method]}</Badge>
                    <span className="text-sm font-semibold text-rose-600">{formatCurrency(expense.amount)}</span>
                  </div>
                ))
              )}
            </CardBody>
          </Card>
        </div>
      )}

      <PaymentModal open={modalOpen} onClose={() => setModalOpen(false)} onSaved={() => setSummary(null)} />
    </>
  );
}
