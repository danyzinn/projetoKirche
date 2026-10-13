import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services';
import { can as canFn } from '@/domain/permissions';
import type { OrgContextData, OrgSummary, PermissionKey, ScopeType } from '@/domain/types';
import { env } from '@/lib/env';
import { hexToRgbTriplet } from '@/lib/utils';
import { useAuth } from './AuthProvider';

const STORAGE_KEY = 'kirche.currentOrg';
const read = () => { try { return localStorage.getItem(STORAGE_KEY); } catch { return null; } };
const write = (v: string) => { try { localStorage.setItem(STORAGE_KEY, v); } catch { /* ignore */ } };

interface OrgState {
  organizations: OrgSummary[] | undefined;
  orgsLoading: boolean;
  orgsError: unknown;
  orgId: string | null;
  selectOrg: (id: string) => void;
  ctx: OrgContextData | undefined;
  ctxLoading: boolean;
  ctxError: unknown;
  refetchCtx: () => void;
  can: (p: PermissionKey, scope?: { type: ScopeType; id: string | null }) => boolean;
}

const OrgContext = createContext<OrgState | null>(null);

export function OrgProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [selected, setSelected] = useState<string | null>(read);

  const orgsQ = useQuery({ queryKey: ['orgs', user?.id], queryFn: api.listMyOrganizations, enabled: !!user });

  // Resolve a igreja atual: escolhida e válida > slug padrão > única disponível.
  const orgId = useMemo(() => {
    const list = orgsQ.data;
    if (!list?.length) return null;
    if (selected && list.some((o) => o.id === selected)) return selected;
    const bySlug = env.defaultOrgSlug && list.find((o) => o.slug === env.defaultOrgSlug);
    if (bySlug) return bySlug.id;
    return list.length === 1 ? list[0].id : null;
  }, [orgsQ.data, selected]);

  const ctxQ = useQuery({ queryKey: ['orgctx', orgId], queryFn: () => api.getOrgContext(orgId!), enabled: !!orgId });

  // White-label: aplica tokens do tenant em CSS variables.
  useEffect(() => {
    const theme = ctxQ.data?.branding.theme ?? {};
    const root = document.documentElement;
    const map: [string, string | undefined][] = [['--primary', theme.primary], ['--primary-hover', theme.primaryHover], ['--primary-soft', theme.primarySoft]];
    map.forEach(([k, v]) => { const t = v && hexToRgbTriplet(v); if (t) root.style.setProperty(k, t); else root.style.removeProperty(k); });
    if (ctxQ.data) document.title = ctxQ.data.branding.appName;
  }, [ctxQ.data]);

  const selectOrg = useCallback((id: string) => { write(id); setSelected(id); }, []);
  const grants = ctxQ.data?.grants;
  const can = useCallback((p: PermissionKey, scope?: { type: ScopeType; id: string | null }) => canFn(grants ?? [], p, scope), [grants]);

  return (
    <OrgContext.Provider value={{
      organizations: orgsQ.data, orgsLoading: orgsQ.isLoading, orgsError: orgsQ.error, orgId, selectOrg,
      ctx: ctxQ.data, ctxLoading: ctxQ.isLoading, ctxError: ctxQ.error, refetchCtx: () => void ctxQ.refetch(), can,
    }}>
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error('useOrg fora do OrgProvider');
  return ctx;
}

/** Para páginas dentro do shell, onde a igreja já está resolvida. */
export function useCurrentOrg() {
  const o = useOrg();
  if (!o.ctx || !o.orgId) throw new Error('Igreja não carregada');
  return { ...o, ctx: o.ctx, orgId: o.orgId };
}
