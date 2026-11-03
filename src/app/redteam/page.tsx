'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Play, ShieldCheck, ShieldX, Swords } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { api, useSession } from '@/components/session';
import { GuardianLine } from '@/components/RequestCards';
import { money } from '@/components/format';
import { Pill, Spinner, StatusPill } from '@/components/ui';
import type { PaymentRequest } from '@/lib/types';

type Scenario = { id: string; title: string; attack: string; defense: string };
type Result = { scenario: string; stopped: boolean; outcome: string; requests: PaymentRequest[]; ms: number };

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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Red team lab</p>
          <h1 className="text-[32px] font-bold tracking-[-0.03em]">Try to make an agent overspend</h1>
          <p className="max-w-2xl text-ink-muted">Six real attacks, fired through the same API every agent uses, against a live permit: house shopping up to $250 a week, ask over $75, never over $500 at once, never gift cards, at most 3 buys an hour.</p>
        </div>
        <button className="btn btn-primary" onClick={runAll} disabled={!!running || !scenarios.length || !data?.owner.paypal}>
          {running ? <Spinner /> : <Swords className="h-4 w-4" />} Run all six
        </button>
      </div>

      {!data?.owner.paypal ? (
        <div className="rounded-tile bg-ask-bg px-4 py-3 text-sm text-ask">
          Link PayPal or the demo wallet on the <Link className="font-semibold underline" href="/app">overview</Link> first, so allowed purchases can really be paid.
        </div>
      ) : null}

      <div className="card flex flex-wrap items-center gap-6 p-5">
        <div>
          <p className="eyebrow">Scorecard</p>
          <p className="mt-1 text-[34px] font-bold tracking-[-0.03em]">
            {stopped} <span className="text-ink-soft">of {ran.length || scenarios.length}</span> stopped
          </p>
        </div>
        <div className="flex flex-1 flex-wrap gap-2">
          {scenarios.map((s) => {
            const r = results[s.id];
            return (
              <Pill key={s.id} tone={!r ? 'muted' : r.stopped ? 'ok' : 'no'}>
                {r ? r.stopped ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldX className="h-3.5 w-3.5" /> : null}
                {s.title}
              </Pill>
            );
          })}
        </div>
        <p className="text-xs text-ink-muted">Every attack also lands in Activity and Risk Ops.</p>
      </div>
      {error ? <p className="text-sm text-no">{error}</p> : null}

      <div className="grid gap-4 md:grid-cols-2">
        {scenarios.map((s, i) => {
          const r = results[s.id];
          const last = r?.requests[r.requests.length - 1];
          return (
            <section key={s.id} className={`card p-5 ${r ? (r.stopped ? 'border-ok/25' : 'border-no/40') : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="eyebrow">Attack {i + 1}</p>
                  <h2 className="mt-1 text-lg font-semibold">{s.title}</h2>
                </div>
                <button className="btn btn-sm btn-secondary" onClick={() => void runOne(s.id).catch(() => {})} disabled={!!running || !data?.owner.paypal}>
                  {running === s.id ? <Spinner /> : <Play className="h-4 w-4" />} Run
                </button>
              </div>
              <p className="mt-2 text-sm">{s.attack}</p>
              <p className="mt-1 text-sm text-ink-muted">Defense: {s.defense}</p>
              {r && last ? (
                <div className={`mt-4 rounded-tile p-4 ${r.stopped ? 'bg-ok-bg' : 'bg-no-bg'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className={`font-semibold ${r.stopped ? 'text-ok' : 'text-no'}`}>{r.stopped ? 'Stopped' : 'Not stopped'} · {r.outcome}</p>
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
