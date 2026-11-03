'use client';

import { useEffect, useState } from 'react';
import { BadgeCheck, FileWarning, ShieldCheck } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { api } from '@/components/session';
import { Spinner } from '@/components/ui';

type Claims = {
  merchant?: { name?: string; domain?: string };
  amount?: string;
  currency?: string;
  items?: { qty: number; name: string }[];
  permit?: { id?: string; purpose?: string };
  agent?: string;
  decision?: { by?: string; guardian?: { verdict: string; risk: number; mode: string } };
  paypal?: { env?: string; order_id?: string; capture_id?: string };
  intent_sha256?: string;
  iat?: number;
};
type Result = { valid: true; claims: Claims; header: Record<string, unknown> } | { valid: false; error: string };

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 border-b border-pp-line py-2 text-sm last:border-0">
      <span className="text-ink-muted">{k}</span>
      <span className="break-all font-medium">{v}</span>
    </div>
  );
}

function Verify() {
  const [token, setToken] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);

  const verify = async (t: string) => {
    setBusy(true);
    try {
      setResult(await api<Result>('/api/receipts/verify', { json: { token: t } }));
    } catch (e) {
      setResult({ valid: false, error: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const fromHash = decodeURIComponent(window.location.hash.slice(1));
    if (fromHash.split('.').length === 3) {
      setToken(fromHash);
      void verify(fromHash);
    }
  }, []);

  // Changes the signed amount without re-signing, to show forgery fails.
  const tamper = () => {
    const parts = token.split('.');
    if (parts.length !== 3) return;
    const json = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    json.amount = (Number(json.amount) * 10).toFixed(2);
    const forged = btoa(JSON.stringify(json)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const t = `${parts[0]}.${forged}.${parts[2]}`;
    setToken(t);
    void verify(t);
  };

  const c = result && result.valid ? result.claims : null;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="eyebrow">For merchants and PayPal risk</p>
        <h1 className="text-[32px] font-bold tracking-[-0.03em]">Verify an agent receipt</h1>
        <p className="text-ink-muted">
          Every payment Valet executes carries an ES256-signed receipt: who authorized it, under which permit, what the agent was asked to do, and the PayPal capture. Check it against Valet&apos;s public key at{' '}
          <a className="link" href="/.well-known/jwks.json">/.well-known/jwks.json</a>.
        </p>
      </div>
      <div className="card p-6">
        <textarea className="input min-h-[120px] font-mono text-xs" placeholder="Paste a receipt (eyJ…)" value={token} onChange={(e) => setToken(e.target.value)} aria-label="Receipt token" />
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn btn-primary" onClick={() => verify(token)} disabled={busy || token.split('.').length !== 3}>
            {busy ? <Spinner /> : <ShieldCheck className="h-4 w-4" />} Verify
          </button>
          <button className="btn btn-secondary" onClick={tamper} disabled={busy || token.split('.').length !== 3} title="Changes the amount without re-signing">
            Tamper with the amount
          </button>
        </div>
        <p className="mt-3 text-xs text-ink-muted">Tip: open any paid row in Activity and choose Verify receipt.</p>
      </div>
      {result ? (
        result.valid && c ? (
          <div className="card animate-rise border-ok/30 p-6">
            <p className="flex items-center gap-2 text-lg font-semibold text-ok">
              <BadgeCheck className="h-6 w-6" /> Valid. Signed by Valet, authorized by the owner&apos;s permit.
            </p>
            <div className="mt-4">
              <Row k="Merchant" v={`${c.merchant?.name ?? ''} (${c.merchant?.domain ?? ''})`} />
              <Row k="Amount" v={`$${c.amount} ${c.currency}`} />
              <Row k="Items" v={(c.items ?? []).map((i) => `${i.qty} × ${i.name}`).join(', ')} />
              <Row k="Permit" v={`${c.permit?.id ?? ''} · ${c.permit?.purpose ?? ''}`} />
              <Row k="Agent" v={c.agent ?? ''} />
              <Row k="Approved by" v={c.decision?.by === 'owner' ? 'The owner, with one tap' : 'The owner’s rules (within limits)'} />
              <Row k="Guardian" v={c.decision?.guardian ? `${c.decision.guardian.verdict}, risk ${c.decision.guardian.risk} (${c.decision.guardian.mode})` : 'n/a'} />
              <Row k="PayPal" v={`${c.paypal?.env ?? ''} order ${c.paypal?.order_id ?? ''} · capture ${c.paypal?.capture_id ?? ''}`} />
              <Row k="Intent hash" v={c.intent_sha256 ?? ''} />
              <Row k="Issued" v={c.iat ? new Date(c.iat * 1000).toLocaleString() : ''} />
            </div>
          </div>
        ) : (
          <div className="card animate-rise border-no/40 p-6">
            <p className="flex items-center gap-2 text-lg font-semibold text-no">
              <FileWarning className="h-6 w-6" /> Not valid
            </p>
            <p className="mt-2 text-sm">{'error' in result ? result.error : ''}</p>
          </div>
        )
      ) : null}
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Shell>
      <Verify />
    </Shell>
  );
}
