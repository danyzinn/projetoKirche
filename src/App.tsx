import { SignUpPage } from '@/pages/auth/SignUpPage';
import { ModuleRoute } from '@/app/ModuleRoute';
import { AgendaPage } from '@/pages/AgendaPage';
import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/app/AuthProvider';
import { OrgProvider } from '@/app/OrgProvider';
import { RequireAuth, RequireOrg } from '@/app/guards';
import { AppShell } from '@/components/layout/AppShell';
import { LoadingList } from '@/components/ui/States';
import { LoginPage } from '@/pages/auth/LoginPage';
import { ForgotPasswordPage, ResetPasswordPage } from '@/pages/auth/PasswordPages';
import { InvitePage } from '@/pages/auth/InvitePage';
import { NoOrgPage, PrivacyPage, SelectOrgPage } from '@/pages/auth/OrgPages';
import { HomePage } from '@/pages/HomePage';
import { AnnouncementDetailPage, AnnouncementsPage, NewAnnouncementPage } from '@/pages/AnnouncementsPages';
import { EventDetailPage, NewEventPage } from '@/pages/EventsPages';
import { GroupsPage } from '@/pages/GroupsPage';
import { MinistryPage } from '@/pages/MinistryPage';
import { MySchedulesPage } from '@/pages/MySchedulesPage';
import { CellPage } from '@/pages/CellPage';
import { NotificationsPage } from '@/pages/NotificationsPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { NotFoundPage } from '@/pages/NotFoundPage';

// Área de gestão carregada sob demanda (membros comuns não baixam esse código).
const ManagementHome = lazy(() => import('@/pages/management/ManagementHome').then((m) => ({ default: m.ManagementHome })));
const MembersPage = lazy(() => import('@/pages/management/MembersPage').then((m) => ({ default: m.MembersPage })));
const ManageMinistriesPage = lazy(() => import('@/pages/management/ManageGroupsPages').then((m) => ({ default: m.ManageMinistriesPage })));
const ManageCellsPage = lazy(() => import('@/pages/management/ManageGroupsPages').then((m) => ({ default: m.ManageCellsPage })));

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: (count, err) => count < 2 && !(err instanceof Error && 'code' in err && ['permission_denied', 'not_found'].includes((err as { code: string }).code)) },
    },
  });
}

const queryClient = createQueryClient();

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/criar-conta" element={<SignUpPage />} />
      <Route path="/entrar" element={<LoginPage />} />
      <Route path="/recuperar-senha" element={<ForgotPasswordPage />} />
      <Route path="/redefinir-senha" element={<RequireAuth><ResetPasswordPage /></RequireAuth>} />
      <Route path="/convite/:token" element={<InvitePage />} />
      <Route path="/privacidade" element={<PrivacyPage />} />
      <Route path="/selecionar-igreja" element={<RequireAuth><SelectOrgPage /></RequireAuth>} />
      <Route path="/sem-igreja" element={<RequireAuth><NoOrgPage /></RequireAuth>} />
      <Route element={<RequireAuth><RequireOrg><AppShell /></RequireOrg></RequireAuth>}>
        <Route index element={<HomePage />} />
        <Route path="avisos" element={<ModuleRoute modules={['announcements']}><AnnouncementsPage /></ModuleRoute>} />
        <Route path="avisos/novo" element={<ModuleRoute modules={['announcements']}><NewAnnouncementPage /></ModuleRoute>} />
        <Route path="avisos/:id" element={<ModuleRoute modules={['announcements']}><AnnouncementDetailPage /></ModuleRoute>} />
        <Route path="eventos" element={<Navigate to="/agenda" replace />} />
        <Route path="agenda" element={<ModuleRoute modules={['events', 'schedules']}><AgendaPage /></ModuleRoute>} />
        <Route path="eventos/novo" element={<ModuleRoute modules={['events']}><NewEventPage /></ModuleRoute>} />
        <Route path="eventos/:id" element={<ModuleRoute modules={['events']}><EventDetailPage /></ModuleRoute>} />
        <Route path="grupos" element={<Navigate to="/comunidade" replace />} />
        <Route path="comunidade" element={<ModuleRoute modules={['ministries', 'cells']}><GroupsPage /></ModuleRoute>} />
        <Route path="ministerios/:id" element={<ModuleRoute modules={['ministries']}><MinistryPage /></ModuleRoute>} />
        <Route path="escalas" element={<ModuleRoute modules={['schedules']}><MySchedulesPage /></ModuleRoute>} />
        <Route path="celulas/:id" element={<ModuleRoute modules={['cells']}><CellPage /></ModuleRoute>} />
        <Route path="notificacoes" element={<ModuleRoute modules={['notifications']}><NotificationsPage /></ModuleRoute>} />
        <Route path="perfil" element={<ProfilePage />} />
        <Route path="gestao" element={<Suspense fallback={<LoadingList />}><ManagementHome /></Suspense>} />
        <Route path="gestao/membros" element={<Suspense fallback={<LoadingList />}><MembersPage /></Suspense>} />
        <Route path="gestao/ministerios" element={<Suspense fallback={<LoadingList />}><ModuleRoute modules={['ministries']}><ManageMinistriesPage /></ModuleRoute></Suspense>} />
        <Route path="gestao/celulas" element={<Suspense fallback={<LoadingList />}><ModuleRoute modules={['cells']}><ManageCellsPage /></ModuleRoute></Suspense>} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export function Providers({ children, client = queryClient }: { children: React.ReactNode; client?: QueryClient }) {
  return (
    <QueryClientProvider client={client}>
      <AuthProvider>
        <OrgProvider>{children}</OrgProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Providers><AppRoutes /></Providers>
    </BrowserRouter>
  );
}
