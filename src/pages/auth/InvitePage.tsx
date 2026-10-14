import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/services';
import { useAuth } from '@/app/AuthProvider';
import { useOrg } from '@/app/OrgProvider';
import { Button } from '@/components/ui/Button';
import { FormMessage } from '@/components/ui/States';
import { AuthLayout } from './AuthLayout';

/**
 * Aceite de convite. A pessoa entra (ou cria conta pelo link de convite do Supabase)
 * com o MESMO e-mail convidado; o vínculo é feito pela RPC accept_invitation.
 */
export function InvitePage() {
  const { token = '' } = useParams();
  const { user } = useAuth();
  const { selectOrg } = useOrg();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!user) {
    return (
      <AuthLayout title="Você recebeu um convite" subtitle="Entre com o e-mail que recebeu o convite para continuar.">
        <Link to="/entrar" state={{ from: `/convite/${token}` }} className="block rounded-xl bg-primary p-3 text-center font-medium text-white">Entrar para aceitar</Link>
        <Link to={`/criar-conta?convite=${encodeURIComponent(token)}`} className="mt-4 block text-center text-sm text-primary">Ainda não tenho conta</Link>
      </AuthLayout>
    );
  }
  return (
    <AuthLayout title="Aceitar convite" subtitle={`Conectado como ${user.email}`}>
      {error && <div className="mb-4"><FormMessage tone="error">{error}</FormMessage></div>}
      <Button className="w-full" loading={loading} onClick={async () => {
        setLoading(true); setError(null);
        try {
          const orgId = await api.acceptInvitation(token);
          await qc.invalidateQueries({ queryKey: ['orgs'] });
          selectOrg(orgId);
          navigate('/', { replace: true });
        } catch (e) { setError(e instanceof Error ? e.message : 'Erro'); }
        finally { setLoading(false); }
      }}>Aceitar e entrar na igreja</Button>
    </AuthLayout>
  );
}
