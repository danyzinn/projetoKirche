import { church } from '@/config/church';
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { can, canAnywhere } from '@/domain/permissions';
import type {
  Announcement, Audience, ChurchEvent, Grant, MinistryKind, PermissionKey, ScopeType,
} from '@/domain/types';
import { ApiError, type KircheApi } from './api';

const ERROR_MESSAGES: Record<string, string> = {
  event_full: 'Vagas esgotadas.',
  registration_closed: 'Inscrições encerradas para este evento.',
  event_started: 'O evento já começou.',
  invalid_or_expired_invitation: 'Convite inválido, já utilizado ou expirado.',
  invitation_email_mismatch: 'Este convite foi enviado para outro e-mail.',
  assignee_not_in_ministry: 'A pessoa precisa integrar o ministério.',
  target_not_member: 'A pessoa não é membro ativo da igreja.',
  last_owner: 'A igreja precisa de ao menos um responsável.',
  audience_required: 'Selecione ao menos um público.',
  schedule_not_published: 'A escala ainda não foi publicada.',
  not_a_draft: 'O aviso não é mais um rascunho.',
  invalid_scope: 'Escopo inválido para esta igreja.',
};

function fail(error: PostgrestError | { message: string; code?: string } | null): never {
  const msg = error?.message ?? 'Erro desconhecido';
  const key = Object.keys(ERROR_MESSAGES).find((k) => msg.includes(k));
  if (key) throw new ApiError(key === 'event_full' || key === 'last_owner' ? 'conflict' : 'validation', ERROR_MESSAGES[key]);
  if (error?.code === '42501' || msg.includes('permission_denied') || msg.includes('row-level security'))
    throw new ApiError('permission_denied', 'Você não tem permissão para esta ação.');
  if (error?.code === 'P0002' || error?.code === 'PGRST116' || msg.includes('not_found'))
    throw new ApiError('not_found', 'Registro não encontrado ou sem acesso.');
  if (error?.code === '23505') throw new ApiError('conflict', 'Este registro já existe.');
  // Não vaza detalhes internos ao usuário final.
  console.error('[api]', error?.code ?? 'unknown');
  throw new ApiError('unknown', 'Não foi possível concluir a operação. Tente novamente.');
}

// Erro → ApiError; sucesso → dado. Linhas ficam sem tipo até gerarmos os tipos do
// banco (`supabase gen types typescript`) — ver docs/ROADMAP.md. O mapeamento para
// tipos de domínio acontece explicitamente em cada método abaixo.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Rec = { [column: string]: any };
type Row = Rec[] & Rec;
function unwrap<T = Row>(res: { data: unknown; error: PostgrestError | null }): T {
  if (res.error) fail(res.error);
  return res.data as T;
}

type RoleRow = { key: string; name: string; role_permissions: { permission_key: PermissionKey }[] };
type GrantRow = { id: string; user_id?: string; scope_type: ScopeType; scope_id: string | null; role: RoleRow | null };
const toGrant = (r: GrantRow): Grant => ({
  id: r.id, roleKey: r.role?.key ?? '', roleName: r.role?.name ?? '', scopeType: r.scope_type, scopeId: r.scope_id,
  permissions: (r.role?.role_permissions ?? []).map((p) => p.permission_key),
});
const GRANT_SELECT = 'id, user_id, scope_type, scope_id, role:role_definitions(key, name, role_permissions(permission_key))';

export function createSupabaseApi(sb: SupabaseClient): KircheApi {
  const me = async () => {
    const { data } = await sb.auth.getSession();
    const id = data.session?.user.id;
    if (!id) throw new ApiError('not_authenticated', 'Sessão expirada. Entre novamente.');
    return id;
  };

  const names = async (ids: (string | null)[]) => {
    const uniq = [...new Set(ids.filter((x): x is string => !!x))];
    if (!uniq.length) return new Map<string, string>();
    const rows = unwrap(await sb.from('profiles').select('id, full_name, display_name').in('id', uniq));
    return new Map<string, string>(rows.map((r) => [r.id as string, (r.display_name || r.full_name || 'Pessoa') as string]));
  };

  const myGrants = async (orgId: string) => {
    const uid = await me();
    const rows = unwrap(await sb.from('user_role_assignments').select(GRANT_SELECT)
      .eq('organization_id', orgId).eq('user_id', uid).is('revoked_at', null));
    return (rows as unknown as GrantRow[]).map(toGrant);
  };

  const scopeLabels = async (orgId: string) => {
    const [m, c] = await Promise.all([
      sb.from('ministries').select('id, name').eq('organization_id', orgId),
      sb.from('cells').select('id, name').eq('organization_id', orgId),
    ]);
    return new Map<string, string>([...(unwrap(m) ?? []), ...(unwrap(c) ?? [])].map((r) => [r.id as string, r.name as string]));
  };
  const labelFor = (labels: Map<string, string>, a: Audience) =>
    a.type === 'church' ? 'Toda a igreja' : labels.get(a.id ?? '') ?? (a.type === 'congregation' ? 'Congregação' : 'Grupo');

  type AnnRow = { id: string; title: string; body: string; status: Announcement['status']; published_at: string | null; author_id: string | null; announcement_audiences: { audience_type: ScopeType; audience_id: string | null }[] };
  const mapAnnouncements = async (orgId: string, rows: AnnRow[]): Promise<Announcement[]> => {
    const uid = await me();
    const ids = rows.map((r) => r.id);
    const [authors, labels, reads] = await Promise.all([
      names(rows.map((r) => r.author_id)),
      scopeLabels(orgId),
      ids.length ? sb.from('announcement_reads').select('announcement_id').eq('user_id', uid).in('announcement_id', ids) : Promise.resolve({ data: [], error: null }),
    ]);
    const readSet = new Set((unwrap(reads) ?? []).map((r) => r.announcement_id as string));
    return rows.map((r) => ({
      id: r.id, title: r.title, body: r.body, status: r.status, publishedAt: r.published_at, authorId: r.author_id,
      authorName: r.author_id ? authors.get(r.author_id) ?? null : null, isRead: readSet.has(r.id),
      audiences: r.announcement_audiences.map((a) => {
        const au: Audience = { type: a.audience_type, id: a.audience_id };
        return { ...au, label: labelFor(labels, au) };
      }),
    }));
  };
  const ANN_SELECT = 'id, title, body, status, published_at, author_id, announcement_audiences(audience_type, audience_id)';

  type EvRow = { id: string; title: string; description: string; location_label: string; starts_at: string; ends_at: string | null; capacity: number | null; registration_enabled: boolean; status: ChurchEvent['status']; audience_type: ScopeType; audience_id: string | null };
  const mapEvents = async (orgId: string, rows: EvRow[]): Promise<ChurchEvent[]> => {
    const uid = await me();
    const ids = rows.map((r) => r.id);
    const [mine, labels, counts] = await Promise.all([
      ids.length ? sb.from('event_registrations').select('event_id').eq('user_id', uid).eq('status', 'registered').in('event_id', ids) : Promise.resolve({ data: [], error: null }),
      scopeLabels(orgId),
      Promise.all(rows.map((r) => (r.capacity ? sb.rpc('event_registered_count', { p_event: r.id }) : Promise.resolve({ data: 0, error: null })))),
    ]);
    const mineSet = new Set((unwrap(mine) ?? []).map((r) => r.event_id as string));
    return rows.map((r, i) => {
      const audience: Audience = { type: r.audience_type, id: r.audience_id };
      return {
        id: r.id, title: r.title, description: r.description, locationLabel: r.location_label, startsAt: r.starts_at, endsAt: r.ends_at,
        capacity: r.capacity, registrationEnabled: r.registration_enabled, status: r.status,
        registeredCount: (counts[i].data as number) ?? 0, isRegistered: mineSet.has(r.id),
        audience: { ...audience, label: labelFor(labels, audience) },
      };
    });
  };

  type SchedRow = { id: string; ministry_id: string; title: string; starts_at: string; notes: string; status: 'draft' | 'published' | 'cancelled'; ministry: { name: string } | null; schedule_assignments: { id: string; user_id: string; position: string; status: 'pending' | 'confirmed' | 'declined'; decline_reason: string | null }[] };

  const api: KircheApi = {
    mode: 'supabase',

    async getSessionUser() {
      const { data } = await sb.auth.getSession();
      const u = data.session?.user;
      return u ? { id: u.id, email: u.email ?? '' } : null;
    },
    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange((_e, session) =>
        cb(session?.user ? { id: session.user.id, email: session.user.email ?? '' } : null));
      return () => data.subscription.unsubscribe();
    },
    async signIn(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw new ApiError('validation', 'E-mail ou senha incorretos.');
    },
    async signUp(email, password, fullName, invitationToken) {
      const destination = invitationToken ? `/convite/${encodeURIComponent(invitationToken)}` : '/';
      const { data, error } = await sb.auth.signUp({ email, password, options: {
        data: { full_name: fullName }, emailRedirectTo: `${window.location.origin}${destination}`,
      } });
      if (error) throw new ApiError('validation', 'Não foi possível criar a conta. Confira os dados e tente novamente.');
      return { needsEmailConfirmation: !data.session };
    },
    async signOut() { await sb.auth.signOut(); },
    async requestPasswordReset(email) {
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/redefinir-senha` });
      if (error) throw new ApiError('unknown', 'Não foi possível enviar o e-mail agora.');
    },
    async updatePassword(password) {
      const { error } = await sb.auth.updateUser({ password });
      if (error) throw new ApiError('validation', 'Não foi possível atualizar a senha.');
    },
    async acceptInvitation(token) {
      return unwrap(await sb.rpc('accept_invitation', { p_token: token })) as string;
    },

    async listMyOrganizations() {
      const rows = unwrap(await sb.from('organizations').select('id, slug, display_name, is_demo').eq('slug', church.slug).order('display_name'));
      return rows.map((r) => ({ id: r.id, slug: r.slug, displayName: r.display_name, isDemo: r.is_demo }));
    },
    async getOrgContext(orgId) {
      const uid = await me();
      const [org, branding, modules, grants, mins, cells] = await Promise.all([
        sb.from('organizations').select('id, slug, display_name, is_demo, timezone, locale').eq('id', orgId).single(),
        sb.from('organization_branding').select('app_name, logo_url, powered_by_label, theme_tokens').eq('organization_id', orgId).maybeSingle(),
        sb.from('organization_modules').select('module_key').eq('organization_id', orgId).eq('enabled', true),
        myGrants(orgId),
        sb.from('ministry_memberships').select('ministry_id').eq('organization_id', orgId).eq('user_id', uid).eq('status', 'active'),
        sb.from('cell_memberships').select('cell_id').eq('organization_id', orgId).eq('user_id', uid).eq('status', 'active'),
      ]);
      const o = unwrap(org);
      const b = branding.error ? fail(branding.error) : branding.data;
      return {
        org: { id: o.id, slug: o.slug, displayName: o.display_name, isDemo: o.is_demo, timezone: o.timezone, locale: o.locale },
        branding: { appName: b?.app_name ?? o.display_name, logoUrl: b?.logo_url ?? null, poweredBy: b?.powered_by_label ?? 'Tecnologia Kirche', theme: b?.theme_tokens ?? {} },
        modules: unwrap(modules).map((m) => m.module_key),
        grants,
        myMinistryIds: unwrap(mins).map((m) => m.ministry_id),
        myCellIds: unwrap(cells).map((m) => m.cell_id),
      };
    },

    async getMyProfile() {
      const r = unwrap(await sb.rpc('get_my_profile').single()) as { id: string; full_name: string; display_name: string | null; phone: string | null };
      return { id: r.id, fullName: r.full_name, displayName: r.display_name, phone: r.phone };
    },
    async updateMyProfile(input) {
      const uid = await me();
      unwrap(await sb.from('profiles').update({ full_name: input.fullName, display_name: input.displayName || null, phone: input.phone || null }).eq('id', uid).select('id').single());
    },

    async listAnnouncements(orgId) {
      const rows = unwrap(await sb.from('announcements').select(ANN_SELECT).eq('organization_id', orgId)
        .neq('status', 'archived').order('published_at', { ascending: false, nullsFirst: true }).limit(100));
      return mapAnnouncements(orgId, rows as unknown as AnnRow[]);
    },
    async getAnnouncement(orgId, id) {
      const row = unwrap(await sb.from('announcements').select(ANN_SELECT).eq('id', id).eq('organization_id', orgId).single());
      return (await mapAnnouncements(orgId, [row as unknown as AnnRow]))[0];
    },
    async createAnnouncement(orgId, input) {
      const uid = await me();
      const ann = unwrap(await sb.from('announcements').insert({ organization_id: orgId, title: input.title, body: input.body, author_id: uid }).select('id').single());
      const aud = await sb.from('announcement_audiences').insert(input.audiences.map((a) => ({
        announcement_id: ann.id, organization_id: orgId, audience_type: a.type, audience_id: a.id })));
      if (aud.error) { await sb.from('announcements').delete().eq('id', ann.id); fail(aud.error); }
      if (input.publishNow) await api.publishAnnouncement(ann.id);
      return ann.id as string;
    },
    async publishAnnouncement(id) { unwrap(await sb.rpc('publish_announcement', { p_id: id })); },
    async markAnnouncementRead(id) { unwrap(await sb.rpc('mark_announcement_read', { p_id: id })); },
    async audienceOptions(orgId) {
      const [grants, mins, cells] = await Promise.all([
        myGrants(orgId),
        sb.from('ministries').select('id, name').eq('organization_id', orgId).eq('is_active', true).order('name'),
        sb.from('cells').select('id, name').eq('organization_id', orgId).order('name'),
      ]);
      const opts: { type: ScopeType; id: string | null; label: string }[] = [];
      if (can(grants, 'announcements.create')) opts.push({ type: 'church', id: null, label: 'Toda a igreja' });
      unwrap(mins).forEach((m) => { if (can(grants, 'announcements.create', { type: 'ministry', id: m.id })) opts.push({ type: 'ministry', id: m.id, label: m.name }); });
      unwrap(cells).forEach((c) => { if (can(grants, 'announcements.create', { type: 'cell', id: c.id })) opts.push({ type: 'cell', id: c.id, label: c.name }); });
      return opts;
    },

    async listEvents(orgId) {
      const rows = unwrap(await sb.from('events').select('*').eq('organization_id', orgId).neq('status', 'draft')
        .gte('starts_at', new Date(Date.now() - 86_400_000).toISOString()).order('starts_at').limit(100));
      return mapEvents(orgId, rows as EvRow[]);
    },
    async getEvent(orgId, id) {
      const row = unwrap(await sb.from('events').select('*').eq('id', id).eq('organization_id', orgId).single());
      return (await mapEvents(orgId, [row as unknown as EvRow]))[0];
    },
    async createEvent(orgId, input) {
      const uid = await me();
      const row = unwrap(await sb.from('events').insert({
        organization_id: orgId, title: input.title, description: input.description ?? '', location_label: input.locationLabel ?? '',
        starts_at: new Date(input.startsAt).toISOString(), ends_at: input.endsAt ? new Date(input.endsAt).toISOString() : null,
        capacity: input.capacity ?? null, registration_enabled: input.registrationEnabled,
        audience_type: input.audience.type, audience_id: input.audience.id, created_by: uid,
      }).select('id').single());
      return row.id as string;
    },
    async registerForEvent(eventId) { unwrap(await sb.rpc('register_for_event', { p_event: eventId })); },
    async cancelRegistration(eventId) { unwrap(await sb.rpc('cancel_event_registration', { p_event: eventId })); },

    async listMinistries(orgId) {
      const uid = await me();
      const [rows, mine] = await Promise.all([
        sb.from('ministries').select('id, name, kind, description').eq('organization_id', orgId).eq('is_active', true).order('name'),
        sb.from('ministry_memberships').select('ministry_id').eq('user_id', uid).eq('organization_id', orgId).eq('status', 'active'),
      ]);
      const set = new Set(unwrap(mine).map((m) => m.ministry_id));
      return unwrap(rows).map((m) => ({ id: m.id, name: m.name, kind: m.kind as MinistryKind, description: m.description, isMember: set.has(m.id) }));
    },
    async getMinistry(orgId, id) {
      const all = await api.listMinistries(orgId);
      const m = all.find((x) => x.id === id);
      if (!m) throw new ApiError('not_found', 'Ministério não encontrado.');
      return m;
    },
    async listMinistryMembers(orgId, ministryId) {
      const rows = unwrap(await sb.from('ministry_memberships').select('id, user_id, positions')
        .eq('organization_id', orgId).eq('ministry_id', ministryId).eq('status', 'active'));
      const n = await names(rows.map((r) => r.user_id));
      return rows.map((r) => ({ id: r.id, userId: r.user_id, fullName: n.get(r.user_id) ?? 'Pessoa', positions: r.positions ?? [] }))
        .sort((a, b) => a.fullName.localeCompare(b.fullName, 'pt-BR'));
    },
    async addMinistryMember(orgId, ministryId, userId, positions) {
      unwrap(await sb.from('ministry_memberships').insert({ organization_id: orgId, ministry_id: ministryId, user_id: userId, positions }));
    },
    async removeMinistryMember(orgId, membershipId) {
      const r = await sb.from('ministry_memberships').delete().eq('id', membershipId).eq('organization_id', orgId).select('id');
      if (!unwrap(r).length) throw new ApiError('permission_denied', 'Você não tem permissão para esta ação.');
    },
    async listSchedules(orgId, ministryId) {
      const rows = unwrap(await sb.from('schedules')
        .select('id, ministry_id, title, starts_at, notes, status, ministry:ministries(name), schedule_assignments(id, user_id, position, status, decline_reason)')
        .eq('organization_id', orgId).eq('ministry_id', ministryId).order('starts_at')) as unknown as SchedRow[];
      const n = await names(rows.flatMap((r) => r.schedule_assignments.map((a) => a.user_id)));
      return rows.map((r) => ({
        id: r.id, ministryId: r.ministry_id, ministryName: r.ministry?.name ?? '', title: r.title, startsAt: r.starts_at, notes: r.notes, status: r.status,
        assignments: r.schedule_assignments.map((a) => ({ id: a.id, scheduleId: r.id, userId: a.user_id, fullName: n.get(a.user_id) ?? 'Pessoa', position: a.position, status: a.status, declineReason: a.decline_reason })),
      }));
    },
    async createSchedule(orgId, input) {
      const uid = await me();
      const row = unwrap(await sb.from('schedules').insert({ organization_id: orgId, ministry_id: input.ministryId, title: input.title, starts_at: new Date(input.startsAt).toISOString(), notes: input.notes ?? '', created_by: uid }).select('id').single());
      return row.id as string;
    },
    async addAssignment(orgId, scheduleId, userId, position) {
      unwrap(await sb.from('schedule_assignments').insert({ organization_id: orgId, schedule_id: scheduleId, user_id: userId, position }));
    },
    async removeAssignment(orgId, assignmentId) {
      const r = await sb.from('schedule_assignments').delete().eq('id', assignmentId).eq('organization_id', orgId).select('id');
      if (!unwrap(r).length) throw new ApiError('permission_denied', 'Você não tem permissão para esta ação.');
    },
    async publishSchedule(scheduleId) { unwrap(await sb.rpc('publish_schedule', { p_schedule: scheduleId })); },
    async listMyAssignments(orgId) {
      const uid = await me();
      type Row = { id: string; schedule_id: string; position: string; status: 'pending' | 'confirmed' | 'declined'; decline_reason: string | null; schedule: { id: string; title: string; starts_at: string; ministry_id: string; status: string; ministry: { name: string } | null } | null };
      const rows = unwrap(await sb.from('schedule_assignments')
        .select('id, schedule_id, position, status, decline_reason, schedule:schedules(id, title, starts_at, ministry_id, status, ministry:ministries(name))')
        .eq('organization_id', orgId).eq('user_id', uid)) as unknown as Row[];
      return rows.filter((r) => r.schedule && r.schedule.status === 'published').map((r) => ({
        id: r.id, scheduleId: r.schedule_id, userId: uid, fullName: '', position: r.position, status: r.status, declineReason: r.decline_reason,
        schedule: { id: r.schedule!.id, title: r.schedule!.title, startsAt: r.schedule!.starts_at, ministryId: r.schedule!.ministry_id, ministryName: r.schedule!.ministry?.name ?? '' },
      })).sort((a, b) => a.schedule.startsAt.localeCompare(b.schedule.startsAt));
    },
    async respondToAssignment(id, status, reason) {
      unwrap(await sb.rpc('respond_to_assignment', { p_assignment: id, p_status: status, p_reason: reason ?? null }));
    },

    async listCells(orgId) {
      const uid = await me();
      const [rows, mine] = await Promise.all([
        sb.from('cells').select('id, name, region_label, meeting_weekday, meeting_time, description').eq('organization_id', orgId).eq('status', 'active').order('name'),
        sb.from('cell_memberships').select('cell_id').eq('organization_id', orgId).eq('user_id', uid).eq('status', 'active'),
      ]);
      const set = new Set(unwrap(mine).map((m) => m.cell_id));
      return unwrap(rows).map((c) => ({ id: c.id, name: c.name, regionLabel: c.region_label, meetingWeekday: c.meeting_weekday, meetingTime: c.meeting_time?.slice(0, 5) ?? null, description: c.description, isMember: set.has(c.id) }));
    },
    async getCell(orgId, id) {
      const uid = await me();
      const [cell, priv, members, meetings] = await Promise.all([
        sb.from('cells').select('id, name, region_label, meeting_weekday, meeting_time, description').eq('id', id).eq('organization_id', orgId).single(),
        sb.from('cell_private_details').select('address').eq('cell_id', id).maybeSingle(),
        sb.from('cell_memberships').select('user_id, kind').eq('cell_id', id).eq('status', 'active'),
        sb.from('cell_meetings').select('id, starts_at, topic, status, cell_attendance(user_id, present)').eq('cell_id', id).order('starts_at', { ascending: false }).limit(20),
      ]);
      const c = unwrap(cell);
      const m = unwrap(members);
      const n = await names(m.map((x) => x.user_id));
      return {
        id: c.id, name: c.name, regionLabel: c.region_label, meetingWeekday: c.meeting_weekday, meetingTime: c.meeting_time?.slice(0, 5) ?? null, description: c.description,
        isMember: m.some((x) => x.user_id === uid),
        address: (priv.error ? fail(priv.error) : priv.data)?.address ?? null,
        members: m.map((x) => ({ userId: x.user_id, fullName: n.get(x.user_id) ?? 'Pessoa', kind: x.kind })),
        meetings: unwrap(meetings).map((mt) => ({
          id: mt.id, startsAt: mt.starts_at, topic: mt.topic, status: mt.status,
          attendance: (mt.cell_attendance ?? []).filter((a: { user_id: string | null }) => a.user_id).map((a: { user_id: string; present: boolean }) => ({ userId: a.user_id, present: a.present })),
        })),
      };
    },
    async createCell(orgId, input) {
      const uid = await me();
      const row = unwrap(await sb.from('cells').insert({ organization_id: orgId, name: input.name, region_label: input.regionLabel ?? '', meeting_weekday: input.meetingWeekday, meeting_time: input.meetingTime, description: input.description ?? '', created_by: uid }).select('id').single());
      return row.id as string;
    },
    async addCellMember(orgId, cellId, userId) {
      unwrap(await sb.from('cell_memberships').insert({ organization_id: orgId, cell_id: cellId, user_id: userId }));
    },
    async createCellMeeting(orgId, cellId, startsAt, topic) {
      const uid = await me();
      unwrap(await sb.from('cell_meetings').insert({ organization_id: orgId, cell_id: cellId, starts_at: new Date(startsAt).toISOString(), topic, created_by: uid }));
    },
    async recordAttendance(orgId, meetingId, userId, present) {
      const uid = await me();
      unwrap(await sb.from('cell_attendance').upsert({ organization_id: orgId, meeting_id: meetingId, user_id: userId, present, recorded_by: uid }, { onConflict: 'meeting_id,user_id' }));
      await sb.from('cell_meetings').update({ status: 'held' }).eq('id', meetingId);
    },

    async listNotifications(orgId) {
      const rows = unwrap(await sb.from('notifications').select('id, category, title, body, link, read_at, created_at')
        .eq('organization_id', orgId).order('created_at', { ascending: false }).limit(100));
      return rows.map((r) => ({ id: r.id, category: r.category, title: r.title, body: r.body, link: r.link, readAt: r.read_at, createdAt: r.created_at }));
    },
    async markNotificationsRead(orgId, ids) { unwrap(await sb.rpc('mark_notifications_read', { p_org: orgId, p_ids: ids })); },

    async searchMembers(orgId, query) {
      if (query.trim().length < 2) return [];
      const rows = unwrap(await sb.rpc('search_members', { p_org: orgId, p_query: query })) as { user_id: string; full_name: string }[];
      return rows.map((r) => ({ userId: r.user_id, fullName: r.full_name }));
    },
    async listMembers(orgId) {
      const grants = await myGrants(orgId);
      if (!canAnywhere(grants, 'church.view_members')) throw new ApiError('permission_denied', 'Você não tem acesso ao diretório.');
      const [members, assignments] = await Promise.all([
        sb.from('organization_memberships').select('user_id, status').eq('organization_id', orgId).neq('status', 'removed'),
        sb.from('user_role_assignments').select(GRANT_SELECT).eq('organization_id', orgId).is('revoked_at', null),
      ]);
      const m = unwrap(members);
      const a = unwrap(assignments) as unknown as GrantRow[];
      const n = await names(m.map((x) => x.user_id));
      return m.map((x) => ({
        userId: x.user_id, fullName: n.get(x.user_id) ?? 'Pessoa', status: x.status,
        grants: a.filter((g) => g.user_id === x.user_id).map(toGrant),
      })).sort((p, q) => p.fullName.localeCompare(q.fullName, 'pt-BR'));
    },
    async listRoles(orgId) {
      const rows = unwrap(await sb.from('role_definitions').select('id, key, name, default_scope')
        .or(`organization_id.is.null,organization_id.eq.${orgId}`).not('key', 'in', '(member,visitor)').order('name'));
      return rows.map((r) => ({ id: r.id, key: r.key, name: r.name, defaultScope: r.default_scope }));
    },
    async grantRole(orgId, userId, roleId, scopeType, scopeId) {
      unwrap(await sb.rpc('grant_role', { p_org: orgId, p_user: userId, p_role: roleId, p_scope_type: scopeType, p_scope_id: scopeId }));
    },
    async revokeRole(assignmentId) { unwrap(await sb.rpc('revoke_role', { p_assignment: assignmentId })); },
    async createInvitation(orgId, email) {
      const token = unwrap(await sb.rpc('create_invitation', { p_org: orgId, p_email: email })) as string;
      return `${window.location.origin}/convite/${token}`;
    },
  };
  return api;
}
