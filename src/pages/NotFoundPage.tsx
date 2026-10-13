import { Link } from 'react-router-dom';
import { EmptyState } from '@/components/ui/States';
import { Button } from '@/components/ui/Button';

export function NotFoundPage() {
  return <EmptyState title="Página não encontrada" description="O endereço pode ter mudado ou você não tem acesso." action={<Link to="/"><Button variant="secondary">Ir para o início</Button></Link>} />;
}
