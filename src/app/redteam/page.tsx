'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { BadgeDollarSign, Copy, Play, Repeat, Route, ShieldCheck, ShieldX, Swords, KeyRound, Syringe } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { api, useSession } from '@/components/session';
import { GuardianLine } from '@/components/RequestCards';
import { money } from '@/components/format';
import { IconCircle, PageHeader, Spinner, StatusPill } from '@/components/ui';
import type { PaymentRequest } from '@/lib/types';

type Scenario = { id: string; title: string; attack: string; defense: string };
type Result = { scenario: string; stopped: boolean; outcome: string; requests: PaymentRequest[]; ms: number };

const ICONS: Record<string, typeof Syringe> = {
  prompt_injection: Syringe,
  price_tamper: BadgeDollarSign,
  lookalike: Copy,
  task_drift: Route,
  burst: Repeat,
  revoked_replay: KeyRound,
};

function Ring({ value, total }: { value: number; total: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const pct = total ? value / total : 0;
  return (
    <svg width="88" height="88" viewBox="0 0 88 88" className="shrink-0" aria-hidden>
      <circle cx="44" cy="44" r={r} fill="none" stroke="#E4E7EB" strokeWidth="8" />
      <circle cx="44" cy="44" r={r} fill="none" stroke="#12B76A" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${c * pct} ${c}`} transform="rotate(-90 44 44)" style={{ transition: 'stroke-dasharray .6s ease' }} />
      <text x="44" y="50" textAnchor="middle" fontSize="20" fontWeight="700" fill="#0A0B0D">
        {value}/{total}
      </text>
    </svg>
  );
}

function Lab() {
  const { data } = useSession();
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [results, setResults] = useState<Record<string, Result>>({});
  const [running, setRunning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ scenarios: Scenario[] }>('/api/redteam').then((o) => setScenarios(o.scenarios));
  }, []);

  const runOne = async (id: string) => {
    setRunning(id);
    setError(null);
    try {
      const out = await api<Result>('/api/redteam', { json: { scenario: id } });
      setResults((r) => ({ ...r, [id]: out }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      throw e;
    } finally {
      setRunning(null);
    }
  };
  const runAll = async () => {
    for (const s of scenarios) {
      try {
        await runOne(s.id);
      } catch {
        break;
      }
    }
  };

  const ran = Object.values(results);
  const stopped = ran.filter((r) => r.stopped).length;

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Red team lab"
        title="Try to make an agent overspend"
        sub="Six real attacks through the same API every agent uses, against a live permit: up to $250 a week, ask above $75, never over $500 at once, never gift cards, at most 3 buys an hour."
        actions={
          <button className="btn btn-primary" onClick={runAll} disabled={!!running || !scenarios.length || !data?.owner.paypal}>
            {running ? <Spinner /> : <Swords className="h-4 w-4" />} Run all six
          </button>
        }
      />

      {!data?.owner.paypal ? (
        <div className="rounded-tile bg-ask-bg px-4 py-3 text-sm font-medium text-ask">
          Link PayPal or the demo wallet on <Link className="underline" href="/app">Home</Link> first, so allowed purchases can really be paid.
        </div>
      ) : null}

      <div className="card flex flex-wrap items-center gap-6 p-6">
        <Ring value={stopped} total={scenarios.length || 6} />
        <div className="min-w-0 flex-1">
          <p className="text-[26px] font-bold tracking-[-0.03em]">
            {stopped} of {ran.length || scenarios.length} stopped
          </p>
          <p className="text-sm text-ink-muted">Each attack also lands in your Activity and in PayPal&apos;s Risk Ops view.</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {scenarios.map((s) => {
              const r = results[s.id];
              return (
                <span key={s.id} className={`pill ${!r ? 'bg-fill text-ink-muted' : r.stopped ? 'bg-ok-bg text-ok' : 'bg-no-bg text-no'}`}>
                  {r ? r.stopped ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldX className="h-3.5 w-3.5" /> : null}
                  {s.title}
                </span>
              );
            })}
          </div>
        </div>
      </div>
      {error ? <p className="text-sm text-no">{error}</p> : null}

      <div className="grid gap-4 md:grid-cols-2">
        {scenarios.map((s) => {
          const r = results[s.id];
          const last = r?.requests[r.requests.length - 1];
          const Icon = ICONS[s.id] ?? Swords;
          return (
            <section key={s.id} className="card flex flex-col p-5">
              <div className="flex items-start gap-3.5">
                <IconCircle tone={r ? (r.stopped ? 'ok' : 'no') : 'muted'} size={44}>
                  <Icon className="h-5 w-5" />
                </IconCircle>
                <div className="min-w-0 flex-1">
                  <h2 className="text-[17px] font-semibold tracking-[-0.01em]">{s.title}</h2>
                  <p className="mt-0.5 text-sm text-ink-muted">{s.attack}</p>
                </div>
                <button className="btn btn-sm btn-secondary" onClick={() => void runOne(s.id).catch(() => {})} disabled={!!running || !data?.owner.paypal}>
                  {running === s.id ? <Spinner /> : <Play className="h-4 w-4" />} Run
                </button>
              </div>
              <p className="mt-3 text-xs text-ink-muted">
                <span className="font-semibold text-ink">Defense:</span> {s.defense}
              </p>
              {r && last ? (
                <div className={`mt-4 animate-rise rounded-tile p-4 ${r.stopped ? 'bg-ok-bg' : 'bg-no-bg'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-sm font-semibold ${r.stopped ? 'text-ok' : 'text-no'}`}>
                      {r.stopped ? 'Stopped' : 'Not stopped'} · {r.outcome}
                    </p>
                    <StatusPill status={last.status} />
                  </div>
                  <p className="mt-2 text-sm">{last.reason}</p>
                  <GuardianLine r={last} />
                  <p className="mt-2 text-xs text-ink-muted">
                    {r.requests.length > 1 ? `${r.requests.length} requests · ` : ''}
                    {money(last.amount)} at {last.merchant.name} · decided in {last.decisionMs < 1000 ? `${last.decisionMs} ms` : `${(last.decisionMs / 1000).toFixed(1)} s`}
                  </p>
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}

export default function RedTeamPage() {
  return (
    <Shell>
      <Lab />
    </Shell>
  );
}
