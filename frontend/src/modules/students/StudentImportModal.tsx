import { useRef, useState } from 'react';
import { Download, FileSpreadsheet, UploadCloud } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/hooks/useToast';
import { studentsService } from '@/services/students.service';
import { exportToExcel, readExcelFile } from '@/utils/excel';

interface StudentImportModalProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

const templateRows = [
  {
    Prénom: 'Awa',
    Nom: 'Diop',
    Sexe: 'F',
    'Date de naissance': '2013-04-12',
    'Lieu de naissance': 'Cotonou',
    Classe: '6ème A',
    Parent: 'Mme Fatou Diop',
    Téléphone: '+229 97 00 00 01',
    Email: 'fatou.diop@mail.com',
    Adresse: '12 rue des Écoles, Cotonou',
    'Groupe sanguin': 'O+',
  },
];

export function StudentImportModal({ open, onClose, onImported }: StudentImportModalProps) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);

  const reset = () => {
    setRows([]);
    setFileName('');
    setResult(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setResult(null);
    try {
      const parsed = await readExcelFile(file);
      if (parsed.length === 0) {
        toast.error('Le fichier ne contient aucune ligne exploitable.');
        return;
      }
      setRows(parsed);
      setFileName(file.name);
    } catch {
      toast.error('Impossible de lire ce fichier. Utilisez un fichier Excel ou CSV.');
    }
  };

  const handleImport = async () => {
    setLoading(true);
    try {
      const response = await studentsService.importMany(rows);
      setResult(response);
      toast.success(`${response.created} élève(s) importé(s).`);
      onImported();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Import impossible.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Importer des élèves"
      description="Chargez un fichier Excel (.xlsx) ou CSV. Les colonnes sont reconnues automatiquement."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={() => { reset(); onClose(); }}>
            Fermer
          </Button>
          <Button onClick={handleImport} disabled={rows.length === 0 || loading} loading={loading} icon={<UploadCloud size={15} />}>
            Importer {rows.length > 0 ? `${rows.length} ligne(s)` : ''}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet size={18} className="text-emerald-600" />
            <div>
              <p className="text-xs font-semibold text-slate-700">Modèle recommandé</p>
              <p className="text-[11px] text-slate-500">Téléchargez le modèle pour éviter les erreurs de colonnes.</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            icon={<Download size={14} />}
            onClick={() => exportToExcel(templateRows, 'modele-import-eleves.xlsx', 'Élèves')}
          >
            Télécharger le modèle
          </Button>
        </div>

        <div
          className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-white px-4 py-8 text-center transition hover:border-royal-300 hover:bg-royal-50/20"
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            void handleFile(event.dataTransfer.files[0]);
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click();
          }}
        >
          <UploadCloud size={26} className="mb-2 text-slate-400" />
          <p className="text-sm font-medium text-slate-700">
            {fileName || 'Cliquez ou déposez votre fichier ici'}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">Formats acceptés : .xlsx, .xls, .csv — 5 000 lignes maximum conseillées.</p>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />
        </div>

        {rows.length > 0 ? (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-600">Aperçu ({rows.length} ligne(s))</p>
              <button type="button" onClick={reset} className="text-[11px] font-medium text-rose-500 hover:text-rose-600">
                Changer de fichier
              </button>
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[560px] text-left text-[11px]">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Prénom</th>
                    <th className="px-3 py-2 font-semibold">Nom</th>
                    <th className="px-3 py-2 font-semibold">Sexe</th>
                    <th className="px-3 py-2 font-semibold">Classe</th>
                    <th className="px-3 py-2 font-semibold">Parent</th>
                    <th className="px-3 py-2 font-semibold">Téléphone</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 5).map((row, index) => (
                    <tr key={index} className="border-t border-slate-100 text-slate-600">
                      <td className="px-3 py-2">{row['prénom'] || row['prenom'] || '—'}</td>
                      <td className="px-3 py-2">{row['nom'] || '—'}</td>
                      <td className="px-3 py-2">{row['sexe'] || '—'}</td>
                      <td className="px-3 py-2">{row['classe'] || '—'}</td>
                      <td className="px-3 py-2">{row['parent'] || '—'}</td>
                      <td className="px-3 py-2">{row['téléphone'] || row['telephone'] || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              Les élèves sans prénom, nom ou classe reconnue sont importés sans affectation de classe.
            </p>
          </div>
        ) : null}

        {result ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
            <p className="font-semibold">Import terminé</p>
            <p className="mt-1">
              {result.created} élève(s) créé(s), {result.skipped} ligne(s) ignorée(s) faute d’informations suffisantes.
            </p>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
