import { useEffect, useState } from 'react';
import { KeyRound, Pencil, Plus, Trash2, UserCheck, UserX, Users } from 'lucide-react';
import type { Role, UserAccount } from '@/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Select } from '@/components/ui/Input';
import { SearchInput } from '@/components/ui/SearchInput';
import { Avatar } from '@/components/ui/Avatar';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { useAuth } from '@/hooks/useAuth';
import { useConfirm } from '@/hooks/useConfirm';
import { useDataVersion } from '@/hooks/useDataVersion';
import { useToast } from '@/hooks/useToast';
import { settingsService } from '@/services/settings.service';
import { ROLE_BADGE_CLASSES, ROLE_LABELS } from '@/config/permissions';
import { cn, formatDate, normalize } from '@/utils/format';

interface UserForm {
  name: string;
  username: string;
  email: string;
  password: string;
  role: Role;
  phone: string;
  active: boolean;
}

const emptyForm: UserForm = {
  name: '',
  username: '',
  email: '',
  password: '',
  role: 'secretary',
  phone: '',
  active: true,
};

const ROLES: Role[] = ['admin', 'director', 'secretary', 'accountant', 'teacher'];

export function UsersPage() {
  const { user, can } = useAuth();
  const version = useDataVersion();
  const toast = useToast();
  const confirm = useConfirm();

  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | ''>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<UserAccount | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof UserForm, string>>>({});
  const [saving, setSaving] = useState(false);

  const canManage = can('users.manage') || can('settings.manage');

  useEffect(() => {
    let active = true;
    setLoading(true);
    settingsService
      .listUsers()
      .then((list) => {
        if (active) setUsers(list.sort((a, b) => a.name.localeCompare(b.name)));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [version]);

  const filtered = users.filter((account) => {
    if (roleFilter && account.role !== roleFilter) return false;
    if (search) {
      const haystack = normalize(`${account.name} ${account.username} ${account.email} ${account.phone}`);
      if (!haystack.includes(normalize(search))) return false;
    }
    return true;
  });

  const openCreate = () => {
    setEditing(null);
    setErrors({});
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (account: UserAccount) => {
    setEditing(account);
    setErrors({});
    setForm({
      name: account.name,
      username: account.username,
      email: account.email,
      password: '',
      role: account.role,
      phone: account.phone,
      active: account.active,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    const next: Partial<Record<keyof UserForm, string>> = {};
    if (!form.name.trim()) next.name = 'Le nom est obligatoire.';
    if (!form.username.trim()) next.username = 'L’identifiant est obligatoire.';
    if (!form.email.trim()) next.email = 'L’e-mail est obligatoire.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = 'Adresse e-mail invalide.';
    if (!editing && form.password.length < 8) next.password = 'Le mot de passe doit contenir au moins 8 caractères.';
    if (editing && form.password && form.password.length < 8) next.password = 'Le mot de passe doit contenir au moins 8 caractères.';
    if (!editing && users.some((account) => account.username.toLowerCase() === form.username.trim().toLowerCase())) {
      next.username = 'Ce nom d’utilisateur est déjà utilisé.';
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      if (editing) {
        await settingsService.updateUser(editing.id, {
          name: form.name.trim(),
          username: form.username.trim(),
          email: form.email.trim(),
          role: form.role,
          phone: form.phone.trim(),
          active: form.active,
          ...(form.password ? { password: form.password } : {}),
        });
        toast.success('Le compte a été mis à jour.');
      } else {
        await settingsService.createUser({
          name: form.name.trim(),
          username: form.username.trim(),
          email: form.email.trim(),
          password: form.password,
          role: form.role,
          phone: form.phone.trim(),
          active: form.active,
          staffId: null,
        });
        toast.success('Le compte utilisateur a été créé.');
      }
      setModalOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (account: UserAccount) => {
    try {
      await settingsService.updateUser(account.id, { active: !account.active });
      toast.success(account.active ? 'Compte désactivé.' : 'Compte réactivé.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Mise à jour impossible.');
    }
  };

  const handleDelete = async (account: UserAccount) => {
    if (account.id === user?.id) {
      toast.error('Vous ne pouvez pas supprimer votre propre compte.');
      return;
    }
    const confirmed = await confirm({
      title: 'Supprimer ce compte ?',
      message: `${account.name} (${account.username}) ne pourra plus se connecter à EDUFLOW. Cette action est irréversible.`,
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!confirmed) return;
    try {
      await settingsService.removeUser(account.id);
      toast.success('Compte supprimé.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Suppression impossible.');
    }
  };

  const columns: Array<Column<UserAccount>> = [
    {
      key: 'name',
      header: 'Utilisateur',
      render: (account) => (
        <div className="flex items-center gap-2.5">
          <Avatar firstName={account.name.split(' ')[0] ?? ''} lastName={account.name.split(' ').slice(1).join(' ')} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-800">{account.name}</p>
            <p className="text-[11px] text-slate-400">@{account.username}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Contact',
      render: (account) => (
        <div className="min-w-0">
          <p className="truncate text-xs text-slate-600">{account.email}</p>
          <p className="text-[11px] text-slate-400">{account.phone || '—'}</p>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Rôle',
      render: (account) => (
        <span
          className={cn(
            'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset',
            ROLE_BADGE_CLASSES[account.role],
          )}
        >
          {ROLE_LABELS[account.role]}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Statut',
      render: (account) => (
        <Badge tone={account.active ? 'success' : 'neutral'} dot>
          {account.active ? 'Actif' : 'Désactivé'}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      header: 'Créé le',
      render: (account) => <span className="text-xs text-slate-500">{formatDate(account.createdAt)}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (account) => (
        <div className="flex items-center justify-end gap-1">
          {canManage ? (
            <>
              <button
                type="button"
                onClick={() => void handleToggle(account)}
                className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                title={account.active ? 'Désactiver' : 'Réactiver'}
                aria-label={account.active ? 'Désactiver le compte' : 'Réactiver le compte'}
              >
                {account.active ? <UserX size={15} /> : <UserCheck size={15} />}
              </button>
              <button
                type="button"
                onClick={() => openEdit(account)}
                className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                title="Modifier"
                aria-label="Modifier le compte"
              >
                <Pencil size={15} />
              </button>
              <button
                type="button"
                onClick={() => void handleDelete(account)}
                className="rounded-md p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                title="Supprimer"
                aria-label="Supprimer le compte"
              >
                <Trash2 size={15} />
              </button>
            </>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Utilisateurs"
        subtitle="Créez les comptes d’accès et attribuez un rôle à chaque membre de l’équipe."
        actions={
          canManage ? (
            <Button icon={<Plus size={15} />} onClick={openCreate}>
              Nouvel utilisateur
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone="royal">
          <Users size={11} /> {users.length} compte(s)
        </Badge>
        <Badge tone="success" dot>
          {users.filter((account) => account.active).length} actifs
        </Badge>
        <Badge tone="neutral">{users.filter((account) => account.role === 'admin').length} administrateur(s)</Badge>
      </div>

      <Card>
        <CardBody className="grid gap-2.5 border-b border-slate-100 sm:grid-cols-2 lg:grid-cols-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Nom, identifiant, e-mail…" />
          <select
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value as Role | '')}
            aria-label="Filtrer par rôle"
            className="h-9 rounded-md border border-line bg-white px-3 text-[13px] text-slate-600 focus:border-royal-400 focus:outline-none focus:ring-2 focus:ring-royal-100"
          >
            <option value="">Tous les rôles</option>
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            icon={<KeyRound size={15} />}
            onClick={() => {
              setSearch('');
              setRoleFilter('');
            }}
          >
            Réinitialiser
          </Button>
        </CardBody>
        <DataTable
          columns={columns}
          data={filtered}
          rowKey={(account) => account.id}
          loading={loading}
          emptyTitle="Aucun utilisateur"
          emptyDescription="Aucun compte ne correspond aux filtres sélectionnés."
        />
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Modifier le compte' : 'Nouvel utilisateur'}
        description={
          editing
            ? `Compte @${editing.username} · laissez le mot de passe vide pour le conserver`
            : 'Le compte permettra de se connecter à EDUFLOW avec le rôle choisi.'
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Annuler
            </Button>
            <Button loading={saving} onClick={() => void handleSave()}>
              {editing ? 'Enregistrer' : 'Créer le compte'}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Nom complet"
            required
            fieldClassName="sm:col-span-2"
            value={form.name}
            error={errors.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          />
          <Input
            label="Identifiant"
            required
            value={form.username}
            error={errors.username}
            onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
            hint="Utilisé pour la connexion"
          />
          <Select
            label="Rôle"
            value={form.role}
            onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as Role }))}
          >
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </Select>
          <Input
            label="E-mail"
            type="email"
            required
            value={form.email}
            error={errors.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
          />
          <Input
            label="Téléphone"
            type="tel"
            value={form.phone}
            onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
          />
          <Input
            label={editing ? 'Nouveau mot de passe' : 'Mot de passe'}
            type="password"
            required={!editing}
            fieldClassName="sm:col-span-2"
            value={form.password}
            error={errors.password}
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            hint={editing ? 'Laissez vide pour ne pas changer le mot de passe.' : 'Au moins 8 caractères.'}
          />
          <label className="flex items-center gap-2 sm:col-span-2">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
              className="h-4 w-4 rounded border-slate-300 text-royal-600 focus:ring-royal-500"
            />
            <span className="text-sm text-slate-600">Compte actif (autorisé à se connecter)</span>
          </label>
        </div>
      </Modal>
    </>
  );
}
