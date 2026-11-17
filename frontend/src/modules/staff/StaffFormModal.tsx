import { useEffect, useState } from 'react';
import type { Gender, SchoolClass, Staff, StaffRole, Subject } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { useToast } from '@/hooks/useToast';
import { staffService } from '@/services/staff.service';
import { cn, todayIso } from '@/utils/format';
import { STAFF_ROLE_LABELS } from '@/config/labels';

interface StaffFormModalProps {
  open: boolean;
  onClose: () => void;
  member: Staff | null;
  subjects: Subject[];
  classes: SchoolClass[];
  onSaved: () => void;
}

interface FormState {
  firstName: string;
  lastName: string;
  gender: Gender;
  role: StaffRole;
  email: string;
  phone: string;
  address: string;
  hireDate: string;
  contractType: Staff['contractType'];
  qualification: string;
  salary: string;
  subjectIds: string[];
  classIds: string[];
  status: Staff['status'];
}

const emptyForm: FormState = {
  firstName: '',
  lastName: '',
  gender: 'M',
  role: 'teacher',
  email: '',
  phone: '',
  address: '',
  hireDate: todayIso(),
  contractType: 'CDI',
  qualification: '',
  salary: '',
  subjectIds: [],
  classIds: [],
  status: 'actif',
};

export function StaffFormModal({ open, onClose, member, subjects, classes, onSaved }: StaffFormModalProps) {
  const toast = useToast();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    if (member) {
      setForm({
        firstName: member.firstName,
        lastName: member.lastName,
        gender: member.gender,
        role: member.role,
        email: member.email,
        phone: member.phone,
        address: member.address,
        hireDate: member.hireDate,
        contractType: member.contractType,
        qualification: member.qualification,
        salary: String(member.salary),
        subjectIds: member.subjectIds,
        classIds: member.classIds,
        status: member.status,
      });
    } else {
      setForm(emptyForm);
    }
  }, [open, member]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const toggleIn = (key: 'subjectIds' | 'classIds', id: string) => {
    setForm((current) => ({
      ...current,
      [key]: current[key].includes(id) ? current[key].filter((item) => item !== id) : [...current[key], id],
    }));
  };

  const validate = (): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.firstName.trim()) next.firstName = 'Le prénom est obligatoire.';
    if (!form.lastName.trim()) next.lastName = 'Le nom est obligatoire.';
    if (!form.email.trim()) next.email = 'L’e-mail est obligatoire.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = 'Adresse e-mail invalide.';
    if (!form.phone.trim()) next.phone = 'Le téléphone est obligatoire.';
    if (!form.hireDate) next.hireDate = 'La date d’embauche est obligatoire.';
    if (!form.salary || Number(form.salary) <= 0) next.salary = 'Indiquez un salaire mensuel valide.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        salary: Number(form.salary),
      };
      if (member) {
        await staffService.update(member.id, payload);
        toast.success('La fiche du membre a été mise à jour.');
      } else {
        await staffService.create(payload);
        toast.success('Nouveau membre ajouté à l’équipe.');
      }
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
      title={member ? 'Modifier la fiche personnel' : 'Ajouter un membre du personnel'}
      description={member ? `Matricule ${member.matricule}` : 'Enseignant, direction, secrétariat, comptabilité ou surveillance.'}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="staff-form" loading={saving}>
            {member ? 'Enregistrer' : 'Ajouter le membre'}
          </Button>
        </>
      }
    >
      <form id="staff-form" onSubmit={handleSubmit} className="space-y-6" noValidate>
        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Identité professionnelle</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Prénom" required value={form.firstName} onChange={(event) => set('firstName', event.target.value)} error={errors.firstName} />
            <Input label="Nom" required value={form.lastName} onChange={(event) => set('lastName', event.target.value)} error={errors.lastName} />
            <Select label="Sexe" value={form.gender} onChange={(event) => set('gender', event.target.value as Gender)}>
              <option value="M">Masculin</option>
              <option value="F">Féminin</option>
            </Select>
            <Select label="Fonction" value={form.role} onChange={(event) => set('role', event.target.value as StaffRole)}>
              {Object.entries(STAFF_ROLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <Input label="E-mail" type="email" required value={form.email} onChange={(event) => set('email', event.target.value)} error={errors.email} />
            <Input label="Téléphone" type="tel" required value={form.phone} onChange={(event) => set('phone', event.target.value)} error={errors.phone} />
            <Input label="Adresse" value={form.address} onChange={(event) => set('address', event.target.value)} fieldClassName="sm:col-span-2" />
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Contrat & rémunération</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Date d’embauche"
              type="date"
              required
              value={form.hireDate}
              onChange={(event) => set('hireDate', event.target.value)}
              error={errors.hireDate}
            />
            <Select
              label="Type de contrat"
              value={form.contractType}
              onChange={(event) => set('contractType', event.target.value as Staff['contractType'])}
            >
              <option value="CDI">CDI</option>
              <option value="CDD">CDD</option>
              <option value="Vacataire">Vacataire</option>
            </Select>
            <Input
              label="Salaire mensuel (FCFA)"
              type="number"
              min={0}
              required
              value={form.salary}
              onChange={(event) => set('salary', event.target.value)}
              error={errors.salary}
            />
            <Select label="Statut" value={form.status} onChange={(event) => set('status', event.target.value as Staff['status'])}>
              <option value="actif">Actif</option>
              <option value="inactif">Inactif</option>
            </Select>
            <Input
              label="Diplôme / qualification"
              value={form.qualification}
              onChange={(event) => set('qualification', event.target.value)}
              fieldClassName="sm:col-span-2"
            />
          </div>
        </section>

        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Matières enseignées</h3>
          <p className="mb-2.5 text-[11px] text-slate-400">Concerne les enseignants. Sélectionnez une ou plusieurs matières.</p>
          <div className="flex flex-wrap gap-1.5">
            {subjects.map((subject) => {
              const selected = form.subjectIds.includes(subject.id);
              return (
                <button
                  key={subject.id}
                  type="button"
                  onClick={() => toggleIn('subjectIds', subject.id)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-[11px] font-medium transition',
                    selected
                      ? 'border-royal-500 bg-royal-50 text-royal-700'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300',
                  )}
                >
                  {subject.name}
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Classes attribuées</h3>
          <p className="mb-2.5 text-[11px] text-slate-400">Classes dont le membre assure le suivi ou l’enseignement principal.</p>
          <div className="flex flex-wrap gap-1.5">
            {classes.map((schoolClass) => {
              const selected = form.classIds.includes(schoolClass.id);
              return (
                <button
                  key={schoolClass.id}
                  type="button"
                  onClick={() => toggleIn('classIds', schoolClass.id)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-[11px] font-medium transition',
                    selected
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300',
                  )}
                >
                  {schoolClass.name}
                </button>
              );
            })}
          </div>
        </section>
      </form>
    </Modal>
  );
}
