import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Bell,
  BookOpen,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  KeyRound,
  LogOut,
  Menu,
  RefreshCw,
  Search,
  Server,
  Settings,
  UserCog,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useServerStatus } from '@/hooks/useServerStatus';
import { useDataVersion } from '@/hooks/useDataVersion';
import { studentsService } from '@/services/students.service';
import { staffService } from '@/services/staff.service';
import { academicsService } from '@/services/academics.service';
import { dashboardService } from '@/services/dashboard.service';
import { settingsService } from '@/services/settings.service';
import { cn, normalize } from '@/utils/format';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/hooks/useToast';
import { authService } from '@/services/auth.service';
import { ROLE_BADGE_CLASSES, ROLE_LABELS } from '@/config/permissions';

interface SearchResult {
  id: string;
  label: string;
  sub: string;
  to: string;
  kind: 'Élève' | 'Personnel' | 'Classe';
}

interface NotificationItem {
  id: string;
  title: string;
  description: string;
  to: string;
  tone: 'danger' | 'warning' | 'info';
}

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { user, logout, can } = useAuth();
  const { status, check } = useServerStatus();
  const toast = useToast();
  const version = useDataVersion();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [openMenu, setOpenMenu] = useState<'notifications' | 'profile' | 'status' | null>(null);
  const [context, setContext] = useState<{ establishment: string; year: string }>({ establishment: '', year: '' });
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === 'Escape') {
        setQuery('');
        setOpenMenu(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const needle = query.trim();
    if (needle.length < 2) {
      setResults([]);
      return;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      const requests: Array<Promise<SearchResult[]>> = [];
      if (can('students.view')) {
        requests.push(
          studentsService
            .list({ search: needle })
            .then((rows) =>
              rows.slice(0, 4).map((student) => ({
                id: student.id,
                label: `${student.firstName} ${student.lastName}`,
                sub: student.matricule,
                to: `/students/${student.id}`,
                kind: 'Élève' as const,
              })),
            )
            .catch(() => []),
        );
      }
      if (can('staff.view')) {
        requests.push(
          staffService
            .list({ search: needle })
            .then((rows) =>
              rows.slice(0, 3).map((member) => ({
                id: member.id,
                label: `${member.firstName} ${member.lastName}`,
                sub: member.matricule,
                to: '/staff',
                kind: 'Personnel' as const,
              })),
            )
            .catch(() => []),
        );
      }
      if (can('academics.view')) {
        requests.push(
          academicsService
            .listClasses()
            .then((rows) =>
              rows
                .filter((schoolClass) => normalize(schoolClass.name).includes(normalize(needle)))
                .slice(0, 2)
                .map((schoolClass) => ({
                  id: schoolClass.id,
                  label: schoolClass.name,
                  sub: schoolClass.room,
                  to: '/academics',
                  kind: 'Classe' as const,
                })),
            )
            .catch(() => []),
        );
      }
      void Promise.all(requests).then((groups) => {
        if (active) setResults(groups.flat().slice(0, 8));
      });
    }, 180);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query, version, can]);

  useEffect(() => {
    if (user?.role === 'superadmin') {
      setNotifications([]);
      return;
    }
    let active = true;
    dashboardService
      .getData()
      .then((data) => {
        if (!active) return;
        setNotifications(
          data.alerts.map((alert) => ({
            id: alert.id,
            title: alert.title,
            description: alert.description,
            to: alert.to ?? '/',
            tone: alert.level,
          })),
        );
      })
      .catch(() => {
        if (active) setNotifications([]);
      });
    return () => {
      active = false;
    };
  }, [version, user?.role]);

  useEffect(() => {
    if (!user || user.role === 'superadmin') {
      setContext({ establishment: 'Plateforme EDUFLOW', year: '' });
      return;
    }
    let active = true;
    void Promise.all([
      settingsService.get().catch(() => null),
      can('academics.view') ? academicsService.listYears().catch(() => []) : Promise.resolve([]),
    ]).then(([settings, years]) => {
      if (!active) return;
      const currentYear = years.find((item) => item.isActive);
      setContext({
        establishment: settings?.name ?? user.establishmentName ?? '',
        year: currentYear?.name ?? '',
      });
    });
    return () => {
      active = false;
    };
  }, [user, can, version]);

  const goTo = (path: string) => {
    setQuery('');
    setOpenMenu(null);
    navigate(path);
  };

  const openPasswordModal = () => {
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setPasswordError('');
    setOpenMenu(null);
    setPasswordOpen(true);
  };

  const handlePasswordChange = async () => {
    setPasswordError('');
    if (!passwordForm.currentPassword) {
      setPasswordError('Saisissez votre mot de passe actuel.');
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      setPasswordError('Le nouveau mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('La confirmation ne correspond pas au nouveau mot de passe.');
      return;
    }
    setPasswordSaving(true);
    try {
      await authService.changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      toast.success('Votre mot de passe a été modifié.');
      setPasswordOpen(false);
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : 'Modification impossible.');
    } finally {
      setPasswordSaving(false);
    }
  };

  const modeBadge =
    status.mode === 'online'
      ? { label: 'Serveur connecté', tone: 'success' as const, icon: <Wifi size={12} /> }
      : status.mode === 'offline'
        ? { label: 'Hors connexion', tone: 'danger' as const, icon: <WifiOff size={12} /> }
        : { label: 'Mode local', tone: 'warning' as const, icon: <Server size={12} /> };

  const roleClass = user ? ROLE_BADGE_CLASSES[user.role] : '';

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-white print:hidden">
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onMenu}
          className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 lg:hidden"
          aria-label="Ouvrir le menu"
        >
          <Menu size={20} />
        </button>

        <div className="hidden min-w-0 items-center gap-2.5 border-r border-line pr-4 xl:flex">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-royal-50 text-royal-700">
            <Building2 size={15} />
          </span>
          <div className="min-w-0">
            <p className="max-w-[220px] truncate text-xs font-semibold text-navy-900">
              {context.establishment || 'Établissement'}
            </p>
            <p className="flex items-center gap-1 text-[10px] text-muted">
              {user?.role === 'superadmin' ? <Server size={10} /> : <CalendarDays size={10} />}
              {user?.role === 'superadmin'
                ? 'Administration de la plateforme'
                : context.year
                  ? `Année scolaire ${context.year}`
                  : 'Année scolaire en cours'}
            </p>
          </div>
        </div>

        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher un élève, un membre, une classe…"
            className="h-9 w-full rounded-md border border-line bg-slate-50 pl-9 pr-16 text-[13px] text-slate-700 placeholder:text-slate-400 transition-colors focus:border-royal-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-royal-100"
            aria-label="Recherche globale"
          />
          <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-400 sm:block">
            Ctrl K
          </kbd>
          {query.trim().length >= 2 ? (
            <div className="absolute left-0 right-0 top-11 z-40 overflow-hidden rounded-md border border-line bg-white py-1 shadow-pop">
              {results.length === 0 ? (
                <p className="px-4 py-3 text-sm text-slate-500">Aucun résultat pour « {query} ».</p>
              ) : (
                results.map((result) => (
                  <button
                    key={`${result.kind}-${result.id}`}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => goTo(result.to)}
                    className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition hover:bg-royal-50/60"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                      {result.kind === 'Élève' ? <Users size={14} /> : result.kind === 'Classe' ? <BookOpen size={14} /> : <UserCog size={14} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-800">{result.label}</span>
                      <span className="block truncate text-[11px] text-slate-400">{result.sub}</span>
                    </span>
                    <Badge tone="neutral">{result.kind}</Badge>
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenMenu(openMenu === 'status' ? null : 'status')}
              className="hidden items-center gap-1.5 rounded-lg px-2 py-1.5 transition hover:bg-slate-100 sm:flex"
              aria-label="État de la connexion"
              aria-expanded={openMenu === 'status'}
            >
              <Badge tone={modeBadge.tone} dot>
                <span className="flex items-center gap-1">
                  {modeBadge.icon}
                  {modeBadge.label}
                </span>
              </Badge>
              <ChevronDown size={12} className="text-slate-400" />
            </button>
            {openMenu === 'status' ? (
              <div className="absolute right-0 top-11 z-40 w-72 rounded-lg border border-line bg-white p-4 shadow-pop">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-navy-900">Connexion au serveur</p>
                  <Badge tone={modeBadge.tone}>{modeBadge.label}</Badge>
                </div>
                <dl className="mt-3 space-y-1.5 text-xs">
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">API</dt>
                    <dd className="truncate font-mono text-[11px] text-slate-600">{status.apiUrl}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Latence</dt>
                    <dd className="text-slate-600">{status.latency !== null ? `${status.latency} ms` : '—'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Dernière vérification</dt>
                    <dd className="text-slate-600">
                      {status.lastCheck ? new Date(status.lastCheck).toLocaleTimeString('fr-FR') : '—'}
                    </dd>
                  </div>
                </dl>
                <p className="mt-3 rounded-lg bg-slate-50 p-2.5 text-[11px] leading-relaxed text-slate-500">
                  {status.mode === 'online'
                    ? 'Le backend EDUFLOW répond. Les données sont synchronisées.'
                    : 'Backend indisponible : reconnectez-vous dès que le serveur EDUFLOW est accessible.'}
                </p>
                <button
                  type="button"
                  onClick={() => void check()}
                  disabled={status.checking}
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  <RefreshCw size={13} className={status.checking ? 'animate-spin' : ''} />
                  Vérifier maintenant
                </button>
              </div>
            ) : null}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenMenu(openMenu === 'notifications' ? null : 'notifications')}
              className="relative rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label={`Notifications (${notifications.length})`}
              aria-expanded={openMenu === 'notifications'}
            >
              <Bell size={19} />
              {notifications.length > 0 ? (
                <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
                  {notifications.length}
                </span>
              ) : null}
            </button>
            {openMenu === 'notifications' ? (
              <div className="absolute right-0 top-11 z-40 w-80 overflow-hidden rounded-lg border border-line bg-white shadow-pop">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <p className="text-sm font-semibold text-navy-900">Notifications</p>
                  <Badge tone="neutral">{notifications.length}</Badge>
                </div>
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                    <CheckCircle2 size={22} className="text-emerald-500" />
                    <p className="text-sm text-slate-600">Tout est à jour.</p>
                  </div>
                ) : (
                  <ul>
                    {notifications.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => goTo(item.to)}
                          className="flex w-full gap-3 border-b border-slate-50 px-4 py-3 text-left transition last:border-0 hover:bg-slate-50"
                        >
                          <AlertCircle
                            size={17}
                            className={cn(
                              'mt-0.5 shrink-0',
                              item.tone === 'danger' && 'text-rose-500',
                              item.tone === 'warning' && 'text-amber-500',
                              item.tone === 'info' && 'text-royal-500',
                            )}
                          />
                          <span className="min-w-0">
                            <span className="block text-xs font-semibold text-slate-800">{item.title}</span>
                            <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">{item.description}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenMenu(openMenu === 'profile' ? null : 'profile')}
              className="flex items-center gap-2.5 rounded-lg py-1 pl-1 pr-2 transition hover:bg-slate-100"
              aria-label="Menu du profil"
              aria-expanded={openMenu === 'profile'}
            >
              {user ? <Avatar firstName={user.name.split(' ')[0]} lastName={user.name.split(' ').slice(-1)[0]} size="md" /> : null}
              <span className="hidden min-w-0 text-left md:block">
                <span className="block max-w-[130px] truncate text-xs font-semibold text-slate-800">{user?.name}</span>
                <span className="block text-[10px] text-slate-400">{user ? ROLE_LABELS[user.role] : ''}</span>
              </span>
              <ChevronDown size={13} className="hidden text-slate-400 md:block" />
            </button>
            {openMenu === 'profile' ? (
              <div className="absolute right-0 top-12 z-40 w-64 overflow-hidden rounded-lg border border-line bg-white shadow-pop">
                <div className="border-b border-slate-100 px-4 py-3">
                  <p className="truncate text-sm font-semibold text-slate-800">{user?.name}</p>
                  <p className="truncate text-xs text-slate-500">{user?.email}</p>
                  {user ? (
                    <span className={cn('mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset', roleClass)}>
                      {ROLE_LABELS[user.role]}
                    </span>
                  ) : null}
                </div>
                {can('settings.view') ? (
                  <button
                    type="button"
                    onClick={() => goTo('/settings')}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                  >
                    <Settings size={14} />
                    Paramètres de l’établissement
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={openPasswordModal}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                >
                  <KeyRound size={14} />
                  Changer mon mot de passe
                </button>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    navigate('/login');
                  }}
                  className="flex w-full items-center gap-2 border-t border-slate-100 px-4 py-2.5 text-left text-xs font-medium text-rose-600 transition hover:bg-rose-50"
                >
                  <LogOut size={14} />
                  Se déconnecter
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      {openMenu ? (
        <button
          type="button"
          className="fixed inset-0 z-20 cursor-default"
          aria-label="Fermer le menu"
          onClick={() => setOpenMenu(null)}
        />
      ) : null}
      </header>

      <Modal
        open={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        title="Changer mon mot de passe"
        description={user ? `Compte @${user.username}. Choisissez un mot de passe d’au moins 8 caractères.` : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPasswordOpen(false)}>
              Annuler
            </Button>
            <Button loading={passwordSaving} onClick={() => void handlePasswordChange()}>
              Modifier le mot de passe
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Mot de passe actuel"
            type="password"
            required
            autoComplete="current-password"
            value={passwordForm.currentPassword}
            onChange={(event) =>
              setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))
            }
          />
          <Input
            label="Nouveau mot de passe"
            type="password"
            required
            autoComplete="new-password"
            value={passwordForm.newPassword}
            onChange={(event) =>
              setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))
            }
            hint="Au moins 8 caractères."
          />
          <Input
            label="Confirmer le nouveau mot de passe"
            type="password"
            required
            autoComplete="new-password"
            value={passwordForm.confirmPassword}
            onChange={(event) =>
              setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))
            }
          />
          {passwordError ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700" role="alert">
              {passwordError}
            </p>
          ) : null}
        </div>
      </Modal>
    </>
  );
}
