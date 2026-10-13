import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList } from 'lucide-react';
import { useCurrentOrg } from '@/app/OrgProvider';
import type { MyAssignment } from '@/domain/types';
import { api } from '@/services';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState, ErrorState, FormMessage, LoadingList } from '@/components/ui/States';
import { formatDateTime } from '@/lib/utils';

export function MySchedulesPage() {
  const { ctx, orgId } = useCurrentOrg();
  const q = useQuery({ queryKey: ['my-assignments', orgId], queryFn: () => api.listMyAssignments(orgId) });
  const upcoming = (q.data ?? []).filter((a) => new Date(a.schedule.startsAt) >= new Date(Date.now() - 6 * 3600_000));
  return (
    <div>
      <PageHeader title="Minhas escalas" subtitle="Confirme ou recuse sua participação" back="/grupos" />
      {q.isLoading ? <LoadingList /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : upcoming.length === 0 ? (
        <EmptyState icon={<ClipboardList className="h-6 w-6" aria-hidden />} title="Nenhuma escala futura" description="Quando você for escalado(a), aparecerá aqui e na central de notificações." />
      ) : (
        <ul className="space-y-3">{upcoming.map((a) => <li key={a.id}><AssignmentCard a={a} tz={ctx.org.timezone} orgId={orgId} /></li>)}</ul>
      )}
    </div>
  );
}

function AssignmentCard({ a, tz, orgId }: { a: MyAssignment; tz: string; orgId: string }) {
  const qc = useQueryClient();
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');
  const respond = useMutation({
    mutationFn: (status: 'confirmed' | 'declined') => api.respondToAssignment(a.id, status, reason),
    onSuccess: () => { setDeclining(false); qc.invalidateQueries({ queryKey: ['my-assignments', orgId] }); },
  });
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{a.schedule.title}</p>
          <p className="text-sm text-muted"><Link className="hover:underline" to={`/ministerios/${a.schedule.ministryId}`}>{a.schedule.ministryName}</Link> · {a.position || 'Sem função'} · {formatDateTime(a.schedule.startsAt, tz)}</p>
        </div>
        <Badge tone={a.status === 'confirmed' ? 'success' : a.status === 'declined' ? 'danger' : 'warning'}>
          {a.status === 'confirmed' ? 'Confirmada' : a.status === 'declined' ? 'Recusada' : 'Pendente'}
        </Badge>
      </div>
      {respond.error && <div className="mt-3"><FormMessage tone="error">{(respond.error as Error).message}</FormMessage></div>}
      {declining ? (
        <form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); respond.mutate('declined'); }}>
          <label className="sr-only" htmlFor={`r-${a.id}`}>Motivo (opcional)</label>
          <Input id={`r-${a.id}`} placeholder="Motivo (opcional, visível à liderança)" maxLength={280} value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button type="submit" variant="danger" loading={respond.isPending}>Confirmar recusa</Button>
          <Button variant="ghost" onClick={() => setDeclining(false)}>Voltar</Button>
        </form>
      ) : (
        <div className="mt-3 flex gap-2">
          {a.status !== 'confirmed' && <Button size="sm" loading={respond.isPending && respond.variables === 'confirmed'} onClick={() => respond.mutate('confirmed')}>Confirmar</Button>}
          {a.status !== 'declined' && <Button size="sm" variant="secondary" onClick={() => setDeclining(true)}>Não poderei</Button>}
        </div>
      )}
    </Card>
  );
}
