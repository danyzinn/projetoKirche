import { church } from '@/config/church';
/**
 * MODO DEMONSTRAÇÃO — dados FICTÍCIOS em memória do navegador.
 * Nada é persistido: recarregar a página restaura o estado inicial.
 * As regras de permissão espelham o banco para que a demonstração seja fiel,
 * mas a segurança real só existe no modo Supabase (RLS).
 */
import { can, canPublishTo } from '@/domain/permissions';
import type {
  Announcement, AppNotification, Audience, CellMeeting, Grant, MinistryKind, PermissionKey,
  RoleDefinition, ScopeType, SessionUser,
} from '@/domain/types';
import { ApiError, type KircheApi } from './api';

const ORG_ID = 'demo-org-ibv-nova';
const uid = () => (globalThis.crypto?.randomUUID?.() ?? `id-${Math.random().toString(36).slice(2)}`);
const daysFromNow = (d: number, h = 19) => {
  const dt = new Date();
  dt.setDate(dt.getDate() + d);
  dt.setHours(h, 0, 0, 0);
  return dt.toISOString();
};

const PERMS: Record<string, PermissionKey[]> = {
  church_owner: ['church.view_members', 'church.manage_members', 'church.manage_permissions', 'church.manage_settings', 'church.view_sensitive', 'church.audit', 'ministries.create', 'ministries.update', 'ministries.manage_members', 'schedules.create', 'schedules.update', 'schedules.delete', 'announcements.create', 'announcements.publish', 'announcements.approve', 'announcements.update', 'events.create', 'events.update', 'events.manage_registrations', 'cells.create', 'cells.update', 'cells.manage_members', 'cells.manage_meetings', 'cells.view_sensitive'],
  ministry_leader: ['ministries.update', 'ministries.manage_members', 'schedules.create', 'schedules.update', 'schedules.delete', 'announcements.create', 'announcements.publish', 'events.create', 'events.update', 'events.manage_registrations'],
  cell_leader: ['cells.manage_members', 'cells.manage_meetings', 'cells.view_sensitive', 'announcements.create', 'announcements.publish'],
  ministry_assistant: ['schedules.create', 'schedules.update', 'announcements.create'],
  secretary: ['church.view_members', 'church.manage_members', 'church.view_sensitive', 'announcements.create', 'events.create', 'events.update', 'events.manage_registrations'],
  treasurer: ['finance.view', 'finance.manage'],
  volunteer: [],
};
const ROLES: RoleDefinition[] = [
  { id: 'role-church_owner', key: 'church_owner', name: 'Responsável da igreja', defaultScope: 'church' },
  { id: 'role-secretary', key: 'secretary', name: 'Secretaria', defaultScope: 'church' },
  { id: 'role-treasurer', key: 'treasurer', name: 'Tesouraria', defaultScope: 'church' },
  { id: 'role-ministry_leader', key: 'ministry_leader', name: 'Líder de ministério', defaultScope: 'ministry' },
  { id: 'role-ministry_assistant', key: 'ministry_assistant', name: 'Auxiliar de ministério', defaultScope: 'ministry' },
  { id: 'role-cell_leader', key: 'cell_leader', name: 'Líder de célula', defaultScope: 'cell' },
];

export const DEMO_PROFILES = [
  { id: 'demo-u1', email: 'demo.membro@kirche.local', fullName: 'Ana Demonstração', label: 'Membro', hint: 'Integrante do Louvor e da Célula Esperança' },
  { id: 'demo-u2', email: 'demo.lider@kirche.local', fullName: 'Bruno Exemplo', label: 'Líder de Louvor', hint: 'Gerencia equipe e escalas do Louvor' },
  { id: 'demo-u3', email: 'demo.admin@kirche.local', fullName: 'Carla Fictícia', label: 'Administração', hint: 'Responsável da igreja (todas as centrais liberadas)' },
  { id: 'demo-u4', email: 'demo.celula@kirche.local', fullName: 'Davi Teste', label: 'Líder de Célula', hint: 'Lidera a Célula Esperança' },
] as const;

interface Store {
  profiles: { id: string; fullName: string; displayName: string | null; phone: string | null }[];
  grants: (Omit<Grant, 'permissions' | 'roleName'> & { userId: string; revoked: boolean })[];
  ministries: { id: string; name: string; kind: MinistryKind; description: string }[];
  ministryMembers: { id: string; ministryId: string; userId: string; positions: string[] }[];
  schedules: { id: string; ministryId: string; title: string; startsAt: string; notes: string; status: 'draft' | 'published' | 'cancelled'; createdBy: string }[];
  assignments: { id: string; scheduleId: string; userId: string; position: string; status: 'pending' | 'confirmed' | 'declined'; declineReason: string | null }[];
  announcements: (Omit<Announcement, 'isRead' | 'authorName'>)[];
  reads: Set<string>;
  events: { id: string; title: string; description: string; locationLabel: string; startsAt: string; endsAt: string | null; capacity: number | null; registrationEnabled: boolean; status: 'draft' | 'published' | 'cancelled'; audience: Audience; createdBy: string }[];
  registrations: { eventId: string; userId: string; status: 'registered' | 'cancelled' }[];
  cells: { id: string; name: string; regionLabel: string; meetingWeekday: number | null; meetingTime: string | null; description: string; address: string }[];
  cellMembers: { cellId: string; userId: string; kind: string }[];
  meetings: (CellMeeting & { cellId: string })[];
  notifications: (AppNotification & { userId: string; dedupe: string })[];
}

function initialStore(): Store {
  const ministryNames: [string, MinistryKind][] = [
    ['Louvor', 'worship'], ['Mídia', 'media'], ['Layout', 'layout'], ['Recepção', 'reception'],
    ['Escola Bíblica Dominical', 'teaching'], ['Infantil', 'children'], ['Jovens', 'youth'],
    ['Ação Social', 'social'], ['Intercessão Homens', 'intercession_men'],
    ['Intercessão Mulheres', 'intercession_women'], ['Segurança', 'security'],
  ];
  const ministries = ministryNames.map(([name, kind], i) => ({ id: `min-${i + 1}`, name, kind, description: '(DEMO) Descrição editável pela igreja.' }));
  const sched1 = 'sch-1';
  return {
    profiles: DEMO_PROFILES.map((p): Store['profiles'][number] => ({ id: p.id, fullName: p.fullName, displayName: null, phone: null })).concat(
      [{ id: 'demo-u5', fullName: 'Elisa Modelo', displayName: null, phone: null }, { id: 'demo-u6', fullName: 'Felipe Amostra', displayName: null, phone: null }],
    ),
    grants: [
      { id: 'g1', userId: 'demo-u3', roleKey: 'church_owner', scopeType: 'church', scopeId: null, revoked: false },
      { id: 'g2', userId: 'demo-u2', roleKey: 'ministry_leader', scopeType: 'ministry', scopeId: 'min-1', revoked: false },
      { id: 'g3', userId: 'demo-u4', roleKey: 'cell_leader', scopeType: 'cell', scopeId: 'cell-1', revoked: false },
    ],
    ministries,
    ministryMembers: [
      { id: 'mm1', ministryId: 'min-1', userId: 'demo-u2', positions: ['Ministro', 'Violão'] },
      { id: 'mm2', ministryId: 'min-1', userId: 'demo-u1', positions: ['Vocal'] },
      { id: 'mm3', ministryId: 'min-1', userId: 'demo-u5', positions: ['Teclado'] },
      { id: 'mm4', ministryId: 'min-2', userId: 'demo-u6', positions: ['Projeção'] },
    ],
    schedules: [{ id: sched1, ministryId: 'min-1', title: 'Culto de domingo (DEMO)', startsAt: daysFromNow(4, 18), notes: 'Repertório a definir.', status: 'published', createdBy: 'demo-u2' }],
    assignments: [
      { id: 'as1', scheduleId: sched1, userId: 'demo-u1', position: 'Vocal', status: 'pending', declineReason: null },
      { id: 'as2', scheduleId: sched1, userId: 'demo-u2', position: 'Violão', status: 'confirmed', declineReason: null },
    ],
    announcements: [
      { id: 'ann-1', title: `Bem-vindo ao app da ${church.name} (DEMO)`, body: 'Este é um aviso de demonstração. Todo o conteúdo aqui é fictício e será substituído pelo conteúdo aprovado pela igreja.', status: 'published', publishedAt: daysFromNow(-1, 9), authorId: 'demo-u3', audiences: [{ type: 'church', id: null }] },
      { id: 'ann-2', title: 'Ensaio do Louvor (DEMO)', body: 'Ensaio fictício para demonstrar avisos segmentados por ministério.', status: 'published', publishedAt: daysFromNow(0, 8), authorId: 'demo-u2', audiences: [{ type: 'ministry', id: 'min-1' }] },
    ],
    reads: new Set(),
    events: [
      { id: 'ev-1', title: 'Encontro de Jovens (DEMO)', description: 'Evento fictício para demonstração.', locationLabel: 'Local a definir', startsAt: daysFromNow(12), endsAt: null, capacity: 80, registrationEnabled: true, status: 'published', audience: { type: 'church', id: null }, createdBy: 'demo-u3' },
      { id: 'ev-2', title: 'Treinamento de Voluntários (DEMO)', description: 'Evento fictício para demonstração.', locationLabel: 'Local a definir', startsAt: daysFromNow(20, 9), endsAt: null, capacity: 2, registrationEnabled: true, status: 'published', audience: { type: 'church', id: null }, createdBy: 'demo-u3' },
    ],
    registrations: [],
    cells: [
      { id: 'cell-1', name: 'Célula Esperança (DEMO)', regionLabel: 'Região Norte', meetingWeekday: 3, meetingTime: '20:00', description: 'Célula fictícia.', address: 'Endereço fictício — visível só para participantes e liderança' },
      { id: 'cell-2', name: 'Célula Vida (DEMO)', regionLabel: 'Região Sul', meetingWeekday: 4, meetingTime: '19:30', description: 'Célula fictícia.', address: 'Endereço fictício' },
    ],
    cellMembers: [
      { cellId: 'cell-1', userId: 'demo-u1', kind: 'participant' },
      { cellId: 'cell-1', userId: 'demo-u4', kind: 'participant' },
      { cellId: 'cell-2', userId: 'demo-u5', kind: 'participant' },
    ],
    meetings: [{ id: 'meet-1', cellId: 'cell-1', startsAt: daysFromNow(2, 20), topic: 'Estudo (DEMO)', status: 'scheduled', attendance: [] }],
    notifications: [
      { id: 'n-1', userId: 'demo-u1', category: 'schedule', title: 'Você foi escalado(a): Culto de domingo (DEMO)', body: 'Confirme sua participação.', link: '/escalas', readAt: null, createdAt: daysFromNow(0, 8), dedupe: 'assignment:as1' },
    ],
  };
}

const delay = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 120));

export function createDemoApi(): KircheApi {
  let s = initialStore();
  let current: SessionUser | null = null;
  const listeners = new Set<(u: SessionUser | null) => void>();

  const me = () => {
    if (!current) throw new ApiError('not_authenticated', 'Sessão expirada.');
    return current.id;
  };
  const grantsOf = (userId: string): Grant[] =>
    s.grants.filter((g) => g.userId === userId && !g.revoked).map((g) => ({
      id: g.id, roleKey: g.roleKey, roleName: ROLES.find((r) => r.key === g.roleKey)?.name ?? g.roleKey,
      scopeType: g.scopeType, scopeId: g.scopeId, permissions: PERMS[g.roleKey] ?? [],
    }));
  const require = (perm: PermissionKey, scope?: { type: ScopeType; id: string | null }) => {
    if (!can(grantsOf(me()), perm, scope)) throw new ApiError('permission_denied', 'Você não tem permissão para esta ação.');
  };
  const name = (id: string | null) => s.profiles.find((p) => p.id === id)?.fullName ?? 'Pessoa';
  const isMinistryMember = (userId: string, ministryId: string) => s.ministryMembers.some((m) => m.userId === userId && m.ministryId === ministryId);
  const isCellMember = (userId: string, cellId: string) => s.cellMembers.some((m) => m.userId === userId && m.cellId === cellId);
  const inAudience = (userId: string, a: Audience) =>
    a.type === 'church' || (a.type === 'ministry' && isMinistryMember(userId, a.id!)) || (a.type === 'cell' && isCellMember(userId, a.id!));
  const audienceLabel = (a: Audience) =>
    a.type === 'church' ? 'Toda a igreja' : a.type === 'ministry' ? s.ministries.find((m) => m.id === a.id)?.name ?? 'Ministério' : s.cells.find((c) => c.id === a.id)?.name ?? 'Célula';
  const notify = (userId: string, n: Omit<AppNotification, 'id' | 'readAt' | 'createdAt'>, dedupe: string) => {
    if (s.notifications.some((x) => x.userId === userId && x.dedupe === dedupe)) return;
    s.notifications.unshift({ ...n, id: uid(), userId, dedupe, readAt: null, createdAt: new Date().toISOString() });
  };
  const canSeeAnnouncement = (userId: string, a: Store['announcements'][number]) =>
    a.authorId === userId || can(grantsOf(userId), 'announcements.update') ||
    (a.status === 'published' && !!a.publishedAt && new Date(a.publishedAt) <= new Date() && a.audiences.some((au) => inAudience(userId, au)));
  const toAnnouncement = (a: Store['announcements'][number]): Announcement => ({
    ...a, authorName: name(a.authorId), isRead: s.reads.has(`${a.id}:${me()}`),
    audiences: a.audiences.map((au) => ({ ...au, label: audienceLabel(au) })),
  });
  const toEvent = (e: Store['events'][number]) => ({
    id: e.id, title: e.title, description: e.description, locationLabel: e.locationLabel, startsAt: e.startsAt, endsAt: e.endsAt,
    capacity: e.capacity, registrationEnabled: e.registrationEnabled, status: e.status, audience: { ...e.audience, label: audienceLabel(e.audience) },
    registeredCount: s.registrations.filter((r) => r.eventId === e.id && r.status === 'registered').length,
    isRegistered: s.registrations.some((r) => r.eventId === e.id && r.userId === me() && r.status === 'registered'),
  });
  const scheduleView = (sc: Store['schedules'][number]) => ({
    id: sc.id, ministryId: sc.ministryId, ministryName: s.ministries.find((m) => m.id === sc.ministryId)?.name ?? '',
    title: sc.title, startsAt: sc.startsAt, notes: sc.notes, status: sc.status,
    assignments: s.assignments.filter((a) => a.scheduleId === sc.id).map((a) => ({ ...a, fullName: name(a.userId) })),
  });
  const notifyAssignment = (a: Store['assignments'][number], title: string) =>
    notify(a.userId, { category: 'schedule', title: `Você foi escalado(a): ${title}`, body: 'Confirme sua participação.', link: '/escalas' }, `assignment:${a.id}`);

  const api: KircheApi = {
    mode: 'demo',

    async getSessionUser() { return delay(current); },
    onAuthChange(cb) { listeners.add(cb); return () => listeners.delete(cb); },
    async signIn(email) {
      const p = DEMO_PROFILES.find((d) => d.email === email);
      if (!p) throw new ApiError('validation', 'Perfil de demonstração não encontrado.');
      s = initialStore(); // cada entrada começa do zero — nada é persistido
      current = { id: p.id, email: p.email };
      listeners.forEach((l) => l(current));
    },
    async signUp() { throw new ApiError('validation', 'Cadastro real indisponível na demonstração.'); },
    async signOut() { current = null; listeners.forEach((l) => l(null)); },
    async requestPasswordReset() { throw new ApiError('validation', 'Recuperação de senha indisponível no modo demonstração.'); },
    async updatePassword() { throw new ApiError('validation', 'Indisponível no modo demonstração.'); },
    async acceptInvitation() { throw new ApiError('validation', 'Convites exigem o backend configurado (modo demonstração).'); },

    async listMyOrganizations() { me(); return delay([{ id: ORG_ID, slug: church.slug, displayName: church.name, isDemo: true }]); },
    async getOrgContext() {
      const u = me();
      return delay({
        org: { id: ORG_ID, slug: church.slug, displayName: church.name, isDemo: true, timezone: 'America/Sao_Paulo', locale: 'pt-BR' },
        branding: { appName: church.name, logoUrl: church.logoUrl, poweredBy: 'Tecnologia Kirche', theme: {} },
        modules: ['announcements', 'events', 'ministries', 'schedules', 'cells', 'notifications'],
        grants: grantsOf(u),
        myMinistryIds: s.ministryMembers.filter((m) => m.userId === u).map((m) => m.ministryId),
        myCellIds: s.cellMembers.filter((m) => m.userId === u).map((m) => m.cellId),
      });
    },

    async getMyProfile() { const p = s.profiles.find((x) => x.id === me())!; return delay({ ...p }); },
    async updateMyProfile(input) {
      const p = s.profiles.find((x) => x.id === me())!;
      Object.assign(p, input);
      await delay(null);
    },

    async listAnnouncements() {
      const u = me();
      return delay(s.announcements.filter((a) => canSeeAnnouncement(u, a))
        .sort((a, b) => (b.publishedAt ?? '9').localeCompare(a.publishedAt ?? '9')).map(toAnnouncement));
    },
    async getAnnouncement(_o, id) {
      const a = s.announcements.find((x) => x.id === id);
      if (!a || !canSeeAnnouncement(me(), a)) throw new ApiError('not_found', 'Aviso não encontrado.');
      return delay(toAnnouncement(a));
    },
    async createAnnouncement(_o, input) {
      const u = me();
      if (!grantsOf(u).some((g) => g.permissions.includes('announcements.create'))) throw new ApiError('permission_denied', 'Você não pode criar avisos.');
      const id = uid();
      s.announcements.push({ id, title: input.title, body: input.body, status: 'draft', publishedAt: null, authorId: u, audiences: input.audiences });
      if (input.publishNow) await api.publishAnnouncement(id);
      return id;
    },
    async publishAnnouncement(id) {
      const u = me();
      const a = s.announcements.find((x) => x.id === id);
      if (!a || !canSeeAnnouncement(u, a)) throw new ApiError('not_found', 'Aviso não encontrado.');
      if (a.status !== 'draft') throw new ApiError('conflict', 'O aviso não é um rascunho.');
      if (!a.audiences.every((au) => canPublishTo(grantsOf(u), au))) throw new ApiError('permission_denied', 'Sem permissão para publicar para um dos públicos selecionados.');
      a.status = 'published';
      a.publishedAt = new Date().toISOString();
      s.profiles.filter((p) => a.audiences.some((au) => inAudience(p.id, au))).forEach((p) =>
        notify(p.id, { category: 'announcement', title: a.title, body: a.body.slice(0, 160), link: `/avisos/${a.id}` }, `announcement:${a.id}`));
      await delay(null);
    },
    async markAnnouncementRead(id) { s.reads.add(`${id}:${me()}`); },
    async audienceOptions() {
      const u = me();
      const g = grantsOf(u);
      const opts: { type: ScopeType; id: string | null; label: string }[] = [];
      if (canPublishTo(g, { type: 'church', id: null }) || can(g, 'announcements.create')) opts.push({ type: 'church', id: null, label: 'Toda a igreja' });
      s.ministries.forEach((m) => { if (can(g, 'announcements.create', { type: 'ministry', id: m.id })) opts.push({ type: 'ministry', id: m.id, label: m.name }); });
      s.cells.forEach((c) => { if (can(g, 'announcements.create', { type: 'cell', id: c.id })) opts.push({ type: 'cell', id: c.id, label: c.name }); });
      return delay(opts);
    },

    async listEvents() {
      const u = me();
      return delay(s.events.filter((e) => e.status !== 'draft' && inAudience(u, e.audience)).sort((a, b) => a.startsAt.localeCompare(b.startsAt)).map(toEvent));
    },
    async getEvent(_o, id) {
      const e = s.events.find((x) => x.id === id);
      if (!e || !inAudience(me(), e.audience)) throw new ApiError('not_found', 'Evento não encontrado.');
      return delay(toEvent(e));
    },
    async createEvent(_o, input) {
      require('events.create', input.audience.type === 'church' ? undefined : input.audience);
      const id = uid();
      s.events.push({ id, title: input.title, description: input.description ?? '', locationLabel: input.locationLabel ?? '', startsAt: new Date(input.startsAt).toISOString(), endsAt: input.endsAt ? new Date(input.endsAt).toISOString() : null, capacity: input.capacity ?? null, registrationEnabled: input.registrationEnabled, status: 'published', audience: input.audience, createdBy: me() });
      return delay(id);
    },
    async registerForEvent(eventId) {
      const u = me();
      const e = s.events.find((x) => x.id === eventId);
      if (!e || !inAudience(u, e.audience) || e.status !== 'published') throw new ApiError('not_found', 'Evento não encontrado.');
      if (!e.registrationEnabled) throw new ApiError('conflict', 'Inscrições encerradas.');
      const count = s.registrations.filter((r) => r.eventId === eventId && r.status === 'registered').length;
      const existing = s.registrations.find((r) => r.eventId === eventId && r.userId === u);
      if (e.capacity !== null && count >= e.capacity && existing?.status !== 'registered') throw new ApiError('conflict', 'Vagas esgotadas.');
      if (existing) existing.status = 'registered'; else s.registrations.push({ eventId, userId: u, status: 'registered' });
      await delay(null);
    },
    async cancelRegistration(eventId) {
      const r = s.registrations.find((x) => x.eventId === eventId && x.userId === me());
      if (r) r.status = 'cancelled';
      await delay(null);
    },

    async listMinistries() {
      const u = me();
      return delay(s.ministries.map((m) => ({ ...m, isMember: isMinistryMember(u, m.id) })));
    },
    async getMinistry(_o, id) {
      const m = s.ministries.find((x) => x.id === id);
      if (!m) throw new ApiError('not_found', 'Ministério não encontrado.');
      return delay({ ...m, isMember: isMinistryMember(me(), id) });
    },
    async listMinistryMembers(_o, ministryId) {
      const u = me();
      if (!isMinistryMember(u, ministryId) && !can(grantsOf(u), 'ministries.manage_members', { type: 'ministry', id: ministryId })) return [];
      return delay(s.ministryMembers.filter((m) => m.ministryId === ministryId).map((m) => ({ id: m.id, userId: m.userId, fullName: name(m.userId), positions: m.positions })));
    },
    async addMinistryMember(_o, ministryId, userId, positions) {
      require('ministries.manage_members', { type: 'ministry', id: ministryId });
      if (isMinistryMember(userId, ministryId)) throw new ApiError('conflict', 'Pessoa já faz parte do ministério.');
      s.ministryMembers.push({ id: uid(), ministryId, userId, positions });
      await delay(null);
    },
    async removeMinistryMember(_o, membershipId) {
      const mm = s.ministryMembers.find((x) => x.id === membershipId);
      if (!mm) throw new ApiError('not_found', 'Vínculo não encontrado.');
      require('ministries.manage_members', { type: 'ministry', id: mm.ministryId });
      s.ministryMembers = s.ministryMembers.filter((x) => x.id !== membershipId);
      await delay(null);
    },
    async listSchedules(_o, ministryId) {
      const u = me();
      const manager = can(grantsOf(u), 'schedules.update', { type: 'ministry', id: ministryId });
      if (!manager && !isMinistryMember(u, ministryId)) return [];
      return delay(s.schedules.filter((x) => x.ministryId === ministryId && (manager || x.status !== 'draft'))
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt)).map(scheduleView));
    },
    async createSchedule(_o, input) {
      require('schedules.create', { type: 'ministry', id: input.ministryId });
      const id = uid();
      s.schedules.push({ id, ministryId: input.ministryId, title: input.title, startsAt: new Date(input.startsAt).toISOString(), notes: input.notes ?? '', status: 'draft', createdBy: me() });
      return delay(id);
    },
    async addAssignment(_o, scheduleId, userId, position) {
      const sc = s.schedules.find((x) => x.id === scheduleId);
      if (!sc) throw new ApiError('not_found', 'Escala não encontrada.');
      require('schedules.update', { type: 'ministry', id: sc.ministryId });
      if (!isMinistryMember(userId, sc.ministryId)) throw new ApiError('validation', 'A pessoa precisa integrar o ministério.');
      if (s.assignments.some((a) => a.scheduleId === scheduleId && a.userId === userId && a.position === position)) throw new ApiError('conflict', 'Designação já existe.');
      const a = { id: uid(), scheduleId, userId, position, status: 'pending' as const, declineReason: null };
      s.assignments.push(a);
      if (sc.status === 'published') notifyAssignment(a, sc.title);
      await delay(null);
    },
    async removeAssignment(_o, assignmentId) {
      const a = s.assignments.find((x) => x.id === assignmentId);
      const sc = a && s.schedules.find((x) => x.id === a.scheduleId);
      if (!a || !sc) throw new ApiError('not_found', 'Designação não encontrada.');
      require('schedules.update', { type: 'ministry', id: sc.ministryId });
      s.assignments = s.assignments.filter((x) => x.id !== assignmentId);
      await delay(null);
    },
    async publishSchedule(scheduleId) {
      const sc = s.schedules.find((x) => x.id === scheduleId);
      if (!sc) throw new ApiError('not_found', 'Escala não encontrada.');
      require('schedules.update', { type: 'ministry', id: sc.ministryId });
      sc.status = 'published';
      s.assignments.filter((a) => a.scheduleId === scheduleId).forEach((a) => notifyAssignment(a, sc.title));
      await delay(null);
    },
    async listMyAssignments() {
      const u = me();
      return delay(s.assignments.filter((a) => a.userId === u).map((a) => {
        const sc = s.schedules.find((x) => x.id === a.scheduleId)!;
        return { ...a, fullName: name(u), schedule: scheduleView(sc) };
      }).filter((a) => a.schedule && s.schedules.find((x) => x.id === a.scheduleId)?.status === 'published')
        .sort((a, b) => a.schedule.startsAt.localeCompare(b.schedule.startsAt)));
    },
    async respondToAssignment(id, status, reason) {
      const u = me();
      const a = s.assignments.find((x) => x.id === id);
      if (!a || a.userId !== u) throw new ApiError('not_found', 'Designação não encontrada.');
      const sc = s.schedules.find((x) => x.id === a.scheduleId)!;
      a.status = status;
      a.declineReason = status === 'declined' ? (reason ?? '').slice(0, 280) : null;
      if (status === 'declined') notify(sc.createdBy, { category: 'schedule', title: `Recusa na escala: ${sc.title}`, body: 'Um integrante não poderá servir. Avalie substituição.', link: `/ministerios/${sc.ministryId}` }, `declined:${a.id}:${Date.now()}`);
      await delay(null);
    },

    async listCells() {
      const u = me();
      return delay(s.cells.map(({ address: _hidden, ...c }) => ({ ...c, isMember: isCellMember(u, c.id) })));
    },
    async getCell(_o, id) {
      const u = me();
      const c = s.cells.find((x) => x.id === id);
      if (!c) throw new ApiError('not_found', 'Célula não encontrada.');
      const member = isCellMember(u, id);
      const g = grantsOf(u);
      const leader = can(g, 'cells.manage_members', { type: 'cell', id });
      const meetingsVisible = member || can(g, 'cells.manage_meetings', { type: 'cell', id });
      const { address, ...rest } = c;
      return delay({
        ...rest, isMember: member,
        address: member || can(g, 'cells.view_sensitive', { type: 'cell', id }) ? address : null,
        members: member || leader ? s.cellMembers.filter((m) => m.cellId === id).map((m) => ({ userId: m.userId, fullName: name(m.userId), kind: m.kind })) : [],
        meetings: meetingsVisible ? s.meetings.filter((m) => m.cellId === id).map(({ cellId: _c, ...m }) => ({
          ...m, attendance: can(g, 'cells.manage_meetings', { type: 'cell', id }) ? m.attendance : m.attendance.filter((x) => x.userId === u),
        })) : [],
      });
    },
    async createCell(_o, input) {
      require('cells.create');
      const id = uid();
      s.cells.push({ id, ...input, regionLabel: input.regionLabel ?? '', description: input.description ?? '', address: '' });
      return delay(id);
    },
    async addCellMember(_o, cellId, userId) {
      require('cells.manage_members', { type: 'cell', id: cellId });
      if (isCellMember(userId, cellId)) throw new ApiError('conflict', 'Pessoa já participa da célula.');
      s.cellMembers.push({ cellId, userId, kind: 'participant' });
      await delay(null);
    },
    async createCellMeeting(_o, cellId, startsAt, topic) {
      require('cells.manage_meetings', { type: 'cell', id: cellId });
      s.meetings.push({ id: uid(), cellId, startsAt: new Date(startsAt).toISOString(), topic, status: 'scheduled', attendance: [] });
      await delay(null);
    },
    async recordAttendance(_o, meetingId, userId, present) {
      const m = s.meetings.find((x) => x.id === meetingId);
      if (!m) throw new ApiError('not_found', 'Encontro não encontrado.');
      require('cells.manage_meetings', { type: 'cell', id: m.cellId });
      m.attendance = m.attendance.filter((a) => a.userId !== userId).concat({ userId, present });
      m.status = 'held';
      await delay(null);
    },

    async listNotifications() {
      const u = me();
      return delay(s.notifications.filter((n) => n.userId === u).map(({ userId: _u, dedupe: _d, ...n }) => n));
    },
    async markNotificationsRead(orgId, ids) {
      if (orgId !== ORG_ID) throw new ApiError('permission_denied', 'Igreja indisponível.');
      const u = me();
      s.notifications.forEach((n) => { if (n.userId === u && !n.readAt && (!ids || ids.includes(n.id))) n.readAt = new Date().toISOString(); });
    },

    async searchMembers(_o, query) {
      const g = grantsOf(me());
      if (!g.some((x) => x.permissions.some((p) => p === 'ministries.manage_members' || p === 'cells.manage_members' || p === 'church.view_members'))) throw new ApiError('permission_denied', 'Você não tem permissão para pesquisar pessoas.');
      const q = query.trim().toLocaleLowerCase('pt-BR');
      if (q.length < 2) return [];
      return delay(s.profiles.filter((p) => p.fullName.toLocaleLowerCase('pt-BR').includes(q)).slice(0, 20).map((p) => ({ userId: p.id, fullName: p.fullName })));
    },
    async listMembers() {
      require('church.view_members');
      return delay(s.profiles.map((p) => ({ userId: p.id, fullName: p.fullName, status: 'active' as const, grants: grantsOf(p.id) })));
    },
    async listRoles() { me(); return delay(ROLES); },
    async grantRole(_o, userId, roleId, scopeType, scopeId) {
      require('church.manage_permissions');
      const role = ROLES.find((r) => r.id === roleId);
      if (!role) throw new ApiError('validation', 'Papel inválido.');
      if ((PERMS[role.key] ?? []).includes('church.manage_permissions') && !grantsOf(me()).some((g) => g.roleKey === 'church_owner')) throw new ApiError('permission_denied', 'Somente o responsável da igreja concede este papel.');
      if (s.grants.some((g) => !g.revoked && g.userId === userId && g.roleKey === role.key && g.scopeId === scopeId)) throw new ApiError('conflict', 'Papel já concedido.');
      s.grants.push({ id: uid(), userId, roleKey: role.key, scopeType, scopeId: scopeType === 'church' ? null : scopeId, revoked: false });
      await delay(null);
    },
    async revokeRole(assignmentId) {
      require('church.manage_permissions');
      const g = s.grants.find((x) => x.id === assignmentId);
      if (!g) throw new ApiError('not_found', 'Papel não encontrado.');
      if (g.roleKey === 'church_owner' && s.grants.filter((x) => x.roleKey === 'church_owner' && !x.revoked).length <= 1) throw new ApiError('conflict', 'A igreja precisa de ao menos um responsável.');
      g.revoked = true;
      await delay(null);
    },
    async createInvitation() {
      require('church.manage_members');
      throw new ApiError('validation', 'Convites reais exigem o backend configurado. No modo demonstração nenhum e-mail é enviado.');
    },
  };
  return api;
}
