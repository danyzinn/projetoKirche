import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { ChevronRight } from 'lucide-react';
import { api } from '@/services';
import { DEMO_PROFILES } from '@/services/demoApi';
import { loginSchema } from '@/domain/schemas';
import { useAuth } from '@/app/AuthProvider';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { FormMessage } from '@/components/ui/States';
import { AuthLayout } from './AuthLayout';

export function LoginPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';
  const [error, setError] = useState<string | null>(null);
  const [demoLoading, setDemoLoading] = useState<string | null>(null);
  const form = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });

  if (user) return <Navigate to={from} replace />;

  if (api.mode === 'demo') {
    return (
      <AuthLayout title="Explorar demonstração" subtitle="Backend ainda não configurado. Escolha um perfil fictício para navegar — não é um login real.">
        <ul className="space-y-2">
          {DEMO_PROFILES.map((p) => (
            <li key={p.id}>
              <button
                className="flex w-full items-center gap-3 rounded-xl border border-line p-3 text-left hover:border-primary/40 hover:bg-primary-soft/40 disabled:opacity-60"
                disabled={!!demoLoading}
                onClick={async () => {
                  setDemoLoading(p.id);
                  await api.signIn(p.email, 'demo');
                  navigate(from, { replace: true });
                }}
              >
                <span className="flex-1">
                  <span className="block text-sm font-semibold">{p.label}</span>
                  <span className="block text-xs text-muted">{p.fullName} · {p.hint}</span>
                </span>
                <ChevronRight className="h-4 w-4 text-muted" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted">Para autenticação real, configure o Supabase (veja o README).</p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Entrar" subtitle="Use o e-mail cadastrado pela igreja ou aceite seu convite.">
      <form
        noValidate
        className="space-y-4"
        onSubmit={form.handleSubmit(async (v) => {
          setError(null);
          try {
            await api.signIn(v.email, v.password);
            navigate(from, { replace: true });
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Falha ao entrar.');
          }
        })}
      >
        {error && <FormMessage tone="error">{error}</FormMessage>}
        <Field label="E-mail" error={form.formState.errors.email?.message}>
          {(p) => <Input type="email" autoComplete="email" inputMode="email" {...p} {...form.register('email')} />}
        </Field>
        <Field label="Senha" error={form.formState.errors.password?.message}>
          {(p) => <Input type="password" autoComplete="current-password" {...p} {...form.register('password')} />}
        </Field>
        <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>Entrar</Button>
        <p className="text-center text-sm"><Link className="text-primary hover:underline" to="/recuperar-senha">Esqueci minha senha</Link></p>
        <p className="text-center text-sm"><Link className="text-primary hover:underline" to={from.startsWith('/convite/') ? `/criar-conta?convite=${encodeURIComponent(from.slice(9))}` : '/criar-conta'}>Criar conta</Link></p>
      </form>
    </AuthLayout>
  );
}
