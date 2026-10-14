import configuration from '../../config/church.json';

/** Identidade pública desta instalação. Nunca colocar segredos neste arquivo. */
export const church = configuration;
export const MODULES = ['announcements', 'events', 'ministries', 'schedules', 'cells', 'notifications'] as const;
export type ModuleKey = typeof MODULES[number];
export function enabledModules(serverModules: string[]): ModuleKey[] {
  return MODULES.filter((key) => church.modules.includes(key) && serverModules.includes(key));
}
