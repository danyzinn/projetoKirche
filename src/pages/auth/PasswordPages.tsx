import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '@/services';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { FormMessage } from '@/components/ui/States';
import { AuthLayout } from './AuthLayout';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle');
  const [msg, setMsg] = useState('');
  return (
    <AuthLayout title="Recuperar senha" subtitle="Enviaremos um link para redefinir sua senha.">
      <form className="space-y-4" onSubmit={async (e) => {
        e.preventDefault();
        setState('loading');
        try { await api.requestPasswordReset(email.trim()); setState('sent'); }
        catch (err) { setMsg(err instanceof Error ? err.message : 'Erro'); setState('error'); }
      }}>
        {state === 'sent' && <FormMessage tone="success">Se o e-mail estiver cadastrado, você receberá o link em instantes.</FormMessage>}
        {state === 'error' && <FormMessage tone="error">{msg}</FormMessage>}
        <Field label="E-mail">{(p) => <Input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} {...p} />}</Field>
        <Button type="submit" className="w-full" loading={state === 'loading'}>Enviar link</Button>
        <p className="text-center text-sm"><Link className="text-primary hover:underline" to="/entrar">Voltar para entrar</Link></p>
      </form>
    </AuthLayout>
  );
}

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  return (
    <AuthLayout title="Definir nova senha">
      <form className="space-y-4" onSubmit={async (e) => {
        e.preventDefault();
        if (pw.length < 8) return setError('A senha precisa de ao menos 8 caracteres.');
        if (pw !== pw2) return setError('As senhas não coincidem.');
        setLoading(true);
        try { await api.updatePassword(pw); navigate('/', { replace: true }); }
        catch (err) { setError(err instanceof Error ? err.message : 'Erro'); }
        finally { setLoading(false); }
      }}>
        {error && <FormMessage tone="error">{error}</FormMessage>}
        <Field label="Nova senha">{(p) => <Input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} {...p} />}</Field>
        <Field label="Confirmar senha">{(p) => <Input type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} {...p} />}</Field>
        <Button type="submit" className="w-full" loading={loading}>Salvar senha</Button>
      </form>
    </AuthLayout>
  );
}
