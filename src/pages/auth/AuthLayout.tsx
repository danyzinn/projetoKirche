import type { ReactNode } from 'react';
import { DemoBanner } from '@/components/layout/DemoBanner';

/** Tela de acesso. Nome exibido vem do tenant padrão; logo oficial ainda não fornecido. */
export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-canvas">
      <DemoBanner />
      <div className="mx-auto flex max-w-md flex-col px-4 py-10">
        <div className="mb-8 flex flex-col items-center text-center">
          <span aria-hidden className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-primary text-base font-bold text-white shadow-card">IBV</span>
          <p className="text-xl font-semibold tracking-tight">IBV Nova</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-6 shadow-card">
          <h1 className="text-lg font-semibold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
          <div className="mt-5">{children}</div>
        </div>
        <p className="mt-6 text-center text-xs text-muted">
          Seus dados são tratados apenas para a gestão da igreja, com acesso restrito por função.
          {' '}<a className="underline" href="/privacidade">Aviso de privacidade</a>
        </p>
        <p className="mt-2 text-center text-[11px] text-muted">Tecnologia Kirche</p>
      </div>
    </div>
  );
}
