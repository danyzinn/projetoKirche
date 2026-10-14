import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CalendarDays, ClipboardList, Megaphone, Users } from 'lucide-react';
import { useCurrentOrg } from '@/app/OrgProvider';
import type { AppNotification } from '@/domain/types';
import { api } from '@/services';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState, ErrorState, LoadingList } from '@/components/ui/States';
import { cn, formatRelative } from '@/lib/utils';

const icons: Record<AppNotification['category'], typeof Bell> = { announcement: Megaphone, schedule: ClipboardList, event: CalendarDays, cell: Users, system: Bell };

export function NotificationsPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['notifications', orgId], queryFn: () => api.listNotifications(orgId) });
  const mark = useMutation({ mutationFn: (ids: string[] | null) => api.markNotificationsRead(orgId, ids), onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications', orgId] }) });
  const unread = q.data?.filter((n) => !n.readAt).length ?? 0;
  return (
    <div>
      <PageHeader title="Notificações" subtitle={unread ? `${unread} não lida${unread > 1 ? 's' : ''}` : 'Tudo em dia'}
        actions={unread > 0 && <Button size="sm" variant="secondary" loading={mark.isPending} onClick={() => mark.mutate(null)}>Marcar todas como lidas</Button>} />
      {mark.error && <ErrorState error={mark.error} />}
      {q.isLoading ? <LoadingList /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !q.data?.length ? (
        <EmptyState icon={<Bell className="h-6 w-6" aria-hidden />} title="Nenhuma notificação" description="Avisos, escalas e eventos para você aparecerão aqui." />
      ) : (
        <ul className="space-y-2">
          {q.data.map((n) => {
            const Icon = icons[n.category];
            const content = (
              <Card className={cn('flex gap-3', !n.readAt && 'border-primary/30 bg-primary-soft/30')}>
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className={cn('text-sm', !n.readAt && 'font-semibold')}>{n.title}{!n.readAt && <span className="sr-only"> (não lida)</span>}</p>
                  {n.body && <p className="line-clamp-2 text-sm text-muted">{n.body}</p>}
                  <p className="mt-1 text-xs text-muted">{formatRelative(n.createdAt)}</p>
                </div>
              </Card>
            );
            return (
              <li key={n.id}>
                {n.link ? <Link to={n.link} onClick={() => !n.readAt && mark.mutate([n.id])}>{content}</Link> : content}
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-6 text-xs text-muted">Notificações push ainda não estão ativas nesta versão; a central acima é sempre a referência.</p>
    </div>
  );
}
