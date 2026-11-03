'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Download, FileCheck2, Undo2 } from 'lucide-react';
import type { PaymentRequest } from '@/lib/types';
import { money } from '../format';
import { ChecksList, ItemsList, TimelineList } from '../RequestCards';
import { api } from '../session';
import { Pill, Spinner } from '../ui';
import { SIGNAL_LABEL } from '../format';

export function DetailPanel({ r, owner = false }: { r: PaymentRequest; owner?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const canRefund = owner && (r.status === 'paid' || r.status === 'partially_refunded') && r.paypal?.captureId;

  return (
    <div className="grid gap-6 whitespace-normal bg-[#FAFAFB] p-6 leading-normal lg:grid-cols-3">
      <div>
        <p className="eyebrow">What the agent asked</p>
        <p className="mt-2 text-sm">
          <span className="font-semibold">Task:</span> “{r.task}”
        </p>
        {r.agentNote ? (
          <p className="mt-1 text-sm text-ink-muted">
            <span className="font-semibold text-black">Agent note:</span> {r.agentNote}
          </p>
        ) : null}
        <div className="mt-3">
          <ItemsList r={r} />
          <p className="mt-2 flex justify-between border-t border-pp-line pt-2 text-sm font-semibold">
            <span>Total</span>
            <span>{money(r.amount)}</span>
          </p>
        </div>
        {r.context ? (
          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-semibold text-ink-muted">Merchant page text the guardian read</summary>
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-tile bg-white p-3 text-[11.5px] text-ink-muted">{r.context}</pre>
          </details>
        ) : null}
      </div>
      <div>
        <p className="eyebrow">Policy checks · {r.policy.latencyMs} ms</p>
        <div className="mt-2">
          <ChecksList r={r} />
        </div>
        {r.guardian ? (
          <div className="mt-4 rounded-tile bg-white p-4 shadow-card">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">AI guardian ({r.guardian.mode === 'claude' ? r.guardian.model ?? 'Claude' : 'rules'})</p>
              <Pill tone={r.guardian.verdict === 'block' ? 'no' : r.guardian.verdict === 'escalate' ? 'ask' : 'ok'}>{r.guardian.verdict}</Pill>
            </div>
            <p className="mt-1.5 text-sm">{r.guardian.ownerExplanation}</p>
            <p className="mt-1 text-xs text-ink-muted">
              Risk {r.guardian.riskScore} · task fit {r.guardian.taskAlignment} · {r.guardian.latencyMs} ms
            </p>
            {r.guardian.signals.length ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {r.guardian.signals.map((s) => (
                  <Pill key={s} tone={s === 'prompt_injection' ? 'no' : 'ask'}>{SIGNAL_LABEL[s] ?? s}</Pill>
                ))}
              </div>
            ) : null}
            {r.guardian.error ? <p className="mt-2 text-xs text-ask">Claude unavailable, rules stood in: {r.guardian.error}</p> : null}
          </div>
        ) : null}
      </div>
      <div>
        <p className="eyebrow">Timeline</p>
        <div className="mt-2">
          <TimelineList r={r} />
        </div>
        {r.dispute ? <p className="mt-3 rounded-tile bg-no-bg px-3 py-2 text-sm text-no">PayPal dispute {r.dispute.id} opened. Evidence bundle is ready.</p> : null}
        {owner ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {canRefund ? (
              <button
                className="btn btn-xs btn-secondary"
                disabled={busy}
                onClick={async () => {
                  if (!confirm(`Refund ${money(r.amount - (r.paypal?.refundedAmount ?? 0))} to your PayPal?`)) return;
                  setBusy(true);
                  setMsg(null);
                  try {
                    await api(`/api/requests/${r.id}/refund`, { json: {} });
                    setMsg('Refund sent through PayPal.');
                  } catch (e) {
                    setMsg(e instanceof Error ? e.message : String(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? <Spinner /> : <Undo2 className="h-3.5 w-3.5" />} Refund
              </button>
            ) : null}
            <a className="btn btn-xs btn-secondary" href={`/api/requests/${r.id}/evidence`}>
              <Download className="h-3.5 w-3.5" /> Evidence
            </a>
            {r.receipt ? (
              <Link className="btn btn-xs btn-secondary" href={`/verify#${encodeURIComponent(r.receipt)}`}>
                <FileCheck2 className="h-3.5 w-3.5" /> Verify receipt
              </Link>
            ) : null}
          </div>
        ) : null}
        {msg ? <p className="mt-2 text-sm text-ink-muted">{msg}</p> : null}
      </div>
    </div>
  );
}
