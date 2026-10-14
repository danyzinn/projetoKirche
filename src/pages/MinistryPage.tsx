import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Send, Trash2, UserPlus } from 'lucide-react';
import { useCurrentOrg } from '@/app/OrgProvider';
import { scheduleInputSchema } from '@/domain/schemas';
import type { Schedule } from '@/domain/types';
import { api } from '@/services';
import { PersonPicker } from '@/components/PersonPicker';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardTitle } from '@/components/ui/Card';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState, ErrorState, FormMessage, LoadingList, PermissionDenied } from '@/components/ui/States';
import { churchLocalToIso, formatDateTime } from '@/lib/utils';

const statusTone = { pending: 'warning', confirmed: 'success', declined: 'danger' } as const;
const statusLabel = { pending: 'Pendente', confirmed: 'Confirmado', declined: 'Recusou' } as const;

export function MinistryPage() {
  const { id = '' } = useParams();
  const { ctx, orgId, can } = useCurrentOrg();
  const scope = { type: 'ministry' as const, id };
  const canManageMembers = can('ministries.manage_members', scope);
  const canCreateSchedule = can('schedules.create', scope);
  const canEditSchedule = can('schedules.update', scope);

  const ministry = useQuery({ queryKey: ['ministry', orgId, id], queryFn: () => api.getMinistry(orgId, id) });
  const members = useQuery({ queryKey: ['ministry-members', orgId, id], queryFn: () => api.listMinistryMembers(orgId, id) });
  const schedules = useQuery({ queryKey: ['schedules', orgId, id], queryFn: () => api.listSchedules(orgId, id), enabled: ctx.modules.includes('schedules') });

  if (ministry.isLoading) return <LoadingList rows={2} />;
  if (ministry.error || !ministry.data) return <><PageHeader title="Ministério" back="/comunidade" /><ErrorState error={ministry.error} /></>;
  const m = ministry.data;
  if (!m.isMember && !canManageMembers && !canCreateSchedule) {
    return <><PageHeader title={m.name} back="/comunidade" /><PermissionDenied description="Somente integrantes e a liderança deste ministério acessam equipe e escalas." /></>;
  }

  return (
    <div className="space-y-6">
      <PageHeader title={m.name} back="/comunidade" subtitle={m.description} actions={(canManageMembers || canCreateSchedule) && <Badge tone="primary">Liderança</Badge>} />

      <section aria-labelledby="team">
        <Card>
          <CardTitle id="team" className="mb-3">Equipe</CardTitle>
          {members.isLoading ? <LoadingList rows={2} /> : members.error ? <ErrorState error={members.error} /> : members.data?.length ? (
            <ul className="divide-y divide-line">
              {members.data.map((mm) => (
                <li key={mm.id} className="flex items-center gap-3 py-2.5">
                  <span className="flex-1"><span className="block text-sm font-medium">{mm.fullName}</span><span className="text-xs text-muted">{mm.positions.join(', ') || 'Sem função definida'}</span></span>
                  {canManageMembers && <RemoveMember orgId={orgId} ministryId={id} membershipId={mm.id} name={mm.fullName} />}
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted">Nenhum integrante ainda.</p>}
          {canManageMembers && <AddMember orgId={orgId} ministryId={id} exclude={members.data?.map((x) => x.userId) ?? []} />}
        </Card>
      </section>

      {ctx.modules.includes('schedules') && <section aria-labelledby="sched" className="space-y-3">
        <h2 id="sched" className="font-semibold">Escalas</h2>
        {canCreateSchedule && <NewSchedule orgId={orgId} ministryId={id} tz={ctx.org.timezone} />}
        {schedules.isLoading ? <LoadingList rows={2} /> : schedules.error ? <ErrorState error={schedules.error} /> : schedules.data?.length ? (
          schedules.data.map((s) => <ScheduleCard key={s.id} s={s} orgId={orgId} tz={ctx.org.timezone} canEdit={canEditSchedule} team={members.data ?? []} />)
        ) : <EmptyState title="Nenhuma escala" description={canCreateSchedule ? 'Crie a primeira escala acima.' : 'Quando a liderança publicar escalas, elas aparecerão aqui.'} />}
      </section>}
    </div>
  );
}

function RemoveMember({ orgId, ministryId, membershipId, name }: { orgId: string; ministryId: string; membershipId: string; name: string }) {
  const qc = useQueryClient();
  const del = useMutation({ mutationFn: () => api.removeMinistryMember(orgId, membershipId), onSuccess: () => qc.invalidateQueries({ queryKey: ['ministry-members', orgId, ministryId] }) });
  return (
    <Button variant="ghost" size="sm" aria-label={`Remover ${name}`} loading={del.isPending}
      onClick={() => { if (window.confirm(`Remover ${name} da equipe?`)) del.mutate(); }}>
      <Trash2 className="h-4 w-4" aria-hidden />
    </Button>
  );
}

function AddMember({ orgId, ministryId, exclude }: { orgId: string; ministryId: string; exclude: string[] }) {
  const qc = useQueryClient();
  const [positions, setPositions] = useState('');
  const add = useMutation({
    mutationFn: (userId: string) => api.addMinistryMember(orgId, ministryId, userId, positions.split(',').map((x) => x.trim()).filter(Boolean)),
    onSuccess: () => { setPositions(''); qc.invalidateQueries({ queryKey: ['ministry-members', orgId, ministryId] }); },
  });
  return (
    <div className="mt-4 space-y-3 border-t border-line pt-4">
      <p className="flex items-center gap-2 text-sm font-medium"><UserPlus className="h-4 w-4" aria-hidden />Adicionar integrante</p>
      <Field label="Funções (separadas por vírgula)">{(p) => <Input placeholder="Ex.: Vocal, Teclado" value={positions} onChange={(e) => setPositions(e.target.value)} {...p} />}</Field>
      <PersonPicker orgId={orgId} exclude={exclude} onPick={(p) => add.mutate(p.userId)} />
      {add.error && <FormMessage tone="error">{(add.error as Error).message}</FormMessage>}
      {add.isSuccess && <FormMessage tone="success">Integrante adicionado.</FormMessage>}
    </div>
  );
}

function NewSchedule({ orgId, ministryId, tz }: { orgId: string; ministryId: string; tz: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: '', startsAt: '', notes: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: () => {
      const parsed = scheduleInputSchema.safeParse({ ...f, ministryId });
      if (!parsed.success) { setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message]))); throw new Error('validation'); }
      setErrors({});
      return api.createSchedule(orgId, { ...parsed.data, startsAt: churchLocalToIso(parsed.data.startsAt, tz) });
    },
    onSuccess: () => { setF({ title: '', startsAt: '', notes: '' }); setOpen(false); qc.invalidateQueries({ queryKey: ['schedules', orgId, ministryId] }); },
  });
  if (!open) return <Button variant="secondary" onClick={() => setOpen(true)}>Nova escala</Button>;
  return (
    <Card>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <CardTitle>Nova escala (rascunho)</CardTitle>
        {save.error && (save.error as Error).message !== 'validation' && <FormMessage tone="error">{(save.error as Error).message}</FormMessage>}
        <Field label="Título" error={errors.title}>{(p) => <Input placeholder="Ex.: Culto de domingo" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} {...p} />}</Field>
        <Field label="Data e hora" error={errors.startsAt} hint={`Fuso da igreja: ${tz}`}>{(p) => <Input type="datetime-local" value={f.startsAt} onChange={(e) => setF({ ...f, startsAt: e.target.value })} {...p} />}</Field>
        <Field label="Observações">{(p) => <Textarea className="min-h-[80px]" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} {...p} />}</Field>
        <div className="flex gap-2"><Button type="submit" loading={save.isPending}>Criar escala</Button><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button></div>
      </form>
    </Card>
  );
}

function ScheduleCard({ s, orgId, tz, canEdit, team }: { s: Schedule; orgId: string; tz: string; canEdit: boolean; team: { userId: string; fullName: string; positions: string[] }[] }) {
  const qc = useQueryClient();
  const [userId, setUserId] = useState('');
  const [position, setPosition] = useState('');
  const refresh = () => qc.invalidateQueries({ queryKey: ['schedules', orgId, s.ministryId] });
  const add = useMutation({ mutationFn: () => api.addAssignment(orgId, s.id, userId, position.trim()), onSuccess: () => { setUserId(''); setPosition(''); refresh(); } });
  const remove = useMutation({ mutationFn: (aid: string) => api.removeAssignment(orgId, aid), onSuccess: refresh });
  const publish = useMutation({ mutationFn: () => api.publishSchedule(s.id), onSuccess: refresh });
  const err = add.error ?? remove.error ?? publish.error;
  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div><p className="font-semibold">{s.title}</p><p className="text-sm text-muted">{formatDateTime(s.startsAt, tz)}</p></div>
        <Badge tone={s.status === 'published' ? 'success' : s.status === 'draft' ? 'warning' : 'danger'}>{s.status === 'published' ? 'Publicada' : s.status === 'draft' ? 'Rascunho' : 'Cancelada'}</Badge>
      </div>
      {s.notes && <p className="mb-3 text-sm text-muted">{s.notes}</p>}
      {s.assignments.length ? (
        <ul className="divide-y divide-line">
          {s.assignments.map((a) => (
            <li key={a.id} className="flex items-center gap-2 py-2 text-sm">
              <span className="flex-1"><span className="font-medium">{a.fullName}</span> · {a.position || 'Sem função'}{a.declineReason && <span className="block text-xs text-muted">Motivo: {a.declineReason}</span>}</span>
              <Badge tone={statusTone[a.status]}>{statusLabel[a.status]}</Badge>
              {canEdit && <Button variant="ghost" size="sm" aria-label={`Remover ${a.fullName} da escala`} onClick={() => remove.mutate(a.id)}><Trash2 className="h-4 w-4" aria-hidden /></Button>}
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-muted">Ninguém escalado ainda.</p>}
      {canEdit && (
        <div className="mt-3 space-y-3 border-t border-line pt-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Field label="Integrante">{(p) => (
              <Select value={userId} onChange={(e) => { setUserId(e.target.value); const m = team.find((t) => t.userId === e.target.value); if (m && !position) setPosition(m.positions[0] ?? ''); }} {...p}>
                <option value="">Selecione…</option>
                {team.map((t) => <option key={t.userId} value={t.userId}>{t.fullName}</option>)}
              </Select>
            )}</Field>
            <Field label="Função">{(p) => <Input value={position} onChange={(e) => setPosition(e.target.value)} {...p} />}</Field>
            <Button variant="secondary" disabled={!userId} loading={add.isPending} onClick={() => add.mutate()}>Escalar</Button>
          </div>
          {s.status === 'draft' && (
            <Button onClick={() => publish.mutate()} loading={publish.isPending} disabled={!s.assignments.length}>
              <Send className="h-4 w-4" aria-hidden />Publicar e notificar equipe
            </Button>
          )}
        </div>
      )}
      {err && <div className="mt-3"><FormMessage tone="error">{(err as Error).message}</FormMessage></div>}
    </Card>
  );
}
