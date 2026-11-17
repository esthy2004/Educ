import type { ReactNode } from 'react';
import { Link, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { ShieldX } from 'lucide-react';
import type { PermissionKey } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/layouts/AppLayout';
import { LoginPage } from '@/pages/auth/LoginPage';
import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import { StudentsPage } from '@/pages/students/StudentsPage';
import { StudentDetailPage } from '@/pages/students/StudentDetailPage';
import { StaffPage } from '@/pages/staff/StaffPage';
import { AcademicsPage } from '@/pages/academics/AcademicsPage';
import { GradesPage } from '@/pages/academics/GradesPage';
import { RankingsPage } from '@/pages/academics/RankingsPage';
import { ReportCardsPage } from '@/pages/academics/ReportCardsPage';
import { AttendancePage } from '@/pages/attendance/AttendancePage';
import { TimetablePage } from '@/pages/timetable/TimetablePage';
import { DisciplinePage } from '@/pages/discipline/DisciplinePage';
import { FinancePage } from '@/pages/finance/FinancePage';
import { PaymentsPage } from '@/pages/finance/PaymentsPage';
import { DebtsPage } from '@/pages/finance/DebtsPage';
import { ExpensesPage } from '@/pages/finance/ExpensesPage';
import { CashPage } from '@/pages/finance/CashPage';
import { FinanceReportsPage } from '@/pages/finance/FinanceReportsPage';
import { DocumentsPage } from '@/pages/documents/DocumentsPage';
import { SettingsPage } from '@/pages/settings/SettingsPage';
import { UsersPage } from '@/pages/settings/UsersPage';
import { RolesPage } from '@/pages/settings/RolesPage';
import { PrintingPage } from '@/pages/settings/PrintingPage';
import { EstablishmentsPage } from '@/pages/platform/EstablishmentsPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

function RequireAuth() {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  return <Outlet />;
}

function RequireSuperAdmin({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== 'superadmin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

function HomePage() {
  const { user } = useAuth();
  if (user?.role === 'superadmin') return <Navigate to="/etablissements" replace />;
  return (
    <RequirePermission permission="dashboard.view">
      <DashboardPage />
    </RequirePermission>
  );
}

function RequirePermission({ permission, children }: { permission: PermissionKey; children: ReactNode }) {
  const { can } = useAuth();

  if (!can(permission)) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center justify-center rounded-lg border border-line bg-white px-6 py-12 text-center shadow-card">
        <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-md bg-rose-50 text-rose-600">
          <ShieldX size={20} />
        </span>
        <h1 className="text-base font-semibold text-navy-900">Accès non autorisé</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
          Votre rôle ne dispose pas des droits nécessaires pour consulter cette page. Contactez un administrateur si
          vous pensez qu’il s’agit d’une erreur.
        </p>
        <Link
          to="/"
          className="mt-5 inline-flex h-9 items-center justify-center rounded-md bg-royal-600 px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-royal-700"
        >
          Retour au tableau de bord
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route
            path="etablissements"
            element={
              <RequireSuperAdmin>
                <EstablishmentsPage />
              </RequireSuperAdmin>
            }
          />
          <Route
            path="students"
            element={
              <RequirePermission permission="students.view">
                <StudentsPage />
              </RequirePermission>
            }
          />
          <Route
            path="students/:id"
            element={
              <RequirePermission permission="students.view">
                <StudentDetailPage />
              </RequirePermission>
            }
          />
          <Route
            path="staff"
            element={
              <RequirePermission permission="staff.view">
                <StaffPage />
              </RequirePermission>
            }
          />
          <Route
            path="academics"
            element={
              <RequirePermission permission="academics.view">
                <AcademicsPage />
              </RequirePermission>
            }
          />
          <Route
            path="academics/grades"
            element={
              <RequirePermission permission="grades.manage">
                <GradesPage />
              </RequirePermission>
            }
          />
          <Route
            path="academics/rankings"
            element={
              <RequirePermission permission="academics.view">
                <RankingsPage />
              </RequirePermission>
            }
          />
          <Route
            path="academics/report-cards"
            element={
              <RequirePermission permission="academics.view">
                <ReportCardsPage />
              </RequirePermission>
            }
          />
          <Route
            path="attendance"
            element={
              <RequirePermission permission="attendance.view">
                <AttendancePage />
              </RequirePermission>
            }
          />
          <Route
            path="timetable"
            element={
              <RequirePermission permission="timetable.view">
                <TimetablePage />
              </RequirePermission>
            }
          />
          <Route
            path="discipline"
            element={
              <RequirePermission permission="discipline.view">
                <DisciplinePage />
              </RequirePermission>
            }
          />
          <Route
            path="finance"
            element={
              <RequirePermission permission="finance.view">
                <FinancePage />
              </RequirePermission>
            }
          />
          <Route
            path="finance/paiements"
            element={
              <RequirePermission permission="finance.view">
                <PaymentsPage />
              </RequirePermission>
            }
          />
          <Route
            path="finance/dettes"
            element={
              <RequirePermission permission="finance.view">
                <DebtsPage />
              </RequirePermission>
            }
          />
          <Route
            path="finance/depenses"
            element={
              <RequirePermission permission="finance.view">
                <ExpensesPage />
              </RequirePermission>
            }
          />
          <Route
            path="finance/caisse"
            element={
              <RequirePermission permission="finance.view">
                <CashPage />
              </RequirePermission>
            }
          />
          <Route
            path="finance/rapports"
            element={
              <RequirePermission permission="finance.view">
                <FinanceReportsPage />
              </RequirePermission>
            }
          />
          <Route
            path="documents"
            element={
              <RequirePermission permission="documents.view">
                <DocumentsPage />
              </RequirePermission>
            }
          />
          <Route
            path="settings"
            element={
              <RequirePermission permission="settings.view">
                <SettingsPage />
              </RequirePermission>
            }
          />
          <Route
            path="settings/utilisateurs"
            element={
              <RequirePermission permission="users.manage">
                <UsersPage />
              </RequirePermission>
            }
          />
          <Route
            path="settings/roles"
            element={
              <RequirePermission permission="settings.manage">
                <RolesPage />
              </RequirePermission>
            }
          />
          <Route
            path="settings/impression"
            element={
              <RequirePermission permission="settings.view">
                <PrintingPage />
              </RequirePermission>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
