import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { useOrg } from './OrgProvider';
import { ErrorState, Skeleton } from '@/components/ui/States';

function FullScreenLoading() {
  return (
    <div role="status" className="mx-auto max-w-md space-y-3 p-6">
      <Skeleton className="h-10 w-40" />
      <Skeleton className="h-24" />
      <Skeleton className="h-24" />
      <span className="sr-only">Carregando…</span>
    </div>
  );
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullScreenLoading />;
  if (!user) return <Navigate to="/entrar" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

export function RequireOrg({ children }: { children: ReactNode }) {
  const { organizations, orgsLoading, orgsError, orgId, ctx, ctxLoading, ctxError, refetchCtx } = useOrg();
  if (orgsLoading || ctxLoading) return <FullScreenLoading />;
  if (orgsError) return <div className="p-6"><ErrorState error={orgsError} /></div>;
  if (!organizations?.length) return <Navigate to="/sem-igreja" replace />;
  if (!orgId) return <Navigate to="/selecionar-igreja" replace />;
  if (ctxError || !ctx) return <div className="p-6"><ErrorState error={ctxError} onRetry={refetchCtx} /></div>;
  return <>{children}</>;
}
