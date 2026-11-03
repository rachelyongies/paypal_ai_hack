'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import type { PaymentRequest } from '@/lib/types';
import { ItemsList, GuardianLine } from '@/components/RequestCards';
import { api } from '@/components/session';
import { money } from '@/components/format';
import { Logo, Pill, Spinner } from '@/components/ui';

// Phone-first approval card: what the PayPal app's push notification would open.
export default function ApprovePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ k?: string }> }) {
  const { id } = use(params);
  const { k } = use(searchParams);
  const [r, setR] = useState<PaymentRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'approve' | 'decline' | null>(null);

  const load = useCallback(async () => {
    try {
      const out = await api<{ request: PaymentRequest }>(`/api/requests/${id}${k ? `?k=${encodeURIComponent(k)}` : ''}`);
      setR(out.request);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [id, k]);

  useEffect(() => {
    void load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [load]);

  const act = async (decision: 'approve' | 'decline') => {
    setBusy(decision);
    try {
      const out = await api<{ request: PaymentRequest }>(`/api/requests/${id}/decision`, { json: { decision, via: 'phone', k } });
      setR(out.request);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-pp-surface">
      <div className="mx-auto max-w-md px-4 pb-10 pt-6">
        <div className="flex items-center justify-between">
          <Logo size="sm" href="/app" />
          <Pill tone="blue">Approval</Pill>
        </div>
        {!r && !error ? (
          <div className="mt-24 flex justify-center text-ink-muted">
            <Spinner className="h-6 w-6" />
          </div>
        ) : null}
        {error && !r ? <div className="card mt-10 p-6 text-center text-no">{error}</div> : null}
        {r ? (
          <div className="card mt-6 overflow-hidden">
            <div className="p-6">
              <p className="eyebrow">{r.agentName} wants to pay</p>
              <p className="mt-2 text-[44px] font-bold leading-none tracking-[-0.04em]">{money(r.amount)}</p>
              <p className="mt-2 text-ink-muted">
                {r.merchant.name} · <span className="font-mono text-[13px]">{r.merchant.domain}</span>
              </p>
              <div className="mt-5">
                <ItemsList r={r} />
              </div>
              <div className="mt-5 rounded-tile bg-ask-bg px-4 py-3 text-[15px] text-ask">{r.reason}</div>
              {r.guardian && r.guardian.ownerExplanation !== r.reason ? <p className="mt-3 text-sm">{r.guardian.ownerExplanation}</p> : null}
              <GuardianLine r={r} />
              <p className="mt-3 text-sm text-ink-muted">Your task: “{r.task}”</p>
            </div>
            <div className="border-t border-pp-line bg-white p-5">
              {r.status === 'pending_approval' ? (
                <div className="grid grid-cols-2 gap-3">
                  <button className="btn btn-secondary h-12" onClick={() => act('decline')} disabled={!!busy}>
                    {busy === 'decline' ? <Spinner /> : null} Decline
                  </button>
                  <button className="btn btn-primary h-12" onClick={() => act('approve')} disabled={!!busy}>
                    {busy === 'approve' ? <Spinner /> : null} Approve
                  </button>
                </div>
              ) : r.status === 'paid' ? (
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 shrink-0 text-ok" />
                  <div>
                    <p className="font-semibold">Paid with PayPal</p>
                    <p className="font-mono text-xs text-ink-muted">Order {r.paypal?.orderId}</p>
                  </div>
                </div>
              ) : r.status === 'executing' ? (
                <p className="flex items-center gap-2 font-semibold"><Spinner /> Paying with PayPal…</p>
              ) : r.status === 'declined' ? (
                <p className="flex items-center gap-2 font-semibold"><XCircle className="h-5 w-5 text-ink-muted" /> Declined. Nothing was charged.</p>
              ) : r.status === 'expired' ? (
                <p className="flex items-center gap-2 font-semibold"><Clock className="h-5 w-5 text-ink-muted" /> Expired. Nothing was charged.</p>
              ) : (
                <p className="font-semibold">This request is {r.status.replace('_', ' ')}.</p>
              )}
              {error ? <p className="mt-2 text-sm text-no">{error}</p> : null}
            </div>
          </div>
        ) : null}
        <p className="mt-6 text-center text-xs text-ink-muted">Valet for PayPal · sandbox prototype · not affiliated with PayPal</p>
      </div>
    </div>
  );
}
