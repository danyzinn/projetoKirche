import { Link, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bell, CalendarDays, Home, User, Users } from 'lucide-react';
import { useCurrentOrg } from '@/app/OrgProvider';
import { sectionForPath } from '@/app/navigation';
import { api } from '@/services';
import { cn } from '@/lib/utils';
import { DemoBanner } from './DemoBanner';

function monogram(name: string) {
  const words = name.trim().split(/\s+/);
  return (words[0].length <= 4 ? words[0] : words.map((w) => w[0]).join('')).slice(0, 4).toUpperCase();
}

export function BrandMark({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  return (
    <span className="flex items-center gap-2">
      {logoUrl ? (
        <img src={logoUrl} alt="" className="h-8 w-8 rounded-lg object-contain" />
      ) : (
        // Marca provisória: iniciais em bloco — NÃO é o logotipo oficial.
        <span aria-hidden className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-[11px] font-bold text-white">
          {monogram(name)}
        </span>
      )}
      <span className="text-base font-semibold tracking-tight">{name}</span>
    </span>
  );
}


export function AppShell() {
  const { ctx, orgId } = useCurrentOrg();
  const { pathname } = useLocation();
  const active = sectionForPath(pathname);
  const has = (key: string) => ctx.modules.includes(key);
  const notifications = useQuery({ queryKey: ['notifications', orgId], queryFn: () => api.listNotifications(orgId), enabled: has('notifications'), refetchInterval: 60_000 });
  const unread = notifications.data?.filter((n) => !n.readAt).length ?? 0;
  const nav = [
    { to: '/', label: 'Início', icon: Home, visible: true },
    { to: '/agenda', label: 'Agenda', icon: CalendarDays, visible: has('events') || has('schedules') },
    { to: '/comunidade', label: 'Comunidade', icon: Users, visible: has('ministries') || has('cells') },
    { to: '/perfil', label: 'Perfil', icon: User, visible: true },
  ].filter((item) => item.visible);
  const bell = has('notifications') && <Link to="/notificacoes" aria-label={`Notificações${unread ? `, ${unread} não lidas` : ''}`} className="relative grid h-11 w-11 place-items-center rounded-xl hover:bg-canvas"><Bell className="h-5 w-5" aria-hidden />{unread > 0 && <span className="absolute right-0 top-0 rounded-full bg-primary px-1.5 text-xs text-white">{unread}</span>}</Link>;
  return (
    <div className="min-h-dvh">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:z-50 focus:bg-surface focus:p-3">Pular para o conteúdo</a>
      <DemoBanner />
      <div className="flex">
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-surface p-4 lg:flex">
          <Link to="/" className="mb-8"><BrandMark name={ctx.branding.appName} logoUrl={ctx.branding.logoUrl} /></Link>
          <nav aria-label="Principal" className="flex flex-1 flex-col gap-2">
            {nav.map((item) => <Link key={item.to} to={item.to} aria-current={active === item.to ? 'page' : undefined} className={cn('flex items-center gap-3 rounded-xl p-3 text-sm font-medium', active === item.to ? 'bg-primary-soft text-primary' : 'hover:bg-canvas')}><item.icon className="h-5 w-5" aria-hidden />{item.label}</Link>)}
          </nav>
          {bell}
          <p className="mt-3 text-xs text-muted">{ctx.branding.poweredBy}</p>
        </aside>
        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-line bg-surface/95 px-4 backdrop-blur lg:hidden">
            <Link to="/"><BrandMark name={ctx.branding.appName} logoUrl={ctx.branding.logoUrl} /></Link>{bell}
          </header>
          <main id="conteudo" className="mx-auto max-w-4xl px-4 pb-28 pt-6 lg:px-8 lg:pb-10"><Outlet /></main>
        </div>
      </div>
      <nav aria-label="Principal" className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface lg:hidden">
        <ul className="grid" style={{ gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))` }}>
          {nav.map((item) => <li key={item.to}><Link to={item.to} aria-current={active === item.to ? 'page' : undefined} className={cn('flex min-h-[64px] flex-col items-center justify-center gap-1 text-xs font-medium', active === item.to ? 'text-primary' : 'text-muted')}><item.icon className="h-5 w-5" aria-hidden />{item.label}</Link></li>)}
        </ul>
      </nav>
    </div>
  );
}
