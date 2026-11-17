import { Router } from 'express';
import type { ActivityLog, Grade, Student } from '../types';
import { getDb } from '../db/store';
import { requireAuth, requirePermission } from '../middleware/auth';
import { asyncHandler } from '../middleware/http';
import {
  attendanceRate,
  enrollmentSeries,
  invoicePaidAmount,
  monthlyFinanceSeries,
  revenueByMethod,
} from '../utils/calculations';
import { monthKey, percent, todayIso } from '../utils/format';

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

interface DashboardAlert {
  id: string;
  level: 'danger' | 'warning' | 'info';
  title: string;
  description: string;
  to?: string;
}

dashboardRouter.get(
  '/',
  requirePermission('dashboard.view'),
  asyncHandler(async (_req, res) => {
    const db = getDb();
    const today = todayIso();
    const currentMonth = monthKey(new Date());
    const previousMonthDate = new Date();
    previousMonthDate.setMonth(previousMonthDate.getMonth() - 1);
    const previousMonth = monthKey(previousMonthDate);

    const activeStudents = db.students.filter((student) => student.status === 'actif');
    const studentsThisMonth = db.students.filter(
      (student) => monthKey(student.enrollmentDate) === currentMonth,
    ).length;
    const studentsPreviousMonth = db.students.filter(
      (student) => monthKey(student.enrollmentDate) === previousMonth,
    ).length;

    const paymentsThisMonth = db.payments.filter(
      (payment) => monthKey(payment.date) === currentMonth,
    );
    const expensesThisMonth = db.expenses.filter(
      (expense) => monthKey(expense.date) === currentMonth,
    );
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

    const overdueInvoices = db.invoices.filter(
      (invoice) =>
        invoice.dueDate < today && invoicePaidAmount(invoice.id, db.payments) < invoice.amount,
    );
    const overdue = overdueInvoices.reduce(
      (sum, invoice) => sum + invoice.amount - invoicePaidAmount(invoice.id, db.payments),
      0,
    );

    const alerts: DashboardAlert[] = [];
    if (overdueInvoices.length > 0) {
      alerts.push({
        id: 'alert_overdue',
        level: 'danger',
        title: `${overdueInvoices.length} facture(s) en retard`,
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
        const classStudents = activeStudents.filter(
          (student) => student.classId === schoolClass.id,
        );
        const grades: Grade[] = db.grades.filter(
          (grade) => grade.classId === schoolClass.id,
        );
        return classStudents
          .map((student: Student) => {
            const studentGrades = grades.filter(
              (grade) => grade.studentId === student.id,
            );
            if (studentGrades.length === 0) return null;
            const totalCoef = db.subjects.reduce((sum, subject) => {
              const subjectGrades = studentGrades.filter(
                (grade) => grade.subjectId === subject.id,
              );
              return subjectGrades.length > 0 ? sum + subject.coefficient : sum;
            }, 0);
            const total = db.subjects.reduce((sum, subject) => {
              const subjectGrades = studentGrades.filter(
                (grade) => grade.subjectId === subject.id,
              );
              if (subjectGrades.length === 0) return sum;
              const value =
                subjectGrades.reduce(
                  (s, grade) => s + grade.score * (grade.type === 'composition' ? 2 : 1),
                  0,
                ) /
                subjectGrades.reduce(
                  (s, grade) => s + (grade.type === 'composition' ? 2 : 1),
                  0,
                );
              return sum + value * subject.coefficient;
            }, 0);
            return {
              id: student.id,
              name: `${student.firstName} ${student.lastName}`,
              className: schoolClass.name,
              average: totalCoef > 0 ? total / totalCoef : 0,
            };
          })
          .filter(
            (entry): entry is { id: string; name: string; className: string; average: number } =>
              entry !== null,
          );
      })
      .sort((a, b) => b.average - a.average)
      .slice(0, 5);

    const activities: ActivityLog[] = db.activities.slice(0, 7);

    res.json({
      stats: {
        students: activeStudents.length,
        studentsDelta: studentsThisMonth - studentsPreviousMonth,
        staff: db.staff.filter((member) => member.status === 'actif').length,
        classes: db.classes.length,
        teachers: db.staff.filter(
          (member) => member.role === 'teacher' && member.status === 'actif',
        ).length,
        monthRevenue,
        monthExpenses,
        monthBalance: monthRevenue - monthExpenses,
        outstanding,
        collectionRate: percent(collected, invoiced),
        attendanceRate: attendanceRate(recentAttendance),
      },
      enrollmentSeries: enrollmentSeries(db.students, 6),
      financeSeries: monthlyFinanceSeries(db.payments, db.expenses, 6),
      activities,
      alerts,
      classDistribution,
      revenueByMethod: revenueByMethod(db.payments),
      topStudents,
      genderSplit: {
        filles: activeStudents.filter((student) => student.gender === 'F').length,
        garcons: activeStudents.filter((student) => student.gender === 'M').length,
      },
    });
  }),
);
