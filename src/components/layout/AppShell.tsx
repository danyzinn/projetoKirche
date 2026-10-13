import { NavLink, Outlet, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bell, CalendarDays, Home, LayoutGrid, LogOut, Megaphone, Settings2, User, Users } from 'lucide-react';
import { useAuth } from '@/app/AuthProvider';
import { useCurrentOrg } from '@/app/OrgProvider';
import { hasAnyManagement } from '@/domain/permissions';
import { api } from '@/services';
import { cn } from '@/lib/utils';
import { DemoBanner } from './DemoBanner';

const memberNav = [
  { to: '/', label: 'Início', icon: Home, end: true },
  { to: '/avisos', label: 'Avisos', icon: Megaphone },
  { to: '/eventos', label: 'Eventos', icon: CalendarDays },
  { to: '/grupos', label: 'Grupos', icon: Users },
  { to: '/notificacoes', label: 'Notificações', icon: Bell },
];

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

function useUnreadCount(orgId: string) {
  const q = useQuery({ queryKey: ['notifications', orgId], queryFn: () => api.listNotifications(orgId), refetchInterval: 60_000 });
  return q.data?.filter((n) => !n.readAt).length ?? 0;
}

export function AppShell() {
  const { ctx, orgId, organizations } = useCurrentOrg();
  const { signOut } = useAuth();
  const unread = useUnreadCount(orgId);
  const showManagement = hasAnyManagement(ctx.grants);
  const nav = showManagement ? [...memberNav, { to: '/gestao', label: 'Minha Central de Gestão', icon: Settings2 }] : memberNav;

  return (
    <div className="min-h-dvh">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-xl focus:bg-surface focus:p-3">
        Pular para o conteúdo
      </a>
      <DemoBanner />
      <div className="flex">
        {/* Sidebar desktop */}
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-surface px-3 py-4 lg:flex">
          <Link to="/" className="mb-6 px-2"><BrandMark name={ctx.branding.appName} logoUrl={ctx.branding.logoUrl} /></Link>
          <nav aria-label="Principal" className="flex flex-1 flex-col gap-1">
            {nav.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end}
                className={({ isActive }) => cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium', isActive ? 'bg-primary-soft text-primary' : 'text-ink hover:bg-canvas')}>
                <item.icon className="h-5 w-5" aria-hidden />
                <span className="flex-1">{item.label}</span>
                {item.to === '/notificacoes' && unread > 0 && <span className="rounded-full bg-primary px-2 text-xs text-white">{unread}</span>}
              </NavLink>
            ))}
          </nav>
          <div className="space-y-1 border-t border-line pt-3">
            {organizations && organizations.length > 1 && (
              <NavLink to="/selecionar-igreja" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted hover:bg-canvas"><LayoutGrid className="h-4 w-4" aria-hidden />Trocar de igreja</NavLink>
            )}
            <NavLink to="/perfil" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-ink hover:bg-canvas"><User className="h-4 w-4" aria-hidden />Perfil</NavLink>
            <button onClick={signOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-muted hover:bg-canvas"><LogOut className="h-4 w-4" aria-hidden />Sair</button>
            <p className="px-3 pt-2 text-[11px] text-muted">{ctx.branding.poweredBy}</p>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Topo mobile */}
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-line bg-surface/95 px-4 backdrop-blur lg:hidden">
            <Link to="/"><BrandMark name={ctx.branding.appName} logoUrl={ctx.branding.logoUrl} /></Link>
            <div className="flex items-center gap-1">
              {showManagement && (
                <Link to="/gestao" aria-label="Minha Central de Gestão" className="grid h-11 w-11 place-items-center rounded-xl text-ink hover:bg-canvas"><Settings2 className="h-5 w-5" aria-hidden /></Link>
              )}
              <Link to="/perfil" aria-label="Perfil" className="grid h-11 w-11 place-items-center rounded-xl text-ink hover:bg-canvas"><User className="h-5 w-5" aria-hidden /></Link>
            </div>
          </header>

          <main id="conteudo" className="mx-auto w-full max-w-4xl flex-1 px-4 pb-28 pt-5 lg:px-8 lg:pb-10">
            <Outlet />
          </main>
        </div>
      </div>

      {/* Bottom navigation mobile */}
      <nav aria-label="Principal" className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface lg:hidden">
        <ul className="grid grid-cols-5">
          {memberNav.map((item) => (
            <li key={item.to}>
              <NavLink to={item.to} end={item.end}
                className={({ isActive }) => cn('relative flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium', isActive ? 'text-primary' : 'text-muted')}>
                <item.icon className="h-5 w-5" aria-hidden />
                {item.label}
                {item.to === '/notificacoes' && unread > 0 && (
                  <span className="absolute right-1/4 top-1.5 min-w-[18px] rounded-full bg-primary px-1 text-center text-[10px] text-white">
                    {unread}<span className="sr-only"> não lidas</span>
                  </span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
