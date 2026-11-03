import Link from 'next/link';
import { ArrowRight, BadgeCheck, Ban, Bot, FileCheck2, Hand, KeyRound, ScrollText, ShieldCheck, Sparkles, Undo2, Wallet } from 'lucide-react';
import { Footer, Logo, Pill } from '@/components/ui';

export const metadata = { title: 'Valet: let AI agents pay, keep the keys' };

function DemoCards() {
  return (
    <div className="relative mx-auto w-full max-w-[420px]">
      <div className="card animate-rise p-5">
        <div className="flex items-center justify-between">
          <p className="eyebrow">Scout wants to pay</p>
          <Pill tone="ask">Needs you</Pill>
        </div>
        <p className="mt-3 text-[34px] font-bold tracking-[-0.03em]">$129.00</p>
        <p className="text-sm text-ink-muted">Ridgeline 2-person tent · Trailhead Outfitters</p>
        <div className="mt-4 rounded-tile bg-ask-bg px-4 py-3 text-sm text-ask">$129.00 is above your $75.00 auto-approve limit.</div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <span className="btn btn-sm btn-secondary">Decline</span>
          <span className="btn btn-sm btn-primary">Approve</span>
        </div>
      </div>
      <div className="card animate-rise mt-4 border-no/20 p-5 [animation-delay:150ms] sm:ml-10">
        <div className="flex items-center justify-between">
          <p className="eyebrow">Blocked before any money moved</p>
          <Pill tone="no">Blocked</Pill>
        </div>
        <p className="mt-2 font-semibold">3 × $100 digital gift cards</p>
        <p className="mt-1 text-sm text-ink-muted">A store page told your agent to buy gift cards; that did not come from you.</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Pill tone="no">Prompt injection</Pill>
          <Pill tone="muted">Lookalike store</Pill>
        </div>
      </div>
    </div>
  );
}

const SAFEGUARDS = [
  { icon: ScrollText, title: 'Configurable permissions', body: 'Write the rules in a sentence. Claude turns them into limits you can see and edit.' },
  { icon: Hand, title: 'Instant override', body: 'Pause one agent, revoke its key, or freeze them all from any screen.' },
  { icon: Undo2, title: 'Clear recourse', body: 'Refund any agent purchase in one tap, with a signed evidence trail for disputes.' },
  { icon: Wallet, title: 'Data safeguards', body: 'Your wallet stays in PayPal’s vault. Agents only ever hold a scoped Valet key.' },
];

const STEPS = [
  { icon: KeyRound, title: 'Link PayPal once', body: 'PayPal’s JS SDK saves your wallet to the PayPal vault. No card numbers, ever.' },
  { icon: Sparkles, title: 'Say what agents may buy', body: '“House shopping up to $250 a week, ask me over $75, never gift cards.”' },
  { icon: Bot, title: 'Agents pay inside the rules', body: 'Policy runs first, then an AI guardian checks intent. PayPal executes what passes.' },
];

const BUSINESS = [
  { title: 'New agent volume', body: 'Moves the 32% who let agents pick but not pay into autonomous checkout on PayPal rails.' },
  { title: 'Fewer unauthorized claims', body: 'Every agent payment carries a signed intent record, so disputes resolve on evidence.' },
  { title: 'The wallet in every agent', body: 'Permissions live in the PayPal account, not in one AI platform. MCP and REST today.' },
  { title: 'A daily reason to open PayPal', body: 'Approvals and agent activity bring owners back to a PayPal surface at the moment of trust.' },
];

export default function Landing() {
  return (
    <>
      <header className="border-b border-pp-line">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Logo />
          <nav className="flex items-center gap-2">
            <Link href="/developers" className="btn btn-sm btn-ghost hidden sm:inline-flex">Developers</Link>
            <Link href="/redteam" className="btn btn-sm btn-ghost hidden sm:inline-flex">Red team</Link>
            <Link href="/app" className="btn btn-sm btn-primary">Open the demo</Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-16 pt-14 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <Pill tone="blue">PayPal AI Hackathon 2026 · Agentic commerce</Pill>
            <h1 className="mt-5 text-[44px] font-bold leading-[1.04] tracking-[-0.035em] sm:text-[60px]">
              Let AI agents pay.
              <br />
              <span className="text-pp-blue">Keep the keys.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-ink-muted">
              Valet gives any AI agent a scoped, revocable permission to pay with PayPal, and checks every payment against what you actually asked for.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/app" className="btn btn-primary">
                Open the demo <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/redteam" className="btn btn-secondary">Watch an attack get blocked</Link>
            </div>
            <p className="mt-5 text-sm text-ink-muted">Runs on PayPal sandbox. Each visitor gets a private demo account.</p>
          </div>
          <DemoCards />
        </section>

        <section className="bg-pp-deep text-white">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <p className="text-sm font-semibold uppercase tracking-[0.1em] text-pp-sky">The trust gap</p>
            <h2 className="mt-3 max-w-3xl text-[34px] font-bold leading-tight tracking-[-0.03em] sm:text-[42px]">
              74% of people let AI agents run errands. Only 9% let them pay.
            </h2>
            <p className="mt-3 max-w-2xl text-white/75">
              Accenture asked 25,590 consumers in 16 countries. Payment is the highest hurdle in the whole journey, and four safeguards unlock it. Valet ships all four on PayPal rails.
            </p>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {SAFEGUARDS.map(({ icon: Icon, title, body }) => (
                <div key={title} className="rounded-card bg-white/[0.07] p-5 ring-1 ring-white/10">
                  <Icon className="h-6 w-6 text-pp-sky" />
                  <p className="mt-3 font-semibold">{title}</p>
                  <p className="mt-1 text-sm text-white/70">{body}</p>
                </div>
              ))}
            </div>
            <p className="mt-6 text-xs text-white/50">Source: Accenture Consumer Pulse Research 2026, Figure 1.</p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-16">
          <p className="eyebrow">How it works</p>
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, body }, i) => (
              <div key={title} className="surface p-6">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-black text-sm font-bold text-white">{i + 1}</span>
                  <Icon className="h-5 w-5" />
                </div>
                <p className="mt-4 text-lg font-semibold">{title}</p>
                <p className="mt-1 text-sm text-ink-muted">{body}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="card flex items-start gap-3 p-5">
              <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-ok" />
              <p className="text-sm"><span className="font-semibold">Inside the rules:</span> paid on PayPal instantly, no interruption.</p>
            </div>
            <div className="card flex items-start gap-3 p-5">
              <Hand className="mt-0.5 h-5 w-5 shrink-0 text-[#E08600]" />
              <p className="text-sm"><span className="font-semibold">Near the edge:</span> one tap on your phone, with a reason in plain English.</p>
            </div>
            <div className="card flex items-start gap-3 p-5">
              <Ban className="mt-0.5 h-5 w-5 shrink-0 text-no" />
              <p className="text-sm"><span className="font-semibold">Manipulated or off-task:</span> blocked, explained, and logged for PayPal risk.</p>
            </div>
          </div>
        </section>

        <section className="border-y border-pp-line bg-pp-surface">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 lg:grid-cols-[1fr_1.4fr]">
            <div>
              <p className="eyebrow">Why PayPal wins</p>
              <h2 className="mt-3 text-[32px] font-bold leading-tight tracking-[-0.03em]">“It is really all about trust.”</h2>
              <p className="mt-3 text-ink-muted">PayPal CEO Enrique Lores on agentic commerce, Q3 2026 earnings call. Valet turns that trust into a product people can use today.</p>
              <div className="mt-6 flex flex-wrap gap-2">
                {['Vault v3', 'Orders v2', 'Refunds', 'Webhooks', 'JS SDK v6', 'Agent Toolkit', 'Claude Opus 5.5', 'AG Grid', 'MCP'].map((t) => (
                  <Pill key={t} tone="muted" className="bg-white ring-1 ring-pp-line">{t}</Pill>
                ))}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {BUSINESS.map(({ title, body }) => (
                <div key={title} className="card p-5">
                  <ShieldCheck className="h-5 w-5 text-pp-blue" />
                  <p className="mt-3 font-semibold">{title}</p>
                  <p className="mt-1 text-sm text-ink-muted">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-16 text-center">
          <FileCheck2 className="mx-auto h-8 w-8" />
          <h2 className="mt-4 text-[32px] font-bold tracking-[-0.03em]">Try the whole loop in three minutes.</h2>
          <p className="mx-auto mt-2 max-w-xl text-ink-muted">Link the sandbox wallet, write a permit, let the agent shop, then try to trick it.</p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/app" className="btn btn-primary">Open the demo <ArrowRight className="h-4 w-4" /></Link>
            <Link href="/developers" className="btn btn-secondary">Connect your own agent</Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
