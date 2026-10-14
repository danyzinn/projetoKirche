import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseApi } from './supabaseApi';

describe('contrato do adapter real', () => {
  it.each([null, { user: { id: 'new-user' } }])('cadastro preserva convite e informa necessidade de confirmação', async (session) => {
    const signUp = vi.fn().mockResolvedValue({ data: { session }, error: null });
    const api = createSupabaseApi({ auth: { signUp } } as unknown as SupabaseClient);
    const result = await api.signUp('new@example.test', 'password123', 'Nova Pessoa', 'token-convite');
    expect(result.needsEmailConfirmation).toBe(!session);
    expect(signUp).toHaveBeenCalledWith({ email: 'new@example.test', password: 'password123', options: {
      data: { full_name: 'Nova Pessoa' }, emailRedirectTo: `${window.location.origin}/convite/token-convite`,
    } });
  });
  it('não apresenta sucesso quando o cadastro falha', async () => {
    const api = createSupabaseApi({ auth: { signUp: vi.fn().mockResolvedValue({ data: {}, error: { message: 'internal detail' } }) } } as unknown as SupabaseClient);
    await expect(api.signUp('new@example.test', 'password123', 'Nome')).rejects.toThrow('Não foi possível criar a conta');
  });
  it('marca notificações explicitamente na igreja atual', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 1, error: null });
    await createSupabaseApi({ rpc } as unknown as SupabaseClient).markNotificationsRead('church-a', null);
    expect(rpc).toHaveBeenCalledWith('mark_notifications_read', { p_org: 'church-a', p_ids: null });
  });
});
