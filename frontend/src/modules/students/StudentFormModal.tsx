import { useEffect, useState } from 'react';
import type { Gender, SchoolClass, Student, StudentStatus } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/hooks/useToast';
import { studentsService } from '@/services/students.service';
import { todayIso } from '@/utils/format';

interface StudentFormModalProps {
  open: boolean;
  onClose: () => void;
  student: Student | null;
  classes: SchoolClass[];
  onSaved: () => void;
}

interface FormState {
  firstName: string;
  lastName: string;
  gender: Gender;
  birthDate: string;
  birthPlace: string;
  classId: string;
  status: StudentStatus;
  enrollmentDate: string;
  address: string;
  parentName: string;
  parentRelation: string;
  parentPhone: string;
  parentEmail: string;
  parentAddress: string;
  bloodType: string;
  allergies: string;
  notes: string;
}

const emptyForm: FormState = {
  firstName: '',
  lastName: '',
  gender: 'M',
  birthDate: '',
  birthPlace: '',
  classId: '',
  status: 'actif',
  enrollmentDate: todayIso(),
  address: '',
  parentName: '',
  parentRelation: 'Père',
  parentPhone: '',
  parentEmail: '',
  parentAddress: '',
  bloodType: 'Inconnu',
  allergies: '',
  notes: '',
};

const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Inconnu'];

export function StudentFormModal({ open, onClose, student, classes, onSaved }: StudentFormModalProps) {
  const toast = useToast();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    if (student) {
      setForm({
        firstName: student.firstName,
        lastName: student.lastName,
        gender: student.gender,
        birthDate: student.birthDate,
        birthPlace: student.birthPlace,
        classId: student.classId ?? '',
        status: student.status,
        enrollmentDate: student.enrollmentDate,
        address: student.address,
        parentName: student.parentName,
        parentRelation: student.parentRelation,
        parentPhone: student.parentPhone,
        parentEmail: student.parentEmail,
        parentAddress: student.parentAddress,
        bloodType: student.bloodType,
        allergies: student.allergies,
        notes: student.notes,
      });
    } else {
      setForm(emptyForm);
    }
  }, [open, student]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const validate = (): boolean => {
    const nextErrors: Partial<Record<keyof FormState, string>> = {};
    if (!form.firstName.trim()) nextErrors.firstName = 'Le prénom est obligatoire.';
    if (!form.lastName.trim()) nextErrors.lastName = 'Le nom est obligatoire.';
    if (!form.birthDate) nextErrors.birthDate = 'La date de naissance est obligatoire.';
    if (!form.classId) nextErrors.classId = 'Sélectionnez une classe.';
    if (!form.parentName.trim()) nextErrors.parentName = 'Le nom du parent ou tuteur est obligatoire.';
    if (!form.parentPhone.trim()) nextErrors.parentPhone = 'Le téléphone du parent est obligatoire.';
    if (form.parentEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.parentEmail)) {
      nextErrors.parentEmail = 'Adresse e-mail invalide.';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        classId: form.classId || null,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
      };
      if (student) {
        await studentsService.update(student.id, payload);
        toast.success('Le dossier de l’élève a été mis à jour.');
      } else {
        await studentsService.create(payload);
        toast.success('Nouvel élève inscrit avec succès.');
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
      title={student ? 'Modifier le dossier élève' : 'Inscrire un nouvel élève'}
      description={
        student
          ? `Matricule ${student.matricule} — les informations sont enregistrées localement.`
          : 'Renseignez l’identité, la scolarité et les coordonnées du parent ou tuteur.'
      }
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="student-form" loading={saving}>
            {student ? 'Enregistrer les modifications' : 'Inscrire l’élève'}
          </Button>
        </>
      }
    >
      <form id="student-form" onSubmit={handleSubmit} className="space-y-6" noValidate>
        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Identité de l’élève</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Prénom"
              required
              value={form.firstName}
              onChange={(event) => set('firstName', event.target.value)}
              error={errors.firstName}
              placeholder="ex. Awa"
            />
            <Input
              label="Nom"
              required
              value={form.lastName}
              onChange={(event) => set('lastName', event.target.value)}
              error={errors.lastName}
              placeholder="ex. Diop"
            />
            <Select label="Sexe" value={form.gender} onChange={(event) => set('gender', event.target.value as Gender)}>
              <option value="M">Masculin</option>
              <option value="F">Féminin</option>
            </Select>
            <Input
              label="Date de naissance"
              type="date"
              required
              value={form.birthDate}
              onChange={(event) => set('birthDate', event.target.value)}
              error={errors.birthDate}
            />
            <Input
              label="Lieu de naissance"
              value={form.birthPlace}
              onChange={(event) => set('birthPlace', event.target.value)}
              placeholder="ex. Cotonou"
            />
            <Select
              label="Groupe sanguin"
              value={form.bloodType}
              onChange={(event) => set('bloodType', event.target.value)}
            >
              {bloodTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Scolarité</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Classe"
              required
              value={form.classId}
              onChange={(event) => set('classId', event.target.value)}
              error={errors.classId}
            >
              <option value="">Sélectionner une classe…</option>
              {classes.map((schoolClass) => (
                <option key={schoolClass.id} value={schoolClass.id}>
                  {schoolClass.name}
                </option>
              ))}
            </Select>
            <Select
              label="Statut"
              value={form.status}
              onChange={(event) => set('status', event.target.value as StudentStatus)}
            >
              <option value="actif">Actif</option>
              <option value="inactif">Inactif</option>
              <option value="transfere">Transféré</option>
              <option value="diplome">Diplômé</option>
            </Select>
            <Input
              label="Date d’inscription"
              type="date"
              value={form.enrollmentDate}
              onChange={(event) => set('enrollmentDate', event.target.value)}
            />
            <Input
              label="Adresse de l’élève"
              value={form.address}
              onChange={(event) => set('address', event.target.value)}
              placeholder="ex. 12 rue des Écoles, Cotonou"
            />
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Parent ou tuteur</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Nom complet"
              required
              value={form.parentName}
              onChange={(event) => set('parentName', event.target.value)}
              error={errors.parentName}
              placeholder="ex. M. Koffi Adjovi"
            />
            <Select
              label="Lien avec l’élève"
              value={form.parentRelation}
              onChange={(event) => set('parentRelation', event.target.value)}
            >
              <option value="Père">Père</option>
              <option value="Mère">Mère</option>
              <option value="Tuteur">Tuteur</option>
            </Select>
            <Input
              label="Téléphone"
              type="tel"
              required
              value={form.parentPhone}
              onChange={(event) => set('parentPhone', event.target.value)}
              error={errors.parentPhone}
              placeholder="+229 97 00 00 00"
            />
            <Input
              label="E-mail"
              type="email"
              value={form.parentEmail}
              onChange={(event) => set('parentEmail', event.target.value)}
              error={errors.parentEmail}
              placeholder="parent@mail.com"
            />
            <Input
              label="Adresse du parent"
              value={form.parentAddress}
              onChange={(event) => set('parentAddress', event.target.value)}
              fieldClassName="sm:col-span-2"
            />
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Suivi médical et observations</h3>
          <div className="grid gap-4">
            <Input
              label="Allergies / précautions"
              value={form.allergies}
              onChange={(event) => set('allergies', event.target.value)}
              placeholder="Aucune allergie connue"
            />
            <Textarea
              label="Observations internes"
              value={form.notes}
              onChange={(event) => set('notes', event.target.value)}
              placeholder="Informations utiles au suivi de l’élève…"
            />
          </div>
        </section>
      </form>
    </Modal>
  );
}
