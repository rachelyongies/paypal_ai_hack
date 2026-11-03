'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, Bot, Plus, RotateCcw, ShieldAlert, Unlink } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { PayPalLink } from '@/components/PayPalLink';
import { PermitCard } from '@/components/PermitCard';
import { Concierge } from '@/components/Concierge';
import { ApprovalCard, DecisionCard } from '@/components/RequestCards';
import { api, useSession } from '@/components/session';
import { useActivity } from '@/components/useActivity';
import { money } from '@/components/format';
import { Empty, Pill, SectionTitle, Spinner } from '@/components/ui';

function WalletCard() {
  const { data, refresh } = useSession();
  const [busy, setBusy] = useState(false);
  const p = data?.owner.paypal;
  if (!p) return null;
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <p className="eyebrow">PayPal wallet</p>
        <Pill tone={p.mode === 'sandbox' ? 'blue' : 'muted'}>{p.mode === 'sandbox' ? 'Sandbox vault' : 'Simulated'}</Pill>
      </div>
      <p className="mt-2 font-semibold">{p.payerEmail ?? 'PayPal account'}</p>
      <p className="text-sm text-ink-muted">{p.via === 'paypal_button' ? 'Linked with the PayPal button' : 'Demo wallet'} · agents never see it</p>
      <button
        className="btn btn-xs btn-ghost mt-3 -ml-3 text-no"
        disabled={busy}
        onClick={async () => {
          if (!confirm('Unlink PayPal? Valet deletes the saved payment token at PayPal, and every agent stops at the gate.')) return;
          setBusy(true);
          try {
            await api('/api/paypal/unlink', { json: {} });
            await refresh();
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? <Spinner /> : <Unlink className="h-3.5 w-3.5" />} Unlink PayPal
      </button>
    </div>
  );
}

function Overview() {
  const { data, refresh } = useSession();
  const { requests } = useActivity();
  const [resetting, setResetting] = useState(false);

  if (!data) {
    return (
      <div className="flex items-center gap-2 text-ink-muted">
        <Spinner /> Loading your Valet…
      </div>
    );
  }
  const pending = (requests ?? []).filter((r) => r.status === 'pending_approval');
  const recent = (requests ?? []).filter((r) => r.status !== 'pending_approval').slice(0, 6);
  const paid = (requests ?? []).filter((r) => r.status === 'paid');
  const week = paid.filter((r) => Date.now() - Date.parse(r.createdAt) < 7 * 864e5).reduce((s, r) => s + r.amount, 0);
  const blocked = (requests ?? []).filter((r) => r.status === 'blocked');
  const active = data.permits.filter((p) => p.status !== 'revoked');

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-bold tracking-[-0.03em]">Your agents</h1>
          <p className="text-ink-muted">Everything your AI agents can pay for with PayPal, in one place.</p>
        </div>
        <div className="flex gap-2">
          <button
            className="btn btn-sm btn-ghost"
            disabled={resetting}
            onClick={async () => {
              if (!confirm('Reset demo data? Permits and activity for this browser are cleared.')) return;
              setResetting(true);
              try {
                await api('/api/reset', { json: {} });
                await refresh();
                location.reload();
              } finally {
                setResetting(false);
              }
            }}
          >
            {resetting ? <Spinner /> : <RotateCcw className="h-4 w-4" />} Reset demo
          </button>
          <Link href="/app/permits/new" className="btn btn-sm btn-primary">
            <Plus className="h-4 w-4" /> New permit
          </Link>
        </div>
      </div>

      {!data.owner.paypal ? <PayPalLink /> : null}

      <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        <div className="min-w-0 space-y-8">
          {pending.length ? (
            <section>
              <SectionTitle title="Needs you" sub="Your agents are waiting. Nothing is charged until you tap approve." />
              <div className="space-y-4">
                {pending.map((r) => (
                  <ApprovalCard key={r.id} r={r} />
                ))}
              </div>
            </section>
          ) : null}

          <section>
            <SectionTitle
              title="Permits"
              sub="Each agent gets its own scoped key. Pause or revoke one without touching the others."
              action={active.length ? <Link href="/app/permits/new" className="link text-sm">Add a permit</Link> : null}
            />
            {data.permits.length ? (
              <div className="space-y-4">
                {data.permits.map((p) => (
                  <PermitCard key={p.id} p={p} />
                ))}
              </div>
            ) : (
              <Empty title="No permits yet">
                <p>Write one sentence about what an agent may buy, and Valet turns it into rules.</p>
                <Link href="/app/permits/new" className="btn btn-sm btn-primary mt-4">
                  <Plus className="h-4 w-4" /> Create your first permit
                </Link>
              </Empty>
            )}
          </section>
        </div>

        <aside className="min-w-0 space-y-6">
          <WalletCard />
          <div className="grid grid-cols-2 gap-3">
            <div className="card px-4 py-3">
              <p className="eyebrow">Paid this week</p>
              <p className="mt-1 text-xl font-bold">{money(week)}</p>
            </div>
            <div className="card px-4 py-3">
              <p className="eyebrow">Blocked</p>
              <p className="mt-1 text-xl font-bold">{blocked.length}</p>
            </div>
          </div>
          <section>
            <SectionTitle title="Recent decisions" action={<Link href="/app/activity" className="link text-sm">All activity</Link>} />
            {recent.length ? (
              <div className="space-y-3">
                {recent.map((r) => (
                  <DecisionCard key={r.id} r={r} compact />
                ))}
              </div>
            ) : (
              <Empty title="Quiet so far">
                <div className="mt-3 flex flex-col gap-2">
                  <Link href="/agent" className="btn btn-sm btn-secondary"><Bot className="h-4 w-4" /> Run the demo agent</Link>
                  <Link href="/redteam" className="btn btn-sm btn-ghost"><ShieldAlert className="h-4 w-4" /> Try to trick it</Link>
                </div>
              </Empty>
            )}
          </section>
          <Concierge />
          <Link href="/agent" className="card flex items-center justify-between p-5 hover:bg-pp-surface">
            <span>
              <span className="block font-semibold">Watch an agent shop</span>
              <span className="text-sm text-ink-muted">Scout pays only through Valet.</span>
            </span>
            <ArrowRight className="h-5 w-5" />
          </Link>
        </aside>
      </div>
    </div>
  );
}

export default function AppPage() {
  return (
    <Shell wide>
      <Overview />
    </Shell>
  );
}
