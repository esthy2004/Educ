import { useEffect, useRef, useState } from 'react';
import { Building2, Download, RefreshCw, Save, Upload, UserRound, Wallet } from 'lucide-react';
import type { SchoolSettings } from '@/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Toggle } from '@/components/ui/Toggle';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/hooks/useAuth';
import { useConfirm } from '@/hooks/useConfirm';
import { useToast } from '@/hooks/useToast';
import { settingsService } from '@/services/settings.service';
import { databaseService } from '@/services/database.service';
import { downloadBlob, todayIso } from '@/utils/format';

const CURRENCIES = ['FCFA', 'EUR', 'USD', 'CAD', 'MAD', 'XOF'];

export function SettingsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<SchoolSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [databaseEngine, setDatabaseEngine] = useState('SQLite');

  const canManage = can('settings.manage');
  const canBackup = can('users.manage');
  const databaseLabel =
    databaseEngine === 'Local (hors ligne)' ? 'locale du navigateur' : databaseEngine;

  useEffect(() => {
    let active = true;
    settingsService
      .get()
      .then((settings) => {
        if (active) setForm(settings);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    databaseService
      .info()
      .then((info) => {
        if (active) setDatabaseEngine(info.engine);
      })
      .catch(() => {
        // Le libellé par défaut reste affiché si les informations sont indisponibles.
      });
    return () => {
      active = false;
    };
  }, []);

  const set = <K extends keyof SchoolSettings>(key: K, value: SchoolSettings[K]) =>
    setForm((current) => (current ? { ...current, [key]: value } : current));

  const handleSave = async () => {
    if (!form) return;
    if (!form.name.trim() || !form.shortName.trim()) {
      toast.error('Le nom et le sigle de l’établissement sont obligatoires.');
      return;
    }
    setSaving(true);
    try {
      const saved = await settingsService.update({
        name: form.name.trim(),
        shortName: form.shortName.trim(),
        type: form.type,
        address: form.address,
        city: form.city,
        country: form.country,
        phone: form.phone,
        email: form.email,
        website: form.website,
        director: form.director,
        currency: form.currency,
        motto: form.motto,
        dateFormat: form.dateFormat,
      });
      setForm(saved);
      toast.success('Les paramètres de l’établissement ont été enregistrés.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  };

  const handleBackup = async () => {
    try {
      const json = await databaseService.exportJson();
      downloadBlob(new Blob([json], { type: 'application/json' }), `eduflow-sauvegarde-${todayIso()}.json`);
      toast.success('Sauvegarde JSON téléchargée.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Export impossible.');
    }
  };

  const handleRestore = async (file: File) => {
    try {
      const raw = await file.text();
      const confirmed = await confirm({
        title: 'Restaurer cette sauvegarde ?',
        message: 'Les données actuelles seront remplacées par le contenu du fichier de sauvegarde. Cette action est immédiate.',
        confirmLabel: 'Restaurer',
        danger: true,
      });
      if (!confirmed) return;
      await databaseService.importJson(raw);
      const restored = await settingsService.get();
      setForm(restored);
      toast.success('Sauvegarde restaurée.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Fichier de sauvegarde invalide.');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleReset = async () => {
    const confirmed = await confirm({
      title: 'Réinitialiser la base ?',
      message: 'Toutes les données du serveur seront effacées. Seul le compte administrateur sera conservé. Cette action est irréversible.',
      confirmLabel: 'Réinitialiser',
      danger: true,
    });
    if (!confirmed) return;
    try {
      await databaseService.reset();
      const reset = await settingsService.get();
      setForm(reset);
      toast.success('La base a été réinitialisée.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Réinitialisation impossible.');
    }
  };

  if (loading || !form) {
    return (
      <>
        <PageHeader eyebrow="Administration" title="Paramètres" subtitle="Chargement des paramètres…" />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-40 animate-pulse rounded-lg border border-line bg-white" />
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Établissement"
        subtitle="Identité, coordonnées et préférences générales utilisées dans toute l’application."
        actions={
          <Button icon={<Save size={15} />} loading={saving} onClick={() => void handleSave()} disabled={!canManage}>
            Enregistrer
          </Button>
        }
      />

      <div className="space-y-5">
        <Card>
          <CardHeader
            title="Identité de l’établissement"
            subtitle="Ces informations apparaissent sur les documents officiels."
            action={<Badge tone="royal"><Building2 size={11} /> {form.shortName}</Badge>}
          />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Nom complet"
              required
              value={form.name}
              onChange={(event) => set('name', event.target.value)}
              disabled={!canManage}
            />
            <Input
              label="Sigle / nom court"
              required
              value={form.shortName}
              onChange={(event) => set('shortName', event.target.value)}
              disabled={!canManage}
            />
            <Input
              label="Type d’établissement"
              fieldClassName="sm:col-span-2"
              value={form.type}
              onChange={(event) => set('type', event.target.value)}
              disabled={!canManage}
              placeholder="Ex. Enseignement primaire et secondaire"
            />
            <Input
              label="Devise / slogan"
              fieldClassName="sm:col-span-2"
              value={form.motto}
              onChange={(event) => set('motto', event.target.value)}
              disabled={!canManage}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Coordonnées" subtitle="Contact et localisation de l’établissement." />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Adresse"
              fieldClassName="sm:col-span-2"
              value={form.address}
              onChange={(event) => set('address', event.target.value)}
              disabled={!canManage}
            />
            <Input label="Ville" value={form.city} onChange={(event) => set('city', event.target.value)} disabled={!canManage} />
            <Input label="Pays" value={form.country} onChange={(event) => set('country', event.target.value)} disabled={!canManage} />
            <Input label="Téléphone" type="tel" value={form.phone} onChange={(event) => set('phone', event.target.value)} disabled={!canManage} />
            <Input label="E-mail" type="email" value={form.email} onChange={(event) => set('email', event.target.value)} disabled={!canManage} />
            <Input
              label="Site web"
              fieldClassName="sm:col-span-2"
              value={form.website}
              onChange={(event) => set('website', event.target.value)}
              disabled={!canManage}
            />
          </CardBody>
        </Card>

        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader title="Direction & préférences" subtitle="Responsable et format des données." />
            <CardBody className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Directeur / Proviseur"
                fieldClassName="sm:col-span-2"
                value={form.director}
                onChange={(event) => set('director', event.target.value)}
                disabled={!canManage}
                leftIcon={<UserRound size={15} />}
              />
              <Select
                label="Devise monétaire"
                value={form.currency}
                onChange={(event) => set('currency', event.target.value)}
                disabled={!canManage}
              >
                {CURRENCIES.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </Select>
              <Select
                label="Format de date"
                value={form.dateFormat}
                onChange={(event) => set('dateFormat', event.target.value)}
                disabled={!canManage}
              >
                <option value="dd/MM/yyyy">JJ/MM/AAAA</option>
                <option value="MM/dd/yyyy">MM/JJ/AAAA</option>
                <option value="yyyy-MM-dd">AAAA-MM-JJ</option>
              </Select>
              <div className="sm:col-span-2">
                <Toggle
                  checked={form.showLogoOnDocuments}
                  onChange={(checked) => set('showLogoOnDocuments', checked)}
                  label="Afficher le logo sur les documents"
                  description="Le logo est utilisé dans l’en-tête des documents imprimés."
                  disabled={!canManage}
                />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Sauvegarde des données"
              subtitle="Exportez ou restaurez la base de données de l’application."
              action={<Badge tone="teal"><Wallet size={11} /> {databaseEngine}</Badge>}
            />
            <CardBody className="space-y-3">
              <p className="text-xs leading-relaxed text-slate-500">
                Les données sont stockées dans la base {databaseLabel}. Exportez régulièrement une sauvegarde JSON
                avant de changer de poste, et importez-la pour retrouver vos données.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" icon={<Download size={15} />} onClick={() => void handleBackup()} disabled={!canBackup}>
                  Exporter la base
                </Button>
                <Button variant="outline" icon={<Upload size={15} />} onClick={() => fileRef.current?.click()} disabled={!canBackup}>
                  Importer une sauvegarde
                </Button>
                <Button variant="danger" icon={<RefreshCw size={15} />} onClick={() => void handleReset()} disabled={!canBackup}>
                  Réinitialiser
                </Button>
              </div>
              {!canBackup && (
                <p className="text-[11px] leading-relaxed text-slate-500">
                  La sauvegarde, la restauration et la réinitialisation sont réservées aux administrateurs.
                </p>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleRestore(file);
                }}
              />
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-700">
                La réinitialisation efface toutes les données métier et conserve uniquement le compte administrateur.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
