import { useEffect, useState } from 'react';
import { FileText, Printer, Save } from 'lucide-react';
import type { SchoolSettings } from '@/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Toggle } from '@/components/ui/Toggle';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { settingsService } from '@/services/settings.service';
import { formatDateLong, todayIso } from '@/utils/format';

export function PrintingPage() {
  const { can } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState<SchoolSettings | null>(null);
  const [saving, setSaving] = useState(false);

  const canManage = can('settings.manage');

  useEffect(() => {
    let active = true;
    settingsService.get().then((settings) => {
      if (active) setForm(settings);
    });
    return () => {
      active = false;
    };
  }, []);

  const set = <K extends keyof SchoolSettings>(key: K, value: SchoolSettings[K]) =>
    setForm((current) => (current ? { ...current, [key]: value } : current));

  const handleSave = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const saved = await settingsService.update({
        printHeader: form.printHeader,
        printFooter: form.printFooter,
        paperSize: form.paperSize,
        showLogoOnDocuments: form.showLogoOnDocuments,
        logo: form.logo,
      });
      setForm(saved);
      toast.success('Paramètres d’impression enregistrés.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  };

  if (!form) {
    return (
      <>
        <PageHeader eyebrow="Administration" title="Impression" subtitle="Chargement des paramètres d’impression…" />
        <div className="h-80 animate-pulse rounded-lg border border-line bg-white" />
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Impression"
        subtitle="Personnalisez l’en-tête, le pied de page et la mise en page des documents."
        actions={
          <Button icon={<Save size={15} />} loading={saving} onClick={() => void handleSave()} disabled={!canManage}>
            Enregistrer
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="En-tête et pied de page"
            subtitle="Textes imprimés sur les certificats, reçus et listes."
            action={<Badge tone="royal"><Printer size={11} /> Documents</Badge>}
          />
          <CardBody className="space-y-4">
            <Input
              label="En-tête des documents"
              value={form.printHeader}
              onChange={(event) => set('printHeader', event.target.value)}
              disabled={!canManage}
              hint="Ex. nom de l’établissement et numéro d’autorisation."
            />
            <Textarea
              label="Pied de page"
              value={form.printFooter}
              onChange={(event) => set('printFooter', event.target.value)}
              disabled={!canManage}
              hint="Mention affichée en bas de chaque document généré."
            />
            <Select
              label="Format du papier"
              value={form.paperSize}
              onChange={(event) => set('paperSize', event.target.value as SchoolSettings['paperSize'])}
              disabled={!canManage}
            >
              <option value="A4">A4 (210 × 297 mm)</option>
              <option value="A5">A5 (148 × 210 mm)</option>
            </Select>
            <Input
              label="URL du logo"
              type="url"
              value={form.logo}
              onChange={(event) => set('logo', event.target.value)}
              disabled={!canManage}
              placeholder="https://… ou laisser vide"
              hint="Le logo est affiché en haut des documents si l’option est activée."
            />
            <Toggle
              checked={form.showLogoOnDocuments}
              onChange={(checked) => set('showLogoOnDocuments', checked)}
              label="Afficher le logo sur les documents"
              description="Décochez pour imprimer des documents sans logo."
              disabled={!canManage}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Aperçu" subtitle="Rendu simplifié de l’en-tête et du pied de page." />
          <CardBody>
            <div className="document-sheet max-w-full rounded-lg border border-slate-200 p-6 shadow-sm">
              <header className="border-b-2 border-navy-900 pb-3 text-center">
                {form.showLogoOnDocuments && form.logo ? (
                  <img src={form.logo} alt="Logo de l’établissement" className="mx-auto mb-2 h-12 object-contain" />
                ) : null}
                <p className="text-[9px] uppercase tracking-[0.16em] text-slate-500">
                  {form.country} · {form.type}
                </p>
                <h2 className="mt-1 text-base font-bold uppercase tracking-wide text-navy-900">{form.name}</h2>
                <p className="mt-0.5 text-[9px] text-slate-500">{form.printHeader || 'En-tête non défini'}</p>
                <p className="text-[9px] text-slate-500">
                  {form.address} · {form.city} · Tél. {form.phone}
                </p>
              </header>
              <div className="py-8 text-center">
                <p className="flex items-center justify-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-700">
                  <FileText size={16} /> Aperçu du document
                </p>
                <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                  Certificats de scolarité, reçus de paiement et listes de classe utilisent cet en-tête.
                </p>
                <p className="mt-6 text-[11px] text-slate-500">
                  Fait à {form.city}, le {formatDateLong(todayIso())}
                </p>
              </div>
              <footer className="border-t border-slate-200 pt-2 text-center text-[9px] text-slate-400">
                {form.printFooter || 'Pied de page non défini'}
              </footer>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
              L’impression réelle utilise le format A4 défini par le navigateur. Le format sélectionné est appliqué aux
              documents générés par l’application.
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
