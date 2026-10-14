import type { ReactNode } from 'react';
import { useCurrentOrg } from './OrgProvider';
import { EmptyState } from '@/components/ui/States';
import { PageHeader } from '@/components/ui/PageHeader';

/** Disponibilidade visual; a autorização continua no banco. */
export function ModuleRoute({ modules, children }: { modules: string[]; children: ReactNode }) {
  const { ctx } = useCurrentOrg();
  if (!modules.some((m) => ctx.modules.includes(m))) return <><PageHeader title="Recurso indisponível" back="/" /><EmptyState title="Este recurso não está habilitado nesta igreja." /></>;
  return <>{children}</>;
}
