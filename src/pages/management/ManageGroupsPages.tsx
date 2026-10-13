import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import { useCurrentOrg } from '@/app/OrgProvider';
import { canAnywhere } from '@/domain/permissions';
import { cellInputSchema } from '@/domain/schemas';
import { api } from '@/services';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardTitle } from '@/components/ui/Card';
import { Field, Input, Select } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState, ErrorState, FormMessage, LoadingList, PermissionDenied } from '@/components/ui/States';
import { WEEKDAYS } from '@/lib/utils';

export function ManageMinistriesPage() {
  const { ctx, orgId, can } = useCurrentOrg();
  const q = useQuery({ queryKey: ['ministries', orgId], queryFn: () => api.listMinistries(orgId) });
  const allowed = ['ministries.manage_members', 'schedules.create', 'schedules.update', 'ministries.create'] as const;
  if (!allowed.some((p) => canAnywhere(ctx.grants, p))) return <><PageHeader title="Ministérios" back="/gestao" /><PermissionDenied /></>;
  const manageable = (q.data ?? []).filter((m) => allowed.some((p) => can(p, { type: 'ministry', id: m.id })));
  return (
    <div>
      <PageHeader title="Cultos e Produção" back="/gestao" subtitle="Central 03 — ministérios sob sua gestão" />
      {q.isLoading ? <LoadingList /> : q.error ? <ErrorState error={q.error} /> : manageable.length === 0 ? <EmptyState title="Nenhum ministério sob sua gestão" /> : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {manageable.map((m) => (
            <li key={m.id}><Link to={`/ministerios/${m.id}`}><Card className="flex items-center gap-3 hover:border-primary/30"><span className="flex-1 font-medium">{m.name}</span>{m.kind === 'layout' && <Badge>Ambientação/Design (configurável)</Badge>}<ChevronRight className="h-4 w-4 text-muted" aria-hidden /></Card></Link></li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ManageCellsPage() {
  const { ctx, orgId, can } = useCurrentOrg();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['cells', orgId], queryFn: () => api.listCells(orgId) });
  const [f, setF] = useState({ name: '', regionLabel: '', meetingWeekday: '', meetingTime: '', description: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const create = useMutation({
    mutationFn: () => {
      const parsed = cellInputSchema.safeParse({ ...f, meetingWeekday: f.meetingWeekday === '' ? null : f.meetingWeekday, meetingTime: f.meetingTime || null });
      if (!parsed.success) { setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message]))); throw new Error('validation'); }
      setErrors({});
      return api.createCell(orgId, parsed.data);
    },
    onSuccess: () => { setF({ name: '', regionLabel: '', meetingWeekday: '', meetingTime: '', description: '' }); qc.invalidateQueries({ queryKey: ['cells', orgId] }); },
  });
  const perms = ['cells.create', 'cells.update', 'cells.manage_members', 'cells.manage_meetings'] as const;
  if (!perms.some((p) => canAnywhere(ctx.grants, p))) return <><PageHeader title="Células" back="/gestao" /><PermissionDenied /></>;
  const manageable = (q.data ?? []).filter((c) => perms.some((p) => can(p, { type: 'cell', id: c.id })));
  return (
    <div className="space-y-4">
      <PageHeader title="Gestão de Células" back="/gestao" subtitle="Central 09 — hierarquia configurável (líder, supervisor, coordenação)" />
      {can('cells.create') && (
        <Card>
          <CardTitle className="mb-3">Nova célula</CardTitle>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
            <Field label="Nome" error={errors.name}>{(p) => <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} {...p} />}</Field>
            <Field label="Região (pública para membros)" hint="Ex.: bairro. Endereço exato é cadastrado à parte e fica restrito.">{(p) => <Input value={f.regionLabel} onChange={(e) => setF({ ...f, regionLabel: e.target.value })} {...p} />}</Field>
            <Field label="Dia do encontro">{(p) => <Select value={f.meetingWeekday} onChange={(e) => setF({ ...f, meetingWeekday: e.target.value })} {...p}><option value="">—</option>{WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</Select>}</Field>
            <Field label="Horário" error={errors.meetingTime}>{(p) => <Input type="time" value={f.meetingTime} onChange={(e) => setF({ ...f, meetingTime: e.target.value })} {...p} />}</Field>
            <div className="sm:col-span-2"><Button type="submit" loading={create.isPending}>Criar célula</Button></div>
            {create.error && (create.error as Error).message !== 'validation' && <div className="sm:col-span-2"><FormMessage tone="error">{(create.error as Error).message}</FormMessage></div>}
            <p className="text-xs text-muted sm:col-span-2">Para designar liderança, use Membros e permissões → Funções → Líder de célula.</p>
          </form>
        </Card>
      )}
      {q.isLoading ? <LoadingList /> : q.error ? <ErrorState error={q.error} /> : manageable.length === 0 ? <EmptyState title="Nenhuma célula sob sua gestão" /> : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {manageable.map((c) => (
            <li key={c.id}><Link to={`/celulas/${c.id}`}><Card className="hover:border-primary/30"><p className="font-medium">{c.name}</p><p className="text-sm text-muted">{c.regionLabel}{c.meetingWeekday !== null && ` · ${WEEKDAYS[c.meetingWeekday]}`}{c.meetingTime && ` às ${c.meetingTime}`}</p></Card></Link></li>
          ))}
        </ul>
      )}
    </div>
  );
}
