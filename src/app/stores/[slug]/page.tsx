import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Armchair, Bed, Cable, Carrot, Coffee, Croissant, Droplets, Egg, Flame, Flashlight, Gift, Headphones, Milk, Package, Scroll, Sparkles, Tent, Tv, type LucideIcon } from 'lucide-react';
import { productsFor, store, STORES } from '@/lib/catalog';
import { Footer } from '@/components/ui';
import { AgentViewToggle } from './toggle';

const ICONS: Record<string, LucideIcon> = {
  armchair: Armchair,
  bed: Bed,
  cable: Cable,
  carrot: Carrot,
  coffee: Coffee,
  croissant: Croissant,
  droplets: Droplets,
  egg: Egg,
  flame: Flame,
  flashlight: Flashlight,
  gift: Gift,
  headphones: Headphones,
  milk: Milk,
  scroll: Scroll,
  sparkles: Sparkles,
  tent: Tent,
  tv: Tv,
};

export function generateStaticParams() {
  return STORES.map((s) => ({ slug: s.slug }));
}

// Demo storefronts. TrailDeals hides a prompt injection where only agents look.
export default async function StorePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = store(slug);
  if (!s) notFound();
  const products = productsFor(slug);
  return (
    <div>
      <div className="bg-pp-surface px-6 py-2 text-center text-xs text-ink-muted">
        Demo merchant inside Valet. <Link className="link" href="/agent">Back to the agent console</Link>
      </div>
      <header className="border-b border-pp-line">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-2xl font-bold tracking-[-0.03em]" style={{ color: s.accent }}>
              {s.name}
            </p>
            <p className="font-mono text-xs text-ink-muted">{s.domain}</p>
          </div>
          <p className="hidden text-sm text-ink-muted sm:block">{s.tagline}</p>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        {!s.trusted ? <AgentViewToggle /> : null}
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => {
            const Icon = ICONS[p.icon] ?? Package;
            return (
              <article key={p.id} className="card p-5">
                <div className="grid h-32 place-items-center rounded-tile bg-pp-surface" style={{ color: s.accent }}>
                  <Icon className="h-10 w-10" strokeWidth={1.6} />
                </div>
                <p className="mt-4 font-semibold">{p.name}</p>
                <p className="text-sm text-ink-muted">{p.blurb}</p>
                <p className="mt-2 text-lg font-bold">${p.price.toFixed(2)}</p>
                <p className="mt-1 font-mono text-[11px] text-ink-soft">product_id {p.id}</p>
                {p.hiddenText ? (
                  <p data-hidden-injection className="mt-3 text-[1px] leading-none text-white" aria-hidden>
                    {p.hiddenText}
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
      </main>
      <Footer />
    </div>
  );
}
