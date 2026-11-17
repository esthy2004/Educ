import { useEffect, useMemo, useState } from 'react';
import { RotateCcw, Save, ShieldCheck } from 'lucide-react';
import type { PermissionKey, Role, SchoolSettings } from '@/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useConfirm } from '@/hooks/useConfirm';
import { useToast } from '@/hooks/useToast';
import { settingsService } from '@/services/settings.service';
import { ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, ROLE_LABELS } from '@/config/permissions';
import { cn } from '@/utils/format';

const ROLES: Role[] = ['admin', 'director', 'secretary', 'accountant', 'teacher'];

export function RolesPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [permissions, setPermissions] = useState<SchoolSettings['rolePermissions'] | null>(null);
  const [role, setRole] = useState<Role>('teacher');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    settingsService.get().then((settings) => {
      if (active) setPermissions(settings.rolePermissions);
    });
    return () => {
      active = false;
    };
  }, []);

  const groups = useMemo(() => {
    const map = new Map<string, typeof ALL_PERMISSIONS>();
    ALL_PERMISSIONS.forEach((permission) => {
      const list = map.get(permission.group) ?? [];
      list.push(permission);
      map.set(permission.group, list);
    });
    return [...map.entries()];
  }, []);

  if (!permissions) {
    return (
      <>
        <PageHeader eyebrow="Administration" title="Rôles & permissions" subtitle="Chargement de la matrice des droits…" />
        <div className="h-96 animate-pulse rounded-lg border border-line bg-white" />
      </>
    );
  }

  const current = permissions[role] ?? [];

  const toggle = (key: PermissionKey) => {
    setPermissions((state) => {
      if (!state) return state;
      const list = state[role] ?? [];
      return {
        ...state,
        [role]: list.includes(key) ? list.filter((item) => item !== key) : [...list, key],
      };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await settingsService.updatePermissions(role, current);
      toast.success(`Permissions du rôle « ${ROLE_LABELS[role]} » enregistrées.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    const confirmed = await confirm({
      title: 'Rétablir les droits par défaut ?',
      message: `Les permissions du rôle « ${ROLE_LABELS[role]} » seront remplacées par les droits recommandés. Pensez à enregistrer.`,
      confirmLabel: 'Rétablir',
    });
    if (!confirmed) return;
    setPermissions((state) => (state ? { ...state, [role]: [...DEFAULT_ROLE_PERMISSIONS[role]] } : state));
  };

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Rôles & permissions"
        subtitle="Définissez les modules accessibles à chaque profil d’utilisateur."
        actions={
          <>
            <Button variant="outline" icon={<RotateCcw size={15} />} onClick={() => void handleReset()}>
              Droits par défaut
            </Button>
            <Button icon={<Save size={15} />} loading={saving} onClick={() => void handleSave()}>
              Enregistrer
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {ROLES.map((roleKey) => {
          const count = (permissions[roleKey] ?? []).length;
          const active = roleKey === role;
          return (
            <button
              key={roleKey}
              type="button"
              onClick={() => setRole(roleKey)}
              className={cn(
                'rounded-lg border bg-white px-4 py-3 text-left shadow-card transition',
                active ? 'border-royal-500 ring-2 ring-royal-100' : 'border-line hover:border-slate-300',
              )}
            >
              <p className="flex items-center gap-2 text-sm font-semibold text-navy-900">
                <ShieldCheck size={15} className={active ? 'text-royal-600' : 'text-slate-400'} />
                {ROLE_LABELS[roleKey]}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                {count} / {ALL_PERMISSIONS.length} permissions
              </p>
            </button>
          );
        })}
      </div>

      <Card className="mt-5">
        <CardHeader
          title={`Permissions · ${ROLE_LABELS[role]}`}
          subtitle="Cochez les actions autorisées pour ce rôle."
          action={<Badge tone="royal">{current.length} droit(s)</Badge>}
        />
        <CardBody className="space-y-6">
          {groups.map(([group, items]) => (
            <section key={group}>
              <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{group}</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {items.map((permission) => {
                  const checked = current.includes(permission.key);
                  return (
                    <label
                      key={permission.key}
                      className={cn(
                        'flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition',
                        checked ? 'border-royal-200 bg-royal-50/40' : 'border-slate-200 bg-white hover:border-slate-300',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(permission.key)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-royal-600 focus:ring-royal-500"
                      />
                      <span className="min-w-0">
                        <span className={checked ? 'font-medium text-navy-900' : 'text-slate-700'}>{permission.label}</span>
                        <span className="block font-mono text-[10px] text-slate-400">{permission.key}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </section>
          ))}
          {role === 'admin' ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-700">
              Attention : retirer le dernier droit d’administration peut bloquer l’accès aux paramètres. Les autres
              administrateurs conservent leurs propres droits.
            </p>
          ) : null}
        </CardBody>
      </Card>
    </>
  );
}
