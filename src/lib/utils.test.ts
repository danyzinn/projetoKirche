import { describe, expect, it } from 'vitest';
import { churchLocalToIso, formatBRL, formatDateTime, hexToRgbTriplet } from './utils';

describe('fuso da igreja', () => {
  it('interpreta horário digitado no fuso da igreja', () => {
    expect(churchLocalToIso('2030-05-01T19:30', 'America/Sao_Paulo')).toBe('2030-05-01T22:30:00.000Z');
    expect(churchLocalToIso('2030-05-01T19:30', 'Europe/Lisbon')).toBe('2030-05-01T18:30:00.000Z');
  });
  it('exibe no fuso da igreja em pt-BR', () => {
    expect(formatDateTime('2030-05-01T22:30:00.000Z', 'America/Sao_Paulo')).toContain('19:30');
  });
  it('rejeita data inválida', () => {
    expect(() => churchLocalToIso('abc')).toThrow();
  });
});

describe('formatação', () => {
  it('BRL com decimal exato', () => {
    expect(formatBRL('1234.5').replace(/\s/g, ' ')).toBe('R$ 1.234,50');
  });
  it('tokens de cor', () => {
    expect(hexToRgbTriplet('#B51227')).toBe('181 18 39');
    expect(hexToRgbTriplet('vermelho')).toBeNull();
  });
});
