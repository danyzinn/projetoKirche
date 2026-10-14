import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

export function PageHeader({ title, subtitle, actions, back }: { title: string; subtitle?: ReactNode; actions?: ReactNode; back?: string }) {
  const { state } = useLocation();
  const candidate = (state as { backTo?: unknown } | null)?.backTo;
  const destination = typeof candidate === 'string' && candidate.startsWith('/') && !candidate.startsWith('//') ? candidate : back;
  return (
    <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        {back && (
          <Link to={destination!} className="mb-1 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
            <ChevronLeft className="h-4 w-4" aria-hidden /> Voltar
          </Link>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </header>
  );
}
