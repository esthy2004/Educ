import type { ReactNode } from 'react';

interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  eyebrow?: string;
  breadcrumb?: BreadcrumbItem[];
}

export function PageHeader({ title, subtitle, actions, eyebrow, breadcrumb }: PageHeaderProps) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {breadcrumb && breadcrumb.length > 0 ? (
          <nav aria-label="Fil d’Ariane" className="mb-1.5 flex flex-wrap items-center gap-1 text-2xs text-slate-400">
            {breadcrumb.map((item, index) => (
              <span key={`${item.label}-${index}`} className="flex items-center gap-1">
                {index > 0 ? <span aria-hidden="true">/</span> : null}
                {item.onClick ? (
                  <button type="button" onClick={item.onClick} className="transition hover:text-royal-600">
                    {item.label}
                  </button>
                ) : (
                  <span className={index === breadcrumb.length - 1 ? 'text-slate-500' : undefined}>{item.label}</span>
                )}
              </span>
            ))}
          </nav>
        ) : eyebrow ? (
          <p className="mb-1 text-2xs font-semibold uppercase tracking-[0.1em] text-royal-600">{eyebrow}</p>
        ) : null}
        <h1 className="text-[22px] font-semibold tracking-tight text-navy-900">{title}</h1>
        {subtitle ? <p className="mt-1 max-w-3xl text-[13px] text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 print:hidden">{actions}</div> : null}
    </div>
  );
}
