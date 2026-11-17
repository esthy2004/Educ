import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CalendarCheck2,
  Eye,
  EyeOff,
  GraduationCap,
  LockKeyhole,
  Server,
  ShieldCheck,
  UserRound,
  Wallet,
  Wifi,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useServerStatus } from '@/hooks/useServerStatus';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { getDb } from '@/services/db';
import { settingsService } from '@/services/settings.service';
import { ROLE_LABELS } from '@/config/permissions';
import type { Role } from '@/types';

const demoAccounts: Array<{ username: string; role: Role }> = [
  { username: 'admin', role: 'superadmin' },
];

export function LoginPage() {
  const { user, login } = useAuth();
  const { status } = useServerStatus();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [settings, setSettings] = useState(() => getDb().settings);

  useEffect(() => {
    document.title = 'Connexion · EDUFLOW';
    let active = true;
    settingsService
      .getPublic()
      .then((value) => {
        if (active) setSettings(value);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  if (user) {
    return <Navigate to={user.role === 'superadmin' ? '/etablissements' : '/'} replace />;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!username.trim() || !password) {
      setError('Renseignez votre identifiant et votre mot de passe.');
      return;
    }
    setLoading(true);
    try {
      const session = await login(username, password);
      const requested = (location.state as { from?: string } | null)?.from;
      const from = session.role === 'superadmin' ? '/etablissements' : requested ?? '/';
      navigate(from, { replace: true });
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Connexion impossible.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-surface">
      <div className="relative hidden w-[44%] flex-col justify-between border-r-4 border-royal-600 bg-navy-900 p-10 text-white lg:flex xl:p-14">
        <div className="relative">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-white text-navy-900">
              <GraduationCap size={22} />
            </span>
            <div>
              <p className="text-lg font-bold tracking-[0.2em]">EDUFLOW</p>
              <p className="text-[11px] uppercase tracking-[0.18em] text-navy-200">Gestion scolaire</p>
            </div>
          </div>

          <div className="mt-16 max-w-md border-t border-white/10 pt-8">
            <p className="text-2xs font-semibold uppercase tracking-[0.16em] text-navy-200">Plateforme de gestion scolaire</p>
            <h1 className="mt-3 text-[28px] font-semibold leading-tight text-white xl:text-[32px]">
              Espace de gestion de l’établissement
            </h1>
            <p className="mt-4 text-[13px] leading-relaxed text-navy-100">
              Inscriptions, scolarité, notes, présences et finances réunis dans une interface unique réservée au
              personnel habilité.
            </p>
          </div>

          <ul className="mt-9 space-y-3">
            {[
              { icon: UserRound, title: 'Dossiers élèves', text: 'Inscriptions, responsables, transferts et historique.' },
              { icon: CalendarCheck2, title: 'Assiduité', text: 'Appel quotidien, justificatifs et suivi des absences.' },
              { icon: Wallet, title: 'Finances', text: 'Frais, paiements partiels, reçus et mouvements de caisse.' },
            ].map((feature) => (
              <li key={feature.title} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded border border-white/10 bg-white/[0.06] text-royal-200">
                  <feature.icon size={15} />
                </span>
                <div>
                  <p className="text-[13px] font-medium text-white">{feature.title}</p>
                  <p className="text-[11px] text-navy-200">{feature.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center gap-2 text-[11px] text-navy-300">
          <ShieldCheck size={14} />
Données hébergées sur le serveur de l’établissement.
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-navy-900 text-white">
              <GraduationCap size={22} />
            </span>
            <div>
              <p className="text-base font-bold tracking-[0.18em] text-navy-900">EDUFLOW</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Gestion scolaire</p>
            </div>
          </div>

          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-navy-900">Connexion</h2>
            <Badge tone={status.mode === 'online' ? 'success' : status.mode === 'offline' ? 'danger' : 'warning'} dot>
              {status.mode === 'online' ? <Wifi size={11} /> : <Server size={11} />}
              {status.mode === 'online' ? 'Serveur connecté' : status.mode === 'offline' ? 'Hors connexion' : 'Mode local'}
            </Badge>
          </div>
          <p className="mb-7 text-sm text-slate-500">
            Accédez à votre espace de gestion de {settings.shortName}.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <label htmlFor="username" className="text-xs font-medium text-slate-600">
                Identifiant
              </label>
              <div className="relative">
                <UserRound size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="username"
                  autoComplete="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="ex. admin"
                  className="h-10 w-full rounded-md border border-line bg-white pl-9 pr-3 text-[13px] text-slate-800 placeholder:text-slate-400 focus:border-royal-400 focus:outline-none focus:ring-2 focus:ring-royal-100"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-medium text-slate-600">
                Mot de passe
              </label>
              <div className="relative">
                <LockKeyhole size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Votre mot de passe"
                  className="h-10 w-full rounded-md border border-line bg-white pl-9 pr-11 text-[13px] text-slate-800 placeholder:text-slate-400 focus:border-royal-400 focus:outline-none focus:ring-2 focus:ring-royal-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700" role="alert">
                {error}
              </div>
            ) : null}

            <Button type="submit" loading={loading} size="lg" className="w-full" icon={<ArrowRight size={16} />}>
              Se connecter
            </Button>
          </form>

          <div className="mt-7 rounded-lg border border-line bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-700">Compte super-administrateur initial</p>
              <span className="text-[10px] text-slate-400">mot de passe indiqué</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-1.5">
              {demoAccounts.map((account) => (
                <button
                  key={account.username}
                  type="button"
                  onClick={() => {
                    setUsername(account.username);
                    setPassword('admin123');
                    setError('');
                  }}
                  className="rounded-lg border border-slate-100 bg-slate-50/60 px-2.5 py-2 text-left transition hover:border-royal-200 hover:bg-royal-50/50"
                >
                  <span className="block text-[11px] font-semibold text-slate-700">{account.username}</span>
                  <span className="block text-[10px] text-slate-400">
                    {ROLE_LABELS[account.role]} · admin123
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-3 text-[10px] leading-relaxed text-slate-400">
              Ce compte crée les établissements et leurs administrateurs. Modifiez son mot de passe après la première connexion.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
