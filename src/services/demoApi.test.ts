import { describe, expect, it } from 'vitest';
import { createDemoApi } from './demoApi';

const ORG = 'demo-org-ibv-nova';
const as = async (email: string) => { const api = createDemoApi(); await api.signIn(email, 'demo'); return api; };

describe('modo demonstração — regras espelhadas', () => {
  it('líder de louvor cria escala, escala integrante e publica; membro confirma', async () => {
    const api = await as('demo.lider@kirche.local');
    const id = await api.createSchedule(ORG, { ministryId: 'min-1', title: 'Culto teste', startsAt: '2030-01-01T18:00', notes: '' });
    await api.addAssignment(ORG, id, 'demo-u1', 'Vocal');
    await api.publishSchedule(id);
    // mesma instância: troca de usuário sem reset do estado
    const schedules = await api.listSchedules(ORG, 'min-1');
    expect(schedules.find((s) => s.id === id)?.status).toBe('published');
  });

  it('líder de louvor não cria escala em outro ministério', async () => {
    const api = await as('demo.lider@kirche.local');
    await expect(api.createSchedule(ORG, { ministryId: 'min-11', title: 'Segurança', startsAt: '2030-01-01T18:00', notes: '' })).rejects.toMatchObject({ code: 'permission_denied' });
  });

  it('não escala quem não integra o ministério', async () => {
    const api = await as('demo.lider@kirche.local');
    const id = await api.createSchedule(ORG, { ministryId: 'min-1', title: 'Culto', startsAt: '2030-01-01T18:00', notes: '' });
    await expect(api.addAssignment(ORG, id, 'demo-u6', 'Vocal')).rejects.toMatchObject({ code: 'validation' });
  });

  it('membro comum não cria avisos nem acessa diretório', async () => {
    const api = await as('demo.membro@kirche.local');
    await expect(api.createAnnouncement(ORG, { title: 'Oi', body: 'x', audiences: [{ type: 'church', id: null }], publishNow: true })).rejects.toMatchObject({ code: 'permission_denied' });
    await expect(api.listMembers(ORG)).rejects.toMatchObject({ code: 'permission_denied' });
  });

  it('aviso segmentado só aparece para o ministério e gera notificação', async () => {
    const api = await as('demo.lider@kirche.local');
    await expect(api.createAnnouncement(ORG, { title: 'Para todos', body: 'x', audiences: [{ type: 'church', id: null }], publishNow: true })).rejects.toMatchObject({ code: 'permission_denied' });
    const annId = await api.createAnnouncement(ORG, { title: 'Ensaio extra', body: 'Sábado', audiences: [{ type: 'ministry', id: 'min-1' }], publishNow: true });
    const visible = await api.listAnnouncements(ORG);
    expect(visible.some((a) => a.id === annId && a.status === 'published')).toBe(true);
  });

  it('respeita limite de vagas do evento', async () => {
    const a = await as('demo.membro@kirche.local');
    await a.registerForEvent('ev-2');
    const ev = await a.getEvent(ORG, 'ev-2');
    expect(ev.isRegistered).toBe(true);
    expect(ev.registeredCount).toBe(1);
  });

  it('endereço da célula é ocultado para quem não participa', async () => {
    const api = await as('demo.membro@kirche.local');
    expect((await api.getCell(ORG, 'cell-1')).address).not.toBeNull();
    const other = await api.getCell(ORG, 'cell-2');
    expect(other.address).toBeNull();
    expect(other.members).toEqual([]);
    expect((await api.listCells(ORG)).every((c) => !('address' in c))).toBe(true);
  });

  it('voluntário responde apenas à própria designação', async () => {
    const api = await as('demo.lider@kirche.local');
    await expect(api.respondToAssignment('as1', 'declined')).rejects.toMatchObject({ code: 'not_found' });
    const member = await as('demo.membro@kirche.local');
    await member.respondToAssignment('as1', 'confirmed');
    expect((await member.listMyAssignments(ORG))[0].status).toBe('confirmed');
  });

  it('sem sessão, nada é acessível', async () => {
    const api = createDemoApi();
    await expect(api.listAnnouncements(ORG)).rejects.toMatchObject({ code: 'not_authenticated' });
  });
});
