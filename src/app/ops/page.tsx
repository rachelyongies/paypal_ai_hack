'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Radio } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { api } from '@/components/session';
import { clock, money } from '@/components/format';
import { Pill, Spinner, Stat } from '@/components/ui';
import type { OpsRequest } from '@/components/client-types';
import type { PaymentRequest } from '@/lib/types';

const OpsGrid = dynamic(() => import('@/components/grid/OpsGrid'), { ssr: false, loading: () => <div className="flex h-40 items-center gap-2 text-ink-muted"><Spinner /> Loading grid…</div> });

type Webhook = { id: string; at: string; eventType: string; verified: boolean | 'skipped'; matchedRequestId?: string };

function Ops() {
  const [rows, setRows] = useState<OpsRequest[] | null>(null);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [live, setLive] = useState(false);
  const load = useCallback(async () => {
    const out = await api<{ requests: OpsRequest[]; webhooks: Webhook[] }>('/api/ops');
    setRows(out.requests);
    setWebhooks(out.webhooks);
  }, []);
  useEffect(() => {
    void load();
    const es = new EventSource('/api/ops/events');
    es.addEventListener('hello', () => setLive(true));
    es.addEventListener('request', (m) => {
      const r = JSON.parse((m as MessageEvent).data) as OpsRequest;
      setRows((prev) => {
        const list = prev ?? [];
        const i = list.findIndex((x) => x.id === r.id);
        if (i === -1) return [r, ...list];
        const copy = list.slice();
        copy[i] = r;
        return copy;
      });
    });
    es.addEventListener('webhook', () => void load());
    es.onerror = () => setLive(false);
    return () => es.close();
  }, [load]);

  const kpi = useMemo(() => {
    const list = rows ?? [];
    const paid = list.filter((r) => ['paid', 'partially_refunded', 'refunded'].includes(r.status));
    const blocked = list.filter((r) => r.verdict === 'block');
    const ms = list.filter((r) => r.decisionMs > 0).map((r) => r.decisionMs).sort((a, b) => a - b);
    const auto = paid.filter((r) => !r.approval).length;
    return {
      tpv: paid.reduce((s, r) => s + r.amount - (r.paypal?.refundedAmount ?? 0), 0),
      count: list.length,
      auto: paid.length ? Math.round((auto / paid.length) * 100) : 0,
      blockedValue: blocked.reduce((s, r) => s + r.amount, 0),
      blocked: blocked.length,
      median: ms.length ? ms[Math.floor(ms.length / 2)] : 0,
      injections: list.filter((r) => r.guardian?.signals.includes('prompt_injection')).length,
    };
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">PayPal internal view</p>
          <h1 className="text-[32px] font-bold tracking-[-0.03em]">Risk Ops</h1>
          <p className="max-w-2xl text-ink-muted">What PayPal&apos;s risk team would see: every agent-initiated payment across all Valet owners, the decision, and the reason. Labelled agent-fraud data that no one has today.</p>
        </div>
        <Pill tone={live ? 'ok' : 'muted'}>
          <Radio className={`h-3.5 w-3.5 ${live ? 'animate-pulseDot' : ''}`} /> {live ? 'Live' : 'Connecting'}
        </Pill>
      </div>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Agent TPV" value={money(kpi.tpv)} sub="net of refunds" />
        <Stat label="Requests" value={String(kpi.count)} />
        <Stat label="Auto-approved" value={`${kpi.auto}%`} sub="of paid purchases" />
        <Stat label="Blocked value" value={money(kpi.blockedValue)} sub={`${kpi.blocked} requests`} />
        <Stat label="Injections caught" value={String(kpi.injections)} />
        <Stat label="Median decision" value={kpi.median < 1000 ? `${kpi.median} ms` : `${(kpi.median / 1000).toFixed(1)} s`} />
      </div>
      {rows ? <OpsGrid rows={rows as unknown as PaymentRequest[]} /> : <div className="flex items-center gap-2 text-ink-muted"><Spinner /> Loading…</div>}
      <section className="card p-5">
        <div className="flex items-center justify-between">
          <p className="font-semibold">PayPal webhooks</p>
          <span className="text-xs text-ink-muted">Signature-verified via /v1/notifications/verify-webhook-signature</span>
        </div>
        {webhooks.length ? (
          <ul className="mt-3 divide-y divide-pp-line text-sm">
            {webhooks.slice(0, 10).map((w) => (
              <li key={`${w.id}-${w.at}`} className="flex items-center gap-3 py-2">
                <span className="w-24 tabular-nums text-ink-muted">{clock(w.at)}</span>
                <span className="font-mono text-[12.5px]">{w.eventType}</span>
                <span className="ml-auto">
                  <Pill tone={w.verified === true ? 'ok' : w.verified === false ? 'no' : 'muted'}>{w.verified === true ? 'Verified' : w.verified === false ? 'Rejected' : 'Not verified'}</Pill>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-ink-muted">No webhooks yet. Register {'<your-url>'}/api/webhooks/paypal in the PayPal developer dashboard.</p>
        )}
      </section>
    </div>
  );
}

export default function OpsPage() {
  return (
    <Shell wide>
      <Ops />
    </Shell>
  );
}
