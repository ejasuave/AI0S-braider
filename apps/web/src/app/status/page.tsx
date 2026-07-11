import { ApiStatus } from '@/features/system/ApiStatus';
import { PageHeader, PageShell } from '@/shared/ui/page-shell';

export default function StatusPage() {
  return (
    <PageShell className="pb-6">
      <PageHeader title="System status" subtitle="API and database connectivity." />
      <div className="mt-6">
        <ApiStatus />
      </div>
    </PageShell>
  );
}
