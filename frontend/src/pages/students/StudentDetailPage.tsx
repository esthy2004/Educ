import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRightLeft,
  Award,
  BookOpen,
  CalendarDays,
  Droplets,
  Mail,
  MapPin,
  Pencil,
  Phone,
  ReceiptText,
  ShieldAlert,
  UserRound,
  Wallet,
} from 'lucide-react';
import type { SchoolClass, Student } from '@/types';
import type { AttendanceRow } from '@/services/attendance.service';
import type { DisciplineRow } from '@/services/discipline.service';
import type { InvoiceRow, PaymentRow } from '@/services/finance.service';
import type { ReportCardData } from '@/services/academics.service';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Tabs } from '@/components/ui/Tabs';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/hooks/useAuth';
import { useDataVersion } from '@/hooks/useDataVersion';
import { studentsService } from '@/services/students.service';
import { academicsService } from '@/services/academics.service';
import { attendanceService } from '@/services/attendance.service';
import { disciplineService } from '@/services/discipline.service';
import { invoicesService, paymentsService } from '@/services/finance.service';
import { staffService, type StaffDirectoryEntry } from '@/services/staff.service';
import { StudentFormModal } from '@/modules/students/StudentFormModal';
import { StudentTransferModal } from '@/modules/students/StudentTransferModal';
import {
  ATTENDANCE_LABELS,
  ATTENDANCE_TONES,
  DISCIPLINE_SEVERITY_LABELS,
  DISCIPLINE_SEVERITY_TONES,
  DISCIPLINE_TYPE_LABELS,
  DISCIPLINE_TYPE_TONES,
  GENDER_LABELS,
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_TONES,
  PAYMENT_METHOD_LABELS,
  STUDENT_STATUS_LABELS,
  STUDENT_STATUS_TONES,
} from '@/config/labels';
import {
  age,
  cn,
  formatCurrency,
  formatDate,
  mention,
  mentionClass,
  percent,
} from '@/utils/format';

const tabItems = [
  { key: 'infos', label: 'Informations' },
  { key: 'academics', label: 'Scolarité & notes' },
  { key: 'finance', label: 'Finance' },
  { key: 'attendance', label: 'Présences' },
  { key: 'discipline', label: 'Discipline' },
  { key: 'history', label: 'Historique' },
];

function InfoRow({ icon, label, value }: { icon?: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 py-2">
      {icon ? <span className="mt-0.5 text-slate-400">{icon}</span> : null}
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        <p className="text-sm text-slate-700">{value || '—'}</p>
      </div>
    </div>
  );
}

export function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can } = useAuth();
  const version = useDataVersion();
  const [student, setStudent] = useState<Student | null>(null);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [discipline, setDiscipline] = useState<DisciplineRow[]>([]);
  const [reports, setReports] = useState<ReportCardData[]>([]);
  const [directory, setDirectory] = useState<StaffDirectoryEntry[]>([]);
  const [classSize, setClassSize] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('infos');
  const [formOpen, setFormOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const canManage = can('students.manage');
  const visibleTabItems = tabItems.filter((item) => {
    if (item.key === 'academics') return can('academics.view');
    if (item.key === 'finance') return can('finance.view');
    if (item.key === 'attendance') return can('attendance.view');
    if (item.key === 'discipline') return can('discipline.view');
    return true;
  });

  useEffect(() => {
    let active = true;
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const load = async () => {
      const [loadedStudent, classList] = await Promise.all([studentsService.get(id), academicsService.listClasses()]);
      if (!active) return;
      setStudent(loadedStudent);
      setClasses(classList);
      if (!loadedStudent) {
        setLoading(false);
        return;
      }
      const years = can('academics.view') ? await academicsService.listYears() : [];
      const activeYear = years.find((year) => year.isActive) ?? years[0];
      const terms = activeYear ? await academicsService.listTerms(activeYear.id) : [];
      const [invoiceRows, paymentRows, attendanceRows, disciplineRows, reportCards, directoryRows, classStudents] = await Promise.all([
        can('finance.view')
          ? invoicesService.list({ search: loadedStudent.matricule })
          : Promise.resolve([] as InvoiceRow[]),
        can('finance.view')
          ? paymentsService.list({ search: loadedStudent.matricule })
          : Promise.resolve([] as PaymentRow[]),
        can('attendance.view')
          ? attendanceService.history({ studentId: loadedStudent.id })
          : Promise.resolve([] as AttendanceRow[]),
        can('discipline.view')
          ? disciplineService.list({ studentId: loadedStudent.id })
          : Promise.resolve([] as DisciplineRow[]),
        can('academics.view')
          ? Promise.all(terms.map((term) => academicsService.reportCard(loadedStudent.id, term.id)))
          : Promise.resolve([] as ReportCardData[]),
        staffService.directory(),
        loadedStudent.classId
          ? studentsService.list({ classId: loadedStudent.classId, status: 'actif' })
          : Promise.resolve([] as Student[]),
      ]);
      if (!active) return;
      setInvoices(invoiceRows);
      setPayments(paymentRows);
      setAttendance(attendanceRows);
      setDiscipline(disciplineRows);
      setReports(reportCards);
      setDirectory(directoryRows);
      setClassSize(classStudents.length);
      setLoading(false);
    };
    void load().catch(() => setLoading(false));
    return () => {
      active = false;
    };
  }, [id, version, can]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-32 animate-pulse rounded-lg border border-line bg-white" />
        <div className="h-64 animate-pulse rounded-lg border border-line bg-white" />
      </div>
    );
  }

  if (!student) {
    return (
      <Card>
        <EmptyState
          title="Élève introuvable"
          description="Ce dossier n’existe pas ou a été supprimé."
          action={<Button onClick={() => navigate('/students')}>Retour à la liste</Button>}
        />
      </Card>
    );
  }

  const schoolClass = classes.find((item) => item.id === student.classId);
  const mainTeacher = schoolClass
    ? directory.find((member) => member.id === schoolClass.mainTeacherId)
    : undefined;
  const invoiced = invoices.reduce((sum, row) => sum + row.invoice.amount, 0);
  const paid = payments.reduce((sum, row) => sum + row.amount, 0);
  const balance = invoiced - paid;
  const attendanceSummary = {
    present: attendance.filter((record) => record.status === 'present').length,
    absent: attendance.filter((record) => record.status === 'absent').length,
    late: attendance.filter((record) => record.status === 'retard').length,
    justified: attendance.filter((record) => record.status === 'justifie').length,
  };
  const presenceRate = percent(
    attendance.filter((record) => record.status === 'present' || record.status === 'justifie').length,
    attendance.length,
  );

  const invoiceColumns: Array<Column<InvoiceRow>> = [
    {
      key: 'label',
      header: 'Facture',
      render: (row) => (
        <div>
          <p className="text-xs font-medium text-slate-700">{row.invoice.label}</p>
          <p className="text-[11px] text-slate-400">Échéance {formatDate(row.invoice.dueDate)}</p>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Montant',
      align: 'right',
      render: (row) => <span className="text-xs text-slate-600">{formatCurrency(row.invoice.amount)}</span>,
    },
    {
      key: 'paid',
      header: 'Payé',
      align: 'right',
      render: (row) => <span className="text-xs font-medium text-emerald-600">{formatCurrency(row.paid)}</span>,
    },
    {
      key: 'balance',
      header: 'Solde',
      align: 'right',
      render: (row) => (
        <span className={cn('text-xs font-semibold', row.balance > 0 ? 'text-rose-600' : 'text-emerald-600')}>
          {formatCurrency(row.balance)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Statut',
      align: 'center',
      render: (row) => <Badge tone={INVOICE_STATUS_TONES[row.status]}>{INVOICE_STATUS_LABELS[row.status]}</Badge>,
    },
  ];

  const paymentColumns: Array<Column<PaymentRow>> = [
    {
      key: 'date',
      header: 'Date',
      render: (row) => <span className="text-xs text-slate-600">{formatDate(row.date)}</span>,
    },
    { key: 'receipt', header: 'Reçu', render: (row) => <span className="font-mono text-[11px] text-slate-600">{row.receiptNumber}</span> },
    { key: 'invoice', header: 'Facture', render: (row) => <span className="text-xs text-slate-600">{row.invoiceLabel}</span> },
    {
      key: 'method',
      header: 'Mode',
      render: (row) => <span className="text-xs text-slate-500">{PAYMENT_METHOD_LABELS[row.method]}</span>,
    },
    {
      key: 'amount',
      header: 'Montant',
      align: 'right',
      render: (row) => <span className="text-xs font-semibold text-slate-700">{formatCurrency(row.amount)}</span>,
    },
  ];

  const attendanceColumns: Array<Column<AttendanceRow>> = [
    { key: 'date', header: 'Date', render: (row) => <span className="text-xs text-slate-600">{formatDate(row.date)}</span> },
    {
      key: 'status',
      header: 'Statut',
      render: (row) => (
        <Badge tone={ATTENDANCE_TONES[row.status]} dot>
          {ATTENDANCE_LABELS[row.status]}
        </Badge>
      ),
    },
    {
      key: 'late',
      header: 'Retard',
      render: (row) => <span className="text-xs text-slate-500">{row.minutesLate > 0 ? `${row.minutesLate} min` : '—'}</span>,
    },
    {
      key: 'justification',
      header: 'Justification',
      render: (row) => (
        <span className="text-xs text-slate-500">
          {row.justification || '—'}
          {row.justifiedBy ? <span className="block text-[10px] text-slate-400">par {row.justifiedBy}</span> : null}
        </span>
      ),
    },
  ];

  const disciplineColumns: Array<Column<DisciplineRow>> = [
    { key: 'date', header: 'Date', render: (row) => <span className="text-xs text-slate-600">{formatDate(row.date)}</span> },
    {
      key: 'type',
      header: 'Type',
      render: (row) => <Badge tone={DISCIPLINE_TYPE_TONES[row.type]}>{DISCIPLINE_TYPE_LABELS[row.type]}</Badge>,
    },
    { key: 'category', header: 'Motif', render: (row) => <span className="text-xs font-medium text-slate-700">{row.category}</span> },
    {
      key: 'severity',
      header: 'Gravité',
      render: (row) => <Badge tone={DISCIPLINE_SEVERITY_TONES[row.severity]}>{DISCIPLINE_SEVERITY_LABELS[row.severity]}</Badge>,
    },
    { key: 'action', header: 'Suite donnée', render: (row) => <span className="text-xs text-slate-500">{row.action}</span> },
    {
      key: 'status',
      header: 'Dossier',
      render: (row) => <Badge tone={row.status === 'ouvert' ? 'warning' : 'success'}>{row.status === 'ouvert' ? 'Ouvert' : 'Traité'}</Badge>,
    },
  ];

  return (
    <>
      <div className="mb-4 flex items-center gap-2 text-xs text-slate-500 print:hidden">
        <button type="button" onClick={() => navigate('/students')} className="flex items-center gap-1 hover:text-royal-600">
          <ArrowLeft size={13} /> Élèves
        </button>
        <span>/</span>
        <span className="font-medium text-slate-700">
          {student.firstName} {student.lastName}
        </span>
      </div>

      <Card className="mb-5 overflow-hidden border-t-2 border-t-navy-900">
        <CardBody className="py-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-wrap items-end gap-4">
              <Avatar firstName={student.firstName} lastName={student.lastName} size="xl" className="ring-4 ring-white" />
              <div className="pb-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-semibold text-navy-900">
                    {student.lastName} {student.firstName}
                  </h1>
                  <Badge tone={STUDENT_STATUS_TONES[student.status]} dot>
                    {STUDENT_STATUS_LABELS[student.status]}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {student.matricule} · {schoolClass?.name ?? 'Non affecté'} · {age(student.birthDate)} ans
                </p>
              </div>
            </div>
            {canManage ? (
              <div className="flex flex-wrap gap-2 print:hidden">
                <Button variant="outline" icon={<ArrowRightLeft size={15} />} onClick={() => setTransferOpen(true)}>
                  Changer de classe
                </Button>
                <Button icon={<Pencil size={15} />} onClick={() => setFormOpen(true)}>
                  Modifier
                </Button>
              </div>
            ) : null}
          </div>

          <div className="mt-5 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-2xs font-semibold uppercase tracking-[0.06em] text-muted">Moyenne générale</p>
              <p className="mt-1 text-lg font-semibold text-navy-900">
                {reports.length > 0 && reports[reports.length - 1].average > 0
                  ? `${reports[reports.length - 1].average.toFixed(2)} / 20`
                  : '—'}
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-2xs font-semibold uppercase tracking-[0.06em] text-muted">Taux de présence</p>
              <p className="mt-1 text-lg font-semibold text-navy-900">{presenceRate} %</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-2xs font-semibold uppercase tracking-[0.06em] text-muted">Solde financier</p>
              <p className={cn('mt-1 text-lg font-semibold', balance > 0 ? 'text-rose-600' : 'text-emerald-600')}>
                {formatCurrency(balance)}
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-2xs font-semibold uppercase tracking-[0.06em] text-muted">Faits disciplinaires</p>
              <p className="mt-1 text-lg font-semibold text-navy-900">{discipline.length}</p>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <Tabs items={visibleTabItems} value={tab} onChange={setTab} className="px-2" />
        <CardBody>
          {tab === 'infos' ? (
            <div className="grid gap-5 lg:grid-cols-3">
              <Card className="shadow-none">
                <CardHeader title="Identité" />
                <CardBody className="divide-y divide-slate-50 py-1">
                  <InfoRow icon={<CalendarDays size={14} />} label="Date de naissance" value={`${formatDate(student.birthDate)} (${age(student.birthDate)} ans)`} />
                  <InfoRow icon={<MapPin size={14} />} label="Lieu de naissance" value={student.birthPlace} />
                  <InfoRow icon={<UserRound size={14} />} label="Sexe" value={GENDER_LABELS[student.gender]} />
                  <InfoRow icon={<MapPin size={14} />} label="Adresse" value={student.address} />
                  <InfoRow label="Date d’inscription" value={formatDate(student.enrollmentDate)} />
                  <InfoRow label="Matricule" value={<span className="font-mono text-xs">{student.matricule}</span>} />
                </CardBody>
              </Card>

              <Card className="shadow-none">
                <CardHeader title="Parent / tuteur" />
                <CardBody className="divide-y divide-slate-50 py-1">
                  <InfoRow icon={<UserRound size={14} />} label="Nom" value={student.parentName} />
                  <InfoRow label="Lien" value={student.parentRelation} />
                  <InfoRow icon={<Phone size={14} />} label="Téléphone" value={student.parentPhone} />
                  <InfoRow icon={<Mail size={14} />} label="E-mail" value={student.parentEmail} />
                  <InfoRow icon={<MapPin size={14} />} label="Adresse" value={student.parentAddress} />
                  <div className="pt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate('/documents')}
                      icon={<ReceiptText size={13} />}
                    >
                      Générer un document
                    </Button>
                  </div>
                </CardBody>
              </Card>

              <div className="space-y-5">
                <Card className="shadow-none">
                  <CardHeader title="Scolarité actuelle" />
                  <CardBody className="divide-y divide-slate-50 py-1">
                    <InfoRow icon={<BookOpen size={14} />} label="Classe" value={schoolClass?.name ?? 'Non affecté'} />
                    <InfoRow label="Salle" value={schoolClass?.room} />
                    <InfoRow label="Professeur principal" value={mainTeacher ? `${mainTeacher.firstName} ${mainTeacher.lastName}` : '—'} />
                    <InfoRow label="Effectif de la classe" value={`${classSize} élèves`} />
                  </CardBody>
                </Card>
                <Card className="shadow-none">
                  <CardHeader title="Santé & observations" />
                  <CardBody className="divide-y divide-slate-50 py-1">
                    <InfoRow icon={<Droplets size={14} />} label="Groupe sanguin" value={student.bloodType} />
                    <InfoRow label="Allergies" value={student.allergies || 'Aucune allergie signalée'} />
                    <InfoRow label="Observations" value={student.notes || 'Aucune observation'} />
                  </CardBody>
                </Card>
              </div>
            </div>
          ) : null}

          {tab === 'academics' ? (
            <div className="space-y-4">
              {reports.length === 0 ? (
                <EmptyState title="Aucun trimestre disponible" description="Les notes apparaîtront après la configuration de l’année scolaire." />
              ) : (
                <div className="grid gap-4 lg:grid-cols-3">
                  {reports.map((report) => (
                    <Card key={report.term.id} className="shadow-none">
                      <CardHeader
                        title={report.term.name}
                        subtitle={report.year?.name}
                        action={<Badge tone={report.average >= 10 ? 'success' : 'danger'}>{mention(report.average)}</Badge>}
                      />
                      <CardBody>
                        <div className="flex items-end justify-between">
                          <div>
                            <p className="text-2xs font-semibold uppercase tracking-[0.06em] text-muted">Moyenne</p>
                            <p className={cn('text-2xl font-semibold', mentionClass(report.average))}>
                              {report.average > 0 ? report.average.toFixed(2) : '—'}
                              <span className="text-sm font-normal text-slate-400"> / 20</span>
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-2xs font-semibold uppercase tracking-[0.06em] text-muted">Rang</p>
                            <p className="text-lg font-semibold text-navy-900">
                              {report.rank > 0 ? `${report.rank}${report.rank === 1 ? 'er' : 'e'}` : '—'}
                              <span className="text-xs font-normal text-slate-400"> / {report.classSize}</span>
                            </p>
                          </div>
                        </div>
                        <div className="mt-4 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
                          <span>{report.attendance.rate} % de présence</span>
                          <span>{report.totalCoefficients} coefficients</span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-4 w-full"
                          onClick={() => navigate(`/academics/report-cards?student=${student.id}&term=${report.term.id}`)}
                        >
                          Voir le bulletin
                        </Button>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              )}

              {reports[0] ? (
                <Card className="shadow-none">
                  <CardHeader title="Détail des matières" subtitle={reports[0].term.name} />
                  <DataTable
                    compact
                    columns={[
                      { key: 'subject', header: 'Matière', render: (row) => <span className="text-xs font-medium text-slate-700">{row.subject.name}</span> },
                      { key: 'coefficient', header: 'Coef.', align: 'center', render: (row) => <span className="text-xs text-slate-500">{row.coefficient}</span> },
                      {
                        key: 'average',
                        header: 'Moyenne',
                        align: 'right',
                        render: (row) => <span className={cn('text-xs font-semibold', mentionClass(row.average))}>{row.average.toFixed(2)} / 20</span>,
                      },
                      {
                        key: 'mention',
                        header: 'Appréciation',
                        align: 'right',
                        render: (row) => <span className="text-[11px] text-slate-500">{mention(row.average)}</span>,
                      },
                    ]}
                    data={reports[0].results}
                    rowKey={(row) => row.subject.id}
                    emptyTitle="Aucune note saisie"
                  />
                </Card>
              ) : null}
            </div>
          ) : null}

          {tab === 'finance' ? (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-slate-100 p-4">
                  <p className="text-2xs font-semibold uppercase tracking-[0.06em] text-muted">Total facturé</p>
                  <p className="mt-1 text-lg font-semibold text-navy-900">{formatCurrency(invoiced)}</p>
                </div>
                <div className="rounded-lg border border-slate-100 p-4">
                  <p className="text-2xs font-semibold uppercase tracking-[0.06em] text-muted">Total payé</p>
                  <p className="mt-1 text-lg font-semibold text-emerald-600">{formatCurrency(paid)}</p>
                </div>
                <div className="rounded-lg border border-slate-100 p-4">
                  <p className="text-2xs font-semibold uppercase tracking-[0.06em] text-muted">Solde restant</p>
                  <p className={cn('mt-1 text-lg font-semibold', balance > 0 ? 'text-rose-600' : 'text-emerald-600')}>{formatCurrency(balance)}</p>
                </div>
              </div>
              <Card className="shadow-none">
                <CardHeader title="Factures" subtitle={`${invoices.length} facture(s)`} />
                <DataTable columns={invoiceColumns} data={invoices} rowKey={(row) => row.invoice.id} compact emptyTitle="Aucune facture" />
              </Card>
              <Card className="shadow-none">
                <CardHeader
                  title="Paiements"
                  subtitle={`${payments.length} paiement(s)`}
                  action={<Button variant="ghost" size="sm" icon={<Wallet size={13} />} onClick={() => navigate('/finance/paiements')}>Caisse</Button>}
                />
                <DataTable columns={paymentColumns} data={payments} rowKey={(row) => row.id} compact emptyTitle="Aucun paiement enregistré" />
              </Card>
            </div>
          ) : null}

          {tab === 'attendance' ? (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {[
                  { label: 'Présences', value: attendanceSummary.present, tone: 'text-emerald-600' },
                  { label: 'Absences', value: attendanceSummary.absent, tone: 'text-rose-600' },
                  { label: 'Retards', value: attendanceSummary.late, tone: 'text-amber-600' },
                  { label: 'Justifiées', value: attendanceSummary.justified, tone: 'text-royal-600' },
                  { label: 'Taux', value: `${presenceRate} %`, tone: 'text-navy-900' },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg border border-slate-100 p-3">
                    <p className="text-2xs font-semibold uppercase tracking-[0.06em] text-muted">{item.label}</p>
                    <p className={cn('mt-1 text-lg font-semibold', item.tone)}>{item.value}</p>
                  </div>
                ))}
              </div>
              <Card className="shadow-none">
                <CardHeader title="Derniers relevés" subtitle={`${attendance.length} enregistrement(s)`} />
                <DataTable columns={attendanceColumns} data={attendance.slice(0, 40)} rowKey={(row) => row.id} compact emptyTitle="Aucune présence enregistrée" />
              </Card>
            </div>
          ) : null}

          {tab === 'discipline' ? (
            <Card className="shadow-none">
              <CardHeader
                title="Suivi disciplinaire"
                subtitle={`${discipline.length} fait(s) consigné(s)`}
                action={<Badge tone={discipline.some((item) => item.status === 'ouvert') ? 'warning' : 'success'}>{discipline.filter((item) => item.status === 'ouvert').length} ouvert(s)</Badge>}
              />
              {discipline.length === 0 ? (
                <EmptyState title="Aucun fait disciplinaire" description="Le parcours de l’élève ne comporte aucune observation." icon={<ShieldAlert size={20} />} />
              ) : (
                <DataTable columns={disciplineColumns} data={discipline} rowKey={(row) => row.id} compact />
              )}
            </Card>
          ) : null}

          {tab === 'history' ? (
            <Card className="shadow-none">
              <CardHeader title="Historique scolaire" subtitle="Parcours des années précédentes et transferts" />
              {student.history.length === 0 ? (
                <EmptyState title="Aucun antécédent" description="L’historique se remplira lors des passages ou transferts de classe." icon={<Award size={20} />} />
              ) : (
                <DataTable
                  columns={[
                    { key: 'year', header: 'Année scolaire', render: (row) => <span className="text-xs font-medium text-slate-700">{row.academicYear}</span> },
                    { key: 'class', header: 'Classe', render: (row) => <span className="text-xs text-slate-600">{row.className}</span> },
                    {
                      key: 'average',
                      header: 'Moyenne',
                      align: 'right',
                      render: (row) => <span className="text-xs text-slate-600">{row.average !== null ? `${row.average.toFixed(2)} / 20` : '—'}</span>,
                    },
                    { key: 'decision', header: 'Décision', render: (row) => <Badge tone="royal">{row.decision}</Badge> },
                  ]}
                  data={student.history}
                  rowKey={(row) => `${row.academicYear}-${row.className}`}
                  compact
                />
              )}
              <CardBody className="border-t border-slate-100">
                <Link to="/students" className="text-xs font-medium text-royal-600 hover:text-royal-700">
                  ← Retour à la liste des élèves
                </Link>
              </CardBody>
            </Card>
          ) : null}
        </CardBody>
      </Card>

      <StudentFormModal open={formOpen} onClose={() => setFormOpen(false)} student={student} classes={classes} onSaved={() => undefined} />
      <StudentTransferModal open={transferOpen} onClose={() => setTransferOpen(false)} student={student} classes={classes} onSaved={() => undefined} />
    </>
  );
}
