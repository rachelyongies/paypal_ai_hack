import Link from 'next/link';
import { KeyRound, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { STATUS, VERDICT } from './format';
import type { PaymentRequest, Verdict } from '@/lib/types';

const TONE: Record<string, string> = {
  ok: 'bg-ok-bg text-ok',
  ask: 'bg-ask-bg text-ask',
  no: 'bg-no-bg text-no',
  muted: 'bg-pp-surface2 text-ink-muted',
  blue: 'bg-[#E6F0FF] text-pp-blue',
};

export function Pill({ tone = 'muted', children, className = '' }: { tone?: keyof typeof TONE | string; children: ReactNode; className?: string }) {
  return <span className={`pill ${TONE[tone] ?? TONE.muted} ${className}`}>{children}</span>;
}

export function Dot({ tone }: { tone: string }) {
  const c = tone === 'ok' ? 'bg-ok' : tone === 'ask' ? 'bg-[#E08600]' : tone === 'no' ? 'bg-no' : tone === 'blue' ? 'bg-pp-blue' : 'bg-ink-soft';
  return <span className={`inline-block h-1.5 w-1.5 rounded-full ${c}`} aria-hidden />;
}

export function StatusPill({ status }: { status: PaymentRequest['status'] }) {
  const s = STATUS[status];
  return (
    <Pill tone={s.tone}>
      <Dot tone={s.tone} />
      {s.label}
    </Pill>
  );
}

export function VerdictPill({ verdict }: { verdict: Verdict }) {
  const v = VERDICT[verdict];
  return <Pill tone={v.tone}>{v.label}</Pill>;
}

export function Logo({ size = 'md', href = '/' }: { size?: 'sm' | 'md'; href?: string }) {
  const box = size === 'sm' ? 'h-7 w-7 rounded-[9px]' : 'h-8 w-8 rounded-[10px]';
  return (
    <Link href={href} className="group inline-flex items-center gap-2.5" aria-label="Valet home">
      <span className={`${box} grid place-items-center bg-black text-white`}>
        <KeyRound className="h-[18px] w-[18px]" strokeWidth={2.4} />
      </span>
      <span className="text-[19px] font-bold tracking-[-0.03em]">Valet</span>
      <span className="pill border border-pp-line bg-white text-[11px] font-semibold text-ink-muted">for PayPal</span>
    </Link>
  );
}

export function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return <Loader2 className={`${className} animate-spin`} aria-hidden />;
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>;
}

export function SectionTitle({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {sub ? <p className="mt-0.5 text-sm text-ink-muted">{sub}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="surface px-6 py-8 text-center">
      <p className="font-semibold">{title}</p>
      {children ? <div className="mt-1 text-sm text-ink-muted">{children}</div> : null}
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card px-5 py-4">
      <p className="eyebrow">{label}</p>
      <p className="mt-1.5 text-[26px] font-bold tracking-[-0.02em]">{value}</p>
      {sub ? <p className="text-xs text-ink-muted">{sub}</p> : null}
    </div>
  );
}

export function Footer() {
  return (
    <footer className="mt-20 border-t border-pp-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-8 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between">
        <p>Hackathon prototype for the PayPal AI Hackathon 2026. Not affiliated with or endorsed by PayPal. Sandbox only; no real money moves.</p>
        <p className="flex gap-4">
          <Link className="hover:text-black" href="/developers">Developers</Link>
          <Link className="hover:text-black" href="/verify">Verify a receipt</Link>
          <Link className="hover:text-black" href="/.well-known/jwks.json">JWKS</Link>
        </p>
      </div>
    </footer>
  );
}
