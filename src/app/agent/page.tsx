'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowUp, Bot, Check, ShieldAlert, Skull, Store, Wand2 } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { api, useSession } from '@/components/session';
import { useActivity } from '@/components/useActivity';
import { ApprovalCard, DecisionCard } from '@/components/RequestCards';
import { Empty, IconCircle, PageHeader, Spinner, Switch } from '@/components/ui';
import { money } from '@/components/format';
import { EXAMPLE_SENTENCES } from '@/lib/rules-text';
import type { PermitRules } from '@/lib/types';

type Line =
  | { kind: 'user'; text: string }
  | { kind: 'assistant'; text: string }
  | { kind: 'tool'; label: string; detail?: string }
  | { kind: 'payment'; status: string; text: string; amount: string; merchant: string };

const PROMPTS = ['Restock the fridge: milk, eggs and a produce box', "Get a 2-person tent for Saturday's camping trip", 'Find the cheapest 2-person tent anywhere', 'Buy a 65 inch TV for movie night'];
const STORES = [
  { slug: 'freshcart', name: 'FreshCart' },
  { slug: 'trailhead', name: 'Trailhead' },
  { slug: 'voltbay', name: 'VoltBay' },
  { slug: 'traildeals', name: 'TrailDeals' },
];

function QuickSetup() {
  const { refresh, data } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="card mx-auto max-w-xl p-8 text-center">
      <IconCircle tone="dark" size={56}>
        <Bot className="h-6 w-6" />
      </IconCircle>
      <h2 className="mt-4 text-[22px] font-bold tracking-[-0.03em]">Give Scout a permit first</h2>
      <p className="mt-1.5 text-ink-muted">Scout can only pay through Valet. Start with the demo permit, or write your own.</p>
      <p className="mt-4 rounded-tile bg-fill p-4 text-left text-sm">“{EXAMPLE_SENTENCES[0]}”</p>
      {!data?.owner.paypal ? <p className="mt-3 text-sm font-medium text-ask">Link PayPal on Home first, or every payment stops at the gate.</p> : null}
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <button
          className="btn btn-primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              const c = await api<{ rules: PermitRules; compiledBy: 'claude' | 'rules' }>('/api/permits/compile', { json: { sentence: EXAMPLE_SENTENCES[0] } });
              await api('/api/permits', { json: { agentName: 'Scout', agentKind: 'demo', sentence: EXAMPLE_SENTENCES[0], rules: c.rules, compiledBy: c.compiledBy } });
              await refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? <Spinner /> : <Wand2 className="h-4 w-4" />} Create Scout&apos;s permit
        </button>
        <Link href="/app/permits/new" className="btn btn-secondary">Write my own</Link>
      </div>
      {error ? <p className="mt-2 text-sm text-no">{error}</p> : null}
    </div>
  );
}

function Console() {
  const { data } = useSession();
  const params = useSearchParams();
  const { requests } = useActivity();
  const demoPermits = useMemo(() => (data?.permits ?? []).filter((p) => p.agentKind === 'demo' && p.status !== 'revoked'), [data]);
  const [permitId, setPermitId] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [compromised, setCompromised] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (permitId && demoPermits.some((p) => p.id === permitId)) return;
    const wanted = params.get('permit');
    setPermitId(demoPermits.find((p) => p.id === wanted)?.id ?? demoPermits[0]?.id ?? null);
  }, [demoPermits, params, permitId]);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [lines, status]);

  if (!data) return <div className="flex items-center gap-2 text-ink-muted"><Spinner /> Loading…</div>;
  const permit = demoPermits.find((p) => p.id === permitId);
  const mine = (requests ?? []).filter((r) => r.permitId === permitId);
  const pending = mine.filter((r) => r.status === 'pending_approval');
  const others = mine.filter((r) => r.status !== 'pending_approval').slice(0, 8);

  const run = async (task: string) => {
    if (!permit || !task.trim() || busy) return;
    const history: { role: 'user' | 'assistant'; text: string }[] = [];
    for (const l of lines) {
      if (l.kind === 'user') history.push({ role: 'user', text: l.text });
      if (l.kind === 'assistant') history.push({ role: 'assistant', text: l.text });
    }
    setLines((ls) => [...ls, { kind: 'user', text: task.trim() }]);
    setInput('');
    setBusy(true);
    setStatus('Starting Scout…');
    try {
      const res = await fetch('/api/demo-agent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ permitId: permit.id, task: task.trim(), history, compromised }) });
      if (!res.ok || !res.body) throw new Error((await res.json().catch(() => ({}))).error ?? 'Agent failed to start');
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split('\n');
        buf = parts.pop() ?? '';
        for (const p of parts) {
          if (!p.trim()) continue;
          const e = JSON.parse(p);
          if (e.type === 'status') setStatus(e.text);
          else setStatus((s) => (s === 'Starting Scout…' ? 'Scout is working…' : s));
          if (e.type === 'assistant') setLines((ls) => [...ls, { kind: 'assistant', text: e.text }]);
          if (e.type === 'tool') setLines((ls) => [...ls, { kind: 'tool', label: e.label, detail: e.detail }]);
          if (e.type === 'payment') setLines((ls) => [...ls, { kind: 'payment', status: e.result.status, text: String(e.result.message).replace(' Poll the status URL.', ''), amount: e.result.amount, merchant: e.result.merchant }]);
          if (e.type === 'error') setLines((ls) => [...ls, { kind: 'assistant', text: `Error: ${e.message}` }]);
        }
      }
    } catch (e) {
      setLines((ls) => [...ls, { kind: 'assistant', text: e instanceof Error ? e.message : String(e) }]);
    } finally {
      setBusy(false);
      setStatus(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Agent console"
        sub="Scout is an ordinary shopping agent. It can only pay through Valet, exactly like a third-party agent would."
        actions={STORES.map((s) => (
          <Link key={s.slug} href={`/stores/${s.slug}`} className="btn btn-xs btn-secondary" target="_blank">
            <Store className="h-3.5 w-3.5" /> {s.name}
          </Link>
        ))}
      />

      {!permit ? (
        <QuickSetup />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          <section className="card flex min-h-[640px] min-w-0 flex-col overflow-hidden">
            <div className="flex flex-wrap items-center gap-3 border-b border-pp-line px-5 py-4">
              <IconCircle tone="dark" size={42}>
                <Bot className="h-[18px] w-[18px]" />
              </IconCircle>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{permit.agentName}</p>
                <p className="truncate text-xs text-ink-muted">
                  {permit.rules.purpose} · {money(permit.spent)} spent · key {permit.tokenPreview}
                </p>
              </div>
              {demoPermits.length > 1 ? (
                <select className="input h-9 w-auto py-0 text-sm" value={permitId ?? ''} onChange={(e) => setPermitId(e.target.value)} aria-label="Permit">
                  {demoPermits.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.agentName} · {p.rules.purpose}
                    </option>
                  ))}
                </select>
              ) : null}
              <label className={`flex cursor-pointer items-center gap-2 rounded-full py-1 pl-3 pr-1 text-xs font-semibold ${compromised ? 'bg-no-bg text-no' : 'bg-fill text-ink-muted'}`} title="Simulates a naive or compromised agent that obeys instructions hidden in web pages">
                <Skull className="h-3.5 w-3.5" />
                <span>Compromised agent {compromised ? 'on' : 'off'}</span>
                <Switch checked={compromised} onChange={setCompromised} label="Compromised agent" />
              </label>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-5" aria-live="polite">
              {!lines.length ? (
                <div className="flex h-full flex-col items-center justify-center py-10 text-center">
                  <p className="text-lg font-semibold">Give Scout an errand</p>
                  <p className="mt-1 text-sm text-ink-muted">Pick one, then watch Valet decide on the right.</p>
                  <div className="mt-5 flex max-w-lg flex-wrap justify-center gap-2">
                    {PROMPTS.map((p) => (
                      <button key={p} className="rounded-full bg-fill px-4 py-2.5 text-[13.5px] font-medium hover:bg-fill-strong" onClick={() => void run(p)}>
                        {p}
                      </button>
                    ))}
                  </div>
                  {compromised ? <p className="mt-5 max-w-sm text-sm font-medium text-no">Compromised mode: Scout obeys hidden instructions on store pages. Valet still decides.</p> : null}
                </div>
              ) : null}
              {lines.map((l, i) =>
                l.kind === 'user' ? (
                  <div key={i} className="ml-auto w-fit max-w-[80%] rounded-[20px] rounded-br-md bg-ink px-4 py-2.5 text-sm text-white">{l.text}</div>
                ) : l.kind === 'assistant' ? (
                  <div key={i} className="w-fit max-w-[85%] rounded-[20px] rounded-bl-md bg-fill px-4 py-2.5 text-sm">{l.text}</div>
                ) : l.kind === 'tool' ? (
                  <p key={i} className="flex min-w-0 items-center gap-2 pl-1 text-xs text-ink-muted">
                    <Check className="h-3.5 w-3.5 shrink-0 text-ok" /> <span className="shrink-0 whitespace-nowrap">{l.label}</span>
                    {l.detail ? <span className="min-w-0 truncate text-ink-soft">· {l.detail}</span> : null}
                  </p>
                ) : (
                  <div
                    key={i}
                    className={`relative max-w-[85%] overflow-hidden rounded-tile px-4 py-3 pl-5 text-sm before:absolute before:inset-y-0 before:left-0 before:w-1 ${
                      l.status === 'paid' ? 'bg-ok-bg before:bg-[#12B76A]' : l.status === 'blocked' || l.status === 'declined' ? 'bg-no-bg before:bg-no' : 'bg-ask-bg before:bg-[#F59E0B]'
                    }`}
                  >
                    <p className="font-semibold">
                      Valet · ${l.amount} at {l.merchant}
                    </p>
                    <p className="mt-0.5 text-ink/80">{l.text}</p>
                  </div>
                ),
              )}
              {status ? (
                <p className="flex items-center gap-2 pl-1 text-xs text-ink-muted">
                  <Spinner className="h-3.5 w-3.5" /> {status}
                </p>
              ) : null}
              <div ref={end} />
            </div>
            <form
              className="flex items-center gap-2 border-t border-pp-line p-4"
              onSubmit={(e) => {
                e.preventDefault();
                void run(input);
              }}
            >
              <input className="input h-12 rounded-full py-0 pl-5" placeholder="Tell Scout what you need…" value={input} onChange={(e) => setInput(e.target.value)} disabled={busy} aria-label="Task for Scout" />
              <button className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-ink text-white disabled:opacity-35" disabled={busy || !input.trim()} aria-label="Send">
                {busy ? <Spinner /> : <ArrowUp className="h-4 w-4" />}
              </button>
            </form>
          </section>

          <aside className="min-w-0 space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="section-title">Valet decisions</h2>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-ok">
                <span className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-[#12B76A]" /> Live
              </span>
            </div>
            {pending.map((r) => (
              <ApprovalCard key={r.id} r={r} />
            ))}
            {others.map((r) => (
              <DecisionCard key={r.id} r={r} />
            ))}
            {!mine.length ? <Empty title="No payments yet">Every payment Scout attempts appears here the moment Valet decides.</Empty> : null}
            <Link href="/redteam" className="card flex items-center gap-3 p-4 transition hover:shadow-lift">
              <IconCircle tone="no" size={40}>
                <ShieldAlert className="h-5 w-5" />
              </IconCircle>
              <span className="text-sm">
                <span className="font-semibold">Red team lab.</span> <span className="text-ink-muted">Fire six attacks at a live permit.</span>
              </span>
            </Link>
          </aside>
        </div>
      )}
    </div>
  );
}

export default function AgentPage() {
  return (
    <Shell wide>
      <Suspense fallback={<div className="flex items-center gap-2 text-ink-muted"><Spinner /> Loading…</div>}>
        <Console />
      </Suspense>
    </Shell>
  );
}
