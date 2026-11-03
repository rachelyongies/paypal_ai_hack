'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowRight, Bot, Check, Copy, Plug, Sparkles, Terminal, Wand2 } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { api, useSession } from '@/components/session';
import { Pill, Spinner } from '@/components/ui';
import { EXAMPLE_SENTENCES, ruleChips } from '@/lib/rules-text';
import { CATEGORIES, CATEGORY_LABEL, type AgentKind, type Category, type PermitRules } from '@/lib/types';
import type { PermitView } from '@/components/client-types';

const KINDS: { id: AgentKind; label: string; sub: string; icon: typeof Bot; name: string }[] = [
  { id: 'demo', label: 'Scout, the demo agent', sub: 'Shops the demo stores in this app', icon: Bot, name: 'Scout' },
  { id: 'mcp', label: 'Claude Desktop or any MCP client', sub: 'Connects to Valet’s MCP server', icon: Plug, name: 'Claude Desktop' },
  { id: 'rest', label: 'Any agent, over REST', sub: 'One HTTP call with a bearer key', icon: Terminal, name: 'My agent' },
];
const CHIP_TONE: Record<string, string> = { block: 'no', auto: 'ask', budget: 'blue', max: 'muted', allow: 'ok', merchant: 'muted', rate: 'muted', expiry: 'muted', note: 'muted', purpose: 'muted' };
const EDITABLE: Category[] = CATEGORIES.filter((c) => c !== 'other');

function NumberField({ label, value, onChange, prefix = '$', hint }: { label: string; value: number | null; onChange: (v: number | null) => void; prefix?: string; hint?: string }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold">{label}</span>
      <div className="mt-1.5 flex items-center gap-2">
        <div className="relative w-full">
          {prefix ? <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted">{prefix}</span> : null}
          <input
            type="number"
            min={0}
            className={`input ${prefix ? 'pl-8' : ''}`}
            value={value ?? ''}
            placeholder="No limit"
            onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
          />
        </div>
      </div>
      {hint ? <span className="mt-1 block text-xs text-ink-muted">{hint}</span> : null}
    </label>
  );
}

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="btn btn-xs btn-secondary"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {done ? 'Copied' : label}
    </button>
  );
}

function Issued({ permit, token }: { permit: PermitView; token: string }) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const mcp = JSON.stringify(
    { mcpServers: { valet: { command: 'npx', args: ['-y', 'mcp-remote', `${origin}/api/mcp`, '--header', 'Authorization:${VALET_AUTH}'], env: { VALET_AUTH: `Bearer ${token}` } } } },
    null,
    2,
  );
  const curl = `curl -X POST ${origin}/api/agent/pay \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "merchant": {"name": "FreshCart", "domain": "freshcart.com"},
    "items": [{"name": "Paper towels, 6 rolls", "sku": "fc-towels", "category": "household", "unit_price": 13.5, "quantity": 1}],
    "task": "Restock paper towels",
    "note": "We are out of paper towels"
  }'`;
  return (
    <div className="card animate-rise p-6 md:p-8">
      <Pill tone="ok">Permit issued</Pill>
      <h2 className="mt-3 text-2xl font-bold tracking-[-0.02em]">{permit.agentName} can now pay inside your rules</h2>
      <p className="mt-1 text-ink-muted">This key is shown once. Valet stores only its hash, so a database leak cannot be replayed.</p>
      <div className="mt-5 flex items-center gap-2 rounded-tile bg-pp-surface p-3">
        <code className="min-w-0 flex-1 truncate font-mono text-sm">{token}</code>
        <CopyButton text={token} />
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {permit.chips.map((c, i) => (
          <Pill key={i} tone={CHIP_TONE[c.kind]}>{c.label}</Pill>
        ))}
      </div>
      <div className="mt-6">
        {permit.agentKind === 'demo' ? (
          <Link href={`/agent?permit=${permit.id}`} className="btn btn-primary">
            Open the agent console <ArrowRight className="h-4 w-4" />
          </Link>
        ) : permit.agentKind === 'mcp' ? (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">Add to claude_desktop_config.json, then restart Claude Desktop</p>
              <CopyButton text={mcp} label="Copy config" />
            </div>
            <pre className="code">{mcp}</pre>
            <p className="mt-2 text-sm text-ink-muted">Then ask Claude: “Use Valet to buy paper towels for the house.” Tools: valet_get_permit, valet_search_products, valet_request_payment, valet_payment_status.</p>
          </div>
        ) : (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">Pay from any agent with one call</p>
              <CopyButton text={curl} label="Copy curl" />
            </div>
            <pre className="code">{curl}</pre>
          </div>
        )}
      </div>
      <div className="mt-6 flex gap-3">
        <Link href="/app" className="btn btn-sm btn-secondary">Back to overview</Link>
        <Link href="/developers" className="btn btn-sm btn-ghost">Developer docs</Link>
      </div>
    </div>
  );
}

function NewPermit() {
  const { data } = useSession();
  const [kind, setKind] = useState<AgentKind>('demo');
  const [agentName, setAgentName] = useState('Scout');
  const [sentence, setSentence] = useState(EXAMPLE_SENTENCES[0]);
  const [rules, setRules] = useState<PermitRules | null>(null);
  const [compiledBy, setCompiledBy] = useState<'claude' | 'rules'>('rules');
  const [meta, setMeta] = useState<{ ms: number; error?: string } | null>(null);
  const [busy, setBusy] = useState<'compile' | 'issue' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ permit: PermitView; token: string } | null>(null);
  const chips = useMemo(() => (rules ? ruleChips(rules) : []), [rules]);

  const compile = async () => {
    setBusy('compile');
    setError(null);
    try {
      const out = await api<{ rules: PermitRules; compiledBy: 'claude' | 'rules'; ms: number; error?: string }>('/api/permits/compile', { json: { sentence } });
      setRules(out.rules);
      setCompiledBy(out.compiledBy);
      setMeta({ ms: out.ms, error: out.error });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const issue = async () => {
    if (!rules) return;
    setBusy('issue');
    setError(null);
    try {
      const out = await api<{ permit: PermitView; token: string }>('/api/permits', { json: { agentName, agentKind: kind, sentence, rules, compiledBy } });
      setIssued(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const set = <K extends keyof PermitRules>(k: K, v: PermitRules[K]) => setRules((r) => (r ? { ...r, [k]: v } : r));
  const toggle = (k: 'blockedCategories' | 'allowedCategories', c: Category) =>
    setRules((r) => {
      if (!r) return r;
      const list = new Set((k === 'allowedCategories' ? r.allowedCategories : r.blockedCategories) ?? []);
      if (list.has(c)) list.delete(c);
      else list.add(c);
      const arr = [...list];
      if (k === 'allowedCategories') return { ...r, allowedCategories: arr.length ? arr : null, blockedCategories: r.blockedCategories.filter((x) => !list.has(x)) };
      return { ...r, blockedCategories: arr, allowedCategories: r.allowedCategories?.filter((x) => !list.has(x)) ?? null };
    });

  if (issued) return <Issued permit={issued.permit} token={issued.token} />;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/app" className="text-sm text-ink-muted hover:text-black">← Overview</Link>
        <h1 className="mt-2 text-[32px] font-bold tracking-[-0.03em]">New permit</h1>
        <p className="text-ink-muted">Say what an agent may buy, the way you would tell a person. Valet turns it into rules you can check before anything is enforced.</p>
      </div>
      {!data?.owner.paypal ? (
        <div className="rounded-tile bg-ask-bg px-4 py-3 text-sm text-ask">
          Link PayPal on the <Link className="font-semibold underline" href="/app">overview</Link> first, or agents will be stopped at the gate.
        </div>
      ) : null}

      <section className="card p-6">
        <p className="eyebrow">1 · Which agent?</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {KINDS.map(({ id, label, sub, icon: Icon, name }) => (
            <button
              key={id}
              onClick={() => {
                setKind(id);
                setAgentName(name);
              }}
              className={`rounded-tile border p-4 text-left transition ${kind === id ? 'border-black bg-black text-white' : 'border-pp-line hover:bg-pp-surface'}`}
              aria-pressed={kind === id}
            >
              <Icon className="h-5 w-5" />
              <p className="mt-2 text-sm font-semibold">{label}</p>
              <p className={`text-xs ${kind === id ? 'text-white/70' : 'text-ink-muted'}`}>{sub}</p>
            </button>
          ))}
        </div>
        <label className="mt-4 block">
          <span className="text-sm font-semibold">Agent name</span>
          <input className="input mt-1.5" value={agentName} onChange={(e) => setAgentName(e.target.value)} maxLength={40} />
        </label>
      </section>

      <section className="card p-6">
        <p className="eyebrow">2 · What may it buy?</p>
        <textarea className="input mt-3 min-h-[120px] text-[17px] leading-relaxed" value={sentence} onChange={(e) => setSentence(e.target.value)} maxLength={1200} aria-label="Permission in plain English" />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {EXAMPLE_SENTENCES.map((s, i) => (
            <button key={i} className="pill bg-pp-surface text-ink-muted hover:bg-pp-surface2" onClick={() => setSentence(s)}>
              Example {i + 1}
            </button>
          ))}
        </div>
        <button className="btn btn-primary mt-5" onClick={compile} disabled={busy !== null || sentence.trim().length < 5}>
          {busy === 'compile' ? <Spinner /> : <Wand2 className="h-4 w-4" />} Turn into rules
        </button>
      </section>

      {rules ? (
        <section className="card animate-rise p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="eyebrow">3 · Check what Valet will enforce</p>
            <span className="flex items-center gap-1.5 text-xs text-ink-muted">
              <Sparkles className="h-3.5 w-3.5 text-pp-blue" />
              {compiledBy === 'claude' ? `Compiled by Claude in ${((meta?.ms ?? 0) / 1000).toFixed(1)} s` : 'Compiled by the offline rules parser'}
            </span>
          </div>
          {meta?.error ? <p className="mt-2 text-xs text-ask">Claude was unavailable ({meta.error}); the offline parser stepped in.</p> : null}
          <p className="mt-3 text-lg font-semibold">{rules.purpose}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {chips.map((c, i) => (
              <Pill key={i} tone={CHIP_TONE[c.kind]}>{c.label}</Pill>
            ))}
          </div>

          <details className="mt-5 rounded-tile border border-pp-line p-4">
            <summary className="cursor-pointer text-sm font-semibold">Adjust the rules</summary>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <NumberField label="Budget" value={rules.budget?.amount ?? null} onChange={(v) => set('budget', v ? { amount: v, period: rules.budget?.period ?? 'week' } : null)} />
                <select
                  className="input mt-2"
                  value={rules.budget?.period ?? 'week'}
                  onChange={(e) => rules.budget && set('budget', { ...rules.budget, period: e.target.value as 'day' | 'week' | 'month' })}
                  disabled={!rules.budget}
                  aria-label="Budget period"
                >
                  <option value="day">per day</option>
                  <option value="week">per week</option>
                  <option value="month">per month</option>
                </select>
              </div>
              <NumberField label="Ask me above" value={rules.autoApproveUpTo} onChange={(v) => set('autoApproveUpTo', v)} hint="Purchases above this need your tap." />
              <NumberField label="Never more than, at once" value={rules.perPurchaseMax} onChange={(v) => set('perPurchaseMax', v)} hint="Above this, Valet blocks outright." />
              <NumberField label="Max purchases an hour" prefix="" value={rules.maxPurchasesPerHour} onChange={(v) => set('maxPurchasesPerHour', v ? Math.round(v) : null)} hint="Stops a looping agent." />
            </div>
            <p className="mt-5 text-sm font-semibold">Allowed categories</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {EDITABLE.map((c) => (
                <button key={c} onClick={() => toggle('allowedCategories', c)} className={`pill ${rules.allowedCategories?.includes(c) ? 'bg-ok text-white' : 'bg-pp-surface text-ink-muted'}`}>
                  {CATEGORY_LABEL[c]}
                </button>
              ))}
            </div>
            <p className="mt-4 text-sm font-semibold">Never</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {EDITABLE.map((c) => (
                <button key={c} onClick={() => toggle('blockedCategories', c)} className={`pill ${rules.blockedCategories.includes(c) ? 'bg-no text-white' : 'bg-pp-surface text-ink-muted'}`}>
                  {CATEGORY_LABEL[c]}
                </button>
              ))}
            </div>
          </details>

          <button className="btn btn-primary mt-6" onClick={issue} disabled={busy !== null || !agentName.trim()}>
            {busy === 'issue' ? <Spinner /> : <Check className="h-4 w-4" />} Issue permit to {agentName || 'agent'}
          </button>
        </section>
      ) : null}
      {error ? <p className="text-sm text-no">{error}</p> : null}
    </div>
  );
}

export default function NewPermitPage() {
  return (
    <Shell>
      <NewPermit />
    </Shell>
  );
}
