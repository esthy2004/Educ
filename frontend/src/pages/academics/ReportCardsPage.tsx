import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, Printer, Users } from 'lucide-react';
import type { AcademicYear, SchoolClass, SchoolSettings, Student, Term } from '@/types';
import type { ReportCardData } from '@/services/academics.service';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { useDataVersion } from '@/hooks/useDataVersion';
import { academicsService } from '@/services/academics.service';
import { studentsService } from '@/services/students.service';
import { settingsService } from '@/services/settings.service';
import { cn, formatDate, mention, mentionClass } from '@/utils/format';

export function ReportCardsPage() {
  const [searchParams] = useSearchParams();
  const version = useDataVersion();
  const [settings, setSettings] = useState<SchoolSettings | null>(null);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classId, setClassId] = useState('');
  const [termId, setTermId] = useState('');
  const [studentId, setStudentId] = useState(searchParams.get('student') ?? '');
  const [reports, setReports] = useState<ReportCardData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    academicsService.overview().then(async (data) => {
      if (!active) return;
      const activeYear = data.years.find((year) => year.isActive) ?? data.years[0];
      const yearTerms = await academicsService.listTerms(activeYear?.id);
      if (!active) return;
      settingsService
        .getPublic()
        .then((value) => {
          if (active) setSettings(value);
        })
        .catch(() => undefined);
      setYears(data.years);
      setClasses(data.classes);
      setTerms(yearTerms);
      const queryStudent = searchParams.get('student');
      if (queryStudent) {
        const student = await studentsService.get(queryStudent);
        if (student && active) {
          setClassId(student.classId ?? '');
          setStudentId(student.id);
        }
      } else {
        setClassId((current) => current || data.classes[0]?.id || '');
      }
      setTermId(searchParams.get('term') ?? yearTerms[0]?.id ?? '');
      setLoading(false);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  useEffect(() => {
    if (!classId) return;
    let active = true;
    studentsService.list({ classId, status: 'actif' }).then((list) => {
      if (active) setStudents(list.sort((a, b) => a.lastName.localeCompare(b.lastName)));
    });
    return () => {
      active = false;
    };
  }, [classId]);

  useEffect(() => {
    if (!termId) return;
    let active = true;
    setLoading(true);
    const targets = studentId ? students.filter((student) => student.id === studentId) : students;
    Promise.all(targets.map((student) => academicsService.reportCard(student.id, termId)))
      .then((data) => {
        if (active) setReports(data);
      })
      .catch(() => {
        if (active) setReports([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [termId, studentId, students, version]);

  const selectedClass = classes.find((schoolClass) => schoolClass.id === classId);
  const selectedTerm = terms.find((term) => term.id === termId);
  const selectedYear = years.find((year) => year.id === selectedTerm?.academicYearId);
  const selectedStudent = students.find((student) => student.id === studentId);
  const averageOfClass = useMemo(() => {
    const values = reports.map((report) => report.average).filter((value) => value > 0);
    return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  }, [reports]);

  const handlePrint = () => window.print();

  return (
    <>
      <PageHeader
        eyebrow="Évaluation"
        title="Bulletins scolaires"
        subtitle="Générez et imprimez les bulletins trimestriels individuels ou de toute une classe."
        actions={
          <>
            <Button variant="outline" icon={<ChevronLeft size={15} />} onClick={() => setStudentId('')} disabled={!studentId}>
              Toute la classe
            </Button>
            <Button icon={<Printer size={15} />} onClick={handlePrint} disabled={reports.length === 0}>
              Imprimer
            </Button>
          </>
        }
      />

      <Card className="mb-5 print:hidden">
        <CardBody>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">Classe</span>
              <select
                value={classId}
                onChange={(event) => {
                  setClassId(event.target.value);
                  setStudentId('');
                }}
                className="h-9 w-full rounded-md border border-line bg-white px-3 text-[13px] text-slate-700 focus:border-royal-400 focus:outline-none focus:ring-2 focus:ring-royal-100"
              >
                {classes.map((schoolClass) => (
                  <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">Trimestre</span>
              <select value={termId} onChange={(event) => setTermId(event.target.value)} className="h-9 w-full rounded-md border border-line bg-white px-3 text-[13px] text-slate-700 focus:border-royal-400 focus:outline-none focus:ring-2 focus:ring-royal-100">
                {terms.map((term) => (
                  <option key={term.id} value={term.id}>{term.name}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">Élève</span>
              <select
                value={studentId}
                onChange={(event) => setStudentId(event.target.value)}
                className="h-9 w-full rounded-md border border-line bg-white px-3 text-[13px] text-slate-700 focus:border-royal-400 focus:outline-none focus:ring-2 focus:ring-royal-100"
              >
                <option value="">Toute la classe ({students.length})</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>{student.lastName} {student.firstName}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
            <Badge tone="royal">{selectedClass?.name ?? '—'}</Badge>
            <Badge tone="neutral">{selectedTerm?.name ?? '—'}</Badge>
            <span>Moyenne de la sélection : <strong className="text-slate-600">{averageOfClass > 0 ? averageOfClass.toFixed(2) : '—'} / 20</strong></span>
            {selectedStudent ? <span>· {selectedStudent.matricule}</span> : null}
          </div>
        </CardBody>
      </Card>

      {loading ? (
        <Card className="print:hidden">
          <div className="space-y-3 p-6">
            <div className="h-64 animate-pulse rounded bg-slate-100" />
          </div>
        </Card>
      ) : reports.length === 0 ? (
        <Card className="print:hidden">
          <EmptyState title="Aucun bulletin disponible" description="Sélectionnez une classe et un trimestre disposant de notes." icon={<Users size={20} />} />
        </Card>
      ) : (
        <div className="space-y-6">
          {reports.map((report, index) => (
            <div
              key={report.student.id}
              className={cn('document-sheet rounded-lg shadow-card ring-1 ring-slate-200 print:ring-0', index < reports.length - 1 && 'print:break-after-page')}
            >
              <div className="flex items-start justify-between border-b-2 border-navy-900 pb-4">
                <div className="flex items-start gap-3">
                  {settings?.showLogoOnDocuments !== false ? (
                    <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-navy-900 text-lg font-bold text-white">
                      {settings?.shortName?.slice(0, 2).toUpperCase() ?? 'EF'}
                    </div>
                  ) : null}
                  <div>
                    <h2 className="text-base font-bold uppercase tracking-wide text-navy-900">{settings?.name ?? 'EDUFLOW'}</h2>
                    <p className="text-[10px] text-slate-500">{settings?.address} · {settings?.city}</p>
                    <p className="text-[10px] text-slate-500">{settings?.phone} · {settings?.email}</p>
                    <p className="text-[10px] italic text-slate-400">{settings?.motto}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold uppercase tracking-wider text-royal-700">Bulletin de notes</p>
                  <p className="text-[11px] text-slate-500">{selectedYear?.name ?? report.year?.name ?? '—'}</p>
                  <p className="text-[11px] font-medium text-slate-600">{report.term.name}</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-1 rounded-lg bg-slate-50 p-3 text-[11px] sm:grid-cols-4">
                <div>
                  <p className="text-[9px] uppercase tracking-wide text-slate-400">Élève</p>
                  <p className="font-semibold text-slate-800">{report.student.lastName} {report.student.firstName}</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-wide text-slate-400">Matricule</p>
                  <p className="font-mono text-slate-700">{report.student.matricule}</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-wide text-slate-400">Classe</p>
                  <p className="text-slate-700">{report.schoolClass.name}</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-wide text-slate-400">Professeur principal</p>
                  <p className="text-slate-700">{report.mainTeacher}</p>
                </div>
              </div>

              <table className="mt-4 w-full border-collapse text-[11px]">
                <thead>
                  <tr className="bg-navy-900 text-white">
                    <th className="px-2 py-2 text-left font-medium">Matière</th>
                    <th className="px-2 py-2 text-center font-medium">Coef.</th>
                    <th className="px-2 py-2 text-center font-medium">Moyenne /20</th>
                    <th className="px-2 py-2 text-center font-medium">Moyenne × coef.</th>
                    <th className="px-2 py-2 text-center font-medium">Appréciation</th>
                  </tr>
                </thead>
                <tbody>
                  {report.results.map((result) => (
                    <tr key={result.subject.id} className="border-b border-slate-100">
                      <td className="px-2 py-1.5 text-slate-700">{result.subject.name}</td>
                      <td className="px-2 py-1.5 text-center text-slate-600">{result.coefficient}</td>
                      <td className={cn('px-2 py-1.5 text-center font-semibold', mentionClass(result.average))}>{result.average.toFixed(2)}</td>
                      <td className="px-2 py-1.5 text-center text-slate-600">{(result.average * result.coefficient).toFixed(2)}</td>
                      <td className="px-2 py-1.5 text-center text-slate-500">{mention(result.average)}</td>
                    </tr>
                  ))}
                  {report.results.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-2 py-4 text-center text-slate-400">Aucune note saisie pour ce trimestre.</td>
                    </tr>
                  ) : null}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold text-slate-800">
                    <td className="px-2 py-2">Total</td>
                    <td className="px-2 py-2 text-center">{report.totalCoefficients}</td>
                    <td className="px-2 py-2 text-center">{report.average > 0 ? report.average.toFixed(2) : '—'}</td>
                    <td className="px-2 py-2 text-center">{report.results.reduce((sum, result) => sum + result.average * result.coefficient, 0).toFixed(2)}</td>
                    <td className="px-2 py-2 text-center">{report.average > 0 ? mention(report.average) : '—'}</td>
                  </tr>
                </tfoot>
              </table>

              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                <div className="rounded-lg border border-slate-200 p-2.5 text-center">
                  <p className="text-[9px] uppercase tracking-wide text-slate-400">Moyenne générale</p>
                  <p className={cn('mt-0.5 text-lg font-bold', mentionClass(report.average))}>{report.average > 0 ? report.average.toFixed(2) : '—'} /20</p>
                </div>
                <div className="rounded-lg border border-slate-200 p-2.5 text-center">
                  <p className="text-[9px] uppercase tracking-wide text-slate-400">Rang</p>
                  <p className="mt-0.5 text-lg font-bold text-navy-900">{report.rank > 0 ? `${report.rank}e` : '—'} <span className="text-[10px] font-normal text-slate-400">/ {report.classSize}</span></p>
                </div>
                <div className="rounded-lg border border-slate-200 p-2.5 text-center">
                  <p className="text-[9px] uppercase tracking-wide text-slate-400">Assiduité</p>
                  <p className="mt-0.5 text-lg font-bold text-navy-900">{report.attendance.rate} %</p>
                  <p className="text-[9px] text-slate-400">{report.attendance.absent} absence(s)</p>
                </div>
                <div className="rounded-lg border border-slate-200 p-2.5 text-center">
                  <p className="text-[9px] uppercase tracking-wide text-slate-400">Mention</p>
                  <p className="mt-0.5 text-sm font-bold text-navy-900">{report.average > 0 ? mention(report.average) : '—'}</p>
                </div>
              </div>

              <div className="mt-4">
                <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Appréciation du conseil de classe</p>
                <p className="mt-1 min-h-[38px] rounded border border-slate-200 p-2 text-[11px] italic text-slate-600">{report.teacherComment}</p>
              </div>

              <div className="mt-6 flex items-end justify-between text-[10px] text-slate-500">
                <div>
                  <p className="italic">{settings?.printFooter || 'Document généré par EDUFLOW'}</p>
                  <p className="mt-1 text-[9px] text-slate-400">Édité le {formatDate(new Date())}</p>
                </div>
                <div className="flex gap-10 text-center">
                  <div>
                    <p className="font-medium text-slate-600">Le professeur principal</p>
                    <p className="mt-6 border-t border-dashed border-slate-300 pt-1 text-[9px] text-slate-400">Signature</p>
                  </div>
                  <div>
                    <p className="font-medium text-slate-600">La direction</p>
                    <p className="mt-6 border-t border-dashed border-slate-300 pt-1 text-[9px] text-slate-400">{settings?.director}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
