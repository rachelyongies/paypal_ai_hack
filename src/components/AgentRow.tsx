'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Ban, Bot, ChevronDown, Pause, Play, Plug, Terminal } from 'lucide-react';
import type { PermitView } from './client-types';
import { money } from './format';
import { api, useSession } from './session';
import { Dot, IconCircle, Pill, Progress, Spinner } from './ui';

const KIND = { demo: { label: 'Demo agent', icon: Bot }, mcp: { label: 'MCP', icon: Plug }, rest: { label: 'REST', icon: Terminal } } as const;
export const CHIP_TONE: Record<string, string> = { block: 'no', auto: 'ask', budget: 'blue', max: 'muted', allow: 'ok', merchant: 'muted', rate: 'muted', expiry: 'muted', note: 'muted', purpose: 'muted' };

/** One agent and its permit, as an expandable row. */
export function AgentRow({ p, defaultOpen = false }: { p: PermitView; defaultOpen?: boolean }) {
  const { refresh } = useSession();
  const [open, setOpen] = useState(defaultOpen);
  const [busy, setBusy] = useState<string | null>(null);
  const kind = KIND[p.agentKind];
  const Icon = kind.icon;
  const budget = p.rules.budget;
  const pct = budget && p.spent !== undefined ? (p.spent / budget.amount) * 100 : null;
  const tone = p.status === 'active' ? 'ok' : p.status === 'paused' ? 'ask' : 'muted';

  const act = async (action: 'pause' | 'resume' | 'revoke') => {
    if (action === 'revoke' && !confirm(`Revoke ${p.agentName}'s key? It stops working immediately and cannot be restored.`)) return;
    setBusy(action);
    try {
      await api(`/api/permits/${p.id}`, { method: 'PATCH', json: { action } });
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={`${p.status === 'revoked' ? 'opacity-55' : ''}`}>
      <button className="flex w-full items-center gap-3.5 rounded-tile px-4 py-3 text-left transition hover:bg-fill/70" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <IconCircle tone="dark" size={42}>
          <Icon className="h-[18px] w-[18px]" />
        </IconCircle>
        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 items-center gap-2 text-[15px] font-semibold">
            <span className="truncate">{p.agentName}</span>
            <Dot tone={tone} />
            <span className="shrink-0 text-xs font-medium text-ink-muted">{p.status === 'active' ? 'Active' : p.status === 'paused' ? 'Paused' : 'Revoked'}</span>
          </p>
          <p className="truncate text-[13px] text-ink-muted">
            {p.rules.purpose} · {kind.label}
          </p>
          {budget && pct !== null && p.status !== 'revoked' ? (
            <div className="mt-2 flex items-center gap-3">
              <div className="flex-1">
                <Progress value={pct} />
              </div>
              <p className="tabular shrink-0 text-[12.5px] font-semibold">
                {money(p.spent)} <span className="font-normal text-ink-muted">/ {money(budget.amount)}</span>
              </p>
            </div>
          ) : null}
        </div>
        <ChevronDown className={`h-4 w-4 shrink-0 text-ink-soft transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? (
        <div className="animate-rise px-4 pb-4 sm:pl-[74px]">
          <p className="rounded-tile bg-fill px-4 py-3 text-sm">“{p.sentence}”</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {p.chips.map((c, i) => (
              <Pill key={i} tone={CHIP_TONE[c.kind]}>{c.label}</Pill>
            ))}
          </div>
          <p className="mt-3 text-xs text-ink-muted">
            Key <span className="font-mono">{p.tokenPreview}</span> · rules compiled by {p.compiledBy === 'claude' ? 'Claude' : 'the offline parser'}
          </p>
          {p.status !== 'revoked' ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {p.status === 'active' ? (
                <button className="btn btn-xs btn-secondary" onClick={() => act('pause')} disabled={!!busy}>
                  {busy === 'pause' ? <Spinner /> : <Pause className="h-3.5 w-3.5" />} Pause
                </button>
              ) : (
                <button className="btn btn-xs btn-secondary" onClick={() => act('resume')} disabled={!!busy}>
                  {busy === 'resume' ? <Spinner /> : <Play className="h-3.5 w-3.5" />} Resume
                </button>
              )}
              <button className="btn btn-xs btn-danger" onClick={() => act('revoke')} disabled={!!busy}>
                {busy === 'revoke' ? <Spinner /> : <Ban className="h-3.5 w-3.5" />} Revoke key
              </button>
              {p.agentKind === 'demo' ? (
                <Link href={`/agent?permit=${p.id}`} className="btn btn-xs btn-ghost">
                  Open console
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

