import type { ActivityLog, Grade, Student } from '@/types';
import { apiRequest, clone, delay, remoteFirst } from '@/services/api';
import { getDb } from '@/services/db';
import {
  attendanceRate,
  enrollmentSeries,
  monthlyFinanceSeries,
  revenueByMethod,
} from '@/utils/calculations';
import { invoicePaidAmount } from '@/utils/calculations';
import { monthKey, percent, todayIso } from '@/utils/format';

export interface DashboardAlert {
  id: string;
  level: 'danger' | 'warning' | 'info';
  title: string;
  description: string;
  to?: string;
}

export interface ClassDistribution {
  name: string;
  effectif: number;
  capacite: number;
}

export interface DashboardData {
  stats: {
    students: number;
    studentsDelta: number;
    staff: number;
    classes: number;
    teachers: number;
    monthRevenue: number;
    monthExpenses: number;
    monthBalance: number;
    outstanding: number;
    collectionRate: number;
    attendanceRate: number;
  };
  enrollmentSeries: Array<{ key: string; label: string; inscriptions: number }>;
  financeSeries: Array<{ key: string; label: string; recettes: number; depenses: number; solde: number }>;
  activities: ActivityLog[];
  alerts: DashboardAlert[];
  classDistribution: ClassDistribution[];
  revenueByMethod: Array<{ name: string; value: number }>;
  topStudents: Array<{ id: string; name: string; className: string; average: number }>;
  genderSplit: { filles: number; garcons: number };
}

const localDashboardService = {
  async getData(): Promise<DashboardData> {
    await delay(160);
    const db = getDb();
    const today = todayIso();
    const currentMonth = monthKey(new Date());
    const previousMonthDate = new Date();
    previousMonthDate.setMonth(previousMonthDate.getMonth() - 1);
    const previousMonth = monthKey(previousMonthDate);

    const activeStudents = db.students.filter((student) => student.status === 'actif');
    const studentsThisMonth = db.students.filter((student) => monthKey(student.enrollmentDate) === currentMonth).length;
    const studentsPreviousMonth = db.students.filter(
      (student) => monthKey(student.enrollmentDate) === previousMonth,
    ).length;

    const paymentsThisMonth = db.payments.filter((payment) => monthKey(payment.date) === currentMonth);
    const expensesThisMonth = db.expenses.filter((expense) => monthKey(expense.date) === currentMonth);
    const monthRevenue = paymentsThisMonth.reduce((sum, payment) => sum + payment.amount, 0);
    const monthExpenses = expensesThisMonth.reduce((sum, expense) => sum + expense.amount, 0);

    const invoiced = db.invoices.reduce((sum, invoice) => sum + invoice.amount, 0);
    const collected = db.payments.reduce((sum, payment) => sum + payment.amount, 0);
    const outstanding = db.invoices.reduce(
      (sum, invoice) => sum + Math.max(0, invoice.amount - invoicePaidAmount(invoice.id, db.payments)),
      0,
    );

    const recentAttendance = db.attendance.filter((record) => {
      const limit = new Date();
      limit.setDate(limit.getDate() - 30);
      return record.date >= limit.toISOString().slice(0, 10);
    });

    const classDistribution = db.classes
      .map((schoolClass) => ({
        name: schoolClass.name,
        effectif: activeStudents.filter((student) => student.classId === schoolClass.id).length,
        capacite: schoolClass.capacity,
      }))
      .sort((a, b) => b.effectif - a.effectif);

    const overdue = db.invoices
      .filter((invoice) => invoice.dueDate < today && invoicePaidAmount(invoice.id, db.payments) < invoice.amount)
      .reduce((sum, invoice) => sum + invoice.amount - invoicePaidAmount(invoice.id, db.payments), 0);
    const overdueCount = db.invoices.filter(
      (invoice) => invoice.dueDate < today && invoicePaidAmount(invoice.id, db.payments) < invoice.amount,
    ).length;

    const alerts: DashboardAlert[] = [];
    if (overdueCount > 0) {
      alerts.push({
        id: 'alert_overdue',
        level: 'danger',
        title: `${overdueCount} facture(s) en retard`,
        description: `${Math.round(overdue).toLocaleString('fr-FR')} FCFA restent à recouvrer.`,
        to: '/finance/dettes',
      });
    }
    const unjustified = db.attendance.filter(
      (record) => record.date === today && record.status === 'absent',
    ).length;
    if (unjustified > 0) {
      alerts.push({
        id: 'alert_attendance',
        level: 'warning',
        title: `${unjustified} absence(s) du jour`,
        description: 'Des absences restent à justifier auprès du secrétariat.',
        to: '/attendance',
      });
    }
    const openDiscipline = db.discipline.filter((record) => record.status === 'ouvert').length;
    if (openDiscipline > 0) {
      alerts.push({
        id: 'alert_discipline',
        level: 'info',
        title: `${openDiscipline} dossier(s) disciplinaire(s) ouvert(s)`,
        description: 'Des faits consignés attendent une décision.',
        to: '/discipline',
      });
    }
    const lowAttendanceClasses = db.classes.filter((schoolClass) => {
      const records = recentAttendance.filter((record) => record.classId === schoolClass.id);
      return records.length > 0 && attendanceRate(records) < 85;
    });
    if (lowAttendanceClasses.length > 0) {
      alerts.push({
        id: 'alert_class_attendance',
        level: 'warning',
        title: 'Assiduité à surveiller',
        description: `${lowAttendanceClasses.map((item) => item.name).join(', ')} sous 85 % de présence.`,
        to: '/attendance',
      });
    }

    const topStudents = db.classes
      .flatMap((schoolClass) => {
        const classStudents = activeStudents.filter((student) => student.classId === schoolClass.id);
        const grades: Grade[] = db.grades.filter((grade) => grade.classId === schoolClass.id);
        return classStudents.map((student: Student) => {
          const studentGrades = grades.filter((grade) => grade.studentId === student.id);
          if (studentGrades.length === 0) return null;
          const totalCoef = db.subjects.reduce((sum, subject) => {
            const subjectGrades = studentGrades.filter((grade) => grade.subjectId === subject.id);
            return subjectGrades.length > 0 ? sum + subject.coefficient : sum;
          }, 0);
          const total = db.subjects.reduce((sum, subject) => {
            const subjectGrades = studentGrades.filter((grade) => grade.subjectId === subject.id);
            if (subjectGrades.length === 0) return sum;
            const value =
              subjectGrades.reduce((s, grade) => s + grade.score * (grade.type === 'composition' ? 2 : 1), 0) /
              subjectGrades.reduce((s, grade) => s + (grade.type === 'composition' ? 2 : 1), 0);
            return sum + value * subject.coefficient;
          }, 0);
          return {
            id: student.id,
            name: `${student.firstName} ${student.lastName}`,
            className: schoolClass.name,
            average: totalCoef > 0 ? total / totalCoef : 0,
          };
        }).filter((entry): entry is { id: string; name: string; className: string; average: number } => entry !== null);
      })
      .sort((a, b) => b.average - a.average)
      .slice(0, 5);

    return clone({
      stats: {
        students: activeStudents.length,
        studentsDelta: studentsThisMonth - studentsPreviousMonth,
        staff: db.staff.filter((member) => member.status === 'actif').length,
        classes: db.classes.length,
        teachers: db.staff.filter((member) => member.role === 'teacher' && member.status === 'actif').length,
        monthRevenue,
        monthExpenses,
        monthBalance: monthRevenue - monthExpenses,
        outstanding,
        collectionRate: percent(collected, invoiced),
        attendanceRate: attendanceRate(recentAttendance),
      },
      enrollmentSeries: enrollmentSeries(db.students, 6),
      financeSeries: monthlyFinanceSeries(db.payments, db.expenses, 6),
      activities: db.activities.slice(0, 7),
      alerts,
      classDistribution,
      revenueByMethod: revenueByMethod(db.payments),
      topStudents,
      genderSplit: {
        filles: activeStudents.filter((student) => student.gender === 'F').length,
        garcons: activeStudents.filter((student) => student.gender === 'M').length,
      },
    });
  },
};

const remoteDashboardService: typeof localDashboardService = {
  getData: () => apiRequest<DashboardData>('/dashboard'),
};

export const dashboardService = remoteFirst(remoteDashboardService, localDashboardService);
