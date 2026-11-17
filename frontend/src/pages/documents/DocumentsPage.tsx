import { useEffect, useMemo, useState } from 'react';
import { FileBadge, FileText, Printer, Receipt, Users } from 'lucide-react';
import type { AcademicYear, AcademicYear as YearType, SchoolClass, SchoolSettings, Student } from '@/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/hooks/useAuth';
import { useDataVersion } from '@/hooks/useDataVersion';
import { studentsService } from '@/services/students.service';
import { academicsService } from '@/services/academics.service';
import { paymentsService, type PaymentRow } from '@/services/finance.service';
import { settingsService } from '@/services/settings.service';
import { GENDER_LABELS, PAYMENT_METHOD_LABELS } from '@/config/labels';
import { age, formatCurrency, formatDate, formatDateLong, todayIso } from '@/utils/format';

type DocumentType = 'certificat' | 'recu' | 'liste';

export function DocumentsPage() {
  const { can } = useAuth();
  const version = useDataVersion();

  const [docType, setDocType] = useState<DocumentType>('certificat');
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [settings, setSettings] = useState<SchoolSettings | null>(null);
  const [studentId, setStudentId] = useState('');
  const [classId, setClassId] = useState('');
  const [paymentId, setPaymentId] = useState('');

  useEffect(() => {
    let active = true;
    const paymentsRequest: Promise<PaymentRow[]> = can('finance.view')
      ? paymentsService.list()
      : Promise.resolve([]);
    Promise.all([
      studentsService.list(),
      academicsService.listClasses(),
      academicsService.listYears(),
      paymentsRequest,
      settingsService.getPublic(),
    ]).then(([studentList, classList, yearList, paymentList, schoolSettings]) => {
      if (!active) return;
      const sorted = studentList.sort((a, b) => a.lastName.localeCompare(b.lastName));
      setStudents(sorted);
      setClasses(classList);
      setYears(yearList);
      setPayments(paymentList);
      setSettings(schoolSettings);
      setStudentId((current) => current || sorted[0]?.id || '');
      setClassId((current) => current || classList[0]?.id || '');
      setPaymentId((current) => current || paymentList[0]?.id || '');
    });
    return () => {
      active = false;
    };
  }, [version, can]);

  const student = students.find((item) => item.id === studentId) ?? null;
  const schoolClass = classes.find((item) => item.id === student?.classId) ?? null;
  const selectedClass = classes.find((item) => item.id === classId) ?? null;
  const payment = payments.find((item) => item.id === paymentId) ?? null;
  const activeYear: YearType | null = years.find((year) => year.isActive) ?? years[0] ?? null;

  const classStudents = useMemo(
    () =>
      students
        .filter((item) => item.classId === classId && item.status === 'actif')
        .sort((a, b) => a.lastName.localeCompare(b.lastName)),
    [students, classId],
  );

  const handlePrint = () => {
    window.print();
  };

  const canPrint = docType === 'certificat' ? Boolean(student) : docType === 'recu' ? Boolean(payment) : classStudents.length > 0;

  const header = settings ? (
    <header className="border-b-2 border-navy-900 pb-3 text-center">
      <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{settings.country} · {settings.type}</p>
      <h1 className="mt-1 text-lg font-bold uppercase tracking-wide text-navy-900">{settings.name}</h1>
      <p className="mt-0.5 text-[10px] text-slate-500">{settings.printHeader}</p>
      <p className="text-[10px] text-slate-500">
        {settings.address} · {settings.city} · Tél. {settings.phone}
      </p>
    </header>
  ) : null;

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          eyebrow="Administration"
          title="Documents"
          subtitle="Générez et imprimez les documents officiels de l’établissement."
          actions={
            <Button icon={<Printer size={15} />} onClick={handlePrint} disabled={!canPrint}>
              Imprimer le document
            </Button>
          }
        />
      </div>

      <div className="grid gap-5 print:block lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-4 print:hidden">
          <Card>
            <CardBody>
              <Tabs
                value={docType}
                onChange={(value) => setDocType(value as DocumentType)}
                items={[
                  { key: 'certificat', label: 'Certificat', icon: <FileBadge size={14} /> },
                  ...(can('finance.view')
                    ? [{ key: 'recu', label: 'Reçu', icon: <Receipt size={14} /> }]
                    : []),
                  { key: 'liste', label: 'Liste', icon: <Users size={14} /> },
                ]}
              />
              <div className="mt-4 space-y-3">
                {docType === 'certificat' ? (
                  <label className="space-y-1.5">
                    <span className="block text-xs font-medium text-slate-600">Élève</span>
                    <select
                      value={studentId}
                      onChange={(event) => setStudentId(event.target.value)}
                      className="h-9 w-full rounded-md border border-line bg-white px-3 text-[13px] text-slate-600 focus:border-royal-400 focus:outline-none focus:ring-2 focus:ring-royal-100"
                    >
                      {students.length === 0 ? <option value="">Aucun élève</option> : null}
                      {students.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.lastName} {item.firstName} — {item.matricule}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                {docType === 'recu' ? (
                  <label className="space-y-1.5">
                    <span className="block text-xs font-medium text-slate-600">Paiement</span>
                    <select
                      value={paymentId}
                      onChange={(event) => setPaymentId(event.target.value)}
                      className="h-9 w-full rounded-md border border-line bg-white px-3 text-[13px] text-slate-600 focus:border-royal-400 focus:outline-none focus:ring-2 focus:ring-royal-100"
                    >
                      {payments.length === 0 ? <option value="">Aucun paiement</option> : null}
                      {payments.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.receiptNumber} — {item.studentName}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                {docType === 'liste' ? (
                  <label className="space-y-1.5">
                    <span className="block text-xs font-medium text-slate-600">Classe</span>
                    <select
                      value={classId}
                      onChange={(event) => setClassId(event.target.value)}
                      className="h-9 w-full rounded-md border border-line bg-white px-3 text-[13px] text-slate-600 focus:border-royal-400 focus:outline-none focus:ring-2 focus:ring-royal-100"
                    >
                      {classes.length === 0 ? <option value="">Aucune classe</option> : null}
                      {classes.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                <p className="rounded-lg bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-500">
                  {docType === 'certificat'
                    ? 'Atteste l’inscription de l’élève pour l’année scolaire active.'
                    : docType === 'recu'
                      ? 'Justificatif de paiement numéroté, à remettre à la famille.'
                      : 'Liste nominative des élèves actifs de la classe.'}
                </p>
                {!can('documents.view') ? (
                  <p className="text-xs font-medium text-rose-600">Vous n’êtes pas autorisé à générer des documents.</p>
                ) : null}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="text-[11px] leading-relaxed text-slate-500">
              <p className="flex items-center gap-2 font-semibold text-slate-700">
                <FileText size={14} /> Aperçu avant impression
              </p>
              <p className="mt-1.5">
                Le document reprend l’en-tête, le pied de page et le format définis dans les paramètres d’impression.
                Utilisez « Imprimer le document » pour l’envoyer à l’imprimante ou l’enregistrer en PDF.
              </p>
            </CardBody>
          </Card>
        </div>

        <div className="overflow-x-auto rounded-lg border border-line bg-slate-100/70 p-3 shadow-card print:border-0 print:bg-white print:p-0 print:shadow-none">
          {!settings ? (
            <div className="document-sheet min-h-[500px]">
              <div className="h-full animate-pulse rounded-lg bg-slate-100" />
            </div>
          ) : !canPrint ? (
            <div className="document-sheet flex min-h-[500px] items-center justify-center">
              <EmptyState
                title="Document indisponible"
                description={
                  docType === 'liste'
                    ? 'Cette classe ne contient aucun élève actif.'
                    : 'Sélectionnez un élément pour afficher l’aperçu.'
                }
              />
            </div>
          ) : (
            <div className="document-sheet shadow-sm">
              {header}

              {docType === 'certificat' && student ? (
                <div className="py-10">
                  <h2 className="text-center text-base font-bold uppercase tracking-[0.18em] text-navy-900">
                    Certificat de scolarité
                  </h2>
                  <p className="mt-2 text-center text-[11px] text-slate-500">
                    Année scolaire {activeYear?.name ?? '—'}
                  </p>
                  <div className="mt-10 space-y-4 text-sm leading-relaxed text-slate-700">
                    <p>
                      Je soussigné(e), <span className="font-semibold">{settings.director}</span>, directeur(trice) de{' '}
                      <span className="font-semibold">{settings.name}</span>, atteste que l’élève :
                    </p>
                    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
                      <dl className="grid gap-2 sm:grid-cols-2">
                        <div>
                          <dt className="text-2xs font-semibold uppercase tracking-[0.06em] text-muted">Nom et prénoms</dt>
                          <dd className="font-semibold text-navy-900">
                            {student.lastName} {student.firstName}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-2xs font-semibold uppercase tracking-[0.06em] text-muted">Matricule</dt>
                          <dd className="font-medium">{student.matricule}</dd>
                        </div>
                        <div>
                          <dt className="text-2xs font-semibold uppercase tracking-[0.06em] text-muted">Né(e) le</dt>
                          <dd>
                            {formatDate(student.birthDate)} à {student.birthPlace || '—'} ({age(student.birthDate)} ans)
                          </dd>
                        </div>
                        <div>
                          <dt className="text-2xs font-semibold uppercase tracking-[0.06em] text-muted">Sexe</dt>
                          <dd>{GENDER_LABELS[student.gender]}</dd>
                        </div>
                        <div>
                          <dt className="text-2xs font-semibold uppercase tracking-[0.06em] text-muted">Classe</dt>
                          <dd className="font-semibold">{schoolClass?.name ?? 'Non affecté'}</dd>
                        </div>
                        <div>
                          <dt className="text-2xs font-semibold uppercase tracking-[0.06em] text-muted">Statut</dt>
                          <dd className="capitalize">{student.status}</dd>
                        </div>
                      </dl>
                    </div>
                    <p>
                      est régulièrement inscrit(e) dans notre établissement pour l’année scolaire{' '}
                      <span className="font-semibold">{activeYear?.name ?? '—'}</span>. Le présent certificat est délivré
                      pour servir et valoir ce que de droit.
                    </p>
                  </div>
                  <div className="mt-14 flex items-end justify-between text-[11px] text-slate-500">
                    <p>Fait à {settings.city}, le {formatDateLong(todayIso())}</p>
                    <div className="text-center">
                      <p className="font-semibold text-slate-700">Le Directeur</p>
                      <p className="mt-10 border-t border-slate-300 pt-1">{settings.director}</p>
                    </div>
                  </div>
                </div>
              ) : null}

              {docType === 'recu' && payment ? (
                <div className="py-10">
                  <h2 className="text-center text-base font-bold uppercase tracking-[0.18em] text-navy-900">
                    Reçu de paiement
                  </h2>
                  <p className="mt-2 text-center text-[11px] text-slate-500">N° {payment.receiptNumber}</p>
                  <div className="mt-8 rounded-lg border border-slate-200 p-4">
                    <dl className="grid gap-2.5 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-2xs font-semibold uppercase tracking-[0.06em] text-muted">Élève</dt>
                        <dd className="font-semibold text-navy-900">{payment.studentName}</dd>
                      </div>
                      <div>
                        <dt className="text-2xs font-semibold uppercase tracking-[0.06em] text-muted">Matricule</dt>
                        <dd>{payment.matricule}</dd>
                      </div>
                      <div>
                        <dt className="text-2xs font-semibold uppercase tracking-[0.06em] text-muted">Classe</dt>
                        <dd>{payment.className}</dd>
                      </div>
                      <div>
                        <dt className="text-2xs font-semibold uppercase tracking-[0.06em] text-muted">Date du paiement</dt>
                        <dd>{formatDate(payment.date)}</dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-2xs font-semibold uppercase tracking-[0.06em] text-muted">Objet</dt>
                        <dd>{payment.invoiceLabel}</dd>
                      </div>
                    </dl>
                    <div className="mt-5 flex items-center justify-between rounded-lg bg-royal-50 px-4 py-3">
                      <span className="text-xs font-semibold uppercase tracking-wide text-royal-700">Montant reçu</span>
                      <span className="text-lg font-bold text-royal-800">{formatCurrency(payment.amount)}</span>
                    </div>
                    <p className="mt-3 text-[11px] text-slate-500">
                      Mode de règlement : {PAYMENT_METHOD_LABELS[payment.method]}
                      {payment.note ? ` · ${payment.note}` : ''}
                    </p>
                  </div>
                  <p className="mt-6 text-sm text-slate-700">
                    Reçu la somme mentionnée ci-dessus pour le compte de {settings.name}. Ce reçu ne vaut qu’en
                    complément du dossier de scolarité.
                  </p>
                  <div className="mt-14 flex items-end justify-between text-[11px] text-slate-500">
                    <p>Fait à {settings.city}, le {formatDateLong(todayIso())}</p>
                    <div className="text-center">
                      <p className="font-semibold text-slate-700">Le Comptable</p>
                      <p className="mt-10 border-t border-slate-300 pt-1">{payment.recordedBy}</p>
                    </div>
                  </div>
                </div>
              ) : null}

              {docType === 'liste' ? (
                <div className="py-8">
                  <h2 className="text-center text-base font-bold uppercase tracking-[0.18em] text-navy-900">
                    Liste des élèves
                  </h2>
                  <p className="mt-2 text-center text-[11px] text-slate-500">
                    Classe {selectedClass?.name ?? '—'} · Année {activeYear?.name ?? '—'} · {classStudents.length} élève(s)
                  </p>
                  <table className="mt-6 w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-300">
                        <th className="py-2 pr-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">N°</th>
                        <th className="py-2 pr-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Matricule</th>
                        <th className="py-2 pr-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Nom et prénoms</th>
                        <th className="py-2 pr-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Sexe</th>
                        <th className="py-2 pr-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Naissance</th>
                        <th className="py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Parent / tuteur</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classStudents.map((item, index) => (
                        <tr key={item.id} className="border-b border-slate-100">
                          <td className="py-1.5 pr-2 text-slate-500">{index + 1}</td>
                          <td className="py-1.5 pr-2 font-mono text-[10px] text-slate-600">{item.matricule}</td>
                          <td className="py-1.5 pr-2 font-medium text-slate-800">
                            {item.lastName} {item.firstName}
                          </td>
                          <td className="py-1.5 pr-2 text-slate-600">{item.gender}</td>
                          <td className="py-1.5 pr-2 text-slate-600">{formatDate(item.birthDate)}</td>
                          <td className="py-1.5 text-slate-600">{item.parentName || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-12 flex items-end justify-between text-[11px] text-slate-500">
                    <p>Fait à {settings.city}, le {formatDateLong(todayIso())}</p>
                    <div className="text-center">
                      <p className="font-semibold text-slate-700">Le Directeur</p>
                      <p className="mt-10 border-t border-slate-300 pt-1">{settings.director}</p>
                    </div>
                  </div>
                </div>
              ) : null}

              <footer className="mt-8 border-t border-slate-200 pt-2 text-center text-[9px] text-slate-400">
                {settings.printFooter}
              </footer>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
