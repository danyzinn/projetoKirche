import type { Grant, PermissionKey, ScopeType } from './types';

/**
 * Espelho no cliente da função SQL `has_permission`. Serve APENAS para decidir
 * o que mostrar — a autorização real acontece no banco (RLS + RPCs).
 * Grant em escopo 'church' cobre qualquer escopo; demais exigem escopo exato.
 */
export function can(
  grants: Grant[],
  permission: PermissionKey,
  scope?: { type: ScopeType; id: string | null },
): boolean {
  return grants.some(
    (g) =>
      g.permissions.includes(permission) &&
      (g.scopeType === 'church' ||
        (scope !== undefined && scope.type !== 'church' && g.scopeType === scope.type && g.scopeId === scope.id)),
  );
}

/** Tem a permissão em algum escopo (para exibir áreas de gestão). */
export function canAnywhere(grants: Grant[], permission: PermissionKey): boolean {
  return grants.some((g) => g.permissions.includes(permission));
}

export function canPublishTo(grants: Grant[], audience: { type: ScopeType; id: string | null }): boolean {
  return audience.type === 'church'
    ? can(grants, 'announcements.publish')
    : can(grants, 'announcements.publish', audience);
}

export type CentralKey =
  | 'admin' | 'finance' | 'services' | 'people' | 'teaching'
  | 'communication' | 'care' | 'security' | 'cells';

export interface CentralDefinition {
  key: CentralKey;
  number: string;
  title: string;
  description: string;
  /** Qualquer uma destas permissões libera a central. */
  anyOf: PermissionKey[];
  /** Status real de implementação nesta versão. */
  status: 'parcial' | 'planejado';
  route: string | null;
}

export const CENTRALS: CentralDefinition[] = [
  { key: 'admin', number: '01', title: 'Administração e Secretaria', description: 'Membros, convites, papéis e permissões.', anyOf: ['church.view_members', 'church.manage_members', 'church.manage_permissions'], status: 'parcial', route: '/gestao/membros' },
  { key: 'finance', number: '02', title: 'Financeiro e Tesouraria', description: 'Acesso segregado. Implementação na Etapa E.', anyOf: ['finance.view', 'finance.manage'], status: 'planejado', route: null },
  { key: 'services', number: '03', title: 'Cultos e Produção', description: 'Louvor, Mídia e Layout: equipes e escalas.', anyOf: ['ministries.create', 'ministries.manage_members', 'schedules.create', 'schedules.update'], status: 'parcial', route: '/gestao/ministerios' },
  { key: 'people', number: '04', title: 'Pessoas e Acolhimento', description: 'Recepção e visitantes (Etapa D).', anyOf: ['church.manage_members'], status: 'planejado', route: null },
  { key: 'teaching', number: '05', title: 'Ensino e Formação', description: 'EBD, Infantil e Jovens (Etapa D).', anyOf: [], status: 'planejado', route: null },
  { key: 'communication', number: '06', title: 'Comunicação e Avisos', description: 'Rascunhos, segmentação e publicação.', anyOf: ['announcements.create', 'announcements.publish', 'events.create'], status: 'parcial', route: '/avisos/novo' },
  { key: 'care', number: '07', title: 'Cuidado, Intercessão e Ação Social', description: 'Planejado (Etapa D).', anyOf: [], status: 'planejado', route: null },
  { key: 'security', number: '08', title: 'Segurança e Infraestrutura', description: 'Planejado (Etapa D).', anyOf: [], status: 'planejado', route: null },
  { key: 'cells', number: '09', title: 'Gestão de Células', description: 'Células, liderança, encontros e presença.', anyOf: ['cells.create', 'cells.update', 'cells.manage_members', 'cells.manage_meetings'], status: 'parcial', route: '/gestao/celulas' },
];

export function visibleCentrals(grants: Grant[]): CentralDefinition[] {
  return CENTRALS.filter((c) => c.anyOf.some((p) => canAnywhere(grants, p)));
}

export function hasAnyManagement(grants: Grant[]): boolean {
  return visibleCentrals(grants).length > 0;
}
