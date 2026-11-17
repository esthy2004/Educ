import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-lg border border-line bg-white px-6 py-12 text-center shadow-card">
        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-royal-50 text-royal-600">
          <Compass size={22} />
        </span>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-royal-600">Erreur 404</p>
        <h1 className="mt-2 text-xl font-semibold text-navy-900">Page introuvable</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          La page demandée n’existe pas ou a été déplacée. Retournez au tableau de bord pour reprendre votre travail.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex h-10 items-center justify-center rounded-lg bg-royal-600 px-4 text-sm font-medium text-white transition hover:bg-royal-700"
        >
          Retour au tableau de bord
        </Link>
      </div>
    </div>
  );
}
