import { hasAnyManagement } from '@/domain/permissions';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/app/AuthProvider';
import { useCurrentOrg } from '@/app/OrgProvider';
import { profileInputSchema } from '@/domain/schemas';
import { api } from '@/services';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardTitle } from '@/components/ui/Card';
import { Field, Input } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorState, FormMessage, LoadingList } from '@/components/ui/States';

export function ProfilePage() {
  const { user, signOut } = useAuth();
  const { ctx } = useCurrentOrg();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['profile'], queryFn: api.getMyProfile });
  const [f, setF] = useState({ fullName: '', displayName: '', phone: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => { if (q.data) setF({ fullName: q.data.fullName, displayName: q.data.displayName ?? '', phone: q.data.phone ?? '' }); }, [q.data]);
  const save = useMutation({
    mutationFn: () => {
      const parsed = profileInputSchema.safeParse({ fullName: f.fullName, displayName: f.displayName || null, phone: f.phone || null });
      if (!parsed.success) { setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message]))); throw new Error('validation'); }
      setErrors({});
      return api.updateMyProfile(parsed.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
  });

  return (
    <div className="space-y-4">
      <PageHeader title="Perfil" subtitle={user?.email} />
      {hasAnyManagement(ctx.grants) && <Link to="/gestao" className="block rounded-xl bg-primary p-4 font-medium text-white">Minha Central de Gestão</Link>}
      {q.isLoading ? <LoadingList rows={1} /> : q.error ? <ErrorState error={q.error} /> : (
        <Card>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
            <CardTitle>Dados pessoais</CardTitle>
            {save.isSuccess && <FormMessage tone="success">Dados atualizados.</FormMessage>}
            {save.error && (save.error as Error).message !== 'validation' && <FormMessage tone="error">{(save.error as Error).message}</FormMessage>}
            <Field label="Nome completo" error={errors.fullName}>{(p) => <Input autoComplete="name" value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} {...p} />}</Field>
            <Field label="Como prefere ser chamado(a)" error={errors.displayName}>{(p) => <Input value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} {...p} />}</Field>
            <Field label="Telefone" error={errors.phone} hint="Visível apenas para você.">{(p) => <Input type="tel" autoComplete="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} {...p} />}</Field>
            <Button type="submit" loading={save.isPending}>Salvar</Button>
          </form>
        </Card>
      )}
      <Card>
        <CardTitle className="mb-2">Igreja vinculada</CardTitle>
        <p className="text-sm">{ctx.org.displayName}{ctx.org.isDemo && ' (demonstração)'}</p>

        <p className="mb-2 mt-4 text-sm font-medium">Minhas funções</p>
        <div className="flex flex-wrap gap-2">{ctx.grants.length ? ctx.grants.map((g) => <Badge key={g.id} tone="primary">{g.roleName}</Badge>) : <Badge>Membro</Badge>}</div>
      </Card>
      <Card>
        <CardTitle className="mb-2">Notificações e privacidade</CardTitle>
        <p className="text-sm text-muted">Você recebe avisos, escalas e eventos na central do app. Preferências de push: disponíveis após ativação do canal (planejado).</p>
        <Link className="mt-2 inline-block text-sm text-primary hover:underline" to="/privacidade">Aviso de privacidade</Link>
      </Card>
      <Button variant="secondary" className="w-full" onClick={signOut}><LogOut className="h-4 w-4" aria-hidden />Sair</Button>
    </div>
  );
}
