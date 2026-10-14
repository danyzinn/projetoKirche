import { describe, it, expect } from 'vitest';
import { church, enabledModules } from './church';
describe('configuração da instalação', () => {
  it('não habilita módulos ausentes no servidor', () => {
    expect(enabledModules([])).toEqual([]);
    expect(enabledModules(['events', 'unknown'])).toEqual(church.modules.includes('events') ? ['events'] : []);
  });
});
