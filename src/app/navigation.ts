export function sectionForPath(path: string) {
  if (/^\/(agenda|eventos|escalas)(\/|$)/.test(path)) return '/agenda';
  if (/^\/(comunidade|grupos|ministerios|celulas)(\/|$)/.test(path)) return '/comunidade';
  if (/^\/(perfil|gestao)(\/|$)/.test(path)) return '/perfil';
  return '/';
}
