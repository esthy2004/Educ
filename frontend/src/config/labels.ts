import type { BadgeTone as Tone } from '@/components/ui/Badge';
import type {
  AttendanceStatus,
  Cycle,
  DisciplineSeverity,
  DisciplineType,
  GradeType,
  PaymentMethod,
  StaffRole,
  StudentStatus,
} from '@/types';

export const STUDENT_STATUS_LABELS: Record<StudentStatus, string> = {
  actif: 'Actif',
  inactif: 'Inactif',
  transfere: 'Transféré',
  diplome: 'Diplômé',
};

export const STUDENT_STATUS_TONES: Record<StudentStatus, Tone> = {
  actif: 'success',
  inactif: 'neutral',
  transfere: 'warning',
  diplome: 'royal',
};

export const GENDER_LABELS = { M: 'Masculin', F: 'Féminin' } as const;

export const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  present: 'Présent',
  absent: 'Absent',
  retard: 'Retard',
  justifie: 'Justifié',
};

export const ATTENDANCE_TONES: Record<AttendanceStatus, Tone> = {
  present: 'success',
  absent: 'danger',
  retard: 'warning',
  justifie: 'royal',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  espece: 'Espèces',
  mobile: 'Mobile money',
  virement: 'Virement',
  cheque: 'Chèque',
};

export const DISCIPLINE_TYPE_LABELS: Record<DisciplineType, string> = {
  incident: 'Incident',
  sanction: 'Sanction',
  observation: 'Observation',
};

export const DISCIPLINE_TYPE_TONES: Record<DisciplineType, Tone> = {
  incident: 'danger',
  sanction: 'warning',
  observation: 'info',
};

export const DISCIPLINE_SEVERITY_LABELS: Record<DisciplineSeverity, string> = {
  faible: 'Faible',
  moyenne: 'Moyenne',
  elevee: 'Élevée',
};

export const DISCIPLINE_SEVERITY_TONES: Record<DisciplineSeverity, Tone> = {
  faible: 'neutral',
  moyenne: 'warning',
  elevee: 'danger',
};

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  teacher: 'Enseignant',
  director: 'Directeur',
  secretary: 'Secrétaire',
  accountant: 'Comptable',
  supervisor: 'Surveillant',
  librarian: 'Bibliothécaire',
  other: 'Autre',
};

export const CYCLE_LABELS: Record<Cycle, string> = {
  primaire: 'Primaire',
  college: 'Collège',
  lycee: 'Lycée',
};

export const GRADE_TYPE_LABELS: Record<GradeType, string> = {
  devoir: 'Devoir',
  composition: 'Composition',
};

export const SCHOOL_DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'] as const;

export const INVOICE_STATUS_LABELS = {
  payee: 'Payée',
  partielle: 'Partielle',
  impayee: 'Impayée',
  retard: 'En retard',
} as const;

export const INVOICE_STATUS_TONES = {
  payee: 'success',
  partielle: 'warning',
  impayee: 'neutral',
  retard: 'danger',
} as const;
