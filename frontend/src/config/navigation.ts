import {
  Award,
  BadgeCheck,
  Banknote,
  Building2,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  Clock,
  CreditCard,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Receipt,
  Settings,
  ShieldAlert,
  SlidersHorizontal,
  UserCog,
  Users,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { PermissionKey } from '@/types';

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  permission: PermissionKey | null;
  superadminOnly?: boolean;
  end?: boolean;
  children?: NavItem[];
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Plateforme',
    items: [
      {
        label: 'Établissements',
        path: '/etablissements',
        icon: Building2,
        permission: null,
        superadminOnly: true,
        end: true,
      },
    ],
  },
  {
    title: 'Pilotage',
    items: [
      {
        label: 'Tableau de bord',
        path: '/',
        icon: LayoutDashboard,
        permission: 'dashboard.view',
        end: true,
      },
    ],
  },
  {
    title: 'Scolarité',
    items: [
      {
        label: 'Élèves',
        path: '/students',
        icon: Users,
        permission: 'students.view',
      },
      {
        label: 'Personnel',
        path: '/staff',
        icon: UserCog,
        permission: 'staff.view',
      },
      {
        label: 'Académique',
        path: '/academics',
        icon: GraduationCap,
        permission: 'academics.view',
        children: [
          {
            label: 'Structure & classes',
            path: '/academics',
            icon: BookOpen,
            permission: 'academics.view',
            end: true,
          },
          {
            label: 'Saisie des notes',
            path: '/academics/grades',
            icon: ClipboardCheck,
            permission: 'grades.manage',
          },
          {
            label: 'Classements',
            path: '/academics/rankings',
            icon: Award,
            permission: 'academics.view',
          },
          {
            label: 'Bulletins',
            path: '/academics/report-cards',
            icon: FileText,
            permission: 'academics.view',
          },
        ],
      },
      {
        label: 'Présences',
        path: '/attendance',
        icon: Clock,
        permission: 'attendance.view',
      },
      {
        label: 'Emploi du temps',
        path: '/timetable',
        icon: CalendarDays,
        permission: 'timetable.view',
      },
      {
        label: 'Discipline',
        path: '/discipline',
        icon: ShieldAlert,
        permission: 'discipline.view',
      },
    ],
  },
  {
    title: 'Finances',
    items: [
      {
        label: 'Finances',
        path: '/finance',
        icon: Wallet,
        permission: 'finance.view',
        children: [
          {
            label: 'Frais & factures',
            path: '/finance',
            icon: Receipt,
            permission: 'finance.view',
            end: true,
          },
          {
            label: 'Paiements',
            path: '/finance/paiements',
            icon: CreditCard,
            permission: 'finance.view',
          },
          {
            label: 'Dettes',
            path: '/finance/dettes',
            icon: Banknote,
            permission: 'finance.view',
          },
          {
            label: 'Dépenses',
            path: '/finance/depenses',
            icon: Receipt,
            permission: 'finance.view',
          },
          {
            label: 'Caisse',
            path: '/finance/caisse',
            icon: Wallet,
            permission: 'finance.view',
          },
          {
            label: 'Rapports',
            path: '/finance/rapports',
            icon: Award,
            permission: 'finance.view',
          },
        ],
      },
    ],
  },
  {
    title: 'Administration',
    items: [
      {
        label: 'Documents',
        path: '/documents',
        icon: FileText,
        permission: 'documents.view',
      },
      {
        label: 'Paramètres',
        path: '/settings',
        icon: Settings,
        permission: 'settings.view',
        children: [
          {
            label: 'Établissement',
            path: '/settings',
            icon: BadgeCheck,
            permission: 'settings.view',
            end: true,
          },
          {
            label: 'Utilisateurs',
            path: '/settings/utilisateurs',
            icon: Users,
            permission: 'settings.view',
          },
          {
            label: 'Rôles & permissions',
            path: '/settings/roles',
            icon: SlidersHorizontal,
            permission: 'settings.view',
          },
          {
            label: 'Impression',
            path: '/settings/impression',
            icon: FileText,
            permission: 'settings.view',
          },
        ],
      },
    ],
  },
];
