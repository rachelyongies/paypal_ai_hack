import { paypalMode } from '@/lib/config';
import { findRequestByPayPal, getOwner, logWebhook, saveOwner, saveRequest, db } from '@/lib/db';
import { publish } from '@/lib/events';
import { verifyWebhook } from '@/lib/paypal';
import type { PaymentRequest } from '@/lib/types';
import { nowIso, round2 } from '@/lib/util';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Resource = {
  id?: string;
  status?: string;
  amount?: { value?: string };
  custom_id?: string;
  invoice_id?: string;
  supplementary_data?: { related_ids?: { order_id?: string; capture_id?: string } };
  links?: { rel: string; href: string }[];
  disputed_transactions?: { seller_transaction_id?: string; custom?: string }[];
  reason?: string;
  dispute_id?: string;
};

function findByResource(res: Resource): PaymentRequest | undefined {
  const byCustom = res.custom_id ? db().requests[res.custom_id] : undefined;
  if (byCustom) return byCustom;
  const related = res.supplementary_data?.related_ids;
  const upLink = res.links?.find((l) => l.rel === 'up')?.href?.split('/').pop();
  return findRequestByPayPal({ orderId: related?.order_id, captureId: related?.capture_id ?? upLink ?? res.id });
}

// PayPal webhooks: verified, then reconciled into Valet's ledger.
export async function POST(req: Request) {
  const raw = await req.text();
  let event: { id?: string; event_type?: string; resource?: Resource };
  try {
    event = JSON.parse(raw);
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }
  let verified: boolean | 'skipped' = 'skipped';
  // Against real PayPal, never change state from an event PayPal has not signed.
  // Only the labelled simulator (no PayPal keys) accepts unsigned test events.
  if (paypalMode() === 'sandbox') {
    if (!process.env.PAYPAL_WEBHOOK_ID) {
      logWebhook({ id: event.id ?? 'unknown', at: nowIso(), eventType: event.event_type ?? 'unknown', verified: false });
      return new Response('Webhook verification is not configured: set PAYPAL_WEBHOOK_ID', { status: 401 });
    }
    verified = await verifyWebhook(req.headers, event).catch(() => false);
    if (!verified) {
      logWebhook({ id: event.id ?? 'unknown', at: nowIso(), eventType: event.event_type ?? 'unknown', verified: false });
      return new Response('Signature verification failed', { status: 401 });
    }
  }
  const type = event.event_type ?? 'unknown';
  const res = event.resource ?? {};
  let match: PaymentRequest | undefined;

  switch (type) {
    case 'PAYMENT.CAPTURE.COMPLETED': {
      match = findByResource(res);
      if (match && match.status !== 'paid') {
        match.status = 'paid';
        match.timeline.push({ at: nowIso(), label: 'PayPal confirmed the capture', detail: res.id });
      }
      break;
    }
    case 'PAYMENT.CAPTURE.REFUNDED':
    case 'PAYMENT.CAPTURE.REVERSED': {
      match = findByResource(res);
      if (match?.paypal) {
        const value = Number(res.amount?.value ?? match.amount);
        if (!match.paypal.refundId || match.paypal.refundId !== res.id) {
          match.paypal.refundedAmount = Math.min(match.amount, round2((match.paypal.refundedAmount ?? 0) + value));
          match.paypal.refundId = res.id;
        }
        match.status = match.paypal.refundedAmount! >= match.amount - 0.001 ? 'refunded' : 'partially_refunded';
        match.timeline.push({ at: nowIso(), label: type === 'PAYMENT.CAPTURE.REVERSED' ? 'PayPal reversed the payment' : 'PayPal confirmed the refund', detail: res.id });
      }
      break;
    }
    case 'CUSTOMER.DISPUTE.CREATED':
    case 'CUSTOMER.DISPUTE.UPDATED': {
      const tx = res.disputed_transactions?.[0];
      match = tx?.seller_transaction_id ? findRequestByPayPal({ captureId: tx.seller_transaction_id }) : undefined;
      if (match) {
        match.dispute = { id: res.dispute_id ?? res.id ?? 'dispute', reason: res.reason, at: nowIso() };
        match.timeline.push({ at: nowIso(), label: 'Buyer opened a PayPal dispute', detail: `${res.reason ?? ''} Evidence bundle ready.`.trim() });
      }
      break;
    }
    case 'VAULT.PAYMENT-TOKEN.DELETED': {
      for (const o of Object.values(db().owners)) {
        if (o.paypal?.paymentTokenId && o.paypal.paymentTokenId === res.id) {
          o.paypal = null;
          saveOwner(o);
          publish(o.id, { type: 'owner', ownerId: o.id });
        }
      }
      break;
    }
  }
  if (match) {
    saveRequest(match);
    const owner = getOwner(match.ownerId);
    if (owner) publish(owner.id, { type: 'request', request: match });
  }
  logWebhook({ id: event.id ?? 'unknown', at: nowIso(), eventType: type, verified, resource: res.id, matchedRequestId: match?.id });
  publish('webhooks', { type: 'webhook', eventType: type });
  return new Response(null, { status: 200 });
}
