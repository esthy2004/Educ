import { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  GraduationCap,
  MapPin,
  Plus,
  Power,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import type { EstablishmentWithStats } from '@/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/hooks/useAuth';
import { useConfirm } from '@/hooks/useConfirm';
import { useDataVersion } from '@/hooks/useDataVersion';
import { useToast } from '@/hooks/useToast';
import {
  schoolsService,
  type CreateEstablishmentInput,
  type EstablishmentAdminInput,
} from '@/services/schools.service';
import { formatDate } from '@/utils/format';

const emptyEstablishment: CreateEstablishmentInput = {
  name: '',
  code: '',
  type: '',
  address: '',
  city: '',
  country: '',
  phone: '',
  email: '',
  director: '',
  admin: {
    name: '',
    username: '',
    email: '',
    password: '',
    phone: '',
  },
};

const emptyAdmin: EstablishmentAdminInput = {
  name: '',
  username: '',
  email: '',
  password: '',
  phone: '',
};

export function EstablishmentsPage() {
  const { user } = useAuth();
  const version = useDataVersion();
  const toast = useToast();
  const confirm = useConfirm();

  const [establishments, setEstablishments] = useState<EstablishmentWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [adminTarget, setAdminTarget] = useState<EstablishmentWithStats | null>(null);
  const [form, setForm] = useState<CreateEstablishmentInput>(emptyEstablishment);
  const [adminForm, setAdminForm] = useState<EstablishmentAdminInput>(emptyAdmin);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    schoolsService
      .list()
      .then(setEstablishments)
      .catch((loadError) => {
        toast.error(loadError instanceof Error ? loadError.message : 'Chargement impossible.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  const totals = useMemo(
    () =>
      establishments.reduce(
        (accumulator, establishment) => ({
          students: accumulator.students + establishment.stats.students,
          staff: accumulator.staff + establishment.stats.staff,
          admins: accumulator.admins + establishment.admins.length,
        }),
        { students: 0, staff: 0, admins: 0 },
      ),
    [establishments],
  );

  const setField = (key: keyof Omit<CreateEstablishmentInput, 'admin'>, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const setAdminField = (
    key: keyof EstablishmentAdminInput,
    value: string,
    target: 'create' | 'add' = 'create',
  ) => {
    if (target === 'create') {
      setForm((current) => ({ ...current, admin: { ...current.admin, [key]: value } }));
    } else {
      setAdminForm((current) => ({ ...current, [key]: value }));
    }
  };

  const validateAdmin = (admin: EstablishmentAdminInput): string | null => {
    if (!admin.name.trim()) return 'Le nom de l’administrateur est obligatoire.';
    if (!admin.username.trim()) return 'L’identifiant de l’administrateur est obligatoire.';
    if (admin.password.length < 8) return 'Le mot de passe doit contenir au moins 8 caractères.';
    return null;
  };

  const handleCreate = async () => {
    setError('');
    if (!form.name.trim() || !form.code.trim()) {
      setError('Le nom et le code de l’établissement sont obligatoires.');
      return;
    }
    const adminError = validateAdmin(form.admin);
    if (adminError) {
      setError(adminError);
      return;
    }
    setSaving(true);
    try {
      await schoolsService.create({
        ...form,
        name: form.name.trim(),
        code: form.code.trim(),
        admin: {
          ...form.admin,
          name: form.admin.name.trim(),
          username: form.admin.username.trim(),
        },
      });
      setCreateOpen(false);
      setForm(emptyEstablishment);
      toast.success('L’établissement et son compte administrateur ont été créés.');
      load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Création impossible.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddAdmin = async () => {
    if (!adminTarget) return;
    setError('');
    const adminError = validateAdmin(adminForm);
    if (adminError) {
      setError(adminError);
      return;
    }
    setSaving(true);
    try {
      await schoolsService.createAdmin(adminTarget.id, {
        ...adminForm,
        name: adminForm.name.trim(),
        username: adminForm.username.trim(),
      });
      setAdminTarget(null);
      setAdminForm(emptyAdmin);
      toast.success('Le compte administrateur a été créé.');
      load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Création impossible.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (establishment: EstablishmentWithStats) => {
    const confirmed = await confirm({
      title: establishment.active ? 'Désactiver cet établissement ?' : 'Réactiver cet établissement ?',
      message: establishment.active
        ? `Les comptes de ${establishment.name} ne pourront plus se connecter. Aucune donnée ne sera supprimée.`
        : `Les comptes de ${establishment.name} pourront de nouveau se connecter.`,
      confirmLabel: establishment.active ? 'Désactiver' : 'Réactiver',
      danger: establishment.active,
    });
    if (!confirmed) return;
    try {
      await schoolsService.update(establishment.id, { active: !establishment.active });
      toast.success(establishment.active ? 'Établissement désactivé.' : 'Établissement réactivé.');
      load();
    } catch (toggleError) {
      toast.error(toggleError instanceof Error ? toggleError.message : 'Mise à jour impossible.');
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Plateforme"
        title="Établissements"
        subtitle="Créez les écoles et leurs comptes administrateurs. Chaque administrateur ne voit que les données de son établissement."
        actions={
          <Button
            icon={<Plus size={15} />}
            onClick={() => {
              setError('');
              setForm(emptyEstablishment);
              setCreateOpen(true);
            }}
          >
            Nouvel établissement
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Badge tone="royal">
          <Building2 size={11} /> {establishments.length} établissement(s)
        </Badge>
        <Badge tone="success" dot>
          {establishments.filter((establishment) => establishment.active).length} actif(s)
        </Badge>
        <Badge tone="neutral">
          <Users size={11} /> {totals.students} élève(s)
        </Badge>
        <Badge tone="neutral">{totals.admins} administrateur(s)</Badge>
        <span className="ml-auto flex items-center gap-1 text-[11px] text-slate-400">
          <ShieldCheck size={13} /> Connecté en tant que {user?.name}
        </span>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-56 animate-pulse rounded-lg border border-line bg-white" />
          ))}
        </div>
      ) : establishments.length === 0 ? (
        <Card>
          <CardBody className="flex flex-col items-center justify-center py-14 text-center">
            <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-royal-50 text-royal-600">
              <Building2 size={22} />
            </span>
            <h2 className="text-base font-semibold text-navy-900">Aucun établissement</h2>
            <p className="mt-1 max-w-md text-sm leading-relaxed text-slate-500">
              Créez votre premier établissement et le compte administrateur qui en gérera les élèves,
              le personnel et les finances.
            </p>
            <Button
              className="mt-5"
              icon={<Plus size={15} />}
              onClick={() => {
                setError('');
                setCreateOpen(true);
              }}
            >
              Créer un établissement
            </Button>
          </CardBody>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {establishments.map((establishment) => (
            <Card key={establishment.id} className="flex flex-col">
              <CardBody className="flex flex-1 flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate text-sm font-semibold text-navy-900">{establishment.name}</h2>
                      <Badge tone={establishment.active ? 'success' : 'neutral'} dot>
                        {establishment.active ? 'Actif' : 'Désactivé'}
                      </Badge>
                    </div>
                    <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                      {establishment.code}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleToggle(establishment)}
                    className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    title={establishment.active ? 'Désactiver' : 'Réactiver'}
                    aria-label={establishment.active ? 'Désactiver l’établissement' : 'Réactiver l’établissement'}
                  >
                    <Power size={16} />
                  </button>
                </div>

                <div className="space-y-1.5 text-xs text-slate-500">
                  <p className="flex items-center gap-1.5">
                    <MapPin size={13} className="shrink-0 text-slate-400" />
                    <span className="truncate">
                      {[establishment.city, establishment.country].filter(Boolean).join(', ') || 'Localisation non renseignée'}
                    </span>
                  </p>
                  <p className="flex items-center gap-1.5">
                    <GraduationCap size={13} className="shrink-0 text-slate-400" />
                    <span className="truncate">{establishment.type || 'Type non renseigné'}</span>
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-center">
                  <div>
                    <p className="text-sm font-semibold text-navy-900">{establishment.stats.students}</p>
                    <p className="text-[10px] text-slate-400">Élèves</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-navy-900">{establishment.stats.classes}</p>
                    <p className="text-[10px] text-slate-400">Classes</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-navy-900">{establishment.stats.staff}</p>
                    <p className="text-[10px] text-slate-400">Personnel</p>
                  </div>
                </div>

                <div className="min-w-0">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Administrateurs
                  </p>
                  {establishment.admins.length === 0 ? (
                    <p className="text-xs text-amber-600">Aucun administrateur actif.</p>
                  ) : (
                    <ul className="space-y-1">
                      {establishment.admins.slice(0, 3).map((admin) => (
                        <li key={admin.id} className="flex items-center justify-between gap-2 text-xs">
                          <span className="truncate text-slate-600">{admin.name}</span>
                          <span className="shrink-0 text-[10px] text-slate-400">@{admin.username}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {establishment.admins.length > 3 ? (
                    <p className="mt-1 text-[10px] text-slate-400">
                      +{establishment.admins.length - 3} autre(s)
                    </p>
                  ) : null}
                </div>

                <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                  <span className="text-[10px] text-slate-400">
                    Créé le {formatDate(establishment.createdAt)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<UserPlus size={14} />}
                    onClick={() => {
                      setError('');
                      setAdminForm(emptyAdmin);
                      setAdminTarget(establishment);
                    }}
                  >
                    Ajouter un admin
                  </Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Nouvel établissement"
        description="L’établissement et son premier administrateur seront créés ensemble."
        size="xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Annuler
            </Button>
            <Button loading={saving} onClick={() => void handleCreate()}>
              Créer l’établissement
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          <section>
            <div className="mb-3 flex items-center gap-2">
              <Building2 size={16} className="text-royal-600" />
              <h3 className="text-sm font-semibold text-navy-900">Établissement</h3>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Nom de l’établissement"
                required
                fieldClassName="sm:col-span-2"
                value={form.name}
                onChange={(event) => setField('name', event.target.value)}
                placeholder="Ex. Groupe scolaire Les Palmiers"
              />
              <Input
                label="Code unique"
                required
                value={form.code}
                onChange={(event) => setField('code', event.target.value)}
                placeholder="Ex. GSLP"
                hint="Utilisé pour identifier l’école sur la plateforme."
              />
              <Input
                label="Type"
                value={form.type}
                onChange={(event) => setField('type', event.target.value)}
                placeholder="Primaire, secondaire…"
              />
              <Input
                label="Ville"
                value={form.city}
                onChange={(event) => setField('city', event.target.value)}
              />
              <Input
                label="Pays"
                value={form.country}
                onChange={(event) => setField('country', event.target.value)}
              />
              <Input
                label="Adresse"
                fieldClassName="sm:col-span-2"
                value={form.address}
                onChange={(event) => setField('address', event.target.value)}
              />
              <Input
                label="Téléphone"
                type="tel"
                value={form.phone}
                onChange={(event) => setField('phone', event.target.value)}
              />
              <Input
                label="E-mail"
                type="email"
                value={form.email}
                onChange={(event) => setField('email', event.target.value)}
              />
              <Input
                label="Directeur / Proviseur"
                fieldClassName="sm:col-span-2"
                value={form.director}
                onChange={(event) => setField('director', event.target.value)}
              />
            </div>
          </section>

          <section className="border-t border-slate-100 pt-5">
            <div className="mb-3 flex items-center gap-2">
              <ShieldCheck size={16} className="text-royal-600" />
              <h3 className="text-sm font-semibold text-navy-900">Compte administrateur de l’école</h3>
            </div>
            <p className="mb-3 text-xs leading-relaxed text-slate-500">
              Ce compte ne pourra consulter que les données de cet établissement. Il pourra ensuite créer
              les autres comptes de son équipe.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Nom complet"
                required
                value={form.admin.name}
                onChange={(event) => setAdminField('name', event.target.value)}
              />
              <Input
                label="Identifiant de connexion"
                required
                value={form.admin.username}
                onChange={(event) => setAdminField('username', event.target.value)}
                placeholder="Ex. admin_palmiers"
              />
              <Input
                label="E-mail"
                type="email"
                value={form.admin.email}
                onChange={(event) => setAdminField('email', event.target.value)}
              />
              <Input
                label="Téléphone"
                type="tel"
                value={form.admin.phone}
                onChange={(event) => setAdminField('phone', event.target.value)}
              />
              <Input
                label="Mot de passe initial"
                type="password"
                required
                fieldClassName="sm:col-span-2"
                value={form.admin.password}
                onChange={(event) => setAdminField('password', event.target.value)}
                hint="Au moins 8 caractères. Communiquez-le à l’administrateur."
              />
            </div>
          </section>

          {error ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={Boolean(adminTarget)}
        onClose={() => setAdminTarget(null)}
        title="Ajouter un administrateur"
        description={
          adminTarget
            ? `Nouveau compte rattaché à ${adminTarget.name}.`
            : undefined
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setAdminTarget(null)}>
              Annuler
            </Button>
            <Button loading={saving} onClick={() => void handleAddAdmin()}>
              Créer le compte
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Nom complet"
            required
            fieldClassName="sm:col-span-2"
            value={adminForm.name}
            onChange={(event) => setAdminField('name', event.target.value, 'add')}
          />
          <Input
            label="Identifiant de connexion"
            required
            value={adminForm.username}
            onChange={(event) => setAdminField('username', event.target.value, 'add')}
          />
          <Input
            label="Mot de passe initial"
            type="password"
            required
            value={adminForm.password}
            onChange={(event) => setAdminField('password', event.target.value, 'add')}
            hint="Au moins 8 caractères."
          />
          <Input
            label="E-mail"
            type="email"
            value={adminForm.email}
            onChange={(event) => setAdminField('email', event.target.value, 'add')}
          />
          <Input
            label="Téléphone"
            type="tel"
            value={adminForm.phone}
            onChange={(event) => setAdminField('phone', event.target.value, 'add')}
          />
          {error ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 sm:col-span-2" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-[11px] leading-relaxed text-emerald-700 sm:col-span-2">
            <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
            Ce compte sera automatiquement limité aux données de {adminTarget?.name}.
          </div>
        </div>
      </Modal>
    </>
  );
}
