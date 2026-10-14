import type {
  Announcement, AppNotification, Assignment, Cell, CellDetail, ChurchEvent, Ministry, MinistryMember,
  MemberRow, MyAssignment, PersonRef, OrgContextData, OrgSummary, Profile, RoleDefinition, Schedule, ScopeType, SessionUser,
} from '@/domain/types';
import type { AnnouncementInput, CellInput, EventInput, ProfileInput, ScheduleInput } from '@/domain/schemas';

export type ApiMode = 'supabase' | 'demo';

export class ApiError extends Error {
  constructor(
    public code: 'permission_denied' | 'not_found' | 'validation' | 'conflict' | 'not_authenticated' | 'unknown',
    message: string,
  ) {
    super(message);
  }
}

/**
 * Contrato único de dados. Implementações:
 *  - supabaseApi: real, autorização no banco (RLS/RPC)
 *  - demoApi: memória do navegador, dados fictícios, nada persistido
 * Um futuro app Expo pode reutilizar este contrato e os tipos de domínio.
 */
export interface KircheApi {
  mode: ApiMode;

  // Sessão
  getSessionUser(): Promise<SessionUser | null>;
  onAuthChange(cb: (user: SessionUser | null) => void): () => void;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string, fullName: string, invitationToken?: string): Promise<{ needsEmailConfirmation: boolean }>;
  signOut(): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  acceptInvitation(token: string): Promise<string>;

  // Contexto de igreja
  listMyOrganizations(): Promise<OrgSummary[]>;
  getOrgContext(orgId: string): Promise<OrgContextData>;

  // Perfil
  getMyProfile(): Promise<Profile>;
  updateMyProfile(input: ProfileInput): Promise<void>;

  // Avisos
  listAnnouncements(orgId: string): Promise<Announcement[]>;
  getAnnouncement(orgId: string, id: string): Promise<Announcement>;
  createAnnouncement(orgId: string, input: AnnouncementInput): Promise<string>;
  publishAnnouncement(id: string): Promise<void>;
  markAnnouncementRead(id: string): Promise<void>;
  audienceOptions(orgId: string): Promise<{ type: ScopeType; id: string | null; label: string }[]>;

  // Eventos
  listEvents(orgId: string): Promise<ChurchEvent[]>;
  getEvent(orgId: string, id: string): Promise<ChurchEvent>;
  createEvent(orgId: string, input: EventInput): Promise<string>;
  registerForEvent(eventId: string): Promise<void>;
  cancelRegistration(eventId: string): Promise<void>;

  // Ministérios e escalas
  listMinistries(orgId: string): Promise<Ministry[]>;
  getMinistry(orgId: string, id: string): Promise<Ministry>;
  listMinistryMembers(orgId: string, ministryId: string): Promise<MinistryMember[]>;
  addMinistryMember(orgId: string, ministryId: string, userId: string, positions: string[]): Promise<void>;
  removeMinistryMember(orgId: string, membershipId: string): Promise<void>;
  listSchedules(orgId: string, ministryId: string): Promise<Schedule[]>;
  createSchedule(orgId: string, input: ScheduleInput): Promise<string>;
  addAssignment(orgId: string, scheduleId: string, userId: string, position: string): Promise<void>;
  removeAssignment(orgId: string, assignmentId: string): Promise<void>;
  publishSchedule(scheduleId: string): Promise<void>;
  listMyAssignments(orgId: string): Promise<MyAssignment[]>;
  respondToAssignment(id: string, status: Exclude<Assignment['status'], 'pending'>, reason?: string): Promise<void>;

  // Células
  listCells(orgId: string): Promise<Cell[]>;
  getCell(orgId: string, id: string): Promise<CellDetail>;
  createCell(orgId: string, input: CellInput): Promise<string>;
  addCellMember(orgId: string, cellId: string, userId: string): Promise<void>;
  createCellMeeting(orgId: string, cellId: string, startsAt: string, topic: string): Promise<void>;
  recordAttendance(orgId: string, meetingId: string, userId: string, present: boolean): Promise<void>;

  // Notificações
  listNotifications(orgId: string): Promise<AppNotification[]>;
  markNotificationsRead(orgId: string, ids: string[] | null): Promise<void>;

  // Gestão de pessoas e permissões
  /** Busca mínima (id + nome) para líderes adicionarem pessoas, sem expor o diretório. */
  searchMembers(orgId: string, query: string): Promise<PersonRef[]>;
  listMembers(orgId: string): Promise<MemberRow[]>;
  listRoles(orgId: string): Promise<RoleDefinition[]>;
  grantRole(orgId: string, userId: string, roleId: string, scopeType: ScopeType, scopeId: string | null): Promise<void>;
  revokeRole(assignmentId: string): Promise<void>;
  createInvitation(orgId: string, email: string): Promise<string>;
}
