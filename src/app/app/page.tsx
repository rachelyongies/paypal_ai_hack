'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Bell, Bot, Check, ChevronRight, Plus, ReceiptText, RotateCcw, ShieldAlert, Snowflake, TrendingUp, Unlink } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { PayPalLink } from '@/components/PayPalLink';
import { AgentRow } from '@/components/AgentRow';
import { Concierge } from '@/components/Concierge';
import { ActivityRow, ApprovalCard } from '@/components/RequestCards';
import { api, useSession } from '@/components/session';
import { useActivity } from '@/components/useActivity';
import { money } from '@/components/format';
import { Empty, Progress, SectionTitle, Spinner } from '@/components/ui';
import type { PaymentRequest } from '@/lib/types';

const WEEK = 7 * 864e5;

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date(Date.now() - 864e5);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function QuickAction({ href, onClick, icon, label, badge, active }: { href?: string; onClick?: () => void; icon: React.ReactNode; label: string; badge?: number; active?: boolean }) {
  const inner = (
    <>
      <span className={`relative grid h-14 w-14 place-items-center rounded-full transition ${active ? 'bg-no text-white' : 'bg-white text-ink shadow-card group-hover:shadow-lift'}`}>
        {icon}
        {badge ? <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-[#F59E0B] px-1 text-[11px] font-bold text-white">{badge}</span> : null}
      </span>
      <span className="text-[13px] font-medium">{label}</span>
    </>
  );
  return href ? (
    <Link href={href} className="group flex w-[76px] flex-col items-center gap-2">
      {inner}
    </Link>
  ) : (
    <button onClick={onClick} className="group flex w-[76px] flex-col items-center gap-2">
      {inner}
    </button>
  );
}

function SpendCard({ requests }: { requests: PaymentRequest[] }) {
  const { data } = useSession();
  const active = (data?.permits ?? []).filter((p) => p.status === 'active');
  const weekly = active.reduce((s, p) => s + (p.rules.budget ? (p.rules.budget.period === 'week' ? p.rules.budget.amount : p.rules.budget.period === 'day' ? p.rules.budget.amount * 7 : p.rules.budget.amount / 4.33) : 0), 0);
  const week = requests.filter((r) => Date.now() - Date.parse(r.createdAt) < WEEK);
  const spent = week.filter((r) => r.status === 'paid' || r.status === 'partially_refunded').reduce((s, r) => s + r.amount - (r.paypal?.refundedAmount ?? 0), 0);
  const blocked = week.filter((r) => r.status === 'blocked');
  const asked = week.filter((r) => r.approval);
  return (
    <div className="relative overflow-hidden rounded-card bg-[#00103D] p-6 text-white shadow-float sm:p-7">
      <div className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-[#0066F5] opacity-70 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 right-24 h-64 w-64 rounded-full bg-[#60CDFF] opacity-30 blur-3xl" />
      <div className="relative">
        <p className="text-sm font-medium text-white/70">Agent spend this week</p>
        <p className="tabular mt-1 text-[48px] font-bold leading-none tracking-[-0.045em]">{money(spent)}</p>
        <p className="mt-2 text-sm text-white/70">{weekly > 0 ? `of ${money(weekly)} weekly limit across ${active.length} agent${active.length === 1 ? '' : 's'}` : 'No weekly limits set yet'}</p>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/15">
          <div className="h-full rounded-full bg-white transition-all duration-700" style={{ width: `${weekly ? Math.min(100, (spent / weekly) * 100) : 0}%` }} />
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2 text-sm">
          <div>
            <p className="text-white/60">Paid</p>
            <p className="tabular text-lg font-semibold">{week.filter((r) => r.status === 'paid').length}</p>
          </div>
          <div>
            <p className="text-white/60">Asked you</p>
            <p className="tabular text-lg font-semibold">{asked.length}</p>
          </div>
          <div>
            <p className="text-white/60">Blocked</p>
            <p className="tabular text-lg font-semibold">
              {blocked.length} <span className="text-sm font-normal text-white/60">· {money(blocked.reduce((s, r) => s + r.amount, 0))} saved</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Onboarding({ requests }: { requests: PaymentRequest[] }) {
  const { data } = useSession();
  if (!data) return null;
  const steps = [
    { done: Boolean(data.owner.paypal), label: 'Link PayPal', sub: 'Save your wallet in the PayPal vault', href: '/app' },
    { done: data.permits.some((p) => p.status !== 'revoked'), label: 'Write a permit', sub: 'One sentence, turned into rules', href: '/app/permits/new' },
    { done: requests.length > 0, label: 'Let an agent shop', sub: 'Watch Valet decide in real time', href: '/agent' },
  ];
  const n = steps.filter((s) => s.done).length;
  if (n === steps.length) return null;
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <p className="section-title">Get started</p>
        <p className="text-sm text-ink-muted">{n} of 3</p>
      </div>
      <div className="mt-3">
        <Progress value={(n / 3) * 100} tone="#12B76A" />
      </div>
      <ul className="mt-4 space-y-1">
        {steps.map((s) => (
          <li key={s.label}>
            <Link href={s.href} className="flex items-center gap-3 rounded-tile px-2 py-2.5 hover:bg-fill/70">
              <span className={`grid h-7 w-7 place-items-center rounded-full ${s.done ? 'bg-[#12B76A] text-white' : 'border-2 border-fill-strong'}`}>{s.done ? <Check className="h-4 w-4" /> : null}</span>
              <span className="min-w-0 flex-1">
                <span className={`block text-sm font-semibold ${s.done ? 'text-ink-muted line-through' : ''}`}>{s.label}</span>
                <span className="block text-xs text-ink-muted">{s.sub}</span>
              </span>
              {!s.done ? <ChevronRight className="h-4 w-4 text-ink-soft" /> : null}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Home() {
  const { data, refresh } = useSession();
  const { requests } = useActivity();
  const [busy, setBusy] = useState<string | null>(null);
  const [hello, setHello] = useState('Hello');
  const [showRevoked, setShowRevoked] = useState(false);
  useEffect(() => setHello(greeting()), []);
  const list = useMemo(() => requests ?? [], [requests]);
  const pending = list.filter((r) => r.status === 'pending_approval');
  const recent = list.filter((r) => r.status !== 'pending_approval').slice(0, 8);
  const groups = useMemo(() => {
    const g: { day: string; items: PaymentRequest[] }[] = [];
    for (const r of recent) {
      const d = dayLabel(r.createdAt);
      const last = g[g.length - 1];
      if (last && last.day === d) last.items.push(r);
      else g.push({ day: d, items: [r] });
    }
    return g;
  }, [recent]);

  if (!data) {
    return (
      <div className="flex items-center gap-2 text-ink-muted">
        <Spinner /> Loading your Valet…
      </div>
    );
  }
  const frozen = data.owner.frozen;
  const toggleFreeze = async () => {
    setBusy('freeze');
    try {
      await api('/api/freeze', { json: { frozen: !frozen } });
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">
            {hello}, {data.owner.displayName}
          </h1>
          <p className="mt-1 text-[15px] text-ink-muted">Everything your AI agents can pay for with PayPal, in one place.</p>
        </div>
        <button
          className="btn btn-sm btn-ghost text-ink-muted"
          disabled={busy === 'reset'}
          onClick={async () => {
            if (!confirm('Reset demo data? Permits and activity for this browser are cleared.')) return;
            setBusy('reset');
            try {
              await api('/api/reset', { json: {} });
              await refresh();
              location.reload();
            } finally {
              setBusy(null);
            }
          }}
        >
          {busy === 'reset' ? <Spinner /> : <RotateCcw className="h-4 w-4" />} Reset demo
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          {!data.owner.paypal ? <PayPalLink /> : <SpendCard requests={list} />}

          <div className="flex flex-wrap justify-between gap-2 px-1 sm:justify-start sm:gap-5">
            <QuickAction href="/app/permits/new" icon={<Plus className="h-5 w-5" />} label="New permit" />
            <QuickAction href="#needs-you" icon={<Bell className="h-5 w-5" />} label="Approvals" badge={pending.length} />
            <QuickAction href="/agent" icon={<Bot className="h-5 w-5" />} label="Run agent" />
            <QuickAction href="/app/activity" icon={<ReceiptText className="h-5 w-5" />} label="Activity" />
            <QuickAction onClick={toggleFreeze} icon={busy === 'freeze' ? <Spinner /> : <Snowflake className="h-5 w-5" />} label={frozen ? 'Unfreeze' : 'Freeze'} active={frozen} />
          </div>

          {pending.length ? (
            <section id="needs-you" className="scroll-mt-24">
              <SectionTitle title="Needs you" sub="Nothing is charged until you approve." />
              <div className="space-y-4">
                {pending.map((r) => (
                  <ApprovalCard key={r.id} r={r} />
                ))}
              </div>
            </section>
          ) : null}

          <section>
            <SectionTitle title="Recent activity" action={<Link href="/app/activity" className="link text-sm">See all</Link>} />
            {recent.length ? (
              <div className="card divide-y divide-pp-line/70 p-2">
                {groups.map((g) => (
                  <div key={g.day} className="py-1">
                    <p className="px-4 pb-1 pt-2 text-[13px] font-medium text-ink-muted">{g.day}</p>
                    {g.items.map((r) => (
                      <ActivityRow key={r.id} r={r} />
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <Empty title="No agent payments yet" icon={<ReceiptText className="h-5 w-5" />}>
                Give Scout an errand and every decision shows up here, the moment Valet makes it.
                <div className="mt-4 flex justify-center gap-2">
                  <Link href="/agent" className="btn btn-sm btn-primary">Run the demo agent</Link>
                </div>
              </Empty>
            )}
          </section>
        </div>

        <aside className="min-w-0 space-y-6">
          <Onboarding requests={list} />
          <section>
            <SectionTitle title="Agents" action={<Link href="/app/permits/new" className="link text-sm">Add</Link>} />
            {data.permits.length ? (
              <div className="card divide-y divide-pp-line/70 p-2">
                {data.permits
                  .filter((p) => showRevoked || p.status !== 'revoked')
                  .map((p, i, arr) => (
                    <AgentRow key={p.id} p={p} defaultOpen={i === 0 && arr.length === 1} />
                  ))}
                {data.permits.some((p) => p.status === 'revoked') ? (
                  <button className="w-full px-4 py-2.5 text-left text-[13px] font-medium text-ink-muted hover:text-ink" onClick={() => setShowRevoked((v) => !v)}>
                    {showRevoked ? 'Hide revoked keys' : `Show revoked keys (${data.permits.filter((p) => p.status === 'revoked').length})`}
                  </button>
                ) : null}
              </div>
            ) : (
              <Empty title="No agents yet" icon={<Bot className="h-5 w-5" />}>
                Write one sentence about what an agent may buy, and Valet turns it into rules.
                <Link href="/app/permits/new" className="btn btn-sm btn-primary mt-4">
                  <Plus className="h-4 w-4" /> Create a permit
                </Link>
              </Empty>
            )}
          </section>
          {data.owner.paypal ? (
            <div className="card flex items-center gap-3 p-4">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-[#E8F0FF] text-sm font-bold text-pp-blue">P</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{data.owner.paypal.payerEmail ?? 'PayPal account'}</p>
                <p className="text-xs text-ink-muted">{data.owner.paypal.mode === 'sandbox' ? 'Sandbox vault' : 'Simulated wallet'} · agents never see it</p>
              </div>
              <button
                className="grid h-9 w-9 place-items-center rounded-full text-no hover:bg-no-bg"
                title="Unlink PayPal"
                aria-label="Unlink PayPal"
                disabled={busy === 'unlink'}
                onClick={async () => {
                  if (!confirm('Unlink PayPal? Valet deletes the saved payment token at PayPal, and every agent stops at the gate.')) return;
                  setBusy('unlink');
                  try {
                    await api('/api/paypal/unlink', { json: {} });
                    await refresh();
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                {busy === 'unlink' ? <Spinner /> : <Unlink className="h-4 w-4" />}
              </button>
            </div>
          ) : null}
          <div className="grid gap-3">
            <Link href="/redteam" className="card flex items-center gap-3 p-4 transition hover:shadow-lift">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-no-bg text-no">
                <ShieldAlert className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">Try to trick it</span>
                <span className="block text-xs text-ink-muted">Six attacks against a live permit</span>
              </span>
              <ArrowRight className="h-4 w-4 text-ink-soft" />
            </Link>
            <Link href="/impact" className="card flex items-center gap-3 p-4 transition hover:shadow-lift">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-[#E8F0FF] text-pp-blue">
                <TrendingUp className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">How this grows PayPal</span>
                <span className="block text-xs text-ink-muted">Users, volume and revenue model</span>
              </span>
              <ArrowRight className="h-4 w-4 text-ink-soft" />
            </Link>
          </div>
        </aside>
      </div>
      <Concierge />
    </div>
  );
}

export default function AppPage() {
  return (
    <Shell wide>
      <Home />
    </Shell>
  );
}
