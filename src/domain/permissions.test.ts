import { describe, expect, it } from 'vitest';
import { can, canAnywhere, canPublishTo, hasAnyManagement, visibleCentrals } from './permissions';
import type { Grant } from './types';

const g = (roleKey: string, scopeType: Grant['scopeType'], scopeId: string | null, permissions: Grant['permissions']): Grant =>
  ({ id: roleKey + scopeId, roleKey, roleName: roleKey, scopeType, scopeId, permissions });

const worshipLeader = [g('ministry_leader', 'ministry', 'louvor', ['schedules.create', 'schedules.update', 'announcements.create', 'announcements.publish', 'ministries.manage_members'])];
const admin = [g('church_admin', 'church', null, ['church.view_members', 'church.manage_members', 'announcements.publish', 'cells.create'])];
const treasurer = [g('treasurer', 'church', null, ['finance.view', 'finance.manage'])];

describe('can()', () => {
  it('nega por padrão quando não há grants', () => {
    expect(can([], 'church.view_members')).toBe(false);
    expect(canAnywhere([], 'announcements.create')).toBe(false);
  });
  it('grant de igreja cobre qualquer escopo', () => {
    expect(can(admin, 'announcements.publish')).toBe(true);
    expect(can(admin, 'announcements.publish', { type: 'ministry', id: 'qualquer' })).toBe(true);
  });
  it('grant de ministério vale só no ministério exato', () => {
    expect(can(worshipLeader, 'schedules.create', { type: 'ministry', id: 'louvor' })).toBe(true);
    expect(can(worshipLeader, 'schedules.create', { type: 'ministry', id: 'seguranca' })).toBe(false);
    expect(can(worshipLeader, 'schedules.create')).toBe(false); // sem escopo = igreja toda
    expect(can(worshipLeader, 'schedules.create', { type: 'cell', id: 'louvor' })).toBe(false); // tipo diferente
  });
  it('papéis são aditivos', () => {
    const both = [...worshipLeader, ...treasurer];
    expect(can(both, 'finance.view')).toBe(true);
    expect(can(both, 'schedules.create', { type: 'ministry', id: 'louvor' })).toBe(true);
  });
  it('admin genérico não recebe finanças automaticamente', () => {
    expect(can(admin, 'finance.view')).toBe(false);
  });
});

describe('canPublishTo()', () => {
  it('líder publica para o próprio ministério, não para a igreja toda', () => {
    expect(canPublishTo(worshipLeader, { type: 'ministry', id: 'louvor' })).toBe(true);
    expect(canPublishTo(worshipLeader, { type: 'church', id: null })).toBe(false);
  });
});

describe('centrais de gestão', () => {
  it('membro comum não vê central de gestão', () => {
    expect(hasAnyManagement([])).toBe(false);
  });
  it('mostra apenas centrais autorizadas', () => {
    const keys = visibleCentrals(worshipLeader).map((c) => c.key);
    expect(keys).toContain('services');
    expect(keys).toContain('communication');
    expect(keys).not.toContain('finance');
    expect(keys).not.toContain('admin');
  });
  it('tesouraria só aparece para quem tem finance.*', () => {
    expect(visibleCentrals(treasurer).map((c) => c.key)).toEqual(['finance']);
    expect(visibleCentrals(admin).map((c) => c.key)).not.toContain('finance');
  });
});
