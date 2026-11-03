'use client';

import { createElement, useCallback, useEffect, useRef, useState } from 'react';
import { ShieldCheck, Wallet } from 'lucide-react';
import { api, useSession } from './session';
import { Spinner } from './ui';

// Minimal typing for the PayPal JS SDK v6 surface we use.
type SaveSession = { start: (opts: { presentationMode: 'auto' | 'popup' | 'modal' | 'redirect' }, setupToken: Promise<{ vaultSetupToken: string }>) => Promise<void> };
type SdkInstance = {
  findEligibleMethods: (o: { currencyCode: string; paymentFlow: string }) => Promise<{ isEligible: (m: string) => boolean }>;
  createPayPalSavePaymentSession: (o: { onApprove: (d: { vaultSetupToken: string }) => void; onCancel: () => void; onError: (e: unknown) => void }) => SaveSession;
};
declare global {
  interface Window {
    paypal?: { createInstance: (o: { clientToken: string; components: string[]; pageType?: string }) => Promise<SdkInstance> };
  }
}

const SDK_URL = 'https://www.sandbox.paypal.com/web-sdk/v6/core';

function loadSdk(): Promise<void> {
  if (window.paypal) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SDK_URL}"]`);
    const s = existing ?? document.createElement('script');
    s.addEventListener('load', () => resolve());
    s.addEventListener('error', () => reject(new Error('Could not load the PayPal SDK')));
    if (!existing) {
      s.src = SDK_URL;
      s.async = true;
      document.head.appendChild(s);
    }
  });
}

export function PayPalLink() {
  const { data, refresh } = useSession();
  const [phase, setPhase] = useState<'idle' | 'loading' | 'ready' | 'linking' | 'ineligible' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [demoBusy, setDemoBusy] = useState(false);
  const session = useRef<SaveSession | null>(null);
  const button = useRef<HTMLElement | null>(null);
  const sandbox = data?.status.paypalMode === 'sandbox';

  const finish = useCallback(
    async (setupToken: string) => {
      setPhase('linking');
      try {
        await api('/api/paypal/payment-token', { json: { setupToken } });
        setMessage(null);
        await refresh();
      } catch (e) {
        setPhase('error');
        setMessage(e instanceof Error ? e.message : String(e));
      }
    },
    [refresh],
  );

  // Return from a full-page redirect, if the SDK chose one.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const token = p.get('approval_token_id');
    if (token && p.get('linked') === '1') {
      window.history.replaceState({}, '', '/app');
      void finish(token);
    }
  }, [finish]);

  useEffect(() => {
    if (!sandbox || phase !== 'idle') return;
    setPhase('loading');
    (async () => {
      try {
        await loadSdk();
        const { clientToken } = await api<{ clientToken: string }>('/api/paypal/client-token', { json: {} });
        const sdk = await window.paypal!.createInstance({ clientToken, components: ['paypal-payments'], pageType: 'checkout' });
        const methods = await sdk.findEligibleMethods({ currencyCode: 'USD', paymentFlow: 'VAULT_WITHOUT_PAYMENT' });
        if (!methods.isEligible('paypal')) {
          setPhase('ineligible');
          return;
        }
        session.current = sdk.createPayPalSavePaymentSession({
          onApprove: (d) => void finish(d.vaultSetupToken),
          onCancel: () => setPhase('ready'),
          onError: (e) => {
            setPhase('error');
            setMessage(e instanceof Error ? e.message : 'PayPal reported an error. Try again.');
          },
        });
        setPhase('ready');
      } catch (e) {
        setPhase('error');
        setMessage(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [sandbox, phase, finish]);

  useEffect(() => {
    const el = button.current;
    if (!el || phase !== 'ready') return;
    const onClick = async () => {
      if (!session.current) return;
      // Start the promise without awaiting it first, to keep the click's
      // transient activation for the PayPal popup.
      const setupToken = api<{ id: string }>('/api/paypal/setup-token', { json: {} }).then((t) => ({ vaultSetupToken: t.id }));
      try {
        await session.current.start({ presentationMode: 'auto' }, setupToken);
      } catch (e) {
        setPhase('error');
        setMessage(e instanceof Error ? e.message : String(e));
      }
    };
    el.addEventListener('click', onClick);
    return () => el.removeEventListener('click', onClick);
  }, [phase]);

  const useDemo = async () => {
    setDemoBusy(true);
    try {
      await api('/api/paypal/demo-link', { json: {} });
      await refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setDemoBusy(false);
    }
  };

  return (
    <div className="card overflow-hidden">
      <div className="grid gap-6 p-6 md:grid-cols-[1.2fr_1fr] md:p-8">
        <div>
          <p className="eyebrow">Step 1</p>
          <h2 className="mt-2 text-2xl font-bold tracking-[-0.02em]">Link PayPal once</h2>
          <p className="mt-2 text-ink-muted">
            Valet saves your wallet in PayPal&apos;s vault so agents can pay inside the rules you write. Agents never see your login, card or bank.
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            <li className="flex gap-2"><ShieldCheck className="h-4 w-4 shrink-0 text-ok" /> Approve once in PayPal; revoke any time.</li>
            <li className="flex gap-2"><ShieldCheck className="h-4 w-4 shrink-0 text-ok" /> PayPal buyer protection still applies.</li>
          </ul>
        </div>
        <div className="flex flex-col justify-center gap-3">
          {sandbox ? (
            <div className="min-h-[48px]">
              {phase === 'loading' || phase === 'idle' ? (
                <div className="flex h-12 items-center justify-center gap-2 rounded-full bg-pp-surface text-sm text-ink-muted"><Spinner /> Loading PayPal…</div>
              ) : null}
              {createElement('paypal-button', {
                ref: button,
                type: 'pay',
                hidden: phase !== 'ready' && phase !== 'linking',
                class: 'paypal-gold',
                style: { display: phase === 'ready' || phase === 'linking' ? 'block' : 'none', width: '100%' },
              })}
              {phase === 'linking' ? <p className="mt-2 flex items-center gap-2 text-sm text-ink-muted"><Spinner /> Saving your PayPal wallet to the vault…</p> : null}
              {phase === 'ineligible' ? <p className="text-sm text-ink-muted">PayPal saving is not enabled on this sandbox app yet. Turn on Save payment methods, or use the demo wallet.</p> : null}
            </div>
          ) : (
            <p className="rounded-tile bg-pp-surface px-4 py-3 text-sm text-ink-muted">PayPal sandbox keys are not configured, so Valet runs its labelled PayPal simulator.</p>
          )}
          {data?.status.demoWallet ? (
            <button className="btn btn-secondary w-full" onClick={useDemo} disabled={demoBusy}>
              {demoBusy ? <Spinner /> : <Wallet className="h-4 w-4" />} Use the demo wallet{sandbox ? ' (sandbox buyer)' : ''}
            </button>
          ) : null}
          {message ? <p className="text-sm text-no">{message}</p> : null}
        </div>
      </div>
    </div>
  );
}
