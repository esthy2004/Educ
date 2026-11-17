import { useEffect, useMemo, useState } from 'react';
import {
  CalendarCheck,
  CheckCircle2,
  Clock,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  UserCheck,
  XCircle,
} from 'lucide-react';
import type { AttendanceStatus, SchoolClass } from '@/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { StatCard } from '@/components/ui/StatCard';
import { SearchInput } from '@/components/ui/SearchInput';
import { Avatar } from '@/components/ui/Avatar';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Input';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/hooks/useAuth';
import { useConfirm } from '@/hooks/useConfirm';
import { useDataVersion } from '@/hooks/useDataVersion';
import { useToast } from '@/hooks/useToast';
import { academicsService } from '@/services/academics.service';
import {
  attendanceService,
  type AttendanceRow,
  type AttendanceSessionEntry,
} from '@/services/attendance.service';
import { ATTENDANCE_LABELS, ATTENDANCE_TONES } from '@/config/labels';
import { formatDate, percent, todayIso } from '@/utils/format';

const STATUS_OPTIONS: AttendanceStatus[] = ['present', 'absent', 'retard', 'justifie'];

const STATUS_BUTTON_CLASSES: Record<AttendanceStatus, string> = {
  present: 'border-emerald-500 bg-emerald-50 text-emerald-700',
  absent: 'border-rose-500 bg-rose-50 text-rose-700',
  retard: 'border-amber-500 bg-amber-50 text-amber-700',
  justifie: 'border-royal-500 bg-royal-50 text-royal-700',
};

export function AttendancePage() {
  const { user, can } = useAuth();
  const version = useDataVersion();
  const toast = useToast();
  const confirm = useConfirm();

  const [tab, setTab] = useState<'appel' | 'historique'>('appel');
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [classId, setClassId] = useState('');
  const [date, setDate] = useState(todayIso());
  const [session, setSession] = useState<AttendanceSessionEntry[]>([]);
  const [loadingSession, setLoadingSession] = useState(true);
  const [saving, setSaving] = useState(false);

  const [history, setHistory] = useState<AttendanceRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyClass, setHistoryClass] = useState('');
  const [historyStatus, setHistoryStatus] = useState<AttendanceStatus | ''>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');

  const [justifying, setJustifying] = useState<AttendanceRow | null>(null);
  const [justification, setJustification] = useState('');
  const [savingJustification, setSavingJustification] = useState(false);

  const canManage = can('attendance.manage');
  const actor = user?.name ?? 'Surveillance';

  useEffect(() => {
    let active = true;
    academicsService.listClasses().then((list) => {
      if (!active) return;
      setClasses(list);
      setClassId((current) => current || list[0]?.id || '');
    });
    return () => {
      active = false;
    };
  }, [version]);

  useEffect(() => {
    if (!classId) {
      setSession([]);
      setLoadingSession(false);
      return;
    }
    let active = true;
    setLoadingSession(true);
    attendanceService
      .session(classId, date)
      .then((entries) => {
        if (active) setSession(entries);
      })
      .finally(() => {
        if (active) setLoadingSession(false);
      });
    return () => {
      active = false;
    };
  }, [classId, date, version]);

  useEffect(() => {
    if (tab !== 'historique') return;
    let active = true;
    setLoadingHistory(true);
    attendanceService
      .history({ classId: historyClass || undefined, status: historyStatus || undefined, from: from || undefined, to: to || undefined, search })
      .then((rows) => {
        if (active) setHistory(rows);
      })
      .finally(() => {
        if (active) setLoadingHistory(false);
      });
    return () => {
      active = false;
    };
  }, [tab, historyClass, historyStatus, from, to, search, version]);

  const counts = useMemo(() => {
    const initial: Record<AttendanceStatus, number> = { present: 0, absent: 0, retard: 0, justifie: 0 };
    session.forEach((entry) => {
      initial[entry.status] += 1;
    });
    return initial;
  }, [session]);

  const attendancePercent = percent(counts.present + counts.justifie, session.length);

  const updateEntry = (studentId: string, patch: Partial<AttendanceSessionEntry>) => {
    setSession((current) =>
      current.map((entry) => (entry.student.id === studentId ? { ...entry, ...patch } : entry)),
    );
  };

  const handleSave = async () => {
    if (!classId || session.length === 0) {
      toast.error('Aucun élève actif dans cette classe.');
      return;
    }
    setSaving(true);
    try {
      await attendanceService.saveSession(
        classId,
        date,
        session.map((entry) => ({
          studentId: entry.student.id,
          status: entry.status,
          minutesLate: entry.minutesLate,
          justification: entry.justification,
        })),
        actor,
      );
      toast.success(`Appel du ${formatDate(date)} enregistré pour ${session.length} élève(s).`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  };

  const handleJustify = async () => {
    if (!justifying) return;
    setSavingJustification(true);
    try {
      await attendanceService.justify(justifying.id, justification, actor);
      toast.success('Absence justifiée.');
      setJustifying(null);
      setJustification('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Justification impossible.');
    } finally {
      setSavingJustification(false);
    }
  };

  const handleDelete = async (row: AttendanceRow) => {
    const confirmed = await confirm({
      title: 'Supprimer la ligne d’appel ?',
      message: `L’enregistrement de ${row.studentName} du ${formatDate(row.date)} sera définitivement supprimé.`,
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!confirmed) return;
    try {
      await attendanceService.remove(row.id);
      toast.success('Enregistrement supprimé.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Suppression impossible.');
    }
  };

  const columns: Array<Column<AttendanceRow>> = [
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
      key: 'status',
      header: 'Statut',
      render: (row) => (
        <Badge tone={ATTENDANCE_TONES[row.status]} dot>
          {ATTENDANCE_LABELS[row.status]}
          {row.status === 'retard' && row.minutesLate > 0 ? ` (${row.minutesLate} min)` : ''}
        </Badge>
      ),
    },
    {
      key: 'justification',
      header: 'Justificatif',
      render: (row) => (
        <span className="text-xs text-slate-500">
          {row.justification || '—'}
          {row.justifiedBy ? <span className="block text-[10px] text-slate-400">par {row.justifiedBy}</span> : null}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          {canManage && row.status !== 'justifie' ? (
            <button
              type="button"
              onClick={() => {
                setJustifying(row);
                setJustification(row.justification ?? '');
              }}
              className="rounded-md p-1.5 text-slate-400 transition hover:bg-royal-50 hover:text-royal-600"
              title="Justifier"
              aria-label={`Justifier l’absence de ${row.studentName}`}
            >
              <ShieldCheck size={15} />
            </button>
          ) : null}
          {canManage ? (
            <button
              type="button"
              onClick={() => void handleDelete(row)}
              className="rounded-md p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
              title="Supprimer"
              aria-label="Supprimer la ligne d’appel"
            >
              <Trash2 size={15} />
            </button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Vie scolaire"
        title="Présences"
        subtitle="Faites l’appel quotidien par classe et suivez l’assiduité des élèves."
        actions={
          <>
            {tab === 'historique' ? (
              <Button
                variant="outline"
                icon={<RefreshCw size={15} />}
                onClick={() => {
                  setSearch('');
                  setHistoryClass('');
                  setHistoryStatus('');
                  setFrom('');
                  setTo('');
                }}
              >
                Réinitialiser
              </Button>
            ) : (
              <Button icon={<Save size={15} />} loading={saving} onClick={() => void handleSave()} disabled={!canManage}>
                Enregistrer l’appel
              </Button>
            )}
          </>
        }
      />

      <Tabs
        className="mb-5"
        value={tab}
        onChange={(value) => setTab(value as 'appel' | 'historique')}
        items={[
          { key: 'appel', label: 'Appel du jour', icon: <CalendarCheck size={14} /> },
          { key: 'historique', label: 'Historique', icon: <Clock size={14} />, count: history.length },
        ]}
      />

      {tab === 'appel' ? (
        <div className="space-y-5">
          <Card>
            <CardBody className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="space-y-1.5">
                <span className="block text-xs font-medium text-slate-600">Classe</span>
                <select
                  value={classId}
                  onChange={(event) => setClassId(event.target.value)}
                  className="h-9 w-full rounded-md border border-line bg-white px-3 text-[13px] text-slate-600 focus:border-royal-400 focus:outline-none focus:ring-2 focus:ring-royal-100"
                >
                  {classes.length === 0 ? <option value="">Aucune classe</option> : null}
                  {classes.map((schoolClass) => (
                    <option key={schoolClass.id} value={schoolClass.id}>
                      {schoolClass.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="block text-xs font-medium text-slate-600">Date de l’appel</span>
                <input
                  type="date"
                  value={date}
                  max={todayIso()}
                  onChange={(event) => setDate(event.target.value)}
                  className="h-9 w-full rounded-md border border-line bg-white px-3 text-[13px] text-slate-600 focus:border-royal-400 focus:outline-none focus:ring-2 focus:ring-royal-100"
                />
              </label>
              <div className="flex items-end">
                <div className="w-full rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-2xs font-semibold uppercase tracking-[0.06em] text-muted">Taux de présence</p>
                  <p className="text-lg font-semibold text-navy-900">{attendancePercent} %</p>
                </div>
              </div>
            </CardBody>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Présents" value={String(counts.present)} icon={<UserCheck size={18} />} tone="emerald" />
            <StatCard label="Absents" value={String(counts.absent)} icon={<XCircle size={18} />} tone="rose" />
            <StatCard label="Retards" value={String(counts.retard)} icon={<Clock size={18} />} tone="amber" />
            <StatCard label="Justifiés" value={String(counts.justifie)} icon={<ShieldCheck size={18} />} tone="royal" />
          </div>

          <Card>
            <CardHeader
              title={`Liste d’appel · ${classes.find((item) => item.id === classId)?.name ?? '—'}`}
              subtitle={formatDate(date)}
              action={<Badge tone="neutral">{session.length} élève(s)</Badge>}
            />
            <CardBody>
              {loadingSession ? (
                <div className="space-y-2">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="h-14 animate-pulse rounded-lg bg-slate-100" />
                  ))}
                </div>
              ) : session.length === 0 ? (
                <EmptyState
                  title="Aucun élève actif"
                  description="Cette classe ne contient aucun élève actif. Affectez des élèves depuis le module Scolarité."
                  icon={<CalendarCheck size={20} />}
                />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {session.map((entry) => (
                    <li key={entry.student.id} className="flex flex-wrap items-center gap-3 py-3">
                      <Avatar firstName={entry.student.firstName} lastName={entry.student.lastName} size="md" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-800">
                          {entry.student.lastName} {entry.student.firstName}
                        </p>
                        <p className="text-[11px] text-slate-400">{entry.student.matricule}</p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {STATUS_OPTIONS.map((status) => {
                          const active = entry.status === status;
                          return (
                            <button
                              key={status}
                              type="button"
                              disabled={!canManage}
                              onClick={() =>
                                updateEntry(entry.student.id, {
                                  status,
                                  minutesLate: status === 'retard' ? entry.minutesLate || 10 : 0,
                                })
                              }
                              className={
                                active
                                  ? `rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${STATUS_BUTTON_CLASSES[status]}`
                                  : 'rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-500 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60'
                              }
                            >
                              {ATTENDANCE_LABELS[status]}
                            </button>
                          );
                        })}
                      </div>
                      {entry.status === 'retard' ? (
                        <input
                          type="number"
                          min={1}
                          max={240}
                          value={entry.minutesLate || ''}
                          disabled={!canManage}
                          onChange={(event) => updateEntry(entry.student.id, { minutesLate: Number(event.target.value) })}
                          placeholder="min"
                          aria-label={`Minutes de retard de ${entry.student.firstName}`}
                          className="h-8 w-16 rounded-lg border border-slate-200 px-2 text-xs text-slate-700 focus:border-royal-400 focus:outline-none focus:ring-2 focus:ring-royal-100"
                        />
                      ) : null}
                      {entry.status === 'justifie' ? (
                        <input
                          value={entry.justification}
                          disabled={!canManage}
                          onChange={(event) => updateEntry(entry.student.id, { justification: event.target.value })}
                          placeholder="Motif du justificatif"
                          aria-label={`Justification de ${entry.student.firstName}`}
                          className="h-8 w-full rounded-lg border border-slate-200 px-2 text-xs text-slate-700 focus:border-royal-400 focus:outline-none focus:ring-2 focus:ring-royal-100 sm:w-56"
                        />
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardBody className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
              <SearchInput value={search} onChange={setSearch} placeholder="Élève ou matricule…" />
              <select
                value={historyClass}
                onChange={(event) => setHistoryClass(event.target.value)}
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
                value={historyStatus}
                onChange={(event) => setHistoryStatus(event.target.value as AttendanceStatus | '')}
                aria-label="Filtrer par statut"
                className="h-9 rounded-md border border-line bg-white px-3 text-[13px] text-slate-600 focus:border-royal-400 focus:outline-none focus:ring-2 focus:ring-royal-100"
              >
                <option value="">Tous les statuts</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {ATTENDANCE_LABELS[status]}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                aria-label="Date de début"
                className="h-9 rounded-md border border-line bg-white px-3 text-[13px] text-slate-600 focus:border-royal-400 focus:outline-none focus:ring-2 focus:ring-royal-100"
              />
              <input
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                aria-label="Date de fin"
                className="h-9 rounded-md border border-line bg-white px-3 text-[13px] text-slate-600 focus:border-royal-400 focus:outline-none focus:ring-2 focus:ring-royal-100"
              />
            </CardBody>
            <DataTable
              columns={columns}
              data={history}
              rowKey={(row) => row.id}
              loading={loadingHistory}
              emptyTitle="Aucun enregistrement"
              emptyDescription="Aucune ligne d’appel ne correspond aux filtres sélectionnés."
            />
          </Card>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <CheckCircle2 size={14} className="text-emerald-500" />
            {history.length} enregistrement(s) affiché(s) sur la période sélectionnée.
          </div>
        </div>
      )}

      <Modal
        open={Boolean(justifying)}
        onClose={() => setJustifying(null)}
        title="Justifier une absence"
        description={
          justifying
            ? `${justifying.studentName} · ${formatDate(justifying.date)}`
            : undefined
        }
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setJustifying(null)}>
              Annuler
            </Button>
            <Button loading={savingJustification} onClick={() => void handleJustify()}>
              Enregistrer le justificatif
            </Button>
          </>
        }
      >
        <Textarea
          label="Motif du justificatif"
          required
          value={justification}
          onChange={(event) => setJustification(event.target.value)}
          placeholder="Ex. rendez-vous médical, raison familiale…"
          hint="Le motif apparaîtra dans l’historique et sur la fiche de l’élève."
        />
      </Modal>
    </>
  );
}
