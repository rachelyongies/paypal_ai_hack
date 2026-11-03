'use client';

import { useState } from 'react';
import { Ban, Pause, Play } from 'lucide-react';
import type { PermitView } from './client-types';
import { money } from './format';
import { api, useSession } from './session';
import { Pill, Spinner } from './ui';

const KIND: Record<string, string> = { demo: 'Demo agent', mcp: 'MCP agent', rest: 'REST agent' };
const CHIP_TONE: Record<string, string> = { block: 'no', auto: 'ask', budget: 'blue', max: 'muted', allow: 'ok', merchant: 'muted', rate: 'muted', expiry: 'muted', note: 'muted', purpose: 'muted' };

export function PermitCard({ p }: { p: PermitView }) {
  const { refresh } = useSession();
  const [busy, setBusy] = useState<string | null>(null);
  const act = async (action: 'pause' | 'resume' | 'revoke') => {
    if (action === 'revoke' && !confirm(`Revoke ${p.agentName}'s permit? Its key stops working immediately and cannot be restored.`)) return;
    setBusy(action);
    try {
      await api(`/api/permits/${p.id}`, { method: 'PATCH', json: { action } });
      await refresh();
    } finally {
      setBusy(null);
    }
  };
  const budget = p.rules.budget;
  const pct = budget && p.spent !== undefined ? Math.min(100, Math.round((p.spent / budget.amount) * 100)) : null;
  const statusTone = p.status === 'active' ? 'ok' : p.status === 'paused' ? 'ask' : 'muted';

  return (
    <div className={`card p-5 ${p.status === 'revoked' ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-lg font-semibold">{p.agentName}</p>
            <Pill tone={statusTone}>{p.status === 'active' ? 'Active' : p.status === 'paused' ? 'Paused' : 'Revoked'}</Pill>
          </div>
          <p className="text-sm text-ink-muted">
            {p.rules.purpose} · {KIND[p.agentKind]} · key <span className="font-mono">{p.tokenPreview}</span>
          </p>
        </div>
        {p.status !== 'revoked' ? (
          <div className="flex shrink-0 gap-1.5">
            {p.status === 'active' ? (
              <button className="btn btn-xs btn-secondary" onClick={() => act('pause')} disabled={!!busy} title="Pause this agent">
                {busy === 'pause' ? <Spinner /> : <Pause className="h-3.5 w-3.5" />} Pause
              </button>
            ) : (
              <button className="btn btn-xs btn-secondary" onClick={() => act('resume')} disabled={!!busy}>
                {busy === 'resume' ? <Spinner /> : <Play className="h-3.5 w-3.5" />} Resume
              </button>
            )}
            <button className="btn btn-xs btn-danger" onClick={() => act('revoke')} disabled={!!busy} title="Revoke the key for good">
              {busy === 'revoke' ? <Spinner /> : <Ban className="h-3.5 w-3.5" />} Revoke
            </button>
          </div>
        ) : null}
      </div>
      <p className="mt-3 text-sm">“{p.sentence}”</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {p.chips.map((c, i) => (
          <Pill key={i} tone={CHIP_TONE[c.kind]}>{c.label}</Pill>
        ))}
      </div>
      {budget && pct !== null ? (
        <div className="mt-4">
          <div className="flex justify-between text-xs text-ink-muted">
            <span>{money(p.spent)} spent</span>
            <span>{money(budget.amount)} a {budget.period}</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-pp-surface2">
            <div className={`h-full rounded-full ${pct > 90 ? 'bg-no' : pct > 70 ? 'bg-[#E08600]' : 'bg-pp-blue'}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      ) : null}
      <p className="mt-3 text-xs text-ink-muted">Rules compiled by {p.compiledBy === 'claude' ? 'Claude' : 'the offline rules parser'}.</p>
    </div>
  );
}
