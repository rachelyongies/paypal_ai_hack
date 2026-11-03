// What leaves the server. Owners see their own data (including approval keys
// for their QR codes); the Risk Ops view never sees secrets or raw owner ids.
import type { Owner, PaymentRequest, Permit } from './types';
import { sha256 } from './util';
import { ruleChips } from './rules-text';

export function ownerView(o: Owner) {
  return {
    id: o.id,
    displayName: o.displayName,
    frozen: o.frozen,
    paypal: o.paypal ? { mode: o.paypal.mode, via: o.paypal.via, payerEmail: o.paypal.payerEmail, linkedAt: o.paypal.linkedAt } : null,
  };
}

export function permitView(p: Permit, spent?: number) {
  const { tokenHash: _t, ...rest } = p;
  return { ...rest, chips: ruleChips(p.rules), spent };
}

export function requestView(r: PaymentRequest) {
  return r;
}

export function opsView(r: PaymentRequest) {
  const { approval, receipt: _receipt, ownerId, ...rest } = r;
  return {
    ...rest,
    owner: `own_${sha256(ownerId).slice(0, 6)}`,
    approval: approval ? { requestedAt: approval.requestedAt, decidedAt: approval.decidedAt, decision: approval.decision, via: approval.via, expiresAt: approval.expiresAt } : undefined,
    hasReceipt: Boolean(r.receipt),
  };
}
