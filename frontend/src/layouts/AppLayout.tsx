import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { WifiOff } from 'lucide-react';
import { Sidebar } from '@/layouts/Sidebar';
import { Topbar } from '@/layouts/Topbar';
import { useServerStatus } from '@/hooks/useServerStatus';

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { status } = useServerStatus();

  return (
    <div className="min-h-screen bg-surface">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="lg:pl-[252px]">
        <Topbar onMenu={() => setMobileOpen(true)} />
        {status.mode === 'offline' ? (
          <div className="flex items-center gap-2 border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs font-medium text-rose-700 print:hidden sm:px-6 lg:px-8">
            <WifiOff size={14} />
            Serveur EDUFLOW injoignable. Les modifications sont indisponibles jusqu’au rétablissement de la connexion.
          </div>
        ) : null}
        <main className="mx-auto w-full max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8">
          <Outlet />
        </main>
        <footer className="mx-auto flex w-full max-w-[1500px] flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-4 text-[11px] text-slate-400 sm:px-6 lg:px-8 print:hidden">
          <span>EDUFLOW · Plateforme de gestion scolaire multi-établissements.</span>
          <span className="text-slate-400">Données internes — usage administratif.</span>
        </footer>
      </div>
    </div>
  );
}
