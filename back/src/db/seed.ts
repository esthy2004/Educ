import type { Database, SchoolSettings, UserAccount } from '../types';
import { DEFAULT_ROLE_PERMISSIONS } from '../config/permissions';
import { hashPassword } from '../utils/password';

export const SUPERADMIN_USERNAME = 'admin';
export const SUPERADMIN_PASSWORD = 'admin123';

export function createDefaultSettings(): SchoolSettings {
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

export function createSuperAdmin(): UserAccount {
  return {
    id: 'usr_superadmin',
    name: 'Super-administrateur EDUFLOW',
    username: SUPERADMIN_USERNAME,
    email: 'admin@eduflow.local',
    password: hashPassword(SUPERADMIN_PASSWORD),
    role: 'superadmin',
    phone: '',
    active: true,
    createdAt: new Date().toISOString(),
    staffId: null,
    establishmentId: null,
  };
}

/**
 * Une installation neuve ne contient aucun établissement ni aucune donnée
 * fictive : uniquement le compte plateforme qui créera les écoles.
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
    users: [createSuperAdmin()],
    grades: [],
    attendance: [],
    feeStructures: [],
    invoices: [],
    payments: [],
    expenses: [],
    timetable: [],
    discipline: [],
    activities: [],
    settings: createDefaultSettings(),
  };
}
