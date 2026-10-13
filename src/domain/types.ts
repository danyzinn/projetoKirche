// Tipos de domínio compartilhados pela web e, no futuro, por um app Expo.
// Não dependem de React nem do Supabase.

export type ScopeType = 'church' | 'congregation' | 'ministry' | 'cell';

export type PermissionKey =
  | 'church.view_members'
  | 'church.manage_members'
  | 'church.manage_permissions'
  | 'church.manage_settings'
  | 'church.view_sensitive'
  | 'church.audit'
  | 'ministries.create'
  | 'ministries.update'
  | 'ministries.manage_members'
  | 'schedules.create'
  | 'schedules.update'
  | 'schedules.delete'
  | 'announcements.create'
  | 'announcements.publish'
  | 'announcements.approve'
  | 'announcements.update'
  | 'events.create'
  | 'events.update'
  | 'events.manage_registrations'
  | 'cells.create'
  | 'cells.update'
  | 'cells.manage_members'
  | 'cells.manage_meetings'
  | 'cells.view_sensitive'
  | 'finance.view'
  | 'finance.manage';

export interface Grant {
  id: string;
  roleKey: string;
  roleName: string;
  scopeType: ScopeType;
  scopeId: string | null;
  permissions: PermissionKey[];
}

export interface ThemeTokens {
  primary: string;
  primaryHover: string;
  primarySoft: string;
}

export interface Branding {
  appName: string;
  logoUrl: string | null;
  poweredBy: string;
  theme: Partial<ThemeTokens>;
}

export interface OrgSummary {
  id: string;
  slug: string;
  displayName: string;
  isDemo: boolean;
}

export interface OrgContextData {
  org: OrgSummary & { timezone: string; locale: string };
  branding: Branding;
  modules: string[];
  grants: Grant[];
  myMinistryIds: string[];
  myCellIds: string[];
}

export interface SessionUser {
  id: string;
  email: string;
}

export interface Profile {
  id: string;
  fullName: string;
  displayName: string | null;
  phone: string | null;
}

export interface Audience {
  type: ScopeType;
  id: string | null;
  label?: string;
}

export type AnnouncementStatus = 'draft' | 'published' | 'archived';

export interface Announcement {
  id: string;
  title: string;
  body: string;
  status: AnnouncementStatus;
  publishedAt: string | null;
  authorId: string | null;
  authorName: string | null;
  audiences: Audience[];
  isRead: boolean;
}

export interface ChurchEvent {
  id: string;
  title: string;
  description: string;
  locationLabel: string;
  startsAt: string;
  endsAt: string | null;
  capacity: number | null;
  registrationEnabled: boolean;
  status: 'draft' | 'published' | 'cancelled';
  registeredCount: number;
  isRegistered: boolean;
  audience: Audience;
}

export type MinistryKind =
  | 'worship' | 'media' | 'layout' | 'reception' | 'teaching' | 'children' | 'youth'
  | 'social' | 'intercession_men' | 'intercession_women' | 'security' | 'other';

export interface Ministry {
  id: string;
  name: string;
  kind: MinistryKind;
  description: string;
  isMember: boolean;
}

export interface PersonRef {
  userId: string;
  fullName: string;
}

export interface MinistryMember extends PersonRef {
  id: string;
  positions: string[];
}

export type AssignmentStatus = 'pending' | 'confirmed' | 'declined';

export interface Assignment extends PersonRef {
  id: string;
  scheduleId: string;
  position: string;
  status: AssignmentStatus;
  declineReason: string | null;
}

export interface Schedule {
  id: string;
  ministryId: string;
  ministryName: string;
  title: string;
  startsAt: string;
  notes: string;
  status: 'draft' | 'published' | 'cancelled';
  assignments: Assignment[];
}

export interface MyAssignment extends Assignment {
  schedule: Pick<Schedule, 'id' | 'title' | 'startsAt' | 'ministryId' | 'ministryName'>;
}

export interface Cell {
  id: string;
  name: string;
  regionLabel: string;
  meetingWeekday: number | null;
  meetingTime: string | null;
  description: string;
  isMember: boolean;
}

export interface CellMeeting {
  id: string;
  startsAt: string;
  topic: string;
  status: 'scheduled' | 'held' | 'cancelled';
  attendance: { userId: string; present: boolean }[];
}

export interface CellDetail extends Cell {
  address: string | null; // null = sem permissão para ver
  members: (PersonRef & { kind: string })[];
  meetings: CellMeeting[];
}

export interface AppNotification {
  id: string;
  category: 'announcement' | 'schedule' | 'event' | 'cell' | 'system';
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface RoleDefinition {
  id: string;
  key: string;
  name: string;
  defaultScope: ScopeType;
}

export interface MemberRow extends PersonRef {
  status: 'active' | 'suspended' | 'removed';
  grants: Grant[];
}
