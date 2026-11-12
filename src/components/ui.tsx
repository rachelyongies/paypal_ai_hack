import Link from 'next/link';
import { KeyRound, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { STATUS, VERDICT } from './format';
import type { PaymentRequest, Verdict } from '@/lib/types';

const TONE: Record<string, string> = {
  ok: 'bg-ok-bg text-ok',
  ask: 'bg-ask-bg text-ask',
  no: 'bg-no-bg text-no',
  muted: 'bg-fill text-ink-muted',
  blue: 'bg-[#E8F0FF] text-pp-blue',
  dark: 'bg-ink text-white',
};

export function Pill({ tone = 'muted', children, className = '' }: { tone?: keyof typeof TONE | string; children: ReactNode; className?: string }) {
  return <span className={`pill ${TONE[tone] ?? TONE.muted} ${className}`}>{children}</span>;
}

export function Dot({ tone, pulse = false }: { tone: string; pulse?: boolean }) {
  const c = tone === 'ok' ? 'bg-[#12B76A]' : tone === 'ask' ? 'bg-[#F59E0B]' : tone === 'no' ? 'bg-no' : tone === 'blue' ? 'bg-pp-blue' : 'bg-ink-soft';
  return <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${c} ${pulse ? 'animate-pulseDot' : ''}`} aria-hidden />;
}

export function StatusPill({ status }: { status: PaymentRequest['status'] }) {
  const s = STATUS[status];
  return (
    <Pill tone={s.tone}>
      <Dot tone={s.tone} pulse={status === 'pending_approval' || status === 'executing'} />
      {s.label}
    </Pill>
  );
}

export function VerdictPill({ verdict }: { verdict: Verdict }) {
  const v = VERDICT[verdict];
  return <Pill tone={v.tone}>{v.label}</Pill>;
}

export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center rounded-[30%] bg-ink text-white" style={{ width: size, height: size }}>
      <KeyRound style={{ width: size * 0.56, height: size * 0.56 }} strokeWidth={2.4} />
    </span>
  );
}

export function Logo({ href = '/', tag = true }: { href?: string; tag?: boolean }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2.5" aria-label="Valet home">
      <LogoMark />
      <span className="text-[19px] font-bold tracking-[-0.04em]">Valet</span>
      {tag ? <span className="rounded-full bg-fill px-2 py-0.5 text-[11px] font-semibold text-ink-muted">for PayPal</span> : null}
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
    <div className="mb-3 flex items-end justify-between gap-4 px-1">
      <div>
        <h2 className="section-title">{title}</h2>
        {sub ? <p className="mt-0.5 text-sm text-ink-muted">{sub}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, sub, actions, kicker }: { title: string; sub?: ReactNode; actions?: ReactNode; kicker?: string }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {kicker ? <p className="eyebrow mb-1">{kicker}</p> : null}
        <h1 className="page-title">{title}</h1>
        {sub ? <p className="mt-1.5 max-w-2xl text-[15px] text-ink-muted">{sub}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Empty({ title, children, icon }: { title: string; children?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="card px-6 py-10 text-center">
      {icon ? <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-fill">{icon}</div> : null}
      <p className="font-semibold">{title}</p>
      {children ? <div className="mx-auto mt-1 max-w-sm text-sm text-ink-muted">{children}</div> : null}
    </div>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'ok' | 'no' | 'blue' }) {
  const c = tone === 'ok' ? 'text-ok' : tone === 'no' ? 'text-no' : tone === 'blue' ? 'text-pp-blue' : '';
  return (
    <div className="card px-5 py-4">
      <p className="eyebrow">{label}</p>
      <p className={`tabular mt-1 text-[26px] font-bold tracking-[-0.03em] ${c}`}>{value}</p>
      {sub ? <p className="text-xs text-ink-muted">{sub}</p> : null}
    </div>
  );
}

const AVATAR_COLORS = ['#0066F5', '#0A7A3D', '#B45309', '#7C3AED', '#C8102E', '#0E7490', '#111827'];
export function colorFor(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function Avatar({ name, size = 40, icon, color }: { name: string; size?: number; icon?: ReactNode; color?: string }) {
  const c = color ?? colorFor(name);
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full font-semibold leading-none"
      style={{ width: size, height: size, background: `${c}14`, color: c, fontSize: size * 0.4, lineHeight: 1 }}
      aria-hidden
    >
      {icon ?? name.replace(/[^A-Za-z0-9]/g, '').slice(0, 1).toUpperCase()}
    </span>
  );
}

export function IconCircle({ children, tone = 'muted', size = 44 }: { children: ReactNode; tone?: 'muted' | 'blue' | 'dark' | 'ok' | 'no' | 'ask'; size?: number }) {
  const t = {
    muted: 'bg-fill text-ink',
    blue: 'bg-[#E8F0FF] text-pp-blue',
    dark: 'bg-ink text-white',
    ok: 'bg-ok-bg text-ok',
    no: 'bg-no-bg text-no',
    ask: 'bg-ask-bg text-ask',
  }[tone];
  return (
    <span className={`grid shrink-0 place-items-center rounded-full ${t}`} style={{ width: size, height: size }}>
      {children}
    </span>
  );
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-[30px] w-[50px] shrink-0 rounded-full transition-colors duration-200 disabled:opacity-50 ${checked ? 'bg-[#12B76A]' : 'bg-fill-strong'}`}
    >
      <span className={`absolute top-[3px] h-6 w-6 rounded-full bg-white shadow transition-all duration-200 ${checked ? 'left-[23px]' : 'left-[3px]'}`} />
    </button>
  );
}

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { id: T; label: ReactNode }[]; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex rounded-full bg-fill p-1">
      {options.map((o) => (
        <button
          key={o.id}
          role="tab"
          aria-selected={value === o.id}
          onClick={() => onChange(o.id)}
          className={`h-9 rounded-full px-4 text-sm font-semibold transition ${value === o.id ? 'bg-white text-ink shadow-card' : 'text-ink-muted hover:text-ink'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Progress({ value, tone }: { value: number; tone?: string }) {
  const v = Math.max(0, Math.min(100, value));
  const c = tone ?? (v > 90 ? '#C8102E' : v > 70 ? '#F59E0B' : '#0066F5');
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-fill-strong">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${v}%`, background: c }} />
    </div>
  );
}

export function Footer() {
  return (
    <footer className="mt-16">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-8 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between">
        <p>Hackathon prototype for the PayPal AI Hackathon 2026. Not affiliated with or endorsed by PayPal. Sandbox only; no real money moves.</p>
        <p className="flex gap-4">
          <Link className="hover:text-ink" href="/developers">Developers</Link>
          <Link className="hover:text-ink" href="/verify">Verify a receipt</Link>
          <Link className="hover:text-ink" href="/.well-known/jwks.json">JWKS</Link>
        </p>
      </div>
    </footer>
  );
}
