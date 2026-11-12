'use client';

import { useEffect, useState } from 'react';
import { Check, ExternalLink, QrCode, ShieldAlert, X } from 'lucide-react';
import type { PaymentRequest } from '@/lib/types';
import { CATEGORY_LABEL } from '@/lib/types';
import { clock, money, SIGNAL_LABEL, STATUS, timeAgo } from './format';
import { api } from './session';
import { Avatar, Pill, Spinner, StatusPill } from './ui';

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

export const itemsLabel = (r: PaymentRequest) => r.items.map((i) => `${i.quantity > 1 ? `${i.quantity} × ` : ''}${i.name}`).join(', ');

export function GuardianLine({ r }: { r: PaymentRequest }) {
  if (!r.guardian) return null;
  const g = r.guardian;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
      <ShieldAlert className="h-3.5 w-3.5" />
      <span>
        {g.mode === 'claude' ? 'Claude' : 'Rules'} guardian · risk {g.riskScore}
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
    <div className="card animate-rise overflow-hidden">
      <div className="p-5">
        <div className="flex items-start gap-3.5">
          <Avatar name={r.merchant.name} size={44} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-ink-muted">{r.agentName} wants to pay</p>
              {left ? <span className="tabular text-xs font-medium text-ink-soft">expires in {left}</span> : null}
            </div>
            <p className="tabular mt-0.5 text-[30px] font-bold leading-tight tracking-[-0.035em]">{money(r.amount)}</p>
            <p className="truncate text-sm text-ink-muted">
              {itemsLabel(r)} · {r.merchant.name}
            </p>
          </div>
        </div>
        <div className="mt-4 rounded-tile bg-ask-bg px-4 py-3 text-sm font-medium text-ask">{r.reason}</div>
        {r.guardian && r.guardian.ownerExplanation !== r.reason ? <p className="mt-2.5 text-sm text-ink-muted">{r.guardian.ownerExplanation}</p> : null}
        <GuardianLine r={r} />
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-pp-line bg-[#FAFAFB] px-5 py-3.5">
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
        <div className="flex items-center gap-4 border-t border-pp-line px-5 py-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/qr?d=${encodeURIComponent(link)}`} alt="QR code that opens this approval on a phone" className="h-28 w-28 rounded-xl bg-white p-1 ring-1 ring-pp-line" />
          <p className="text-sm text-ink-muted">
            Scan with your phone to approve, the way a PayPal app notification would open it.{' '}
            <a className="link inline-flex items-center gap-1" href={link} target="_blank" rel="noreferrer">
              Open link <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </p>
        </div>
      ) : null}
      {error ? <p className="px-5 pb-4 text-sm text-no">{error}</p> : null}
    </div>
  );
}

/** One payment in a list: merchant, items, amount and status. */
export function ActivityRow({ r, onClick }: { r: PaymentRequest; onClick?: () => void }) {
  const s = STATUS[r.status];
  const stopped = r.status === 'blocked' || r.status === 'declined' || r.status === 'expired' || r.status === 'failed';
  const amountClass = stopped ? 'text-ink-soft line-through decoration-1' : r.status.includes('refund') ? 'text-pp-blue' : 'text-ink';
  const tone = s.tone === 'ok' ? 'text-ok' : s.tone === 'no' ? 'text-no' : s.tone === 'ask' ? 'text-ask' : s.tone === 'blue' ? 'text-pp-blue' : 'text-ink-soft';
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag onClick={onClick} className={`flex w-full items-center gap-3.5 px-4 py-3 text-left ${onClick ? 'rounded-tile transition hover:bg-fill/70' : ''}`}>
      <Avatar name={r.merchant.name} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold">{itemsLabel(r)}</p>
        <p className="truncate text-[13px] text-ink-muted">
          {r.merchant.name} · {r.agentName} · {timeAgo(r.createdAt)}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className={`tabular text-[15px] font-semibold ${amountClass}`}>{r.status.includes('refund') ? '+' : '−'}{money(r.status.includes('refund') ? r.paypal?.refundedAmount ?? r.amount : r.amount)}</p>
        <p className={`text-[12px] font-semibold ${tone}`}>{s.label}</p>
      </div>
    </Tag>
  );
}

export function DecisionCard({ r }: { r: PaymentRequest; compact?: boolean }) {
  const accent = r.status === 'blocked' || r.status === 'failed' ? 'before:bg-no' : r.status === 'paid' ? 'before:bg-[#12B76A]' : r.status === 'pending_approval' ? 'before:bg-[#F59E0B]' : 'before:bg-ink-soft';
  return (
    <div className={`card animate-rise relative overflow-hidden p-4 pl-5 before:absolute before:inset-y-0 before:left-0 before:w-1 ${accent}`}>
      <div className="flex items-start gap-3">
        <Avatar name={r.merchant.name} size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate font-semibold">{itemsLabel(r)}</p>
            <StatusPill status={r.status} />
          </div>
          <p className="tabular text-sm text-ink-muted">
            {money(r.amount)} · {r.merchant.name} · {timeAgo(r.createdAt)}
          </p>
          <p className={`mt-1.5 text-sm ${r.status === 'blocked' ? 'text-no' : 'text-ink-muted'}`}>{r.reason}</p>
          {r.status === 'blocked' && r.guardian?.signals.length ? <GuardianLine r={r} /> : null}
          {r.paypal?.orderId ? (
            <p className="mt-2 truncate font-mono text-[11px] text-ink-soft">
              PayPal {r.paypal.mode === 'sandbox' ? 'sandbox' : 'simulated'} order {r.paypal.orderId}
            </p>
          ) : null}
          {r.paypal?.error ? <p className="mt-2 text-sm text-no">PayPal: {r.paypal.error}</p> : null}
        </div>
      </div>
    </div>
  );
}

export function TimelineList({ r }: { r: PaymentRequest }) {
  return (
    <ol className="relative space-y-3 border-l border-pp-line pl-4">
      {r.timeline.map((t, i) => (
        <li key={i} className="relative text-sm">
          <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-ink/30" />
          <p className="font-semibold">{t.label}</p>
          <p className="text-xs text-ink-muted">
            {clock(t.at)}
            {t.detail ? ` · ${t.detail}` : ''}
          </p>
        </li>
      ))}
    </ol>
  );
}

export function ChecksList({ r }: { r: PaymentRequest }) {
  const icon = (res: string) =>
    res === 'pass' ? <Check className="h-4 w-4 text-ok" /> : res === 'block' ? <X className="h-4 w-4 text-no" /> : res === 'ask' ? <ShieldAlert className="h-4 w-4 text-ask" /> : <span className="h-4 w-4" />;
  return (
    <ul className="space-y-2">
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
    <ul className="space-y-1.5 text-sm">
      {r.items.map((i, idx) => (
        <li key={idx} className="flex justify-between gap-3">
          <span>
            {i.quantity} × {i.name} <span className="text-ink-muted">· {CATEGORY_LABEL[i.category]}</span>
          </span>
          <span className="tabular">{money(i.unitPrice * i.quantity)}</span>
        </li>
      ))}
    </ul>
  );
}
