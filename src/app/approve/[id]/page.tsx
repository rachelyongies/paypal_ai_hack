'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { Check, Clock, X } from 'lucide-react';
import type { PaymentRequest } from '@/lib/types';
import { GuardianLine, ItemsList } from '@/components/RequestCards';
import { api } from '@/components/session';
import { money } from '@/components/format';
import { Avatar, LogoMark, Spinner } from '@/components/ui';

// Phone-first approval: what a PayPal app notification would open.
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

  const pending = r?.status === 'pending_approval';

  return (
    <div className="min-h-screen bg-canvas">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-8 pt-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LogoMark size={28} />
            <span className="text-[17px] font-bold tracking-[-0.04em]">Valet</span>
          </div>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink-muted shadow-card">Approval request</span>
        </div>

        {!r && !error ? (
          <div className="flex flex-1 items-center justify-center text-ink-muted">
            <Spinner className="h-6 w-6" />
          </div>
        ) : null}
        {error && !r ? <div className="card mt-10 p-6 text-center text-no">{error}</div> : null}

        {r ? (
          <>
            <div className="mt-10 flex flex-col items-center text-center">
              <Avatar name={r.merchant.name} size={64} />
              <p className="mt-4 text-[15px] font-medium text-ink-muted">{r.agentName} wants to pay</p>
              <p className="tabular mt-1 text-[52px] font-bold leading-none tracking-[-0.05em]">{money(r.amount)}</p>
              <p className="mt-2 text-[15px] font-semibold">{r.merchant.name}</p>
              <p className="font-mono text-xs text-ink-muted">{r.merchant.domain}</p>
            </div>

            <div className="card mt-8 p-5">
              <ItemsList r={r} />
              <div className="mt-4 rounded-tile bg-ask-bg px-4 py-3 text-[15px] font-medium text-ask">{r.reason}</div>
              {r.guardian && r.guardian.ownerExplanation !== r.reason ? <p className="mt-3 text-sm">{r.guardian.ownerExplanation}</p> : null}
              <GuardianLine r={r} />
              <p className="mt-3 border-t border-pp-line pt-3 text-sm text-ink-muted">Your task: “{r.task}”</p>
            </div>

            <div className="mt-auto pt-8">
              {pending ? (
                <div className="grid gap-3">
                  <button className="btn btn-primary btn-lg h-14 w-full text-[17px]" onClick={() => act('approve')} disabled={!!busy}>
                    {busy === 'approve' ? <Spinner /> : <Check className="h-5 w-5" />} Approve
                  </button>
                  <button className="btn btn-secondary btn-lg h-14 w-full text-[17px]" onClick={() => act('decline')} disabled={!!busy}>
                    {busy === 'decline' ? <Spinner /> : <X className="h-5 w-5" />} Decline
                  </button>
                </div>
              ) : r.status === 'paid' ? (
                <div className="card flex items-center gap-4 p-5">
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-[#12B76A] text-white">
                    <Check className="h-6 w-6" strokeWidth={3} />
                  </span>
                  <div>
                    <p className="font-semibold">Paid with PayPal</p>
                    <p className="font-mono text-xs text-ink-muted">Order {r.paypal?.orderId}</p>
                  </div>
                </div>
              ) : r.status === 'executing' ? (
                <div className="card flex items-center gap-3 p-5 font-semibold">
                  <Spinner /> Paying with PayPal…
                </div>
              ) : r.status === 'declined' ? (
                <div className="card flex items-center gap-4 p-5">
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-fill">
                    <X className="h-6 w-6" />
                  </span>
                  <div>
                    <p className="font-semibold">Declined</p>
                    <p className="text-sm text-ink-muted">Nothing was charged.</p>
                  </div>
                </div>
              ) : r.status === 'expired' ? (
                <div className="card flex items-center gap-4 p-5">
                  <Clock className="h-6 w-6 text-ink-muted" />
                  <p className="font-semibold">Expired. Nothing was charged.</p>
                </div>
              ) : (
                <div className="card p-5 font-semibold">This request is {r.status.replace('_', ' ')}.</div>
              )}
              {error ? <p className="mt-2 text-sm text-no">{error}</p> : null}
              <p className="mt-6 text-center text-xs text-ink-soft">Valet for PayPal · sandbox prototype · not affiliated with PayPal</p>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
