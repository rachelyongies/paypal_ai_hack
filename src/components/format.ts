import type { PaymentRequest, Verdict } from '@/lib/types';

export const money = (n: number | undefined | null) =>
  (n ?? 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export function timeAgo(iso: string) {
  const s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function clock(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' });
}

export const STATUS: Record<PaymentRequest['status'], { label: string; tone: 'ok' | 'ask' | 'no' | 'muted' | 'blue' }> = {
  paid: { label: 'Paid', tone: 'ok' },
  pending_approval: { label: 'Needs you', tone: 'ask' },
  executing: { label: 'Paying…', tone: 'blue' },
  blocked: { label: 'Blocked', tone: 'no' },
  declined: { label: 'Declined', tone: 'muted' },
  expired: { label: 'Expired', tone: 'muted' },
  failed: { label: 'Failed', tone: 'no' },
  refunded: { label: 'Refunded', tone: 'blue' },
  partially_refunded: { label: 'Part refunded', tone: 'blue' },
};

export const VERDICT: Record<Verdict, { label: string; tone: 'ok' | 'ask' | 'no' }> = {
  approve: { label: 'Approved', tone: 'ok' },
  ask: { label: 'Asked you', tone: 'ask' },
  block: { label: 'Blocked', tone: 'no' },
};

export const SIGNAL_LABEL: Record<string, string> = {
  prompt_injection: 'Prompt injection',
  task_mismatch: 'Off task',
  price_anomaly: 'Price anomaly',
  merchant_risk: 'Merchant risk',
  urgency_pressure: 'Urgency pressure',
  duplicate: 'Duplicate',
  policy_conflict: 'Breaks a rule',
};

export const SOURCE_LABEL: Record<string, string> = {
  'demo-agent': 'Demo agent',
  mcp: 'MCP',
  rest: 'REST',
  redteam: 'Red team',
};
