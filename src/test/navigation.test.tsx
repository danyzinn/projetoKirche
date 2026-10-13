import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes, Providers, createQueryClient } from '@/App';
import { api } from '@/services';

function renderApp(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Providers client={createQueryClient()}><AppRoutes /></Providers>
    </MemoryRouter>,
  );
}

describe('interface por perfil (modo demonstração)', () => {
  beforeEach(async () => { await api.signOut(); });

  it('sem backend, a tela de acesso deixa claro que é demonstração', async () => {
    renderApp('/');
    expect(await screen.findByText('Explorar demonstração')).toBeInTheDocument();
    expect(screen.getAllByText(/MODO DEMONSTRAÇÃO/).length).toBeGreaterThan(0);
  });

  it('membro comum não vê a Central de Gestão', async () => {
    renderApp('/');
    await userEvent.click(await screen.findByRole('button', { name: /Membro/ }));
    expect(await screen.findByText('Avisos recentes')).toBeInTheDocument();
    expect(screen.queryByText('Minha Central de Gestão')).not.toBeInTheDocument();
  });

  it('líder vê a Central de Gestão apenas com centrais autorizadas', async () => {
    renderApp('/');
    await userEvent.click(await screen.findByRole('button', { name: /Líder de Louvor/ }));
    const links = await screen.findAllByRole('link', { name: /Minha Central de Gestão/ });
    await userEvent.click(links[0]);
    expect(await screen.findByText('Cultos e Produção')).toBeInTheDocument();
    expect(screen.getByText('Comunicação e Avisos')).toBeInTheDocument();
    expect(screen.queryByText('Financeiro e Tesouraria')).not.toBeInTheDocument();
    expect(screen.queryByText('Administração e Secretaria')).not.toBeInTheDocument();
  });

  it('membro que acessa URL de gestão diretamente recebe acesso restrito', async () => {
    renderApp('/gestao/membros');
    await userEvent.click(await screen.findByRole('button', { name: /Membro/ }));
    expect(await screen.findByText('Acesso restrito')).toBeInTheDocument();
  });

  it('administração vê todas as centrais liberadas, exceto finanças', async () => {
    renderApp('/gestao');
    await userEvent.click(await screen.findByRole('button', { name: /Administração/ }));
    expect(await screen.findByText('Administração e Secretaria')).toBeInTheDocument();
    expect(screen.getByText('Gestão de Células')).toBeInTheDocument();
    expect(screen.queryByText('Financeiro e Tesouraria')).not.toBeInTheDocument();
  });
});
