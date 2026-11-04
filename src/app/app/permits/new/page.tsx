'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Ban, Bot, Check, Clock, Copy, Gauge, Gift, Hand, PenLine, Plane, Plug, Repeat, ShoppingBasket, Sparkles, Store, Tag, Terminal, Wallet, Wand2 } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { api, useSession } from '@/components/session';
import { Segmented, Spinner } from '@/components/ui';
import { TEMPLATES, type PermitTemplate } from '@/lib/rules-text';
import { CATEGORIES, CATEGORY_LABEL, type AgentKind, type Category, type PermitRules } from '@/lib/types';
import type { PermitView } from '@/components/client-types';

const TEMPLATE_ICON: Record<PermitTemplate['icon'], typeof Plane> = { basket: ShoppingBasket, plane: Plane, repeat: Repeat, gift: Gift, pen: PenLine };
const KINDS: { id: AgentKind; label: string; name: string; icon: typeof Bot; sub: string }[] = [
  { id: 'demo', label: 'Scout', name: 'Scout', icon: Bot, sub: 'The demo shopping agent in this app' },
  { id: 'mcp', label: 'Claude Desktop', name: 'Claude Desktop', icon: Plug, sub: 'Any MCP client, through Valet’s MCP server' },
  { id: 'rest', label: 'Any agent', name: 'My agent', icon: Terminal, sub: 'One HTTP call with a bearer key' },
];
const EDITABLE: Category[] = CATEGORIES.filter((c) => c !== 'other');
const usd = (n: number) => `$${Number.isInteger(n) ? n.toLocaleString() : n.toFixed(2)}`;
const per = { day: 'a day', week: 'a week', month: 'a month' } as const;

function Step({ n, title, children, done }: { n: number; title: string; children: React.ReactNode; done?: boolean }) {
  return (
    <section className="card animate-rise p-6">
      <div className="mb-4 flex items-center gap-3">
        <span className={`grid h-7 w-7 place-items-center rounded-full text-[13px] font-bold ${done ? 'bg-[#12B76A] text-white' : 'bg-ink text-white'}`}>{done ? <Check className="h-4 w-4" /> : n}</span>
        <h2 className="section-title">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function SummaryRow({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: 'no' | 'ask' | 'ok' }) {
  const c = tone === 'no' ? 'text-no' : tone === 'ask' ? 'text-ask' : tone === 'ok' ? 'text-ok' : 'text-ink';
  return (
    <div className="flex items-start gap-3.5 px-1 py-3">
      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-fill text-ink">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-ink-muted">{label}</p>
        <p className={`text-[15px] font-semibold ${c}`}>{value}</p>
      </div>
    </div>
  );
}

function NumberField({ label, value, onChange, prefix = '$', hint }: { label: string; value: number | null; onChange: (v: number | null) => void; prefix?: string; hint?: string }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold">{label}</span>
      <div className="relative mt-1.5">
        {prefix ? <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted">{prefix}</span> : null}
        <input type="number" min={0} className={`input ${prefix ? 'pl-8' : ''}`} value={value ?? ''} placeholder="No limit" onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} />
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
  const mcp = JSON.stringify({ mcpServers: { valet: { command: 'npx', args: ['-y', 'mcp-remote', `${origin}/api/mcp`, '--header', 'Authorization:${VALET_AUTH}'], env: { VALET_AUTH: `Bearer ${token}` } } } }, null, 2);
  const curl = `curl -X POST ${origin}/api/agent/pay \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json" \\
  -d '{"merchant":{"name":"FreshCart","domain":"freshcart.example"},"items":[{"name":"Paper towels, 6 rolls","sku":"fc-towels","category":"household","unit_price":13.5,"quantity":1}],"task":"Restock paper towels"}'`;
  return (
    <div className="mx-auto max-w-2xl">
      <div className="card animate-sheet overflow-hidden">
        <div className="relative overflow-hidden bg-[#00103D] px-7 pb-8 pt-9 text-white">
          <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-[#0066F5] opacity-60 blur-3xl" />
          <span className="relative grid h-14 w-14 place-items-center rounded-full bg-[#12B76A]">
            <Check className="h-7 w-7" strokeWidth={3} />
          </span>
          <h1 className="relative mt-5 text-[30px] font-bold tracking-[-0.035em]">{permit.agentName} is ready</h1>
          <p className="relative mt-1 text-white/70">It can now pay with PayPal inside your rules. Pause or revoke it any time.</p>
        </div>
        <div className="space-y-5 p-7">
          <div>
            <p className="text-sm font-semibold">Agent key</p>
            <p className="text-xs text-ink-muted">Shown once. Valet stores only a hash, so a leaked database cannot be replayed.</p>
            <div className="mt-2 flex items-center gap-2 rounded-tile bg-fill p-2 pl-4">
              <code className="min-w-0 flex-1 truncate font-mono text-sm">{token}</code>
              <CopyButton text={token} />
            </div>
          </div>
          {permit.agentKind === 'demo' ? (
            <Link href={`/agent?permit=${permit.id}`} className="btn btn-primary btn-lg w-full">
              Give Scout an errand <ArrowRight className="h-4 w-4" />
            </Link>
          ) : permit.agentKind === 'mcp' ? (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold">Add to claude_desktop_config.json</p>
                <CopyButton text={mcp} label="Copy config" />
              </div>
              <pre className="code">{mcp}</pre>
              <p className="mt-2 text-sm text-ink-muted">Restart Claude Desktop, then ask: “Use Valet to buy paper towels for the house.”</p>
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
          <div className="flex gap-2">
            <Link href="/app" className="btn btn-sm btn-secondary">Back to Home</Link>
            <Link href="/developers" className="btn btn-sm btn-ghost">Developer docs</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function NewPermit() {
  const { data } = useSession();
  const [template, setTemplate] = useState<string>('home');
  const [kind, setKind] = useState<AgentKind>('demo');
  const [agentName, setAgentName] = useState('Scout');
  const [sentence, setSentence] = useState(TEMPLATES[0].sentence);
  const [rules, setRules] = useState<PermitRules | null>(null);
  const [compiledBy, setCompiledBy] = useState<'claude' | 'rules'>('rules');
  const [meta, setMeta] = useState<{ ms: number; error?: string } | null>(null);
  const [busy, setBusy] = useState<'compile' | 'issue' | null>(null);
  const [edit, setEdit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ permit: PermitView; token: string } | null>(null);

  const summary = useMemo(() => {
    if (!rules) return [];
    return [
      { icon: <Wallet className="h-4 w-4" />, label: 'Spending limit', value: rules.budget ? `${usd(rules.budget.amount)} ${per[rules.budget.period]}` : 'No recurring limit' },
      { icon: <Hand className="h-4 w-4" />, label: 'Ask me first', value: rules.autoApproveUpTo === null ? 'Never asks' : rules.autoApproveUpTo === 0 ? 'Before every purchase' : `Above ${usd(rules.autoApproveUpTo)}`, tone: 'ask' as const },
      { icon: <Gauge className="h-4 w-4" />, label: 'Single purchase cap', value: rules.perPurchaseMax ? `Never over ${usd(rules.perPurchaseMax)}` : 'No cap' },
      { icon: <Tag className="h-4 w-4" />, label: 'Can buy', value: rules.allowedCategories?.length ? rules.allowedCategories.map((c) => CATEGORY_LABEL[c]).join(', ') : 'Anything not on the never list', tone: 'ok' as const },
      { icon: <Ban className="h-4 w-4" />, label: 'Never', value: rules.blockedCategories.map((c) => CATEGORY_LABEL[c]).join(', ') || 'Nothing blocked', tone: 'no' as const },
      { icon: <Store className="h-4 w-4" />, label: 'Stores', value: rules.allowedMerchants?.length ? `Only ${rules.allowedMerchants.join(', ')}` : 'Any store, lookalikes flagged' },
      { icon: <Clock className="h-4 w-4" />, label: 'Speed and expiry', value: `${rules.maxPurchasesPerHour ? `Up to ${rules.maxPurchasesPerHour} purchases an hour` : 'No burst limit'} · ${rules.expiresInDays ? `expires in ${rules.expiresInDays} days` : 'no expiry'}` },
      ...rules.notes.map((n) => ({ icon: <Sparkles className="h-4 w-4" />, label: 'Note', value: n })),
    ];
  }, [rules]);

  const compile = async () => {
    setBusy('compile');
    setError(null);
    try {
      const out = await api<{ rules: PermitRules; compiledBy: 'claude' | 'rules'; ms: number; error?: string }>('/api/permits/compile', { json: { sentence } });
      setRules(out.rules);
      setCompiledBy(out.compiledBy);
      setMeta({ ms: out.ms, error: out.error });
      setEdit(false);
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
      setIssued(await api<{ permit: PermitView; token: string }>('/api/permits', { json: { agentName, agentKind: kind, sentence, rules, compiledBy } }));
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
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link href="/app" className="inline-flex items-center gap-1 text-sm font-medium text-ink-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Home
        </Link>
        <h1 className="page-title mt-3">New permit</h1>
        <p className="mt-1.5 text-[15px] text-ink-muted">Tell an agent what it may buy, the way you would tell a person. You check the rules before anything is enforced.</p>
      </div>
      {!data?.owner.paypal ? (
        <div className="rounded-tile bg-ask-bg px-4 py-3 text-sm font-medium text-ask">
          Link PayPal on <Link className="underline" href="/app">Home</Link> first, or agents will be stopped at the gate.
        </div>
      ) : null}

      <Step n={1} title="Start from a template" done={Boolean(sentence.trim())}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {TEMPLATES.map((t) => {
            const Icon = TEMPLATE_ICON[t.icon];
            const on = template === t.id;
            return (
              <button
                key={t.id}
                onClick={() => {
                  setTemplate(t.id);
                  setSentence(t.sentence);
                  setRules(null);
                }}
                className={`flex flex-col items-start gap-3 rounded-xl2 p-4 text-left transition ${on ? 'bg-ink text-white' : 'bg-fill hover:bg-fill-strong'}`}
                aria-pressed={on}
              >
                <Icon className="h-5 w-5" />
                <span>
                  <span className="block text-sm font-semibold leading-tight">{t.label}</span>
                  <span className={`block text-xs ${on ? 'text-white/65' : 'text-ink-muted'}`}>{t.blurb}</span>
                </span>
              </button>
            );
          })}
        </div>
      </Step>

      <Step n={2} title="Which agent is it for?">
        <Segmented
          label="Agent"
          value={kind}
          onChange={(k) => {
            setKind(k);
            setAgentName(KINDS.find((x) => x.id === k)!.name);
          }}
          options={KINDS.map((k) => ({ id: k.id, label: k.label }))}
        />
        <p className="mt-2 text-sm text-ink-muted">{KINDS.find((x) => x.id === kind)!.sub}</p>
        <label className="mt-4 block max-w-sm">
          <span className="text-sm font-semibold">Name</span>
          <input className="input mt-1.5" value={agentName} onChange={(e) => setAgentName(e.target.value)} maxLength={40} />
        </label>
      </Step>

      <Step n={3} title="Say it in your own words" done={Boolean(rules)}>
        <textarea className="input min-h-[112px] text-[17px] leading-relaxed" value={sentence} onChange={(e) => { setSentence(e.target.value); setRules(null); }} maxLength={1200} placeholder="Groceries up to $150 a week, ask me above $60, never gift cards." aria-label="Permission in plain English" />
        <button className="btn btn-primary mt-4" onClick={compile} disabled={busy !== null || sentence.trim().length < 5}>
          {busy === 'compile' ? <Spinner /> : <Wand2 className="h-4 w-4" />} Turn into rules
        </button>
      </Step>

      {rules ? (
        <section className="card animate-sheet p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-ink text-[13px] font-bold text-white">4</span>
              <h2 className="section-title">Check what Valet will enforce</h2>
            </div>
            <span className="flex items-center gap-1.5 text-xs text-ink-muted">
              <Sparkles className="h-3.5 w-3.5 text-pp-blue" />
              {compiledBy === 'claude' ? `Understood by Claude in ${((meta?.ms ?? 0) / 1000).toFixed(1)} s` : 'Understood by the offline parser'}
            </span>
          </div>
          {meta?.error ? <p className="mt-2 text-xs text-ask">Claude was unavailable ({meta.error}); the offline parser stepped in.</p> : null}
          <p className="mt-4 text-[22px] font-bold tracking-[-0.03em]">{rules.purpose}</p>
          <div className="mt-2 divide-y divide-pp-line">
            {summary.map((s, i) => (
              <SummaryRow key={i} icon={s.icon} label={s.label} value={s.value} tone={'tone' in s ? s.tone : undefined} />
            ))}
          </div>
          <button className="link mt-2 text-sm" onClick={() => setEdit((v) => !v)}>
            {edit ? 'Done editing' : 'Adjust the rules'}
          </button>
          {edit ? (
            <div className="mt-4 animate-rise rounded-xl2 bg-fill/60 p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <NumberField label="Spending limit" value={rules.budget?.amount ?? null} onChange={(v) => set('budget', v ? { amount: v, period: rules.budget?.period ?? 'week' } : null)} />
                  <select className="input mt-2" value={rules.budget?.period ?? 'week'} onChange={(e) => rules.budget && set('budget', { ...rules.budget, period: e.target.value as 'day' | 'week' | 'month' })} disabled={!rules.budget} aria-label="Limit period">
                    <option value="day">per day</option>
                    <option value="week">per week</option>
                    <option value="month">per month</option>
                  </select>
                </div>
                <NumberField label="Ask me above" value={rules.autoApproveUpTo} onChange={(v) => set('autoApproveUpTo', v)} hint="Purchases above this wait for your tap." />
                <NumberField label="Single purchase cap" value={rules.perPurchaseMax} onChange={(v) => set('perPurchaseMax', v)} hint="Above this, Valet blocks outright." />
                <NumberField label="Purchases an hour" prefix="" value={rules.maxPurchasesPerHour} onChange={(v) => set('maxPurchasesPerHour', v ? Math.round(v) : null)} hint="Stops a looping agent." />
              </div>
              <p className="mt-5 text-sm font-semibold">Can buy</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {EDITABLE.map((c) => (
                  <button key={c} onClick={() => toggle('allowedCategories', c)} className={`pill px-3 py-1.5 ${rules.allowedCategories?.includes(c) ? 'bg-ok text-white' : 'bg-white text-ink-muted'}`}>
                    {CATEGORY_LABEL[c]}
                  </button>
                ))}
              </div>
              <p className="mt-4 text-sm font-semibold">Never</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {EDITABLE.map((c) => (
                  <button key={c} onClick={() => toggle('blockedCategories', c)} className={`pill px-3 py-1.5 ${rules.blockedCategories.includes(c) ? 'bg-no text-white' : 'bg-white text-ink-muted'}`}>
                    {CATEGORY_LABEL[c]}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <button className="btn btn-primary btn-lg mt-6 w-full sm:w-auto" onClick={issue} disabled={busy !== null || !agentName.trim()}>
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
