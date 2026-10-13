import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './Button';

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-xl bg-line/70', className)} />;
}

export function LoadingList({ rows = 3 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Carregando" className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-20" />)}
      <span className="sr-only">Carregando…</span>
    </div>
  );
}

export function EmptyState({ title, description, action, icon }: { title: string; description?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-line bg-surface px-6 py-10 text-center">
      <div className="mb-3 rounded-full bg-canvas p-3 text-muted">{icon ?? <Inbox className="h-6 w-6" aria-hidden />}</div>
      <p className="font-medium text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : 'Algo deu errado.';
  return (
    <div role="alert" className="flex flex-col items-center rounded-2xl border border-danger/20 bg-danger/5 px-6 py-8 text-center">
      <AlertTriangle className="mb-2 h-6 w-6 text-danger" aria-hidden />
      <p className="font-medium text-ink">Não foi possível carregar</p>
      <p className="mt-1 text-sm text-muted">{message}</p>
      {onRetry && <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>Tentar novamente</Button>}
    </div>
  );
}

export function PermissionDenied({ description }: { description?: string }) {
  return (
    <EmptyState
      icon={<Lock className="h-6 w-6" aria-hidden />}
      title="Acesso restrito"
      description={description ?? 'Seu perfil não tem permissão para esta área. Fale com a liderança se precisar de acesso.'}
    />
  );
}

export function FormMessage({ tone, children }: { tone: 'success' | 'error'; children: ReactNode }) {
  return (
    <p role={tone === 'error' ? 'alert' : 'status'} className={cn('rounded-xl px-3 py-2 text-sm', tone === 'error' ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success')}>
      {children}
    </p>
  );
}
