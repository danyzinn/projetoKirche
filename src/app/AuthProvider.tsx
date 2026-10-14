import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/services';
import type { SessionUser } from '@/domain/types';

interface AuthState {
  user: SessionUser | null;
  loading: boolean;
  error: unknown;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const qc = useQueryClient();
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let active = true;
    api.getSessionUser().then((u) => { if (active) { setUser(u); setLoading(false); } }).catch((err: unknown) => { if (active) { setError(err); setLoading(false); } });
    const off = api.onAuthChange((u) => {
      setError(null);
      setUser((prev) => {
        if (prev?.id !== u?.id) qc.clear(); // nunca reaproveitar cache entre contas
        return u;
      });
      setLoading(false);
    });
    return () => { active = false; off(); };
  }, [qc]);

  const signOut = async () => {
    await api.signOut();
    qc.clear();
    try { localStorage.removeItem('kirche.currentOrg'); } catch { /* armazenamento indisponível */ }
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, loading, error, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fora do AuthProvider');
  return ctx;
}
