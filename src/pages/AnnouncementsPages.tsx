import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useCurrentOrg } from '@/app/OrgProvider';
import { canAnywhere, canPublishTo } from '@/domain/permissions';
import { announcementInputSchema } from '@/domain/schemas';
import type { Announcement, ScopeType } from '@/domain/types';
import { api } from '@/services';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState, ErrorState, FormMessage, LoadingList, PermissionDenied } from '@/components/ui/States';
import { cn, formatDateTime } from '@/lib/utils';

type Filter = 'all' | 'unread' | 'mine';

export function AnnouncementsPage() {
  const { ctx, orgId } = useCurrentOrg();
  const [filter, setFilter] = useState<Filter>('all');
  const q = useQuery({ queryKey: ['announcements', orgId], queryFn: () => api.listAnnouncements(orgId) });
  const canCreate = canAnywhere(ctx.grants, 'announcements.create');
  const list = (q.data ?? []).filter((a) => filter === 'all' ? true : filter === 'unread' ? !a.isRead && a.status === 'published' : a.authorId !== null && a.status === 'draft');

  return (
    <div>
      <PageHeader title="Avisos" subtitle="Comunicados para você e seus grupos" actions={canCreate && (
        <Link to="/avisos/novo"><Button size="sm"><Plus className="h-4 w-4" aria-hidden />Novo aviso</Button></Link>
      )} />
      <div role="tablist" aria-label="Filtrar avisos" className="mb-4 flex gap-2">
        {(['all', 'unread', ...(canCreate ? ['mine'] : [])] as Filter[]).map((f) => (
          <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)}
            className={cn('h-9 rounded-full border px-3 text-sm', filter === f ? 'border-primary bg-primary-soft text-primary' : 'border-line bg-surface text-muted')}>
            {f === 'all' ? 'Todos' : f === 'unread' ? 'Não lidos' : 'Rascunhos'}
          </button>
        ))}
      </div>
      {q.isLoading ? <LoadingList /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : list.length === 0 ? (
        <EmptyState title="Nenhum aviso aqui" description={filter === 'unread' ? 'Você está em dia.' : 'Quando houver comunicados para você, eles aparecerão aqui.'} />
      ) : (
        <ul className="space-y-3">
          {list.map((a) => <li key={a.id}><AnnouncementCard a={a} tz={ctx.org.timezone} /></li>)}
        </ul>
      )}
    </div>
  );
}

function AnnouncementCard({ a, tz }: { a: Announcement; tz: string }) {
  return (
    <Link to={`/avisos/${a.id}`} className="block">
      <Card className="transition-colors hover:border-primary/30">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          {a.status === 'draft' && <Badge tone="warning">Rascunho</Badge>}
          {a.status === 'published' && !a.isRead && <Badge tone="primary">Novo</Badge>}
          {a.audiences.map((au, i) => <Badge key={i}>{au.label}</Badge>)}
        </div>
        <p className="font-semibold">{a.title}</p>
        <p className="mt-1 line-clamp-2 text-sm text-muted">{a.body}</p>
        {a.publishedAt && <p className="mt-2 text-xs text-muted">{formatDateTime(a.publishedAt, tz)}{a.authorName && ` · ${a.authorName}`}</p>}
      </Card>
    </Link>
  );
}

export function AnnouncementDetailPage() {
  const { id = '' } = useParams();
  const { ctx, orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['announcement', id], queryFn: () => api.getAnnouncement(orgId, id) });
  const markRead = useMutation({
    mutationFn: () => api.markAnnouncementRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['announcements', orgId] }),
  });
  const publish = useMutation({
    mutationFn: () => api.publishAnnouncement(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['announcement', id] }); qc.invalidateQueries({ queryKey: ['announcements', orgId] }); qc.invalidateQueries({ queryKey: ['notifications', orgId] }); },
  });
  const a = q.data;
  const { mutate: markReadMutate } = markRead;
  useEffect(() => { if (a && a.status === 'published' && !a.isRead) markReadMutate(); }, [a, markReadMutate]);

  if (q.isLoading) return <LoadingList rows={1} />;
  if (q.error || !a) return <><PageHeader title="Aviso" back="/avisos" /><ErrorState error={q.error} /></>;
  const canPublish = a.status === 'draft' && a.audiences.every((au) => canPublishTo(ctx.grants, au));
  return (
    <article>
      <PageHeader title={a.title} back="/avisos" subtitle={a.publishedAt ? `${formatDateTime(a.publishedAt, ctx.org.timezone)}${a.authorName ? ` · ${a.authorName}` : ''}` : 'Rascunho'} />
      <div className="mb-4 flex flex-wrap gap-2">{a.audiences.map((au, i) => <Badge key={i}>{au.label}</Badge>)}</div>
      <Card><p className="whitespace-pre-wrap leading-relaxed">{a.body}</p></Card>
      {a.status === 'draft' && (
        <div className="mt-4 space-y-2">
          {publish.error && <FormMessage tone="error">{(publish.error as Error).message}</FormMessage>}
          {canPublish ? (
            <Button onClick={() => publish.mutate()} loading={publish.isPending}>Publicar agora</Button>
          ) : (
            <p className="text-sm text-muted">Você não tem permissão para publicar para todos os públicos deste aviso. Ele aguarda publicação por alguém autorizado.</p>
          )}
        </div>
      )}
    </article>
  );
}

export function NewAnnouncementPage() {
  const { ctx, orgId } = useCurrentOrg();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const opts = useQuery({ queryKey: ['audience-options', orgId], queryFn: () => api.audienceOptions(orgId) });
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const audiences = (opts.data ?? []).filter((o) => selected.includes(`${o.type}:${o.id}`)).map((o) => ({ type: o.type as ScopeType, id: o.id }));
  const canPublishAll = audiences.length > 0 && audiences.every((a) => canPublishTo(ctx.grants, a));

  const save = useMutation({
    mutationFn: (publishNow: boolean) => {
      const parsed = announcementInputSchema.safeParse({ title, body, audiences, publishNow });
      if (!parsed.success) {
        setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
        throw new Error('validation');
      }
      setErrors({});
      return api.createAnnouncement(orgId, parsed.data);
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ['announcements', orgId] });
      qc.invalidateQueries({ queryKey: ['notifications', orgId] });
      navigate(`/avisos/${id}`);
    },
    onError: (e) => { if ((e as Error).message !== 'validation') setServerError((e as Error).message); },
  });

  if (!canAnywhere(ctx.grants, 'announcements.create')) return <><PageHeader title="Novo aviso" back="/avisos" /><PermissionDenied /></>;

  return (
    <div>
      <PageHeader title="Novo aviso" back="/avisos" subtitle="Escolha o público. Só aparecem grupos em que você pode comunicar." />
      <Card>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(canPublishAll); }}>
          {serverError && <FormMessage tone="error">{serverError}</FormMessage>}
          <Field label="Título" error={errors.title}>{(p) => <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} {...p} />}</Field>
          <Field label="Mensagem" error={errors.body}>{(p) => <Textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} {...p} />}</Field>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Público</legend>
            {opts.isLoading ? <LoadingList rows={1} /> : opts.data?.length ? (
              <div className="flex flex-wrap gap-2">
                {opts.data.map((o) => {
                  const key = `${o.type}:${o.id}`;
                  const on = selected.includes(key);
                  return (
                    <label key={key} className={cn('flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm', on ? 'border-primary bg-primary-soft text-primary' : 'border-line')}>
                      <input type="checkbox" className="accent-[rgb(var(--primary))]" checked={on} onChange={() => setSelected((s) => on ? s.filter((x) => x !== key) : [...s, key])} />
                      {o.label}
                    </label>
                  );
                })}
              </div>
            ) : <p className="text-sm text-muted">Nenhum público disponível para você.</p>}
            {errors.audiences && <p role="alert" className="mt-1 text-sm text-danger">{errors.audiences}</p>}
          </fieldset>
          <div className="flex flex-wrap gap-2 pt-2">
            {canPublishAll && <Button type="submit" loading={save.isPending && save.variables === true}>Publicar agora</Button>}
            <Button type="button" variant="secondary" loading={save.isPending && save.variables === false} onClick={() => save.mutate(false)}>Salvar rascunho</Button>
          </div>
          {audiences.length > 0 && !canPublishAll && <p className="text-xs text-muted">Você pode criar o rascunho; a publicação para este público exige aprovação de quem tem permissão.</p>}
          <p className="text-xs text-muted">Destinatários recebem a notificação no app. Push depende de autorização de cada pessoa e não tem entrega garantida.</p>
        </form>
      </Card>
    </div>
  );
}
