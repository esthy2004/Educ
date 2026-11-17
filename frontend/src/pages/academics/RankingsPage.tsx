import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Award, Download, Eye, Medal, Trophy } from 'lucide-react';
import type { SchoolClass, Term } from '@/types';
import type { RankedStudent } from '@/utils/calculations';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { useDataVersion } from '@/hooks/useDataVersion';
import { academicsService } from '@/services/academics.service';
import { exportToExcel } from '@/utils/excel';
import { cn, formatDate, mention, mentionClass } from '@/utils/format';

export function RankingsPage() {
  const version = useDataVersion();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [classId, setClassId] = useState('');
  const [termId, setTermId] = useState('');
  const [ranking, setRanking] = useState<RankedStudent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    academicsService.overview().then(async (data) => {
      if (!active) return;
      setClasses(data.classes);
      const activeYear = data.years.find((year) => year.isActive) ?? data.years[0];
      const yearTerms = await academicsService.listTerms(activeYear?.id);
      if (!active) return;
      setTerms(yearTerms);
      setClassId((current) => current || data.classes[0]?.id || '');
      setTermId((current) => current || yearTerms[0]?.id || '');
    });
    return () => {
      active = false;
    };
  }, [version]);

  useEffect(() => {
    if (!classId || !termId) return;
    let active = true;
    setLoading(true);
    academicsService
      .rankings(classId, termId)
      .then((rows) => {
        if (active) setRanking(rows);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [classId, termId, version]);

  const selectedClass = classes.find((item) => item.id === classId);
  const selectedTerm = terms.find((item) => item.id === termId);

  const stats = useMemo(() => {
    const graded = ranking.filter((row) => row.average > 0);
    const total = graded.reduce((sum, row) => sum + row.average, 0);
    return {
      average: graded.length > 0 ? total / graded.length : 0,
      passing: graded.filter((row) => row.average >= 10).length,
      graded: graded.length,
      best: graded[0]?.average ?? 0,
    };
  }, [ranking]);

  const exportRanking = () => {
    exportToExcel(
      ranking.map((row) => ({
        Rang: row.rank,
        Élève: `${row.student.lastName} ${row.student.firstName}`,
        Matricule: row.student.matricule,
        Classe: selectedClass?.name ?? '',
        Trimestre: selectedTerm?.name ?? '',
        Moyenne: Number(row.average.toFixed(2)),
        Mention: mention(row.average),
        Décision: row.average >= 10 ? 'Admis' : 'Insuffisant',
      })),
      `classement-${selectedClass?.name ?? 'classe'}-${selectedTerm?.name ?? 'trimestre'}`.replace(/\s+/g, '-').toLowerCase(),
      'Classement',
    );
  };

  const columns: Array<Column<RankedStudent>> = [
    {
      key: 'rank',
      header: 'Rang',
      render: (row) => (
        <span
          className={cn(
            'inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold',
            row.rank === 1 ? 'bg-amber-100 text-amber-800' : row.rank === 2 ? 'bg-slate-200 text-slate-700' : row.rank === 3 ? 'bg-slate-100 text-slate-600' : 'bg-slate-50 text-slate-500',
          )}
        >
          {row.rank}
        </span>
      ),
    },
    {
      key: 'student',
      header: 'Élève',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <Avatar firstName={row.student.firstName} lastName={row.student.lastName} size="sm" />
          <div>
            <p className="text-xs font-medium text-slate-800">{row.student.lastName} {row.student.firstName}</p>
            <p className="text-[10px] text-slate-400">{row.student.matricule}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'average',
      header: 'Moyenne',
      align: 'right',
      render: (row) => (
        <span className={cn('text-sm font-semibold', mentionClass(row.average))}>
          {row.average > 0 ? row.average.toFixed(2) : '—'} <span className="text-[10px] font-normal text-slate-400">/ 20</span>
        </span>
      ),
    },
    { key: 'mention', header: 'Mention', render: (row) => <span className="text-xs text-slate-600">{row.average > 0 ? mention(row.average) : '—'}</span> },
    {
      key: 'decision',
      header: 'Décision',
      align: 'center',
      render: (row) => (
        <Badge tone={row.average >= 10 ? 'success' : row.average > 0 ? 'danger' : 'neutral'}>
          {row.average >= 10 ? 'Admis' : row.average > 0 ? 'Insuffisant' : 'Non évalué'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) => (
        <Link to={`/students/${row.student.id}`} className="inline-flex rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-royal-600" aria-label="Voir le dossier">
          <Eye size={15} />
        </Link>
      ),
    },
  ];

  const podium = ranking.slice(0, 3);

  return (
    <>
      <PageHeader
        eyebrow="Résultats"
        title="Classements"
        subtitle="Classement des élèves par classe et par trimestre, calculé sur les moyennes pondérées."
        actions={
          <Button variant="outline" icon={<Download size={15} />} onClick={exportRanking} disabled={ranking.length === 0}>
            Exporter Excel
          </Button>
        }
      />

      <Card className="mb-5">
        <CardBody>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">Classe</span>
              <select value={classId} onChange={(event) => setClassId(event.target.value)} className="h-9 w-full rounded-md border border-line bg-white px-3 text-[13px] text-slate-700 focus:border-royal-400 focus:outline-none focus:ring-2 focus:ring-royal-100">
                <option value="">Sélectionner…</option>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">Trimestre</span>
              <select value={termId} onChange={(event) => setTermId(event.target.value)} className="h-9 w-full rounded-md border border-line bg-white px-3 text-[13px] text-slate-700 focus:border-royal-400 focus:outline-none focus:ring-2 focus:ring-royal-100">
                <option value="">Sélectionner…</option>
                {terms.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </label>
          </div>
        </CardBody>
      </Card>

      {!loading && ranking.length === 0 ? (
        <Card>
          <EmptyState title="Aucun résultat" description="Aucune note n’est disponible pour cette classe et ce trimestre." icon={<Award size={20} />} />
        </Card>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-line bg-white p-4 shadow-card">
              <p className="text-2xs font-semibold uppercase tracking-[0.06em] text-muted">Moyenne de la classe</p>
              <p className="mt-1.5 text-[22px] font-semibold tracking-tight text-navy-900 tabular">
                {stats.average > 0 ? stats.average.toFixed(2) : '—'}
                <span className="text-sm font-normal text-muted"> / 20</span>
              </p>
              <p className="mt-2 text-2xs text-slate-400">{stats.graded} élève(s) évalué(s)</p>
            </div>
            <div className="rounded-lg border border-line bg-white p-4 shadow-card">
              <p className="text-2xs font-semibold uppercase tracking-[0.06em] text-muted">Meilleure moyenne</p>
              <p className="mt-1.5 text-[22px] font-semibold tracking-tight text-amber-700 tabular">{stats.best > 0 ? stats.best.toFixed(2) : '—'}</p>
              <p className="mt-2 text-2xs text-slate-400">{ranking[0] ? `${ranking[0].student.firstName} ${ranking[0].student.lastName}` : '—'}</p>
            </div>
            <div className="rounded-lg border border-line bg-white p-4 shadow-card">
              <p className="text-2xs font-semibold uppercase tracking-[0.06em] text-muted">Taux de réussite</p>
              <p className="mt-1.5 text-[22px] font-semibold tracking-tight text-emerald-700 tabular">{stats.graded > 0 ? Math.round((stats.passing / stats.graded) * 100) : 0} %</p>
              <p className="mt-2 text-2xs text-slate-400">{stats.passing} élève(s) ≥ 10/20</p>
            </div>
            <div className="rounded-lg border border-line bg-white p-4 shadow-card">
              <p className="text-2xs font-semibold uppercase tracking-[0.06em] text-muted">Période</p>
              <p className="mt-1.5 text-base font-semibold text-navy-900">{selectedTerm?.name ?? '—'}</p>
              <p className="mt-2 text-2xs text-slate-400">{selectedClass?.name ?? '—'}{selectedTerm ? ` · ${formatDate(selectedTerm.endDate)}` : ''}</p>
            </div>
          </div>

          {podium.length >= 3 ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {podium.map((row, index) => {
                const styles = [
                  { ring: 'ring-amber-200', bg: 'bg-amber-50/60', icon: <Trophy size={18} className="text-amber-500" />, label: '1er' },
                  { ring: 'ring-slate-200', bg: 'bg-slate-50/60', icon: <Medal size={18} className="text-slate-400" />, label: '2e' },
                  { ring: 'ring-slate-200', bg: 'bg-slate-50', icon: <Medal size={18} className="text-slate-500" />, label: '3e' },
                ][index];
                return (
                  <div key={row.student.id} className={cn('flex items-center gap-3 rounded-lg border border-line p-4', styles.bg, index === 0 && 'sm:-mt-1 sm:mb-1')}>
                    <div className="relative">
                      <Avatar firstName={row.student.firstName} lastName={row.student.lastName} size="lg" />
                      <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[9px] font-bold text-slate-600 shadow">
                        {row.rank}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {styles.icon}
                        <p className="truncate text-sm font-semibold text-navy-900">{row.student.lastName} {row.student.firstName}</p>
                      </div>
                      <p className="text-[11px] text-slate-500">{row.student.matricule} · {mention(row.average)}</p>
                      <p className={cn('mt-0.5 text-lg font-semibold', mentionClass(row.average))}>{row.average.toFixed(2)} / 20</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          <Card>
            <CardHeader
              title={`Classement — ${selectedClass?.name ?? ''}`}
              subtitle={`${ranking.length} élève(s) · ${selectedTerm?.name ?? ''}`}
              action={<Badge tone="royal">{stats.graded} évalué(s)</Badge>}
            />
            <DataTable columns={columns} data={ranking} rowKey={(row) => row.student.id} loading={loading} compact />
          </Card>
        </div>
      )}
    </>
  );
}
