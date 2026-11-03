'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowRight, BadgeCheck, Bell, Repeat, ShieldCheck, Sparkles, Store, TrendingUp, UserPlus, Wallet } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { IconCircle, PageHeader } from '@/components/ui';
import { compact, DEFAULT_MODEL, PAYPAL_Q3_2026, runModel, TAKE_RATE, type ModelInput } from '@/lib/impact';

function Slider({ label, hint, value, min, max, step, format, onChange }: { label: string; hint: string; value: number; min: number; max: number; step: number; format: (v: number) => string; onChange: (v: number) => void }) {
  const p = ((value - min) / (max - min)) * 100;
  return (
    <label className="block">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold">{label}</span>
        <span className="tabular text-[17px] font-bold tracking-[-0.02em]">{format(value)}</span>
      </div>
      <input type="range" className="slider mt-3 w-full" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ ['--p' as string]: `${p}%` }} aria-label={label} />
      <span className="mt-1.5 block text-xs text-ink-muted">{hint}</span>
    </label>
  );
}

const LEVERS = [
  { icon: UserPlus, title: 'Every agent needs a wallet', body: 'Agent platforms send people to “Link PayPal”. People without PayPal open an account to give their agent a key.', metric: 'New accounts' },
  { icon: Bell, title: 'Approvals bring people back', body: 'Approvals, receipts and controls live with PayPal, so the moment of trust happens on a PayPal surface, every week.', metric: 'Engagement' },
  { icon: TrendingUp, title: 'Purchases that never happened', body: 'Only 9% let agents buy today. Clear rules move the 32% who let agents pick, but not pay, into checkout.', metric: 'Agent TPV' },
  { icon: Wallet, title: 'Branded wallet economics', body: 'Agent payments run on the PayPal wallet from the vault, not on a card a platform could swap out.', metric: 'Margin' },
  { icon: ShieldCheck, title: 'Fewer unauthorized claims', body: 'Every payment carries a signed intent record and a guardian verdict, so disputes resolve on evidence.', metric: 'Lower losses' },
  { icon: Store, title: 'Agent Protection for merchants', body: 'Verified agent orders with dispute evidence attached, a natural premium add-on for Agent Ready merchants.', metric: 'New revenue line' },
];

function Impact() {
  const [m, setM] = useState<ModelInput>(DEFAULT_MODEL);
  const out = useMemo(() => runModel(m), [m]);
  const set = (k: keyof ModelInput) => (v: number) => setM((x) => ({ ...x, [k]: v }));

  return (
    <div className="space-y-10">
      <PageHeader
        kicker="For PayPal"
        title="How Valet grows PayPal"
        sub="Agents will shop for millions of people. Valet makes PayPal the place where they get permission to pay: more users, more engagement, more volume, fewer losses."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <section className="card space-y-7 p-6 sm:p-7">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-pp-blue" />
            <h2 className="section-title">Move the assumptions</h2>
          </div>
          <Slider label="Active accounts that give an agent a permit" hint={`Of PayPal's ${compact(PAYPAL_Q3_2026.activeAccounts)} active accounts`} value={m.adoption} min={0.0025} max={0.1} step={0.0025} format={(v) => `${(v * 100).toFixed(v < 0.01 ? 2 : 1)}%`} onChange={set('adoption')} />
          <Slider label="Agent spend per wallet, per month" hint="Groceries, household restocks, subscriptions, travel" value={m.monthlySpend} min={25} max={500} step={5} format={(v) => `$${v}`} onChange={set('monthlySpend')} />
          <Slider label="New PayPal accounts per adopter" hint="People who join PayPal to give their agent a wallet" value={m.newUserRatio} min={0} max={0.5} step={0.01} format={(v) => `${Math.round(v * 100)}%`} onChange={set('newUserRatio')} />
          <Slider label="Revenue per dollar of agent volume" hint={`Q3 2026: $8.6B revenue ÷ $487.1B TPV = ${(TAKE_RATE * 100).toFixed(2)}%`} value={m.takeRate} min={0.01} max={0.03} step={0.0005} format={(v) => `${(v * 100).toFixed(2)}%`} onChange={set('takeRate')} />
          <button className="link text-sm" onClick={() => setM(DEFAULT_MODEL)}>Reset to the base case</button>
        </section>

        <section className="relative overflow-hidden rounded-card bg-[#00103D] p-6 text-white shadow-float sm:p-8">
          <div className="pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full bg-[#0066F5] opacity-60 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 -left-10 h-72 w-72 rounded-full bg-[#60CDFF] opacity-25 blur-3xl" />
          <div className="relative">
            <p className="text-sm font-medium text-white/70">Annual revenue for PayPal</p>
            <p className="tabular mt-1 text-[64px] font-bold leading-none tracking-[-0.05em]">{compact(out.annualRevenue, true)}</p>
            <p className="mt-2 text-sm text-white/70">from {compact(out.annualTpv, true)} of agent payments a year</p>
            <div className="mt-8 grid grid-cols-2 gap-4">
              <div className="rounded-xl2 bg-white/[0.08] p-4 ring-1 ring-white/10">
                <p className="text-xs text-white/60">Agent wallets</p>
                <p className="tabular mt-1 text-[28px] font-bold tracking-[-0.03em]">{compact(out.wallets)}</p>
              </div>
              <div className="rounded-xl2 bg-white/[0.08] p-4 ring-1 ring-white/10">
                <p className="text-xs text-white/60">New PayPal accounts</p>
                <p className="tabular mt-1 text-[28px] font-bold tracking-[-0.03em]">+{compact(out.newAccounts)}</p>
              </div>
              <div className="rounded-xl2 bg-white/[0.08] p-4 ring-1 ring-white/10">
                <p className="text-xs text-white/60">Agent volume a year</p>
                <p className="tabular mt-1 text-[28px] font-bold tracking-[-0.03em]">{compact(out.annualTpv, true)}</p>
              </div>
              <div className="rounded-xl2 bg-white/[0.08] p-4 ring-1 ring-white/10">
                <p className="text-xs text-white/60">Approval moments a week</p>
                <p className="tabular mt-1 text-[28px] font-bold tracking-[-0.03em]">{compact(out.wallets * 2)}</p>
              </div>
            </div>
            <p className="mt-6 text-xs leading-relaxed text-white/55">
              Illustrative model. Facts: {compact(PAYPAL_Q3_2026.activeAccounts)} active accounts and {(TAKE_RATE * 100).toFixed(2)}% revenue per dollar of TPV, from {PAYPAL_Q3_2026.source}. Adoption, spend, new accounts and two approvals a week per wallet are assumptions.
            </p>
          </div>
        </section>
      </div>

      <section>
        <h2 className="section-title mb-4 px-1">Where the growth comes from</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {LEVERS.map(({ icon: Icon, title, body, metric }) => (
            <div key={title} className="card p-5">
              <div className="flex items-center justify-between">
                <IconCircle tone="blue" size={42}>
                  <Icon className="h-5 w-5" />
                </IconCircle>
                <span className="pill bg-fill text-ink-muted">{metric}</span>
              </div>
              <p className="mt-4 font-semibold">{title}</p>
              <p className="mt-1 text-sm text-ink-muted">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <h2 className="text-[24px] font-bold tracking-[-0.03em]">Why only PayPal can ship this</h2>
          <p className="mt-2 text-ink-muted">The permission layer needs a wallet people already trust, merchants that already accept it, and a risk engine that already sees the traffic.</p>
          <Link href="/ops" className="btn btn-secondary mt-5">
            See the Risk Ops view <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {[
            ['440M active accounts', 'A wallet most agent users already have.'],
            ['Buyer protection', 'Recourse people already understand.'],
            ['Agent Ready and Store Sync', 'Merchants already reachable inside AI surfaces.'],
            ['Risk models at scale', 'Valet adds intent labels they lack today.'],
          ].map(([t, b]) => (
            <li key={t} className="flex gap-3 rounded-xl2 bg-fill p-4">
              <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-pp-blue" />
              <span>
                <span className="block text-sm font-semibold">{t}</span>
                <span className="block text-xs text-ink-muted">{b}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <p className="flex items-center gap-2 px-1 text-xs text-ink-muted">
        <Repeat className="h-3.5 w-3.5" /> Consumer figures: Accenture Consumer Pulse Research 2026 (25,590 consumers, 16 countries). PayPal figures: Q3 2026 results.
      </p>
    </div>
  );
}

export default function ImpactPage() {
  return (
    <Shell wide>
      <Impact />
    </Shell>
  );
}
