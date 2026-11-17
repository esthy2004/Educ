import type { PermissionKey, Role } from '../types';

export const ALL_PERMISSIONS: { key: PermissionKey; label: string; group: string }[] = [
  { key: 'dashboard.view', label: 'Voir le tableau de bord', group: 'Général' },
  { key: 'students.view', label: 'Consulter les élèves', group: 'Élèves' },
  { key: 'students.manage', label: 'Créer / modifier / supprimer des élèves', group: 'Élèves' },
  { key: 'staff.view', label: 'Consulter le personnel', group: 'Personnel' },
  { key: 'staff.manage', label: 'Gérer le personnel', group: 'Personnel' },
  { key: 'academics.view', label: 'Consulter les classes et matières', group: 'Académique' },
  { key: 'academics.manage', label: 'Gérer les années, niveaux et classes', group: 'Académique' },
  { key: 'grades.manage', label: 'Saisir les notes et bulletins', group: 'Académique' },
  { key: 'attendance.view', label: 'Consulter les présences', group: 'Vie scolaire' },
  { key: 'attendance.manage', label: 'Saisir les présences et justifications', group: 'Vie scolaire' },
  { key: 'finance.view', label: 'Consulter les finances', group: 'Finances' },
  { key: 'finance.manage', label: 'Encaisser et gérer les dépenses', group: 'Finances' },
  { key: 'timetable.view', label: "Consulter l'emploi du temps", group: 'Vie scolaire' },
  { key: 'timetable.manage', label: "Gérer l'emploi du temps", group: 'Vie scolaire' },
  { key: 'discipline.view', label: 'Consulter la discipline', group: 'Vie scolaire' },
  { key: 'discipline.manage', label: 'Enregistrer incidents et sanctions', group: 'Vie scolaire' },
  { key: 'documents.view', label: 'Générer des documents', group: 'Documents' },
  { key: 'settings.view', label: "Voir les paramètres de l'établissement", group: "Paramètres" },
  { key: 'settings.manage', label: "Modifier les paramètres", group: "Paramètres" },
  { key: 'users.manage', label: 'Gérer les utilisateurs', group: 'Paramètres' },
];

const ALL_KEYS = ALL_PERMISSIONS.map((p) => p.key);

export const DEFAULT_ROLE_PERMISSIONS: Record<Role, PermissionKey[]> = {
  // Le super-administrateur pilote les établissements via une API dédiée ;
  // il n'a volontairement accès à aucune donnée métier d'une école.
  superadmin: [],
  admin: ALL_KEYS,
  director: ALL_KEYS.filter((key) => key !== 'users.manage'),
  secretary: [
    'dashboard.view',
    'students.view',
    'students.manage',
    'staff.view',
    'academics.view',
    'attendance.view',
    'attendance.manage',
    'finance.view',
    'timetable.view',
    'discipline.view',
    'documents.view',
  ],
  accountant: [
    'dashboard.view',
    'students.view',
    'staff.view',
    'finance.view',
    'finance.manage',
    'documents.view',
  ],
  teacher: [
    'dashboard.view',
    'students.view',
    'academics.view',
    'grades.manage',
    'attendance.view',
    'attendance.manage',
    'timetable.view',
    'discipline.view',
    'discipline.manage',
    'documents.view',
  ],
};

export const ROLE_LABELS: Record<Role, string> = {
  superadmin: 'Super-administrateur',
  admin: 'Administrateur',
  director: 'Directeur',
  secretary: 'Secrétaire',
  accountant: 'Comptable',
  teacher: 'Enseignant',
};

export const ROLE_BADGE_CLASSES: Record<Role, string> = {
  superadmin: 'bg-navy-50 text-navy-700 ring-navy-200',
  admin: 'bg-royal-50 text-royal-700 ring-royal-200',
  director: 'bg-violet-50 text-violet-700 ring-violet-200',
  secretary: 'bg-teal-50 text-teal-700 ring-teal-200',
  accountant: 'bg-amber-50 text-amber-700 ring-amber-200',
  teacher: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
};
