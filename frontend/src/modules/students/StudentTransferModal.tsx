import { useEffect, useState } from 'react';
import type { SchoolClass, Student } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import { useToast } from '@/hooks/useToast';
import { studentsService } from '@/services/students.service';
import { academicsService } from '@/services/academics.service';

interface StudentTransferModalProps {
  open: boolean;
  onClose: () => void;
  student: Student | null;
  classes: SchoolClass[];
  onSaved: () => void;
}

export function StudentTransferModal({ open, onClose, student, classes, onSaved }: StudentTransferModalProps) {
  const toast = useToast();
  const [classId, setClassId] = useState('');
  const [yearName, setYearName] = useState('Année en cours');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setClassId('');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    academicsService
      .listYears()
      .then((years) => {
        const activeYear = years.find((year) => year.isActive) ?? years[0];
        if (active && activeYear) setYearName(activeYear.name);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [open]);

  const currentClass = classes.find((item) => item.id === student?.classId);
  const targetClass = classes.find((item) => item.id === classId);

  const handleTransfer = async () => {
    if (!student) return;
    if (!classId) {
      toast.error('Sélectionnez la classe de destination.');
      return;
    }
    if (classId === student.classId) {
      toast.error('L’élève est déjà dans cette classe.');
      return;
    }
    setSaving(true);
    try {
      await studentsService.transfer(
        student.id,
        classId,
        currentClass?.name ?? 'Non affecté',
        yearName,
      );
      toast.success(`${student.firstName} ${student.lastName} a été transféré(e) en ${targetClass?.name}.`);
      onSaved();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Transfert impossible.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Changer de classe"
      description={student ? `Élève : ${student.firstName} ${student.lastName} (${student.matricule})` : undefined}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={handleTransfer} loading={saving}>
            Confirmer le transfert
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg bg-slate-50 px-3.5 py-2.5 text-xs text-slate-600">
          Classe actuelle : <span className="font-semibold text-slate-800">{currentClass?.name ?? 'Non affectée'}</span>
        </div>
        <Select label="Nouvelle classe" required value={classId} onChange={(event) => setClassId(event.target.value)}>
          <option value="">Sélectionner la classe de destination…</option>
          {classes
            .filter((schoolClass) => schoolClass.id !== student?.classId)
            .map((schoolClass) => (
              <option key={schoolClass.id} value={schoolClass.id}>
                {schoolClass.name} — {schoolClass.room}
              </option>
            ))}
        </Select>
        <p className="text-[11px] leading-relaxed text-slate-500">
          Le changement est enregistré dans l’historique scolaire de l’élève avec l’année {yearName}. Aucune note ni
          facture existante n’est modifiée.
        </p>
      </div>
    </Modal>
  );
}
