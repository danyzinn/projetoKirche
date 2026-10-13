import { FlaskConical } from 'lucide-react';
import { api } from '@/services';

/** Sempre visível no modo demonstração: dados fictícios e não persistidos. */
export function DemoBanner() {
  if (api.mode !== 'demo') return null;
  return (
    <div role="note" className="flex items-center justify-center gap-2 bg-warning/15 px-4 py-2 text-center text-xs font-medium text-ink">
      <FlaskConical className="h-4 w-4 shrink-0 text-warning" aria-hidden />
      MODO DEMONSTRAÇÃO — dados fictícios, nada é salvo. Ao recarregar ou sair, tudo volta ao estado inicial.
    </div>
  );
}
