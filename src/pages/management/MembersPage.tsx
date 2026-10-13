import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link2, ShieldCheck, X } from 'lucide-react';
import { useCurrentOrg } from '@/app/OrgProvider';
import type { MemberRow, ScopeType } from '@/domain/types';
import { api } from '@/services';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardTitle } from '@/components/ui/Card';
import { Field, Input, Select } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState, ErrorState, FormMessage, LoadingList, PermissionDenied } from '@/components/ui/States';

export function MembersPage() {
  const { orgId, can } = useCurrentOrg();
  const [filter, setFilter] = useState('');
  const q = useQuery({ queryKey: ['members', orgId], queryFn: () => api.listMembers(orgId), enabled: can('church.view_members') });
  if (!can('church.view_members')) return <><PageHeader title="Membros" back="/gestao" /><PermissionDenied /></>;
  const list = (q.data ?? []).filter((m) => m.fullName.toLocaleLowerCase('pt-BR').includes(filter.toLocaleLowerCase('pt-BR')));
  return (
    <div className="space-y-4">
      <PageHeader title="Membros e permissões" back="/gestao" subtitle="Central 01 — Administração e Secretaria" />
      {can('church.manage_members') && <InviteCard orgId={orgId} />}
      <label className="block text-sm font-medium">Filtrar por nome<Input className="mt-1.5" value={filter} onChange={(e) => setFilter(e.target.value)} /></label>
      {q.isLoading ? <LoadingList /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : list.length === 0 ? <EmptyState title="Ninguém encontrado" /> : (
        <ul className="space-y-2">{list.map((m) => <li key={m.userId}><MemberCard m={m} orgId={orgId} canGrant={can('church.manage_permissions')} /></li>)}</ul>
      )}
    </div>
  );
}

function InviteCard({ orgId }: { orgId: string }) {
  const [email, setEmail] = useState('');
  const [link, setLink] = useState<string | null>(null);
  const invite = useMutation({ mutationFn: () => api.createInvitation(orgId, email.trim()), onSuccess: (l) => { setLink(l); setEmail(''); } });
  return (
    <Card>
      <CardTitle className="mb-3 flex items-center gap-2"><Link2 className="h-4 w-4 text-primary" aria-hidden />Convidar pessoa</CardTitle>
      <form className="flex flex-col gap-2 sm:flex-row sm:items-end" onSubmit={(e) => { e.preventDefault(); invite.mutate(); }}>
        <div className="flex-1"><Field label="E-mail">{(p) => <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} {...p} />}</Field></div>
        <Button type="submit" loading={invite.isPending}>Gerar convite</Button>
      </form>
      {invite.error && <div className="mt-2"><FormMessage tone="error">{(invite.error as Error).message}</FormMessage></div>}
      {link && (
        <div className="mt-3 space-y-1">
          <FormMessage tone="success">Convite criado (válido por 7 dias). Copie e envie o link — ele não será exibido novamente.</FormMessage>
          <Input readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Link do convite" />
          <p className="text-xs text-muted">Envio automático por e-mail depende de provedor configurado (pendente).</p>
        </div>
      )}
    </Card>
  );
}

function MemberCard({ m, orgId, canGrant }: { m: MemberRow; orgId: string; canGrant: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const revoke = useMutation({ mutationFn: (id: string) => api.revokeRole(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['members', orgId] }); qc.invalidateQueries({ queryKey: ['orgctx', orgId] }); } });
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex-1 font-medium">{m.fullName}</span>
        {canGrant && <Button size="sm" variant="secondary" onClick={() => setOpen(!open)}><ShieldCheck className="h-4 w-4" aria-hidden />Funções</Button>}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {m.grants.length ? m.grants.map((g) => (
          <Badge key={g.id} tone="primary">
            {g.roleName}{g.scopeType !== 'church' && ' (escopo)'}
            {canGrant && <button aria-label={`Revogar ${g.roleName}`} className="ml-1 rounded-full hover:bg-primary/10" onClick={() => { if (window.confirm(`Revogar ${g.roleName} de ${m.fullName}?`)) revoke.mutate(g.id); }}><X className="h-3 w-3" aria-hidden /></button>}
          </Badge>
        )) : <Badge>Membro</Badge>}
      </div>
      {revoke.error && <div className="mt-2"><FormMessage tone="error">{(revoke.error as Error).message}</FormMessage></div>}
      {open && <GrantForm orgId={orgId} userId={m.userId} onDone={() => setOpen(false)} />}
    </Card>
  );
}

function GrantForm({ orgId, userId, onDone }: { orgId: string; userId: string; onDone: () => void }) {
  const qc = useQueryClient();
  const roles = useQuery({ queryKey: ['roles', orgId], queryFn: () => api.listRoles(orgId) });
  const ministries = useQuery({ queryKey: ['ministries', orgId], queryFn: () => api.listMinistries(orgId) });
  const cells = useQuery({ queryKey: ['cells', orgId], queryFn: () => api.listCells(orgId) });
  const [roleId, setRoleId] = useState('');
  const [scopeId, setScopeId] = useState('');
  const role = roles.data?.find((r) => r.id === roleId);
  const scopeType: ScopeType = role?.defaultScope ?? 'church';
  const scopeOptions = scopeType === 'ministry' ? ministries.data ?? [] : scopeType === 'cell' ? cells.data ?? [] : [];
  const grant = useMutation({
    mutationFn: () => api.grantRole(orgId, userId, roleId, scopeType, scopeType === 'church' ? null : scopeId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['members', orgId] }); qc.invalidateQueries({ queryKey: ['orgctx', orgId] }); onDone(); },
  });
  return (
    <form className="mt-3 grid gap-3 border-t border-line pt-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); grant.mutate(); }}>
      <Field label="Função">{(p) => (
        <Select value={roleId} onChange={(e) => { setRoleId(e.target.value); setScopeId(''); }} required {...p}>
          <option value="">Selecione…</option>
          {roles.data?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </Select>
      )}</Field>
      {scopeType !== 'church' ? (
        <Field label={scopeType === 'ministry' ? 'Ministério' : 'Célula'}>{(p) => (
          <Select value={scopeId} onChange={(e) => setScopeId(e.target.value)} required {...p}>
            <option value="">Selecione…</option>
            {scopeOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </Select>
        )}</Field>
      ) : <p className="text-sm text-muted">Escopo: toda a igreja</p>}
      <Button type="submit" loading={grant.isPending} disabled={!roleId || (scopeType !== 'church' && !scopeId)}>Conceder</Button>
      {grant.error && <div className="sm:col-span-3"><FormMessage tone="error">{(grant.error as Error).message}</FormMessage></div>}
      <p className="text-xs text-muted sm:col-span-3">Toda concessão e revogação é registrada na auditoria. Papéis com gestão de permissões só podem ser concedidos pelo responsável da igreja.</p>
    </form>
  );
}
