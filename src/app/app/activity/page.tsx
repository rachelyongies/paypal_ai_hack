'use client';

import dynamic from 'next/dynamic';
import { Shell } from '@/components/Shell';
import { useActivity } from '@/components/useActivity';
import { money } from '@/components/format';
import { PageHeader, Spinner, Stat } from '@/components/ui';

const ActivityGrid = dynamic(() => import('@/components/grid/ActivityGrid'), { ssr: false, loading: () => <div className="flex h-40 items-center gap-2 text-ink-muted"><Spinner /> Loading grid…</div> });

function Activity() {
  const { requests } = useActivity();
  const rows = requests ?? [];
  const paid = rows.filter((r) => r.status === 'paid' || r.status === 'partially_refunded');
  const refunded = rows.reduce((s, r) => s + (r.paypal?.refundedAmount ?? 0), 0);
  return (
    <div className="space-y-6">
      <PageHeader title="Activity" sub="Every request your agents made, what Valet decided, and why. Open a row for the full trail, refunds and evidence." />
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Paid by agents" value={money(paid.reduce((s, r) => s + r.amount, 0))} sub={`${paid.length} purchases`} />
        <Stat label="Waiting on you" value={String(rows.filter((r) => r.status === 'pending_approval').length)} />
        <Stat label="Blocked" tone="no" value={String(rows.filter((r) => r.status === 'blocked').length)} sub={money(rows.filter((r) => r.status === 'blocked').reduce((s, r) => s + r.amount, 0)) + ' stopped'} />
        <Stat label="Refunded" tone="blue" value={money(refunded)} />
      </div>
      {requests ? <ActivityGrid rows={rows} /> : <div className="flex items-center gap-2 text-ink-muted"><Spinner /> Loading…</div>}
    </div>
  );
}

export default function ActivityPage() {
  return (
    <Shell wide>
      <Activity />
    </Shell>
  );
}
