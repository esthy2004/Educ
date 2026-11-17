import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Award,
  Banknote,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  Info,
  RefreshCw,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import {
  Area,
  AreaChart,
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
import { StatCard } from '@/components/ui/StatCard';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/hooks/useAuth';
import { useDataVersion } from '@/hooks/useDataVersion';
import { dashboardService, type DashboardData } from '@/services/dashboard.service';
import { formatCompactCurrency, formatCurrency, formatDate, formatDateLong, formatNumber, percent } from '@/utils/format';

const CHART_COLORS = ['#244b3c', '#527663', '#c69b57', '#648a9a'];

const activityIcons = {
  student: UserPlus,
  payment: Banknote,
  grade: ClipboardCheck,
  attendance: CalendarCheck,
  discipline: ShieldAlert,
  expense: Wallet,
  system: Info,
};

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-lg border border-line bg-white" />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="h-80 animate-pulse rounded-lg border border-line bg-white lg:col-span-2" />
        <div className="h-80 animate-pulse rounded-lg border border-line bg-white" />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="h-64 animate-pulse rounded-lg border border-line bg-white" />
        <div className="h-64 animate-pulse rounded-lg border border-line bg-white" />
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const version = useDataVersion();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    dashboardService
      .getData()
      .then((result) => {
        if (active) setData(result);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [version, reloadKey]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';

  return (
    <>
      <PageHeader
        eyebrow="Pilotage"
        title={`${greeting}, ${user?.name.split(' ')[0] ?? 'bienvenue'}`}
        subtitle={`Voici la situation de l’établissement au ${formatDateLong(new Date())}.`}
        actions={
          <>
            <Button variant="outline" icon={<RefreshCw size={15} className={loading ? 'animate-spin' : ''} />} onClick={() => setReloadKey((key) => key + 1)}>
              Actualiser
            </Button>
            <Button icon={<Users size={15} />} onClick={() => navigate('/students')}>
              Gérer les élèves
            </Button>
          </>
        }
      />

      {!data ? (
        <DashboardSkeleton />
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Élèves inscrits"
              value={formatNumber(data.stats.students)}
              hint={`${data.stats.classes} classes · ${data.stats.teachers} enseignants`}
              icon={<Users size={18} />}
              tone="royal"
              trend={
                data.stats.studentsDelta === 0
                  ? undefined
                  : {
                      value: `${data.stats.studentsDelta > 0 ? '+' : ''}${data.stats.studentsDelta} ce mois`,
                      positive: data.stats.studentsDelta >= 0,
                    }
              }
            />
            <StatCard
              label="Recettes du mois"
              value={formatCurrency(data.stats.monthRevenue)}
              hint="Paiements encaissés"
              icon={<TrendingUp size={18} />}
              tone="emerald"
            />
            <StatCard
              label="Solde du mois"
              value={formatCurrency(data.stats.monthBalance)}
              hint={`Dépenses : ${formatCompactCurrency(data.stats.monthExpenses)}`}
              icon={data.stats.monthBalance >= 0 ? <Wallet size={18} /> : <TrendingDown size={18} />}
              tone={data.stats.monthBalance >= 0 ? 'teal' : 'rose'}
            />
            <StatCard
              label="Impayés à recouvrer"
              value={formatCurrency(data.stats.outstanding)}
              hint={`Taux de recouvrement : ${data.stats.collectionRate} %`}
              icon={<AlertTriangle size={18} />}
              tone="amber"
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader
                title="Évolution des inscriptions"
                subtitle="Nouveaux élèves sur les 6 derniers mois"
                action={<Badge tone="royal">{formatNumber(data.stats.students)} actifs</Badge>}
              />
              <CardBody>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.enrollmentSeries} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                      <defs>
                        <linearGradient id="enrollmentFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#244b3c" stopOpacity={0.18} />
                          <stop offset="100%" stopColor="#244b3c" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e1dccf" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#747b73' }} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#747b73' }} />
                      <Tooltip
                        contentStyle={{ borderRadius: 6, border: '1px solid #e1dccf', fontSize: 12 }}
                        formatter={(value) => [`${formatNumber(Number(value))} élève(s)`, 'Inscriptions']}
                      />
                      <Area
                        type="monotone"
                        dataKey="inscriptions"
                        stroke="#244b3c"
                        strokeWidth={2}
                        fill="url(#enrollmentFill)"
                        dot={{ r: 3, strokeWidth: 2, fill: '#fff' }}
                        activeDot={{ r: 5 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Répartition par cycle" subtitle="Effectifs des classes actives" />
              <CardBody className="space-y-3.5">
                {data.classDistribution.slice(0, 6).map((item) => (
                  <div key={item.name}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700">{item.name}</span>
                      <span className="text-slate-500">
                        {item.effectif} / {item.capacite}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-royal-500"
                        style={{ width: `${Math.min(100, percent(item.effectif, item.capacite))}%` }}
                      />
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => navigate('/academics')}
                  className="flex w-full items-center justify-center gap-1 pt-1 text-xs font-medium text-royal-600 hover:text-royal-700"
                >
                  Voir la structure académique <ArrowRight size={13} />
                </button>
              </CardBody>
            </Card>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader title="Recettes et dépenses" subtitle="Flux financiers des 6 derniers mois" />
              <CardBody>
                <div className="mb-3 flex items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-royal-500" /> Recettes
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-slate-300" /> Dépenses
                  </span>
                </div>
                <div className="h-60 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.financeSeries} margin={{ top: 4, right: 8, left: -6, bottom: 0 }} barGap={4}>
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
                      <Bar dataKey="recettes" fill="#244b3c" radius={[3, 3, 0, 0]} maxBarSize={24} />
                      <Bar dataKey="depenses" fill="#d8d2c4" radius={[3, 3, 0, 0]} maxBarSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Alertes & suivi" subtitle="Points nécessitant votre attention" />
              <CardBody className="space-y-2.5">
                {data.alerts.length === 0 ? (
                  <EmptyState
                    title="Aucune alerte"
                    description="Tout est sous contrôle pour le moment."
                    icon={<CheckCircle2 size={20} />}
                    compact
                  />
                ) : (
                  data.alerts.map((alert) => (
                    <button
                      key={alert.id}
                      type="button"
                      onClick={() => alert.to && navigate(alert.to)}
                      className="flex w-full items-start gap-3 rounded-lg border border-slate-100 p-3 text-left transition hover:border-royal-200 hover:bg-royal-50/30"
                    >
                      <span
                        className={
                          alert.level === 'danger'
                            ? 'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600'
                            : alert.level === 'warning'
                              ? 'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600'
                              : 'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-royal-50 text-royal-600'
                        }
                      >
                        {alert.level === 'danger' ? <AlertTriangle size={14} /> : alert.level === 'warning' ? <CalendarCheck size={14} /> : <Info size={14} />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold text-slate-800">{alert.title}</span>
                        <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">{alert.description}</span>
                      </span>
                    </button>
                  ))
                )}
              </CardBody>
            </Card>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader
                title="Activités récentes"
                subtitle="Dernières opérations enregistrées"
                action={
                  <Badge tone="neutral">
                    <GraduationCap size={11} /> Journal
                  </Badge>
                }
              />
              <CardBody className="divide-y divide-slate-100 py-1">
                {data.activities.length === 0 ? (
                  <EmptyState title="Aucune activité" compact />
                ) : (
                  data.activities.map((activity) => {
                    const Icon = activityIcons[activity.type] ?? Info;
                    return (
                      <div key={activity.id} className="flex items-start gap-3 py-3">
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                          <Icon size={14} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-slate-800">{activity.title}</p>
                          <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{activity.description}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-[10px] text-slate-400">{formatDate(activity.date)}</p>
                          <p className="text-[10px] text-slate-400">{activity.actor}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </CardBody>
            </Card>

            <div className="space-y-5">
              <Card>
                <CardHeader title="Répartition des paiements" subtitle="Modes d’encaissement" />
                <CardBody>
                  {data.revenueByMethod.length === 0 ? (
                    <EmptyState title="Aucun paiement" compact />
                  ) : (
                    <div className="flex items-center gap-4">
                      <div className="h-32 w-32 shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={data.revenueByMethod}
                              dataKey="value"
                              nameKey="name"
                              innerRadius={34}
                              outerRadius={56}
                              paddingAngle={3}
                              strokeWidth={0}
                            >
                              {data.revenueByMethod.map((entry, index) => (
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
                        {data.revenueByMethod.map((entry, index) => (
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

              <Card>
                <CardHeader title="Meilleurs élèves" subtitle="Moyenne générale toutes matières" />
                <CardBody className="space-y-2.5">
                  {data.topStudents.length === 0 ? (
                    <EmptyState title="Pas encore de notes" compact />
                  ) : (
                    data.topStudents.map((student, index) => (
                      <button
                        key={student.id}
                        type="button"
                        onClick={() => navigate(`/students/${student.id}`)}
                        className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1 text-left transition hover:bg-slate-50"
                      >
                        <span
                          className={
                            index === 0
                              ? 'flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[10px] font-bold text-amber-700'
                              : 'flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500'
                          }
                        >
                          {index + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-medium text-slate-700">{student.name}</span>
                          <span className="block text-[10px] text-slate-400">{student.className}</span>
                        </span>
                        <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
                          <Award size={12} />
                          {student.average.toFixed(2)}
                        </span>
                      </button>
                    ))
                  )}
                </CardBody>
              </Card>
            </div>
          </div>

          <Card>
            <CardBody className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-royal-50 text-royal-700">
                  <BookOpen size={18} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-navy-900">Assiduité globale</p>
                  <p className="text-xs text-slate-500">Taux de présence sur les 30 derniers jours</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="h-2 w-40 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{ width: `${data.stats.attendanceRate}%` }}
                  />
                </div>
                <span className="text-lg font-semibold text-navy-900">{data.stats.attendanceRate} %</span>
                <Button variant="outline" size="sm" onClick={() => navigate('/attendance')}>
                  Détail
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </>
  );
}
