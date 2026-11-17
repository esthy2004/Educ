import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronDown, GraduationCap, Wifi, WifiOff, X, Server } from 'lucide-react';
import type { NavItem } from '@/config/navigation';
import { NAV_GROUPS } from '@/config/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useServerStatus } from '@/hooks/useServerStatus';
import { useDataVersion } from '@/hooks/useDataVersion';
import { getDb } from '@/services/db';
import { settingsService } from '@/services/settings.service';
import { cn } from '@/utils/format';

interface SidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

function itemIsActive(item: NavItem, pathname: string): boolean {
  if (item.end) return pathname === item.path;
  return pathname === item.path || pathname.startsWith(`${item.path}/`);
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { can, user } = useAuth();
  const canSee = (item: NavItem) =>
    item.superadminOnly ? user?.role === 'superadmin' : Boolean(item.permission && can(item.permission));
  const { status } = useServerStatus();
  const version = useDataVersion();
  const location = useLocation();
  const [openSections, setOpenSections] = useState<string[]>([]);
  const [settings, setSettings] = useState(() => getDb().settings);

  useEffect(() => {
    const activeParents = NAV_GROUPS.flatMap((group) =>
      group.items
        .filter((item) => item.children && !item.end && itemIsActive(item, location.pathname))
        .map((item) => item.path),
    );
    setOpenSections((current) => [...new Set([...current, ...activeParents])]);
  }, [location.pathname]);

  useEffect(() => {
    let active = true;
    const request =
      user && user.role !== 'superadmin' ? settingsService.get() : settingsService.getPublic();
    request
      .then((value) => {
        if (active) setSettings(value);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [version, user]);

  const modeLabel =
    status.mode === 'online' ? 'Serveur connecté' : status.mode === 'offline' ? 'Hors connexion' : 'Mode local';
  const modeIcon =
    status.mode === 'online' ? <Wifi size={13} /> : status.mode === 'offline' ? <WifiOff size={13} /> : <Server size={13} />;
  const modeColor =
    status.mode === 'online'
      ? 'text-emerald-300'
      : status.mode === 'offline'
        ? 'text-rose-300'
        : 'text-amber-300';

  return (
    <div className="flex h-full flex-col border-r border-navy-800 bg-navy-900 text-navy-100">
      <div className="flex h-14 items-center gap-2.5 px-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-white text-navy-900">
          <GraduationCap size={19} />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-bold tracking-[0.14em] text-white">EDUFLOW</p>
          <p className="truncate text-[10px] uppercase tracking-[0.12em] text-navy-200">Gestion scolaire</p>
        </div>
      </div>

      <div className="mx-3 mb-3 border-t border-white/10 pt-3">
        <p className="truncate text-xs font-semibold text-white">
          {user?.role === 'superadmin' ? 'Plateforme EDUFLOW' : user?.establishmentName ?? settings.name}
        </p>
        <p className="mt-0.5 truncate text-[10px] text-navy-200">
          {user?.role === 'superadmin' ? 'Super-administrateur' : settings.city}
        </p>
      </div>

      <nav className="scroll-thin flex-1 space-y-4 overflow-y-auto px-2.5 pb-4" aria-label="Navigation principale">
        {NAV_GROUPS.map((group) => {
          const visibleItems = group.items.filter(canSee);
          if (visibleItems.length === 0) return null;
          return (
            <div key={group.title}>
              <p className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-navy-300">
                {group.title}
              </p>
              <ul className="space-y-px">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const hasChildren = Boolean(item.children && item.children.length > 0);
                  const parentActive = itemIsActive(item, location.pathname);
                  const open = openSections.includes(item.path);
                  if (hasChildren) {
                    const children = item.children?.filter(canSee) ?? [];
                    return (
                      <li key={item.path}>
                        <button
                          type="button"
                          onClick={() =>
                            setOpenSections((current) =>
                              current.includes(item.path)
                                ? current.filter((path) => path !== item.path)
                                : [...current, item.path],
                            )
                          }
                          aria-expanded={open}
                          className={cn(
                            'flex w-full items-center gap-2.5 rounded px-2.5 py-[7px] text-left text-[13px] font-medium transition-colors',
                            parentActive
                              ? 'bg-white/[0.06] text-white'
                              : 'text-navy-100 hover:bg-white/[0.06] hover:text-white',
                          )}
                        >
                          <Icon size={16} className={parentActive ? 'text-royal-300' : 'text-navy-200'} />
                          <span className="flex-1">{item.label}</span>
                          <ChevronDown
                            size={14}
                            className={cn('text-navy-300 transition-transform', open && 'rotate-180')}
                          />
                        </button>
                        {open ? (
                          <ul className="mb-1 ml-[19px] mt-0.5 space-y-px border-l border-white/10 pl-2.5">
                            {children.map((child) => {
                              const ChildIcon = child.icon;
                              return (
                                <li key={child.path}>
                                  <NavLink
                                    to={child.path}
                                    end={child.end}
                                    onClick={onNavigate}
                                    className={({ isActive }) =>
                                      cn(
                                        'flex items-center gap-2 rounded px-2 py-[5px] text-xs transition-colors',
                                        isActive
                                          ? 'bg-white/[0.08] font-semibold text-white'
                                          : 'text-navy-200 hover:bg-white/[0.05] hover:text-white',
                                      )
                                    }
                                  >
                                    <ChildIcon size={13} className="shrink-0 opacity-70" />
                                    {child.label}
                                  </NavLink>
                                </li>
                              );
                            })}
                          </ul>
                        ) : null}
                      </li>
                    );
                  }
                  return (
                    <li key={item.path}>
                      <NavLink
                        to={item.path}
                        end={item.end}
                        onClick={onNavigate}
                        className={({ isActive }) =>
                          cn(
                            'relative flex items-center gap-2.5 rounded px-2.5 py-[7px] text-[13px] font-medium transition-colors',
                            isActive
                              ? 'bg-white/10 font-semibold text-white'
                              : 'text-navy-100 hover:bg-white/[0.06] hover:text-white',
                          )
                        }
                      >
                        {({ isActive }) => (
                          <>
                            {isActive ? (
                              <span className="absolute -left-2.5 inset-y-1 w-[2px] rounded-r bg-royal-300" aria-hidden="true" />
                            ) : null}
                            <Icon size={16} className={cn('shrink-0', isActive ? 'text-white' : 'text-navy-200')} />
                            {item.label}
                          </>
                        )}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-3 py-3">
        <div className={cn('flex items-center gap-2 text-[11px] font-medium', modeColor)}>
          {modeIcon}
          <span>{modeLabel}</span>
        </div>
        <p className="mt-1 text-[10px] leading-snug text-navy-300">
          {status.mode === 'online'
            ? 'Synchronisé avec le serveur EDUFLOW.'
            : 'Serveur EDUFLOW injoignable.'}
        </p>
        {user ? <p className="mt-2 truncate text-[10px] text-navy-300">v1.0 · {version ? `maj ${version}` : 'prêt'}</p> : null}
      </div>
    </div>
  );
}

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[252px] print:hidden lg:block">
        <SidebarContent />
      </aside>
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-navy-950/60" onClick={onClose} aria-hidden="true" />
          <aside className="absolute inset-y-0 left-0 w-[272px] shadow-pop">
            <button
              type="button"
              onClick={onClose}
              className="absolute right-2.5 top-3.5 z-10 rounded p-1.5 text-navy-200 hover:bg-white/10 hover:text-white"
              aria-label="Fermer le menu"
            >
              <X size={18} />
            </button>
            <SidebarContent onNavigate={onClose} />
          </aside>
        </div>
      ) : null}
    </>
  );
}
