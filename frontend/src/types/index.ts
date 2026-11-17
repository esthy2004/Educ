// ---------------------------------------------------------------------------
// EDUFLOW — Types métier partagés
// Ces types décrivent le contrat de données de l'API EDUFLOW (back/src/types.ts).
// ---------------------------------------------------------------------------

export type Role = 'superadmin' | 'admin' | 'director' | 'secretary' | 'accountant' | 'teacher';

export type Gender = 'M' | 'F';

export type Cycle = 'primaire' | 'college' | 'lycee';

export type StudentStatus = 'actif' | 'inactif' | 'transfere' | 'diplome';

export type StaffRole =
  | 'teacher'
  | 'director'
  | 'secretary'
  | 'accountant'
  | 'supervisor'
  | 'librarian'
  | 'other';

export type AttendanceStatus = 'present' | 'absent' | 'retard' | 'justifie';

export type PaymentMethod = 'espece' | 'mobile' | 'virement' | 'cheque';

export type DisciplineType = 'incident' | 'sanction' | 'observation';

export type DisciplineSeverity = 'faible' | 'moyenne' | 'elevee';

export type GradeType = 'devoir' | 'composition';

export type PermissionKey =
  | 'dashboard.view'
  | 'students.view'
  | 'students.manage'
  | 'staff.view'
  | 'staff.manage'
  | 'academics.view'
  | 'academics.manage'
  | 'grades.manage'
  | 'attendance.view'
  | 'attendance.manage'
  | 'finance.view'
  | 'finance.manage'
  | 'timetable.view'
  | 'timetable.manage'
  | 'discipline.view'
  | 'discipline.manage'
  | 'documents.view'
  | 'settings.view'
  | 'settings.manage'
  | 'users.manage';

// ---------------------------------------------------------------------------
// Référentiel académique
// ---------------------------------------------------------------------------

export interface AcademicYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface Term {
  id: string;
  name: string;
  academicYearId: string;
  startDate: string;
  endDate: string;
  order: number;
}

export interface Level {
  id: string;
  name: string;
  cycle: Cycle;
  order: number;
}

export interface SchoolClass {
  id: string;
  name: string;
  levelId: string;
  academicYearId: string;
  mainTeacherId: string | null;
  room: string;
  capacity: number;
  tuitionFee: number;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  coefficient: number;
  levelIds: string[];
}

export interface Grade {
  id: string;
  studentId: string;
  subjectId: string;
  classId: string;
  termId: string;
  type: GradeType;
  score: number;
  date: string;
}

// ---------------------------------------------------------------------------
// Personnes
// ---------------------------------------------------------------------------

export interface StudentHistoryEntry {
  academicYear: string;
  className: string;
  average: number | null;
  decision: string;
}

export interface Student {
  id: string;
  matricule: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  birthDate: string;
  birthPlace: string;
  classId: string | null;
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
  history: StudentHistoryEntry[];
  createdAt: string;
}

export interface Staff {
  id: string;
  matricule: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  role: StaffRole;
  email: string;
  phone: string;
  address: string;
  hireDate: string;
  contractType: 'CDI' | 'CDD' | 'Vacataire';
  qualification: string;
  salary: number;
  subjectIds: string[];
  classIds: string[];
  status: 'actif' | 'inactif';
}

export interface UserAccount {
  id: string;
  name: string;
  username: string;
  email: string;
  password: string;
  role: Role;
  phone: string;
  active: boolean;
  createdAt: string;
  staffId?: string | null;
  establishmentId: string | null;
}

// ---------------------------------------------------------------------------
// Présences
// ---------------------------------------------------------------------------

export interface AttendanceRecord {
  id: string;
  studentId: string;
  classId: string;
  date: string;
  status: AttendanceStatus;
  minutesLate: number;
  justification: string;
  justifiedBy: string;
}

// ---------------------------------------------------------------------------
// Finances
// ---------------------------------------------------------------------------

export interface FeeStructure {
  id: string;
  levelId: string;
  academicYearId: string;
  label: string;
  amount: number;
  dueDate: string;
}

export interface Invoice {
  id: string;
  studentId: string;
  academicYearId: string;
  label: string;
  amount: number;
  dueDate: string;
  createdAt: string;
}

export interface Payment {
  id: string;
  studentId: string;
  invoiceId: string;
  amount: number;
  date: string;
  method: PaymentMethod;
  receiptNumber: string;
  recordedBy: string;
  note: string;
}

export interface Expense {
  id: string;
  label: string;
  category: string;
  amount: number;
  date: string;
  method: PaymentMethod;
  recordedBy: string;
  note: string;
}

// ---------------------------------------------------------------------------
// Vie scolaire
// ---------------------------------------------------------------------------

export interface TimetableSlot {
  id: string;
  classId: string;
  day: number; // 1 = lundi … 5 = vendredi
  start: string; // HH:mm
  end: string;
  subjectId: string;
  teacherId: string;
  room: string;
}

export interface DisciplineRecord {
  id: string;
  studentId: string;
  date: string;
  type: DisciplineType;
  severity: DisciplineSeverity;
  category: string;
  description: string;
  action: string;
  reportedBy: string;
  status: 'ouvert' | 'traite';
}

export interface ActivityLog {
  id: string;
  type: 'student' | 'payment' | 'grade' | 'attendance' | 'discipline' | 'expense' | 'system';
  title: string;
  description: string;
  date: string;
  actor: string;
}

// ---------------------------------------------------------------------------
// Paramètres
// ---------------------------------------------------------------------------

export interface SchoolSettings {
  name: string;
  shortName: string;
  type: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  website: string;
  director: string;
  logo: string;
  currency: string;
  motto: string;
  dateFormat: string;
  printHeader: string;
  printFooter: string;
  paperSize: 'A4' | 'A5';
  showLogoOnDocuments: boolean;
  rolePermissions: Record<Role, PermissionKey[]>;
}

export interface Establishment {
  id: string;
  name: string;
  code: string;
  type: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  director: string;
  active: boolean;
  createdAt: string;
  settings: SchoolSettings;
}

export interface EstablishmentStats {
  students: number;
  staff: number;
  classes: number;
  users: number;
}

export interface EstablishmentWithStats extends Establishment {
  stats: EstablishmentStats;
  admins: Array<Omit<UserAccount, 'password'>>;
}

export interface Database {
  version: number;
  establishments: Establishment[];
  academicYears: AcademicYear[];
  terms: Term[];
  levels: Level[];
  classes: SchoolClass[];
  subjects: Subject[];
  students: Student[];
  staff: Staff[];
  users: UserAccount[];
  grades: Grade[];
  attendance: AttendanceRecord[];
  feeStructures: FeeStructure[];
  invoices: Invoice[];
  payments: Payment[];
  expenses: Expense[];
  timetable: TimetableSlot[];
  discipline: DisciplineRecord[];
  activities: ActivityLog[];
  settings: SchoolSettings;
}

export interface SessionUser {
  id: string;
  name: string;
  username: string;
  email: string;
  role: Role;
  establishmentId: string | null;
  establishmentName: string | null;
}

export type ServerMode = 'online' | 'local' | 'offline';

export interface ServerStatus {
  mode: ServerMode;
  apiUrl: string;
  latency: number | null;
  lastCheck: string | null;
  checking: boolean;
}
