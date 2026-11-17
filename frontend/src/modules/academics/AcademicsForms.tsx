import { useEffect, useState } from 'react';
import type { AcademicYear, Cycle, Level, SchoolClass, Subject, Term } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Toggle } from '@/components/ui/Toggle';
import { useToast } from '@/hooks/useToast';
import { academicsService } from '@/services/academics.service';
import type { StaffDirectoryEntry } from '@/services/staff.service';
import { CYCLE_LABELS } from '@/config/labels';
import { cn } from '@/utils/format';

interface BaseModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

// ---------------------------------------------------------------------------
// Année scolaire
// ---------------------------------------------------------------------------

export function YearFormModal({ open, onClose, onSaved, year }: BaseModalProps & { year: AcademicYear | null }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(year?.name ?? '');
    setStartDate(year?.startDate ?? `${new Date().getFullYear()}-09-01`);
    setEndDate(year?.endDate ?? `${new Date().getFullYear() + 1}-06-30`);
    setIsActive(year?.isActive ?? false);
  }, [open, year]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !startDate || !endDate) {
      toast.error('Renseignez le libellé et les dates de l’année.');
      return;
    }
    if (startDate >= endDate) {
      toast.error('La date de fin doit être postérieure à la date de début.');
      return;
    }
    setSaving(true);
    try {
      if (year) await academicsService.updateYear(year.id, { name, startDate, endDate, isActive });
      else await academicsService.createYear({ name, startDate, endDate, isActive });
      toast.success(year ? 'Année scolaire mise à jour.' : 'Année scolaire créée.');
      onSaved();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={year ? 'Modifier l’année scolaire' : 'Nouvelle année scolaire'}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" form="year-form" loading={saving}>Enregistrer</Button>
        </>
      }
    >
      <form id="year-form" onSubmit={submit} className="space-y-4" noValidate>
        <Input label="Libellé" required value={name} onChange={(event) => setName(event.target.value)} placeholder="2026-2027" />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Début" type="date" required value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          <Input label="Fin" type="date" required value={endDate} onChange={(event) => setEndDate(event.target.value)} />
        </div>
        <Toggle checked={isActive} onChange={setIsActive} label="Année active" description="Une seule année peut être active à la fois." />
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Trimestre
// ---------------------------------------------------------------------------

export function TermFormModal({
  open,
  onClose,
  onSaved,
  term,
  years,
}: BaseModalProps & { term: Term | null; years: AcademicYear[] }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [yearId, setYearId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [order, setOrder] = useState('1');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(term?.name ?? '');
    setYearId(term?.academicYearId ?? years.find((year) => year.isActive)?.id ?? years[0]?.id ?? '');
    setStartDate(term?.startDate ?? '');
    setEndDate(term?.endDate ?? '');
    setOrder(String(term?.order ?? 1));
  }, [open, term, years]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !yearId || !startDate || !endDate) {
      toast.error('Renseignez tous les champs du trimestre.');
      return;
    }
    setSaving(true);
    try {
      const payload = { name, academicYearId: yearId, startDate, endDate, order: Number(order) };
      if (term) await academicsService.updateTerm(term.id, payload);
      else await academicsService.createTerm(payload);
      toast.success('Trimestre enregistré.');
      onSaved();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={term ? 'Modifier le trimestre' : 'Nouveau trimestre'}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" form="term-form" loading={saving}>Enregistrer</Button>
        </>
      }
    >
      <form id="term-form" onSubmit={submit} className="space-y-4" noValidate>
        <Input label="Libellé" required value={name} onChange={(event) => setName(event.target.value)} placeholder="Trimestre 1" />
        <Select label="Année scolaire" required value={yearId} onChange={(event) => setYearId(event.target.value)}>
          <option value="">Sélectionner…</option>
          {years.map((year) => (
            <option key={year.id} value={year.id}>{year.name}</option>
          ))}
        </Select>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Début" type="date" required value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          <Input label="Fin" type="date" required value={endDate} onChange={(event) => setEndDate(event.target.value)} />
        </div>
        <Input label="Ordre" type="number" min={1} max={6} value={order} onChange={(event) => setOrder(event.target.value)} />
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Niveau
// ---------------------------------------------------------------------------

export function LevelFormModal({ open, onClose, onSaved, level }: BaseModalProps & { level: Level | null }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [cycle, setCycle] = useState<Cycle>('college');
  const [order, setOrder] = useState('1');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(level?.name ?? '');
    setCycle(level?.cycle ?? 'college');
    setOrder(String(level?.order ?? 1));
  }, [open, level]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      toast.error('Le nom du niveau est obligatoire.');
      return;
    }
    setSaving(true);
    try {
      const payload = { name: name.trim(), cycle, order: Number(order) };
      if (level) await academicsService.updateLevel(level.id, payload);
      else await academicsService.createLevel(payload);
      toast.success('Niveau enregistré.');
      onSaved();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={level ? 'Modifier le niveau' : 'Nouveau niveau'}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" form="level-form" loading={saving}>Enregistrer</Button>
        </>
      }
    >
      <form id="level-form" onSubmit={submit} className="space-y-4" noValidate>
        <Input label="Nom du niveau" required value={name} onChange={(event) => setName(event.target.value)} placeholder="6ème" />
        <Select label="Cycle" value={cycle} onChange={(event) => setCycle(event.target.value as Cycle)}>
          {Object.entries(CYCLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </Select>
        <Input label="Ordre" type="number" min={1} value={order} onChange={(event) => setOrder(event.target.value)} />
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Classe
// ---------------------------------------------------------------------------

export function ClassFormModal({
  open,
  onClose,
  onSaved,
  schoolClass,
  levels,
  years,
  staff,
}: BaseModalProps & {
  schoolClass: SchoolClass | null;
  levels: Level[];
  years: AcademicYear[];
  staff: StaffDirectoryEntry[];
}) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [levelId, setLevelId] = useState('');
  const [yearId, setYearId] = useState('');
  const [mainTeacherId, setMainTeacherId] = useState('');
  const [room, setRoom] = useState('');
  const [capacity, setCapacity] = useState('30');
  const [tuitionFee, setTuitionFee] = useState('200000');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(schoolClass?.name ?? '');
    setLevelId(schoolClass?.levelId ?? levels[0]?.id ?? '');
    setYearId(schoolClass?.academicYearId ?? years.find((year) => year.isActive)?.id ?? years[0]?.id ?? '');
    setMainTeacherId(schoolClass?.mainTeacherId ?? '');
    setRoom(schoolClass?.room ?? '');
    setCapacity(String(schoolClass?.capacity ?? 30));
    setTuitionFee(String(schoolClass?.tuitionFee ?? 200000));
  }, [open, schoolClass, levels, years]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !levelId || !yearId) {
      toast.error('Renseignez le nom, le niveau et l’année scolaire.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        levelId,
        academicYearId: yearId,
        mainTeacherId: mainTeacherId || null,
        room,
        capacity: Number(capacity),
        tuitionFee: Number(tuitionFee),
      };
      if (schoolClass) await academicsService.updateClass(schoolClass.id, payload);
      else await academicsService.createClass(payload);
      toast.success('Classe enregistrée.');
      onSaved();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={schoolClass ? 'Modifier la classe' : 'Nouvelle classe'}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" form="class-form" loading={saving}>Enregistrer</Button>
        </>
      }
    >
      <form id="class-form" onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Nom de la classe" required value={name} onChange={(event) => setName(event.target.value)} placeholder="6ème A" />
          <Select label="Niveau" required value={levelId} onChange={(event) => setLevelId(event.target.value)}>
            <option value="">Sélectionner…</option>
            {levels.map((level) => (
              <option key={level.id} value={level.id}>{level.name}</option>
            ))}
          </Select>
          <Select label="Année scolaire" required value={yearId} onChange={(event) => setYearId(event.target.value)}>
            <option value="">Sélectionner…</option>
            {years.map((year) => (
              <option key={year.id} value={year.id}>{year.name}</option>
            ))}
          </Select>
          <Select label="Professeur principal" value={mainTeacherId} onChange={(event) => setMainTeacherId(event.target.value)}>
            <option value="">Non assigné</option>
            {staff
              .filter((member) => member.status === 'actif')
              .map((member) => (
                <option key={member.id} value={member.id}>{member.firstName} {member.lastName}</option>
              ))}
          </Select>
          <Input label="Salle" value={room} onChange={(event) => setRoom(event.target.value)} placeholder="Salle 10" />
          <Input label="Capacité" type="number" min={1} value={capacity} onChange={(event) => setCapacity(event.target.value)} />
          <Input
            label="Frais de scolarité annuels (FCFA)"
            type="number"
            min={0}
            value={tuitionFee}
            onChange={(event) => setTuitionFee(event.target.value)}
            fieldClassName="sm:col-span-2"
          />
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Matière
// ---------------------------------------------------------------------------

export function SubjectFormModal({
  open,
  onClose,
  onSaved,
  subject,
  levels,
}: BaseModalProps & { subject: Subject | null; levels: Level[] }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [coefficient, setCoefficient] = useState('1');
  const [levelIds, setLevelIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(subject?.name ?? '');
    setCode(subject?.code ?? '');
    setCoefficient(String(subject?.coefficient ?? 1));
    setLevelIds(subject?.levelIds ?? levels.map((level) => level.id));
  }, [open, subject, levels]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !code.trim()) {
      toast.error('Le nom et le code de la matière sont obligatoires.');
      return;
    }
    if (levelIds.length === 0) {
      toast.error('Sélectionnez au moins un niveau.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        coefficient: Number(coefficient),
        levelIds,
      };
      if (subject) await academicsService.updateSubject(subject.id, payload);
      else await academicsService.createSubject(payload);
      toast.success('Matière enregistrée.');
      onSaved();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={subject ? 'Modifier la matière' : 'Nouvelle matière'}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" form="subject-form" loading={saving}>Enregistrer</Button>
        </>
      }
    >
      <form id="subject-form" onSubmit={submit} className="space-y-4" noValidate>
        <Input label="Nom de la matière" required value={name} onChange={(event) => setName(event.target.value)} placeholder="Mathématiques" />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Code" required value={code} onChange={(event) => setCode(event.target.value)} placeholder="MATH" />
          <Input label="Coefficient" type="number" min={1} max={10} value={coefficient} onChange={(event) => setCoefficient(event.target.value)} />
        </div>
        <div>
          <p className="mb-2 text-xs font-medium text-slate-600">Niveaux concernés</p>
          <div className="flex flex-wrap gap-1.5">
            {levels.map((level) => {
              const selected = levelIds.includes(level.id);
              return (
                <button
                  key={level.id}
                  type="button"
                  onClick={() =>
                    setLevelIds((current) =>
                      current.includes(level.id) ? current.filter((id) => id !== level.id) : [...current, level.id],
                    )
                  }
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-[11px] font-medium transition',
                    selected ? 'border-royal-500 bg-royal-50 text-royal-700' : 'border-slate-200 text-slate-500 hover:border-slate-300',
                  )}
                >
                  {level.name}
                </button>
              );
            })}
          </div>
        </div>
      </form>
    </Modal>
  );
}
