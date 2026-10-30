import type { Metadata } from 'next';
import { EnablementDesk } from '@/features/enablement/EnablementDesk';
import { loadReports } from '@/features/enablement/reports';

export const metadata: Metadata = { title: 'Enablement desk · Ratenwerk' };
export const dynamic = 'force-dynamic';

export default async function EnablementPage() {
  return <EnablementDesk reports={await loadReports()} />;
}
