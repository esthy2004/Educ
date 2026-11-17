import type { Database, SchoolSettings } from '@/types';
import { DEFAULT_ROLE_PERMISSIONS } from '@/config/permissions';

function defaultSettings(): SchoolSettings {
  return {
    name: 'EDUFLOW',
    shortName: 'EDUFLOW',
    type: '',
    address: '',
    city: '',
    country: '',
    phone: '',
    email: '',
    website: '',
    director: '',
    logo: '',
    currency: 'FCFA',
    motto: '',
    dateFormat: 'dd/MM/yyyy',
    printHeader: '',
    printFooter: '',
    paperSize: 'A4',
    showLogoOnDocuments: true,
    rolePermissions: JSON.parse(JSON.stringify(DEFAULT_ROLE_PERMISSIONS)) as SchoolSettings['rolePermissions'],
  };
}

/**
 * Jeu de démarrage local minimal : aucun établissement et aucun compte
 * métier. Le compte super-administrateur est créé par le serveur.
 */
export function seedDatabase(): Database {
  return {
    version: 3,
    establishments: [],
    academicYears: [],
    terms: [],
    levels: [],
    classes: [],
    subjects: [],
    students: [],
    staff: [],
    users: [],
    grades: [],
    attendance: [],
    feeStructures: [],
    invoices: [],
    payments: [],
    expenses: [],
    timetable: [],
    discipline: [],
    activities: [],
    settings: defaultSettings(),
  };
}
