import { describe, expect, it } from 'vitest';
import { announcementInputSchema, eventInputSchema, profileInputSchema } from './schemas';

describe('announcementInputSchema', () => {
  it('exige público', () => {
    const r = announcementInputSchema.safeParse({ title: 'Título ok', body: 'x', audiences: [], publishNow: false });
    expect(r.success).toBe(false);
  });
  it('rejeita público inconsistente (igreja com id)', () => {
    const r = announcementInputSchema.safeParse({ title: 'Título ok', body: 'x', audiences: [{ type: 'church', id: '6f1c1f8e-7c43-4a42-9b55-6f0d2a1c1f8e' }], publishNow: true });
    expect(r.success).toBe(false);
  });
  it('aceita IDs do modo demonstração (UUID é validado no banco)', () => {
    expect(announcementInputSchema.safeParse({ title: 'Ensaio', body: 'x', audiences: [{ type: 'ministry', id: 'min-1' }], publishNow: false }).success).toBe(true);
  });
  it('aceita aviso válido', () => {
    expect(announcementInputSchema.safeParse({ title: 'Ensaio', body: 'Sábado', audiences: [{ type: 'church', id: null }], publishNow: true }).success).toBe(true);
  });
});

describe('eventInputSchema', () => {
  const base = { title: 'Conferência', startsAt: '2030-01-10T19:00', registrationEnabled: true, audience: { type: 'church', id: null } };
  it('término deve ser após início', () => {
    expect(eventInputSchema.safeParse({ ...base, endsAt: '2030-01-10T18:00' }).success).toBe(false);
  });
  it('vagas devem ser positivas', () => {
    expect(eventInputSchema.safeParse({ ...base, capacity: 0 }).success).toBe(false);
    expect(eventInputSchema.safeParse({ ...base, capacity: '20' }).success).toBe(true);
  });
});

describe('profileInputSchema', () => {
  it('rejeita telefone com letras', () => {
    expect(profileInputSchema.safeParse({ fullName: 'Ana', displayName: null, phone: 'abc' }).success).toBe(false);
  });
});
