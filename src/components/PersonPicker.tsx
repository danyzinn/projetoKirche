import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services';
import type { PersonRef } from '@/domain/types';
import { Input } from '@/components/ui/Field';

/** Busca de pessoas da igreja (mín. 2 letras). Não expõe o diretório inteiro. */
export function PersonPicker({ orgId, onPick, exclude = [], label = 'Buscar pessoa' }: { orgId: string; onPick: (p: PersonRef) => void; exclude?: string[]; label?: string }) {
  const [text, setText] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => { const t = setTimeout(() => setDebounced(text), 250); return () => clearTimeout(t); }, [text]);
  const q = useQuery({ queryKey: ['member-search', orgId, debounced], queryFn: () => api.searchMembers(orgId, debounced), enabled: debounced.trim().length >= 2 });
  const results = (q.data ?? []).filter((p) => !exclude.includes(p.userId));
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">
        {label}
        <Input className="mt-1.5" placeholder="Digite ao menos 2 letras do nome" value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      {q.error && <p role="alert" className="text-sm text-danger">{(q.error as Error).message}</p>}
      {debounced.trim().length >= 2 && !q.isLoading && results.length === 0 && !q.error && <p className="text-sm text-muted">Ninguém encontrado.</p>}
      {results.length > 0 && (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {results.map((p) => (
            <li key={p.userId}>
              <button type="button" className="flex min-h-[44px] w-full items-center px-3 text-left text-sm hover:bg-canvas" onClick={() => { onPick(p); setText(''); }}>
                {p.fullName}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
