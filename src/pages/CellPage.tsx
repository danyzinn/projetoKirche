import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock, MapPin } from 'lucide-react';
import { useCurrentOrg } from '@/app/OrgProvider';
import type { CellMeeting } from '@/domain/types';
import { api } from '@/services';
import { PersonPicker } from '@/components/PersonPicker';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardTitle } from '@/components/ui/Card';
import { Field, Input } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState, ErrorState, FormMessage, LoadingList, PermissionDenied } from '@/components/ui/States';
import { churchLocalToIso, formatDateTime, WEEKDAYS } from '@/lib/utils';

export function CellPage() {
  const { id = '' } = useParams();
  const { ctx, orgId, can } = useCurrentOrg();
  const scope = { type: 'cell' as const, id };
  const canManageMembers = can('cells.manage_members', scope);
  const canManageMeetings = can('cells.manage_meetings', scope);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['cell', id], queryFn: () => api.getCell(orgId, id) });
  const refresh = () => qc.invalidateQueries({ queryKey: ['cell', id] });
  const addMember = useMutation({ mutationFn: (userId: string) => api.addCellMember(orgId, id, userId), onSuccess: refresh });

  if (q.isLoading) return <LoadingList rows={2} />;
  if (q.error || !q.data) return <><PageHeader title="Célula" back="/grupos" /><ErrorState error={q.error} /></>;
  const c = q.data;
  if (!c.isMember && !canManageMembers && !canManageMeetings) {
    return <><PageHeader title={c.name} back="/grupos" /><PermissionDenied description="Somente participantes e a liderança desta célula veem detalhes." /></>;
  }
  return (
    <div className="space-y-5">
      <PageHeader title={c.name} back="/grupos" subtitle={`${c.regionLabel}${c.meetingWeekday !== null ? ` · ${WEEKDAYS[c.meetingWeekday]}` : ''}${c.meetingTime ? ` às ${c.meetingTime}` : ''}`}
        actions={(canManageMembers || canManageMeetings) && <Badge tone="primary">Liderança</Badge>} />
      <Card className="flex items-start gap-3">
        {c.address ? <MapPin className="mt-0.5 h-5 w-5 text-primary" aria-hidden /> : <Lock className="mt-0.5 h-5 w-5 text-muted" aria-hidden />}
        <div><p className="text-sm font-medium">Local do encontro</p><p className="text-sm text-muted">{c.address || 'Restrito aos participantes e à liderança.'}</p></div>
      </Card>

      <Card>
        <CardTitle className="mb-3">Participantes</CardTitle>
        {c.members.length ? (
          <ul className="grid gap-1 sm:grid-cols-2">{c.members.map((m) => <li key={m.userId} className="text-sm">{m.fullName}</li>)}</ul>
        ) : <p className="text-sm text-muted">Nenhum participante.</p>}
        {canManageMembers && (
          <div className="mt-4 border-t border-line pt-4">
            <PersonPicker orgId={orgId} label="Adicionar participante" exclude={c.members.map((m) => m.userId)} onPick={(p) => addMember.mutate(p.userId)} />
            {addMember.error && <div className="mt-2"><FormMessage tone="error">{(addMember.error as Error).message}</FormMessage></div>}
          </div>
        )}
      </Card>

      <section className="space-y-3">
        <h2 className="font-semibold">Encontros</h2>
        {canManageMeetings && <NewMeeting orgId={orgId} cellId={id} tz={ctx.org.timezone} onDone={refresh} />}
        {c.meetings.length ? c.meetings.map((m) => (
          <MeetingCard key={m.id} m={m} tz={ctx.org.timezone} members={c.members} canRecord={canManageMeetings} orgId={orgId} onDone={refresh} />
        )) : <EmptyState title="Nenhum encontro registrado" />}
      </section>
    </div>
  );
}

function NewMeeting({ orgId, cellId, tz, onDone }: { orgId: string; cellId: string; tz: string; onDone: () => void }) {
  const [startsAt, setStartsAt] = useState('');
  const [topic, setTopic] = useState('');
  const save = useMutation({ mutationFn: () => api.createCellMeeting(orgId, cellId, churchLocalToIso(startsAt, tz), topic.trim()), onSuccess: () => { setStartsAt(''); setTopic(''); onDone(); } });
  return (
    <Card>
      <form className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); if (startsAt) save.mutate(); }}>
        <Field label="Data e hora" hint={`Fuso: ${tz}`}>{(p) => <Input type="datetime-local" required value={startsAt} onChange={(e) => setStartsAt(e.target.value)} {...p} />}</Field>
        <Field label="Tema / estudo">{(p) => <Input value={topic} maxLength={140} onChange={(e) => setTopic(e.target.value)} {...p} />}</Field>
        <Button type="submit" loading={save.isPending} disabled={!startsAt}>Agendar</Button>
      </form>
      {save.error && <div className="mt-2"><FormMessage tone="error">{(save.error as Error).message}</FormMessage></div>}
    </Card>
  );
}

function MeetingCard({ m, tz, members, canRecord, orgId, onDone }: { m: CellMeeting; tz: string; members: { userId: string; fullName: string }[]; canRecord: boolean; orgId: string; onDone: () => void }) {
  const record = useMutation({ mutationFn: (v: { userId: string; present: boolean }) => api.recordAttendance(orgId, m.id, v.userId, v.present), onSuccess: onDone });
  const presence = new Map(m.attendance.map((a) => [a.userId, a.present]));
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><p className="font-medium">{m.topic || 'Encontro'}</p><p className="text-sm text-muted">{formatDateTime(m.startsAt, tz)}</p></div>
        <Badge tone={m.status === 'held' ? 'success' : m.status === 'cancelled' ? 'danger' : 'neutral'}>{m.status === 'held' ? 'Realizado' : m.status === 'cancelled' ? 'Cancelado' : 'Agendado'}</Badge>
      </div>
      {canRecord ? (
        <fieldset className="mt-3 border-t border-line pt-3">
          <legend className="mb-2 text-sm font-medium">Presença</legend>
          <ul className="space-y-1">
            {members.map((p) => (
              <li key={p.userId}>
                <label className="flex min-h-[44px] items-center gap-3 text-sm">
                  <input type="checkbox" checked={presence.get(p.userId) ?? false} disabled={record.isPending}
                    onChange={(e) => record.mutate({ userId: p.userId, present: e.target.checked })} />
                  {p.fullName}
                </label>
              </li>
            ))}
          </ul>
          {record.error && <FormMessage tone="error">{(record.error as Error).message}</FormMessage>}
        </fieldset>
      ) : m.attendance.length > 0 && (
        <p className="mt-2 text-sm text-muted">Sua presença: {m.attendance[0].present ? 'registrada' : 'ausente'}</p>
      )}
    </Card>
  );
}
