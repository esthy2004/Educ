import type {
  AttendanceRecord,
  Expense,
  Grade,
  Invoice,
  Payment,
  SchoolClass,
  Student,
  Subject,
} from '../types';
import { addDays, average, monthKey, monthLabel, percent, toIso, weightedAverage } from '../utils/format';

export interface SubjectResult {
  subject: Subject;
  average: number;
  coefficient: number;
}

export interface StudentAverageResult {
  studentId: string;
  average: number;
  subjects: SubjectResult[];
  totalCoefficients: number;
}

export function subjectAverage(grades: Grade[]): number {
  if (grades.length === 0) return 0;
  return weightedAverage(
    grades.map((grade) => ({ score: grade.score, coefficient: grade.type === 'composition' ? 2 : 1 })),
  );
}

export function computeStudentAverage(
  studentId: string,
  termId: string,
  grades: Grade[],
  subjects: Subject[],
): StudentAverageResult {
  const studentGrades = grades.filter((g) => g.studentId === studentId && g.termId === termId);
  const results = subjects
    .map((subject) => {
      const subjectGrades = studentGrades.filter((g) => g.subjectId === subject.id);
      if (subjectGrades.length === 0) return null;
      return {
        subject,
        average: subjectAverage(subjectGrades),
        coefficient: subject.coefficient,
      };
    })
    .filter((value): value is SubjectResult => value !== null);
  const overall = weightedAverage(
    results.map((item) => ({ score: item.average, coefficient: item.coefficient })),
  );
  return {
    studentId,
    average: results.length > 0 ? overall : 0,
    subjects: results,
    totalCoefficients: results.reduce((sum, item) => sum + item.coefficient, 0),
  };
}

export interface RankedStudent {
  student: Student;
  average: number;
  rank: number;
}

export function computeClassRanking(
  students: Student[],
  grades: Grade[],
  subjects: Subject[],
  termId: string,
): RankedStudent[] {
  const withAverages = students
    .map((student) => ({
      student,
      average: computeStudentAverage(student.id, termId, grades, subjects).average,
    }))
    .filter((entry) => entry.average > 0)
    .sort((a, b) => b.average - a.average);

  let lastAverage = Number.NaN;
  let lastRank = 0;
  return withAverages.map((entry, index) => {
    const rounded = Math.round(entry.average * 100) / 100;
    const rank = rounded === lastAverage ? lastRank : index + 1;
    lastAverage = rounded;
    lastRank = rank;
    return { ...entry, rank };
  });
}

export function invoicePaidAmount(invoiceId: string, payments: Payment[]): number {
  return payments
    .filter((payment) => payment.invoiceId === invoiceId)
    .reduce((sum, payment) => sum + payment.amount, 0);
}

export function studentFinance(
  studentId: string,
  invoices: Invoice[],
  payments: Payment[],
): { invoiced: number; paid: number; balance: number } {
  const studentInvoices = invoices.filter((invoice) => invoice.studentId === studentId);
  const invoiced = studentInvoices.reduce((sum, invoice) => sum + invoice.amount, 0);
  const paid = payments
    .filter((payment) => payment.studentId === studentId)
    .reduce((sum, payment) => sum + payment.amount, 0);
  return { invoiced, paid, balance: invoiced - paid };
}

export function classFilledRate(classItem: SchoolClass, students: Student[]): number {
  const count = students.filter((student) => student.classId === classItem.id && student.status === 'actif').length;
  return percent(count, classItem.capacity);
}

export function attendanceRate(records: AttendanceRecord[]): number {
  if (records.length === 0) return 0;
  const present = records.filter((record) => record.status === 'present' || record.status === 'justifie').length;
  return percent(present, records.length);
}

export function monthlyFinanceSeries(
  payments: Payment[],
  expenses: Expense[],
  monthsBack = 6,
  currency = 'FCFA',
): Array<{ key: string; label: string; recettes: number; depenses: number; solde: number }> {
  const today = new Date();
  const months: Array<{ key: string; label: string; recettes: number; depenses: number; solde: number }> = [];
  for (let index = monthsBack - 1; index >= 0; index -= 1) {
    const date = new Date(today.getFullYear(), today.getMonth() - index, 1);
    const key = monthKey(date);
    const recettes = payments.filter((p) => monthKey(p.date) === key).reduce((s, p) => s + p.amount, 0);
    const depenses = expenses.filter((e) => monthKey(e.date) === key).reduce((s, e) => s + e.amount, 0);
    months.push({
      key,
      label: monthLabel(key),
      recettes,
      depenses,
      solde: recettes - depenses,
      ...(currency ? {} : {}),
    });
  }
  return months;
}

export function enrollmentSeries(
  students: Student[],
  monthsBack = 6,
): Array<{ key: string; label: string; inscriptions: number }> {
  const today = new Date();
  const series: Array<{ key: string; label: string; inscriptions: number }> = [];
  for (let index = monthsBack - 1; index >= 0; index -= 1) {
    const date = new Date(today.getFullYear(), today.getMonth() - index, 1);
    const key = monthKey(date);
    series.push({
      key,
      label: monthLabel(key),
      inscriptions: students.filter((student) => monthKey(student.enrollmentDate) === key).length,
    });
  }
  return series;
}

export function revenueByMethod(payments: Payment[]): Array<{ name: string; value: number }> {
  const labels: Record<string, string> = {
    espece: 'Espèces',
    mobile: 'Mobile money',
    virement: 'Virement',
    cheque: 'Chèque',
  };
  return Object.entries(labels)
    .map(([key, name]) => ({
      name,
      value: payments.filter((payment) => payment.method === key).reduce((sum, p) => sum + p.amount, 0),
    }))
    .filter((entry) => entry.value > 0);
}

export function lastSchoolDays(count: number): string[] {
  const days: string[] = [];
  let cursor = new Date();
  while (days.length < count) {
    if (cursor.getDay() !== 0 && cursor.getDay() !== 6) days.push(toIso(cursor));
    cursor = addDays(cursor, -1);
  }
  return days.reverse();
}

export function averageOf(values: number[]): number {
  return average(values);
}
