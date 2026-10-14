import { useCurrentOrg } from '@/app/OrgProvider';
import { EventsPage } from './EventsPages';
import { MySchedulesPage } from './MySchedulesPage';
export function AgendaPage() {
  const { ctx } = useCurrentOrg();
  return ctx.modules.includes('events') ? <EventsPage /> : <MySchedulesPage />;
}
