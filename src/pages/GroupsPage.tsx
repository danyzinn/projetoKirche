import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, ClipboardList, Music, Users } from 'lucide-react';
import { useCurrentOrg } from '@/app/OrgProvider';
import { api } from '@/services';
import { Card, CardTitle } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState, ErrorState, LoadingList } from '@/components/ui/States';
import { WEEKDAYS } from '@/lib/utils';

export function GroupsPage() {
  const { orgId } = useCurrentOrg();
  const ministries = useQuery({ queryKey: ['ministries', orgId], queryFn: () => api.listMinistries(orgId) });
  const cells = useQuery({ queryKey: ['cells', orgId], queryFn: () => api.listCells(orgId) });
  const myMinistries = ministries.data?.filter((m) => m.isMember) ?? [];
  const myCells = cells.data?.filter((c) => c.isMember) ?? [];
  const otherCells = cells.data?.filter((c) => !c.isMember) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Meus grupos" subtitle="Ministérios, escalas e células" actions={
        <Link to="/escalas" className="inline-flex h-9 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm font-medium hover:bg-canvas"><ClipboardList className="h-4 w-4" aria-hidden />Minhas escalas</Link>
      } />
      <section aria-labelledby="min-title">
        <h2 id="min-title" className="mb-3 flex items-center gap-2 font-semibold"><Music className="h-4 w-4 text-primary" aria-hidden />Meus ministérios</h2>
        {ministries.isLoading ? <LoadingList rows={2} /> : ministries.error ? <ErrorState error={ministries.error} /> : myMinistries.length ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {myMinistries.map((m) => (
              <li key={m.id}><Link to={`/ministerios/${m.id}`}><Card className="flex items-center gap-3 hover:border-primary/30"><span className="flex-1 font-medium">{m.name}</span><ChevronRight className="h-4 w-4 text-muted" aria-hidden /></Card></Link></li>
            ))}
          </ul>
        ) : <EmptyState title="Você ainda não integra um ministério" description="Converse com a liderança do ministério em que deseja servir." />}
      </section>
      <section aria-labelledby="cell-title">
        <h2 id="cell-title" className="mb-3 flex items-center gap-2 font-semibold"><Users className="h-4 w-4 text-primary" aria-hidden />Minha célula</h2>
        {cells.isLoading ? <LoadingList rows={1} /> : cells.error ? <ErrorState error={cells.error} /> : myCells.length ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {myCells.map((c) => (
              <li key={c.id}><Link to={`/celulas/${c.id}`}><Card className="hover:border-primary/30"><p className="font-medium">{c.name}</p><p className="text-sm text-muted">{c.regionLabel}{c.meetingWeekday !== null && ` · ${WEEKDAYS[c.meetingWeekday]}`}{c.meetingTime && ` às ${c.meetingTime}`}</p></Card></Link></li>
            ))}
          </ul>
        ) : <EmptyState title="Sem célula vinculada" description="Veja abaixo as células da igreja e fale com a coordenação." />}
      </section>
      {otherCells.length > 0 && (
        <section aria-labelledby="find-title">
          <h2 id="find-title" className="mb-1 font-semibold">Encontrar uma célula</h2>
          <p className="mb-3 text-sm text-muted">Mostramos apenas a região. O endereço é compartilhado pela liderança após o contato.</p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {otherCells.map((c) => (
              <li key={c.id}><Card><CardTitle>{c.name}</CardTitle><p className="text-sm text-muted">{c.regionLabel}{c.meetingWeekday !== null && ` · ${WEEKDAYS[c.meetingWeekday]}`}{c.meetingTime && ` às ${c.meetingTime}`}</p></Card></li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
