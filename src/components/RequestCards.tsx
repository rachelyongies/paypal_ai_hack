'use client';

import { useEffect, useState } from 'react';
import { Check, ExternalLink, QrCode, ShieldAlert, X } from 'lucide-react';
import type { PaymentRequest } from '@/lib/types';
import { CATEGORY_LABEL } from '@/lib/types';
import { clock, money, SIGNAL_LABEL, timeAgo } from './format';
import { api } from './session';
import { Pill, Spinner, StatusPill } from './ui';

function useCountdown(iso?: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!iso) return null;
  const s = Math.max(0, Math.round((Date.parse(iso) - now) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function GuardianLine({ r }: { r: PaymentRequest }) {
  if (!r.guardian) return null;
  const g = r.guardian;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
      <span className="font-semibold text-black">Guardian</span>
      <span>
        {g.mode === 'claude' ? 'Claude' : 'Rules'} · risk {g.riskScore} · {g.latencyMs < 1000 ? `${g.latencyMs} ms` : `${(g.latencyMs / 1000).toFixed(1)} s`}
      </span>
      {g.signals.map((s) => (
        <Pill key={s} tone={s === 'prompt_injection' || s === 'policy_conflict' ? 'no' : 'ask'}>{SIGNAL_LABEL[s] ?? s}</Pill>
      ))}
    </div>
  );
}

export function ApprovalCard({ r, showQr = true, via = 'web', onDone }: { r: PaymentRequest; showQr?: boolean; via?: 'web' | 'phone'; onDone?: (r: PaymentRequest) => void }) {
  const [busy, setBusy] = useState<'approve' | 'decline' | null>(null);
  const [qr, setQr] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const left = useCountdown(r.approval?.expiresAt);
  const link = typeof window !== 'undefined' && r.approval ? `${window.location.origin}/approve/${r.id}?k=${r.approval.key}` : '';

  const act = async (decision: 'approve' | 'decline') => {
    setBusy(decision);
    setError(null);
    try {
      const out = await api<{ request: PaymentRequest }>(`/api/requests/${r.id}/decision`, { json: { decision, via, k: r.approval?.key } });
      onDone?.(out.request);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="card animate-rise border-[#F5B65A]/60 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">{r.agentName} wants to pay</p>
          <p className="mt-1.5 text-[28px] font-bold leading-none tracking-[-0.03em]">{money(r.amount)}</p>
          <p className="mt-1.5 text-sm text-ink-muted">
            {r.items.map((i) => `${i.quantity > 1 ? `${i.quantity} × ` : ''}${i.name}`).join(', ')} · {r.merchant.name}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <Pill tone="ask">Needs you</Pill>
          {left ? <span className="text-xs tabular-nums text-ink-muted">expires {left}</span> : null}
        </div>
      </div>
      <div className="mt-4 rounded-tile bg-ask-bg px-4 py-3 text-sm text-ask">{r.reason}</div>
      {r.guardian && r.guardian.ownerExplanation !== r.reason ? <p className="mt-2 text-sm text-ink-muted">{r.guardian.ownerExplanation}</p> : null}
      <GuardianLine r={r} />
      <p className="mt-2 text-xs text-ink-muted">Task: “{r.task}”</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button className="btn btn-sm btn-secondary" onClick={() => act('decline')} disabled={!!busy}>
          {busy === 'decline' ? <Spinner /> : <X className="h-4 w-4" />} Decline
        </button>
        <button className="btn btn-sm btn-primary" onClick={() => act('approve')} disabled={!!busy}>
          {busy === 'approve' ? <Spinner /> : <Check className="h-4 w-4" />} Approve and pay with PayPal
        </button>
        {showQr && r.approval ? (
          <button className="btn btn-sm btn-ghost ml-auto" onClick={() => setQr((v) => !v)} aria-expanded={qr}>
            <QrCode className="h-4 w-4" /> Approve on phone
          </button>
        ) : null}
      </div>
      {qr && link ? (
        <div className="mt-4 flex items-center gap-4 rounded-tile bg-pp-surface p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/qr?d=${encodeURIComponent(link)}`} alt="QR code that opens this approval on a phone" className="h-28 w-28 rounded-lg bg-white p-1" />
          <p className="text-sm text-ink-muted">
            Scan to approve from your phone, the way the PayPal app would notify you.{' '}
            <a className="link inline-flex items-center gap-1" href={link} target="_blank" rel="noreferrer">
              Open link <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </p>
        </div>
      ) : null}
      {error ? <p className="mt-2 text-sm text-no">{error}</p> : null}
    </div>
  );
}

export function DecisionCard({ r, compact = false }: { r: PaymentRequest; compact?: boolean }) {
  const tone = r.status === 'blocked' || r.status === 'failed' ? 'border-no/25' : r.status === 'paid' ? 'border-ok/20' : '';
  return (
    <div className={`card animate-rise p-4 ${tone}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">
            {r.items.map((i) => `${i.quantity > 1 ? `${i.quantity} × ` : ''}${i.name}`).join(', ')}
          </p>
          <p className="mt-0.5 text-sm text-ink-muted">
            {money(r.amount)} · {r.merchant.name} · {r.agentName} · {timeAgo(r.createdAt)}
          </p>
        </div>
        <StatusPill status={r.status} />
      </div>
      {!compact || r.status !== 'paid' ? <p className={`mt-2 text-sm ${r.status === 'blocked' ? 'text-no' : 'text-ink-muted'}`}>{r.reason}</p> : null}
      {r.status === 'blocked' && r.guardian?.signals.length ? <GuardianLine r={r} /> : null}
      {r.paypal?.orderId ? (
        <p className="mt-2 font-mono text-[11.5px] text-ink-muted">
          PayPal {r.paypal.mode === 'sandbox' ? 'sandbox' : 'simulated'} order {r.paypal.orderId}
          {r.paypal.captureId ? ` · capture ${r.paypal.captureId}` : ''}
        </p>
      ) : null}
      {r.paypal?.error ? <p className="mt-2 text-sm text-no">PayPal: {r.paypal.error}</p> : null}
    </div>
  );
}

export function TimelineList({ r }: { r: PaymentRequest }) {
  return (
    <ol className="space-y-2">
      {r.timeline.map((t, i) => (
        <li key={i} className="flex gap-3 text-sm">
          <span className="w-20 shrink-0 tabular-nums text-ink-muted">{clock(t.at)}</span>
          <span>
            <span className="font-semibold">{t.label}</span>
            {t.detail ? <span className="text-ink-muted"> · {t.detail}</span> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function ChecksList({ r }: { r: PaymentRequest }) {
  const icon = (res: string) =>
    res === 'pass' ? <Check className="h-4 w-4 text-ok" /> : res === 'block' ? <X className="h-4 w-4 text-no" /> : res === 'ask' ? <ShieldAlert className="h-4 w-4 text-[#E08600]" /> : <span className="h-4 w-4" />;
  return (
    <ul className="space-y-1.5">
      {r.policy.checks.map((c) => (
        <li key={c.id} className="flex items-start gap-2 text-sm">
          <span className="mt-0.5">{icon(c.result)}</span>
          <span>
            <span className="font-semibold">{c.label}.</span> <span className="text-ink-muted">{c.detail}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function ItemsList({ r }: { r: PaymentRequest }) {
  return (
    <ul className="space-y-1 text-sm">
      {r.items.map((i, idx) => (
        <li key={idx} className="flex justify-between gap-3">
          <span>
            {i.quantity} × {i.name} <span className="text-ink-muted">({CATEGORY_LABEL[i.category]})</span>
          </span>
          <span className="tabular-nums">{money(i.unitPrice * i.quantity)}</span>
        </li>
      ))}
    </ul>
  );
}
