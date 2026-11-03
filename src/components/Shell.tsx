'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { Bot, LayoutDashboard, List, Lock, LockOpen, ShieldAlert, Activity as Pulse, Code2 } from 'lucide-react';
import { Footer, Logo, Pill, Spinner } from './ui';
import { api, SessionProvider, useSession } from './session';

const NAV = [
  { href: '/app', label: 'Overview', icon: LayoutDashboard },
  { href: '/app/activity', label: 'Activity', icon: List },
  { href: '/agent', label: 'Agent', icon: Bot },
  { href: '/redteam', label: 'Red team', icon: ShieldAlert },
  { href: '/ops', label: 'Risk Ops', icon: Pulse },
  { href: '/developers', label: 'Developers', icon: Code2 },
];

function FreezeButton() {
  const { data, refresh } = useSession();
  const [busy, setBusy] = useState(false);
  if (!data) return null;
  const frozen = data.owner.frozen;
  return (
    <button
      className={`btn btn-sm ${frozen ? 'bg-no text-white hover:bg-[#a51818]' : 'btn-danger'}`}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await api('/api/freeze', { json: { frozen: !frozen } });
          await refresh();
        } finally {
          setBusy(false);
        }
      }}
      title={frozen ? 'Agents are frozen. Click to let them pay again.' : 'Stop every agent from paying, instantly.'}
    >
      {busy ? <Spinner /> : frozen ? <LockOpen className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
      {frozen ? 'Unfreeze agents' : 'Freeze all agents'}
    </button>
  );
}

function Header() {
  const path = usePathname();
  const { data } = useSession();
  return (
    <header className="sticky top-0 z-40 border-b border-pp-line bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-6">
        <Logo />
        <nav className="hidden items-center gap-0.5 xl:flex" aria-label="Main">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === '/app' ? path === '/app' || path.startsWith('/app/permits') : path.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`relative inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-sm font-semibold transition-colors ${active ? 'bg-black text-white' : 'text-black hover:bg-pp-surface'}`}
              >
                <Icon className="h-4 w-4" />
                {label}
                {label === 'Overview' && data?.pending ? (
                  <span className="ml-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-[#E08600] px-1 text-[11px] font-bold text-white">{data.pending}</span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {data ? (
            <div className="hidden items-center gap-1.5 2xl:flex">
              <Pill tone={data.status.paypalMode === 'sandbox' ? 'blue' : 'muted'}>{data.status.paypalMode === 'sandbox' ? 'PayPal sandbox' : 'PayPal simulator'}</Pill>
              <Pill tone={data.status.aiMode === 'claude' ? 'blue' : 'muted'}>{data.status.aiMode === 'claude' ? 'Claude guardian' : 'Rules guardian'}</Pill>
            </div>
          ) : null}
          <FreezeButton />
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto border-t border-pp-line px-4 py-2 xl:hidden" aria-label="Main mobile">
        {NAV.map(({ href, label }) => (
          <Link key={href} href={href} className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold ${(href === '/app' ? path === '/app' : path.startsWith(href)) ? 'bg-black text-white' : 'text-black'}`}>
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

function FrozenBanner() {
  const { data } = useSession();
  if (!data?.owner.frozen) return null;
  return (
    <div className="bg-no px-6 py-2.5 text-center text-sm font-semibold text-white">
      All agents are frozen. Every payment request is blocked at the gate until you unfreeze.
    </div>
  );
}

export function Shell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <SessionProvider>
      <Header />
      <FrozenBanner />
      <main className={`mx-auto ${wide ? 'max-w-7xl' : 'max-w-6xl'} px-6 py-8`}>{children}</main>
      <Footer />
    </SessionProvider>
  );
}
