import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, ChevronRight, ClipboardList, Megaphone, Settings2, Users } from 'lucide-react';
import { useCurrentOrg } from '@/app/OrgProvider';
import { hasAnyManagement } from '@/domain/permissions';
import { api } from '@/services';
import { Card, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ErrorState, Skeleton } from '@/components/ui/States';
import { formatDateTime, greeting, WEEKDAYS } from '@/lib/utils';

function Section({ title, to, icon: Icon, children }: { title: string; to: string; icon: typeof Megaphone; children: React.ReactNode }) {
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <CardTitle className="flex items-center gap-2"><Icon className="h-4 w-4 text-primary" aria-hidden />{title}</CardTitle>
        <Link to={to} className="inline-flex items-center text-sm text-primary hover:underline">Ver tudo<ChevronRight className="h-4 w-4" aria-hidden /></Link>
      </div>
      {children}
    </Card>
  );
}

export function HomePage() {
  const { ctx, orgId } = useCurrentOrg();
  const tz = ctx.org.timezone;
  const profile = useQuery({ queryKey: ['profile'], queryFn: api.getMyProfile });
  const anns = useQuery({ queryKey: ['announcements', orgId], queryFn: () => api.listAnnouncements(orgId), enabled: ctx.modules.includes('announcements') });
  const events = useQuery({ queryKey: ['events', orgId], queryFn: () => api.listEvents(orgId), enabled: ctx.modules.includes('events') });
  const assignments = useQuery({ queryKey: ['my-assignments', orgId], queryFn: () => api.listMyAssignments(orgId), enabled: ctx.modules.includes('schedules') });
  const cells = useQuery({ queryKey: ['cells', orgId], queryFn: () => api.listCells(orgId), enabled: ctx.modules.includes('cells') });

  const firstName = profile.data?.displayName || profile.data?.fullName.split(' ')[0];
  const nextAssignment = assignments.data?.find((a) => a.status !== 'declined' && new Date(a.schedule.startsAt) >= new Date());
  const myCell = cells.data?.find((c) => c.isMember);
  const published = anns.data?.filter((a) => a.status === 'published' && !!a.publishedAt && new Date(a.publishedAt) <= new Date()).slice(0, 3);

  const upcoming = (events.data ?? []).filter((e) => e.status === 'published' && new Date(e.startsAt) >= new Date()).sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-muted">{greeting(new Date(), tz)}{firstName ? ',' : ''}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{firstName ?? ctx.branding.appName}</h1>
      </div>

      {hasAnyManagement(ctx.grants) && (
        <Link to="/gestao" className="flex items-center gap-3 rounded-2xl bg-primary p-4 text-white shadow-card hover:bg-primary-hover">
          <Settings2 className="h-5 w-5" aria-hidden />
          <span className="flex-1"><span className="block font-semibold">Minha Central de Gestão</span><span className="text-sm text-white/80">Áreas liberadas para suas funções</span></span>
          <ChevronRight className="h-5 w-5" aria-hidden />
        </Link>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {ctx.modules.includes('schedules') && <Section title="Minha próxima escala" to="/escalas" icon={ClipboardList}>
          {assignments.isLoading ? <Skeleton className="h-14" /> : assignments.error ? <ErrorState error={assignments.error} /> : nextAssignment ? (
            <div>
              <p className="font-medium">{nextAssignment.schedule.title}</p>
              <p className="text-sm text-muted">{nextAssignment.schedule.ministryName} · {nextAssignment.position} · {formatDateTime(nextAssignment.schedule.startsAt, tz)}</p>
              <Badge className="mt-2" tone={nextAssignment.status === 'confirmed' ? 'success' : nextAssignment.status === 'declined' ? 'danger' : 'warning'}>
                {nextAssignment.status === 'confirmed' ? 'Confirmada' : nextAssignment.status === 'declined' ? 'Recusada' : 'Aguardando sua confirmação'}
              </Badge>
            </div>
          ) : <p className="text-sm text-muted">Você não tem escalas futuras.</p>}
        </Section>}

        {ctx.modules.includes('cells') && <Section title="Minha célula" to={myCell ? `/celulas/${myCell.id}` : '/grupos'} icon={Users}>
          {cells.isLoading ? <Skeleton className="h-14" /> : cells.error ? <ErrorState error={cells.error} /> : myCell ? (
            <div>
              <p className="font-medium">{myCell.name}</p>
              <p className="text-sm text-muted">{myCell.regionLabel}{myCell.meetingWeekday !== null && ` · ${WEEKDAYS[myCell.meetingWeekday]}`}{myCell.meetingTime && ` às ${myCell.meetingTime}`}</p>
            </div>
          ) : <p className="text-sm text-muted">Você ainda não participa de uma célula. Veja as opções em Grupos.</p>}
        </Section>}
      </div>

      {ctx.modules.includes('announcements') && <Section title="Avisos recentes" to="/avisos" icon={Megaphone}>
        {anns.isLoading ? <Skeleton className="h-20" /> : anns.error ? <ErrorState error={anns.error} onRetry={() => anns.refetch()} /> : published?.length ? (
          <ul className="divide-y divide-line">
            {published.map((a) => (
              <li key={a.id}>
                <Link to={`/avisos/${a.id}`} className="flex items-start gap-2 py-2.5 hover:text-primary">
                  {!a.isRead && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Não lido" />}
                  <span className="min-w-0 flex-1"><span className="block truncate font-medium">{a.title}</span><span className="text-xs text-muted">{a.audiences.map((x) => x.label).join(', ')}</span></span>
                </Link>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted">Nenhum aviso por enquanto.</p>}
      </Section>}

      {ctx.modules.includes('events') && <Section title="Próximos eventos" to="/eventos" icon={CalendarDays}>
        {events.isLoading ? <Skeleton className="h-20" /> : events.error ? <ErrorState error={events.error} /> : upcoming.length ? (
          <ul className="divide-y divide-line">
            {upcoming.slice(0, 3).map((e) => (
              <li key={e.id}><Link to={`/eventos/${e.id}`} className="block py-2.5 hover:text-primary"><span className="block font-medium">{e.title}</span><span className="text-xs text-muted">{formatDateTime(e.startsAt, tz)}</span></Link></li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted">Nenhum evento agendado.</p>}
      </Section>}
      <p className="text-xs text-muted">Horários de culto serão exibidos aqui após confirmação pela igreja.</p>
    </div>
  );
}
