import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, MapPin, Plus, Users } from 'lucide-react';
import { useCurrentOrg } from '@/app/OrgProvider';
import { can, canAnywhere } from '@/domain/permissions';
import { eventInputSchema } from '@/domain/schemas';
import type { ChurchEvent } from '@/domain/types';
import { api } from '@/services';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState, ErrorState, FormMessage, LoadingList, PermissionDenied } from '@/components/ui/States';
import { churchLocalToIso, formatDateTime } from '@/lib/utils';

function seatsLabel(e: ChurchEvent) {
  if (e.capacity === null) return null;
  const left = Math.max(e.capacity - e.registeredCount, 0);
  return left === 0 ? 'Esgotado' : `${left} vaga${left > 1 ? 's' : ''}`;
}

export function EventsPage() {
  const { ctx, orgId } = useCurrentOrg();
  const q = useQuery({ queryKey: ['events', orgId], queryFn: () => api.listEvents(orgId) });
  const [mine, setMine] = useState(false);
  const list = (q.data ?? []).filter((e) => !mine || e.isRegistered);
  return (
    <div>
      <PageHeader title="Eventos" subtitle="Agenda da igreja e dos seus grupos" actions={canAnywhere(ctx.grants, 'events.create') && (
        <Link to="/eventos/novo"><Button size="sm"><Plus className="h-4 w-4" aria-hidden />Novo evento</Button></Link>
      )} />
      <label className="mb-4 inline-flex min-h-[44px] items-center gap-2 text-sm">
        <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Somente minhas inscrições
      </label>
      {q.isLoading ? <LoadingList /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : list.length === 0 ? (
        <EmptyState icon={<CalendarDays className="h-6 w-6" aria-hidden />} title="Nenhum evento" description={mine ? 'Você não tem inscrições ativas.' : 'Novos eventos aparecerão aqui.'} />
      ) : (
        <ul className="space-y-3">
          {list.map((e) => (
            <li key={e.id}>
              <Link to={`/eventos/${e.id}`} className="block">
                <Card className="flex gap-4 hover:border-primary/30">
                  <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-primary-soft text-center text-primary">
                    <span className="text-lg font-bold leading-none">{new Intl.DateTimeFormat('pt-BR', { day: '2-digit', timeZone: ctx.org.timezone }).format(new Date(e.startsAt))}</span>
                    <span className="text-[10px] uppercase">{new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: ctx.org.timezone }).format(new Date(e.startsAt))}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{e.title}</p>
                    <p className="text-sm text-muted">{formatDateTime(e.startsAt, ctx.org.timezone)}{e.locationLabel && ` · ${e.locationLabel}`}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {e.status === 'cancelled' && <Badge tone="danger">Cancelado</Badge>}
                      {e.isRegistered && <Badge tone="success">Inscrito(a)</Badge>}
                      {seatsLabel(e) && <Badge>{seatsLabel(e)}</Badge>}
                      <Badge>{e.audience.label}</Badge>
                    </div>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function EventDetailPage() {
  const { id = '' } = useParams();
  const { ctx, orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['event', id], queryFn: () => api.getEvent(orgId, id) });
  const invalidate = () => { qc.invalidateQueries({ queryKey: ['event', id] }); qc.invalidateQueries({ queryKey: ['events', orgId] }); };
  const register = useMutation({ mutationFn: () => api.registerForEvent(id), onSuccess: invalidate });
  const cancel = useMutation({ mutationFn: () => api.cancelRegistration(id), onSuccess: invalidate });
  const e = q.data;
  if (q.isLoading) return <LoadingList rows={1} />;
  if (q.error || !e) return <><PageHeader title="Evento" back="/eventos" /><ErrorState error={q.error} /></>;
  const full = e.capacity !== null && e.registeredCount >= e.capacity;
  const err = register.error ?? cancel.error;
  return (
    <div>
      <PageHeader title={e.title} back="/eventos" />
      <Card className="space-y-3">
        <p className="flex items-center gap-2 text-sm"><CalendarDays className="h-4 w-4 text-primary" aria-hidden />{formatDateTime(e.startsAt, ctx.org.timezone)}{e.endsAt && ` — ${formatDateTime(e.endsAt, ctx.org.timezone)}`}</p>
        {e.locationLabel && <p className="flex items-center gap-2 text-sm"><MapPin className="h-4 w-4 text-primary" aria-hidden />{e.locationLabel}</p>}
        {e.capacity !== null && <p className="flex items-center gap-2 text-sm"><Users className="h-4 w-4 text-primary" aria-hidden />{e.registeredCount} de {e.capacity} vagas preenchidas</p>}
        {e.description && <p className="whitespace-pre-wrap text-sm text-muted">{e.description}</p>}
      </Card>
      <div className="mt-4 space-y-2">
        {err && <FormMessage tone="error">{(err as Error).message}</FormMessage>}
        {register.isSuccess && e.isRegistered && <FormMessage tone="success">Inscrição confirmada.</FormMessage>}
        {e.status === 'cancelled' ? <Badge tone="danger">Evento cancelado</Badge> : !e.registrationEnabled ? (
          <p className="text-sm text-muted">Este evento não exige inscrição.</p>
        ) : e.isRegistered ? (
          <Button variant="danger" onClick={() => cancel.mutate()} loading={cancel.isPending}>Cancelar minha inscrição</Button>
        ) : (
          <Button onClick={() => register.mutate()} loading={register.isPending} disabled={full}>{full ? 'Vagas esgotadas' : 'Quero participar'}</Button>
        )}
      </div>
    </div>
  );
}

export function NewEventPage() {
  const { ctx, orgId } = useCurrentOrg();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const ministries = useQuery({ queryKey: ['ministries', orgId], queryFn: () => api.listMinistries(orgId) });
  const [f, setF] = useState({ title: '', description: '', locationLabel: '', startsAt: '', endsAt: '', capacity: '', registrationEnabled: true, audience: 'church:' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const audienceOpts = [
    ...(can(ctx.grants, 'events.create') ? [{ value: 'church:', label: 'Toda a igreja' }] : []),
    ...(ministries.data ?? []).filter((m) => can(ctx.grants, 'events.create', { type: 'ministry', id: m.id })).map((m) => ({ value: `ministry:${m.id}`, label: m.name })),
  ];
  const save = useMutation({
    mutationFn: () => {
      const [type, id] = (audienceOpts.some((o) => o.value === f.audience) ? f.audience : audienceOpts[0]?.value ?? 'church:').split(':');
      const parsed = eventInputSchema.safeParse({ ...f, endsAt: f.endsAt || null, capacity: f.capacity ? f.capacity : null, audience: { type, id: id || null } });
      if (!parsed.success) { setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message]))); throw new Error('validation'); }
      setErrors({});
      return api.createEvent(orgId, { ...parsed.data, startsAt: churchLocalToIso(parsed.data.startsAt, ctx.org.timezone), endsAt: parsed.data.endsAt ? churchLocalToIso(parsed.data.endsAt, ctx.org.timezone) : null });
    },
    onSuccess: (id) => { qc.invalidateQueries({ queryKey: ['events', orgId] }); navigate(`/eventos/${id}`); },
  });
  if (!canAnywhere(ctx.grants, 'events.create')) return <><PageHeader title="Novo evento" back="/eventos" /><PermissionDenied /></>;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <div>
      <PageHeader title="Novo evento" back="/eventos" subtitle={`Horários no fuso da igreja (${ctx.org.timezone}).`} />
      <Card>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          {save.error && (save.error as Error).message !== 'validation' && <FormMessage tone="error">{(save.error as Error).message}</FormMessage>}
          <Field label="Título" error={errors.title}>{(p) => <Input value={f.title} onChange={set('title')} {...p} />}</Field>
          <Field label="Descrição">{(p) => <Textarea value={f.description} onChange={set('description')} {...p} />}</Field>
          <Field label="Local" hint="Use uma descrição geral. Endereços residenciais não devem ser publicados.">{(p) => <Input value={f.locationLabel} onChange={set('locationLabel')} {...p} />}</Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Início" error={errors.startsAt}>{(p) => <Input type="datetime-local" value={f.startsAt} onChange={set('startsAt')} {...p} />}</Field>
            <Field label="Término (opcional)" error={errors.endsAt}>{(p) => <Input type="datetime-local" value={f.endsAt} onChange={set('endsAt')} {...p} />}</Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Vagas (opcional)" error={errors.capacity}>{(p) => <Input type="number" min={1} value={f.capacity} onChange={set('capacity')} {...p} />}</Field>
            <Field label="Público">{(p) => <Select value={f.audience} onChange={set('audience')} {...p}>{audienceOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select>}</Field>
          </div>
          <label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" checked={f.registrationEnabled} onChange={(e) => setF({ ...f, registrationEnabled: e.target.checked })} />Exigir inscrição</label>
          <Button type="submit" loading={save.isPending}>Criar evento</Button>
          <p className="text-xs text-muted">Verificação de conflito de salas/reservas: planejada (Etapa D).</p>
        </form>
      </Card>
    </div>
  );
}
