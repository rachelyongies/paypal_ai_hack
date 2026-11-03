'use client';

import type { ICellRendererParams } from 'ag-grid-community';
import type { PaymentRequest } from '@/lib/types';
import { money, SIGNAL_LABEL, SOURCE_LABEL } from '../format';
import { Pill, StatusPill, VerdictPill } from '../ui';

type P = ICellRendererParams<PaymentRequest>;

export function StatusCell(p: P) {
  return p.data ? <StatusPill status={p.data.status} /> : null;
}

export function VerdictCell(p: P) {
  return p.data ? <VerdictPill verdict={p.data.verdict} /> : p.value ? <span className="font-semibold">{String(p.value)}</span> : null;
}

export function AmountCell(p: P) {
  if (p.value === undefined || p.value === null) return null;
  return <span className={`tabular-nums ${p.node.group ? 'font-bold' : 'font-semibold'}`}>{money(Number(p.value))}</span>;
}

export function RiskCell(p: P) {
  const v = Number(p.value ?? 0);
  if (!p.data) return null;
  const color = v >= 70 ? '#C41E1E' : v >= 35 ? '#E08600' : '#0F8514';
  return (
    <span className="flex w-full items-center gap-2" title={`Risk ${v} of 100`}>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-pp-surface2">
        <span className="block h-full rounded-full" style={{ width: `${Math.max(4, v)}%`, background: color }} />
      </span>
      <span className="w-6 text-right tabular-nums text-xs text-ink-muted">{v}</span>
    </span>
  );
}

export function SignalsCell(p: P) {
  const s = p.data?.guardian?.signals ?? [];
  if (!s.length) return p.data ? <span className="text-xs text-ink-muted">none</span> : null;
  return (
    <span className="flex flex-wrap gap-1 overflow-hidden">
      {s.slice(0, 2).map((x) => (
        <Pill key={x} tone={x === 'prompt_injection' || x === 'policy_conflict' ? 'no' : 'ask'}>{SIGNAL_LABEL[x] ?? x}</Pill>
      ))}
      {s.length > 2 ? <Pill tone="muted">+{s.length - 2}</Pill> : null}
    </span>
  );
}

export function MerchantCell(p: P) {
  if (!p.data) return p.value ? <span className="font-semibold">{String(p.value)}</span> : null;
  return (
    <span className="flex flex-col leading-tight">
      <span className="font-semibold">{p.data.merchant.name}</span>
      <span className="text-[11.5px] text-ink-muted">{p.data.merchant.domain}</span>
    </span>
  );
}

export function SourceCell(p: P) {
  return p.value ? <span className="text-ink-muted">{SOURCE_LABEL[String(p.value)] ?? String(p.value)}</span> : null;
}
