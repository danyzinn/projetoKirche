import { Navigate, useNavigate } from 'react-router-dom';
import { Building2, ChevronRight } from 'lucide-react';
import { useAuth } from '@/app/AuthProvider';
import { useOrg } from '@/app/OrgProvider';
import { Button } from '@/components/ui/Button';
import { LoadingList } from '@/components/ui/States';
import { AuthLayout } from './AuthLayout';

export function SelectOrgPage() {
  const { organizations, orgsLoading, selectOrg } = useOrg();
  const navigate = useNavigate();
  if (orgsLoading) return <AuthLayout title="Selecione a igreja"><LoadingList rows={2} /></AuthLayout>;
  if (!organizations?.length) return <Navigate to="/sem-igreja" replace />;
  return (
    <AuthLayout title="Selecione a igreja" subtitle="Você participa de mais de uma igreja.">
      <ul className="space-y-2">
        {organizations.map((o) => (
          <li key={o.id}>
            <button onClick={() => { selectOrg(o.id); navigate('/', { replace: true }); }}
              className="flex w-full items-center gap-3 rounded-xl border border-line p-3 text-left hover:bg-canvas">
              <Building2 className="h-5 w-5 text-primary" aria-hidden />
              <span className="flex-1 text-sm font-medium">{o.displayName}{o.isDemo && ' (demonstração)'}</span>
              <ChevronRight className="h-4 w-4 text-muted" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </AuthLayout>
  );
}

export function NoOrgPage() {
  const { signOut, user } = useAuth();
  return (
    <AuthLayout title="Nenhuma igreja vinculada" subtitle={`A conta ${user?.email ?? ''} ainda não foi vinculada a uma igreja. Peça um convite à secretaria.`}>
      <Button variant="secondary" className="w-full" onClick={signOut}>Sair</Button>
    </AuthLayout>
  );
}

export function PrivacyPage() {
  return (
    <AuthLayout title="Aviso de privacidade (rascunho)">
      <div className="space-y-3 text-sm text-muted">
        <p><strong className="text-ink">Rascunho técnico — pendente de revisão jurídica e aprovação da igreja.</strong></p>
        <p>Tratamos dados pessoais para gestão da vida da igreja (cadastro, ministérios, escalas, eventos, células e comunicação). Dados sobre convicção religiosa são sensíveis e têm acesso restrito por função.</p>
        <p>Endereços de células, pedidos de oração, dados de crianças e informações financeiras nunca são públicos. Notificações push só são enviadas com sua permissão.</p>
        <p>Você pode solicitar acesso, correção ou exclusão dos seus dados à secretaria. Controlador e encarregado serão definidos com a assessoria jurídica da igreja.</p>
      </div>
    </AuthLayout>
  );
}
