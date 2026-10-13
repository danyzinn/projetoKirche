import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useCurrentOrg } from '@/app/OrgProvider';
import { visibleCentrals } from '@/domain/permissions';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { PermissionDenied } from '@/components/ui/States';

export function ManagementHome() {
  const { ctx } = useCurrentOrg();
  const centrals = visibleCentrals(ctx.grants);
  if (!centrals.length) return <><PageHeader title="Minha Central de Gestão" /><PermissionDenied /></>;
  return (
    <div>
      <PageHeader title="Minha Central de Gestão" subtitle="Somente as áreas liberadas para suas funções aparecem aqui." />
      <ul className="grid gap-3 sm:grid-cols-2">
        {centrals.map((c) => {
          const body = (
            <Card className={c.route ? 'flex h-full items-start gap-3 hover:border-primary/30' : 'flex h-full items-start gap-3 opacity-80'}>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-sm font-bold text-primary">{c.number}</span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 font-semibold">{c.title}<Badge tone={c.status === 'parcial' ? 'success' : 'neutral'}>{c.status === 'parcial' ? 'Disponível (parcial)' : 'Planejado'}</Badge></span>
                <span className="mt-1 block text-sm text-muted">{c.description}</span>
              </span>
              {c.route && <ChevronRight className="h-5 w-5 text-muted" aria-hidden />}
            </Card>
          );
          return <li key={c.key}>{c.route ? <Link to={c.route}>{body}</Link> : <div aria-disabled>{body}</div>}</li>;
        })}
      </ul>
    </div>
  );
}
