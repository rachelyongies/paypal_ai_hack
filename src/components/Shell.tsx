'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { BadgeCheck, Bot, Code2, House, Plus, Radar, ReceiptText, ShieldAlert, Snowflake, TrendingUp, Wallet } from 'lucide-react';
import { Footer, Logo, LogoMark, Switch } from './ui';
import { api, SessionProvider, useSession } from './session';

type Item = { href: string; label: string; icon: typeof House; match?: (p: string) => boolean };
const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: 'Account',
    items: [
      { href: '/app', label: 'Home', icon: House, match: (p) => p === '/app' || p.startsWith('/app/permits') },
      { href: '/app/activity', label: 'Activity', icon: ReceiptText },
    ],
  },
  {
    title: 'Try it',
    items: [
      { href: '/agent', label: 'Agent console', icon: Bot },
      { href: '/redteam', label: 'Red team', icon: ShieldAlert },
    ],
  },
  {
    title: 'For PayPal',
    items: [
      { href: '/impact', label: 'Growth model', icon: TrendingUp },
      { href: '/ops', label: 'Risk Ops', icon: Radar },
    ],
  },
  {
    title: 'Build',
    items: [
      { href: '/developers', label: 'Developers', icon: Code2 },
      { href: '/verify', label: 'Verify receipt', icon: BadgeCheck },
    ],
  },
];
const MOBILE: Item[] = [GROUPS[0].items[0], GROUPS[0].items[1], GROUPS[1].items[0], GROUPS[1].items[1], GROUPS[2].items[0]];

const isActive = (item: Item, path: string) => (item.match ? item.match(path) : path.startsWith(item.href));

function useFreeze() {
  const { data, refresh } = useSession();
  const [busy, setBusy] = useState(false);
  const frozen = data?.owner.frozen ?? false;
  const set = async (canPay: boolean) => {
    setBusy(true);
    try {
      await api('/api/freeze', { json: { frozen: !canPay } });
      await refresh();
    } finally {
      setBusy(false);
    }
  };
  return { frozen, busy, set, ready: Boolean(data) };
}

function FreezeCard() {
  const { frozen, busy, set, ready } = useFreeze();
  const { data } = useSession();
  if (!ready) return null;
  return (
    <div className="rounded-xl2 bg-white p-4 shadow-card">
      <div className="flex items-center gap-3">
        <span className={`grid h-9 w-9 place-items-center rounded-full ${frozen ? 'bg-no-bg text-no' : 'bg-[#E8F0FF] text-pp-blue'}`}>
          <Snowflake className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Agent payments</p>
          <p className={`text-xs ${frozen ? 'text-no' : 'text-ink-muted'}`}>{frozen ? 'Frozen' : 'On'}</p>
        </div>
        <Switch checked={!frozen} onChange={set} label="Agent payments" disabled={busy} />
      </div>
      <div className="mt-3 flex items-center gap-2 border-t border-pp-line pt-3 text-xs text-ink-muted">
        <Wallet className="h-3.5 w-3.5" />
        {data?.owner.paypal ? (
          <span className="truncate">PayPal {data.owner.paypal.mode === 'sandbox' ? 'sandbox' : 'demo'} wallet linked</span>
        ) : (
          <Link href="/app" className="link">Link PayPal</Link>
        )}
      </div>
    </div>
  );
}

function Sidebar() {
  const path = usePathname();
  const { data } = useSession();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] flex-col px-5 py-6 lg:flex">
      <div className="px-2">
        <Logo href="/" />
      </div>
      <Link href="/app/permits/new" className="btn btn-primary mt-6 w-full">
        <Plus className="h-4 w-4" /> New permit
      </Link>
      <nav className="mt-6 flex-1 space-y-5 overflow-y-auto" aria-label="Main">
        {GROUPS.map((g) => (
          <div key={g.title}>
            <p className="px-3 pb-1.5 text-[12px] font-medium text-ink-soft">{g.title}</p>
            <ul className="space-y-0.5">
              {g.items.map((item) => {
                const active = isActive(item, path);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex h-10 items-center gap-3 rounded-full px-3 text-[14.5px] font-medium transition ${active ? 'bg-white font-semibold text-ink shadow-card' : 'text-ink-muted hover:bg-white/60 hover:text-ink'}`}
                    >
                      <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.3 : 2} />
                      <span className="flex-1">{item.label}</span>
                      {item.href === '/app' && data?.pending ? (
                        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#F59E0B] px-1.5 text-[11px] font-bold text-white">{data.pending}</span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <FreezeCard />
      {data ? (
        <p className="mt-3 px-2 text-[11px] text-ink-soft">
          {data.status.paypalMode === 'sandbox' ? 'PayPal sandbox' : 'PayPal simulator'} · {data.status.aiMode === 'claude' ? 'Claude guardian' : 'Rules guardian'}
        </p>
      ) : null}
    </aside>
  );
}

function MobileBars() {
  const path = usePathname();
  const { frozen, busy, set, ready } = useFreeze();
  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-pp-line bg-canvas/90 px-4 backdrop-blur lg:hidden">
        <Link href="/" className="flex items-center gap-2" aria-label="Valet home">
          <LogoMark size={28} />
          <span className="text-[17px] font-bold tracking-[-0.04em]">Valet</span>
        </Link>
        {ready ? (
          <div className="flex items-center gap-2 text-xs font-semibold">
            <span className={frozen ? 'text-no' : 'text-ink-muted'}>{frozen ? 'Frozen' : 'Payments on'}</span>
            <Switch checked={!frozen} onChange={set} label="Agent payments" disabled={busy} />
          </div>
        ) : null}
      </header>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-pp-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Main mobile">
        {MOBILE.map((item) => {
          const Icon = item.icon;
          const active = isActive(item, path);
          return (
            <Link key={item.href} href={item.href} className={`flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold ${active ? 'text-ink' : 'text-ink-soft'}`}>
              <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
              {item.label.split(' ')[0]}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

function FrozenBanner() {
  const { data } = useSession();
  if (!data?.owner.frozen) return null;
  return (
    <div className="mb-6 flex items-center gap-3 rounded-xl2 bg-no px-5 py-3.5 text-sm font-semibold text-white">
      <Snowflake className="h-4 w-4" /> All agent payments are frozen. Every request is blocked at the gate until you switch payments back on.
    </div>
  );
}

export function Shell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <SessionProvider>
      <Sidebar />
      <MobileBars />
      <div className="lg:pl-[264px]">
        <main className={`mx-auto ${wide ? 'max-w-[1180px]' : 'max-w-[1040px]'} px-5 pb-24 pt-6 lg:px-10 lg:pb-10 lg:pt-10`}>
          <FrozenBanner />
          {children}
        </main>
        <div className="hidden lg:block">
          <Footer />
        </div>
      </div>
    </SessionProvider>
  );
}
