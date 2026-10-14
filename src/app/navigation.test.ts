import { describe, it, expect } from 'vitest';
import { sectionForPath } from './navigation';
describe('seção ativa', () => {
  it.each([['/eventos/123', '/agenda'], ['/escalas', '/agenda'], ['/ministerios/123', '/comunidade'], ['/celulas/123', '/comunidade'], ['/gestao/membros', '/perfil'], ['/avisos/123', '/']])('%s pertence a %s', (path, section) => {
    expect(sectionForPath(path)).toBe(section);
  });
});
