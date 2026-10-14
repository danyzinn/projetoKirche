import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { loginSchema } from '@/domain/schemas';
import { api } from '@/services';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { FormMessage } from '@/components/ui/States';
import { AuthLayout } from './AuthLayout';

const schema = loginSchema.extend({ fullName: z.string().trim().min(2, 'Informe seu nome').max(120) });
export function SignUpPage() {
  const [params] = useSearchParams();
  const token = params.get('convite') ?? undefined;
  const from = token ? `/convite/${encodeURIComponent(token)}` : '/';
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  return <AuthLayout title="Criar conta" subtitle="Use o mesmo e-mail que recebeu o convite da igreja.">
    {api.mode === 'demo' ? <FormMessage tone="success">Na demonstração, use os perfis fictícios na tela de entrada.</FormMessage> : sent ? <FormMessage tone="success">Confira seu e-mail para confirmar a conta. Depois, volte ao convite para concluir seu vínculo com a igreja.</FormMessage> :
      <form noValidate className="space-y-4" onSubmit={form.handleSubmit(async (v) => {
        setError(null);
        try {
          const result = await api.signUp(v.email, v.password, v.fullName, token);
          if (result.needsEmailConfirmation) setSent(true); else navigate(from, { replace: true });
        } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível criar sua conta.'); }
      })}>
        {error && <FormMessage tone="error">{error}</FormMessage>}
        <Field label="Nome completo" error={form.formState.errors.fullName?.message}>{(p) => <Input autoComplete="name" {...p} {...form.register('fullName')} />}</Field>
        <Field label="E-mail" error={form.formState.errors.email?.message}>{(p) => <Input type="email" autoComplete="email" {...p} {...form.register('email')} />}</Field>
        <Field label="Senha" error={form.formState.errors.password?.message}>{(p) => <Input type="password" autoComplete="new-password" {...p} {...form.register('password')} />}</Field>
        <p className="text-sm text-muted">Criar uma conta não libera acesso aos dados da igreja. O vínculo depende de um convite válido.</p>
        <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>Criar conta</Button>
      </form>}
    <Link to="/entrar" state={{ from }} className="mt-4 block text-center text-sm text-primary">Já tenho conta — entrar</Link>
  </AuthLayout>;
}
