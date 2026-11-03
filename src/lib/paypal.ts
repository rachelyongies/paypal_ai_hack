// PayPal REST client for the sandbox, plus a labelled simulator for local runs
// without credentials. Every call Valet makes to PayPal lives in this file.
import { config, paypalMode } from './config';
import { round2, sleep } from './util';
import crypto from 'node:crypto';

export class PayPalError extends Error {
  constructor(
    message: string,
    public status: number,
    public debugId?: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

type G = typeof globalThis & { __ppToken?: { value: string; expiresAt: number } };
const g = globalThis as G;

function basicAuth() {
  return Buffer.from(`${config.paypal.clientId}:${config.paypal.clientSecret}`).toString('base64');
}

async function oauth(extra = ''): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch(`${config.paypal.apiBase}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${basicAuth()}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=client_credentials${extra}`,
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new PayPalError(data?.error_description || `PayPal auth failed (${res.status})`, res.status, res.headers.get('paypal-debug-id') ?? undefined, data);
  }
  return data;
}

async function accessToken(): Promise<string> {
  if (g.__ppToken && g.__ppToken.expiresAt > Date.now() + 60_000) return g.__ppToken.value;
  const data = await oauth();
  g.__ppToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

async function call<T = Record<string, unknown>>(
  method: 'GET' | 'POST' | 'DELETE' | 'PATCH',
  path: string,
  body?: unknown,
  opts: { requestId?: string } = {},
): Promise<T & { _debugId?: string }> {
  const token = await accessToken();
  const res = await fetch(`${config.paypal.apiBase}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(opts.requestId ? { 'PayPal-Request-Id': opts.requestId } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  });
  const debugId = res.headers.get('paypal-debug-id') ?? undefined;
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const detail = Array.isArray(data?.details) && data.details[0] ? ` ${data.details[0].issue}: ${data.details[0].description ?? ''}` : '';
    throw new PayPalError(`${data?.message || data?.name || `PayPal ${res.status}`}${detail}`.trim(), res.status, debugId ?? data?.debug_id, data);
  }
  return Object.assign(data, { _debugId: debugId });
}

const simId = (p: string) => `${p}${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

// ---------------------------------------------------------------------------
// Browser-safe client token for the JS SDK v6 (`window.paypal.createInstance`).
export async function createClientToken(): Promise<string> {
  if (paypalMode() === 'simulated') throw new PayPalError('PayPal keys are not configured; use the demo wallet.', 400);
  const data = await oauth('&response_type=client_token');
  return data.access_token;
}

// ---------------------------------------------------------------------------
// Vault v3: save the owner's PayPal wallet without a purchase.
export async function createSetupToken(returnUrl: string, cancelUrl: string) {
  return call<{ id: string; status: string; links?: { href: string; rel: string }[] }>(
    'POST',
    '/v3/vault/setup-tokens',
    {
      payment_source: {
        paypal: {
          description: 'Valet: lets your AI agents pay with PayPal inside the rules you set',
          usage_type: 'MERCHANT',
          customer_type: 'CONSUMER',
          permit_multiple_payment_tokens: true,
          experience_context: {
            brand_name: 'Valet',
            return_url: returnUrl,
            cancel_url: cancelUrl,
            vault_instruction: 'ON_PAYER_APPROVAL',
          },
        },
      },
    },
    { requestId: crypto.randomUUID() },
  );
}

export interface PaymentTokenResult {
  id: string;
  customerId?: string;
  payerEmail?: string;
}

export async function createPaymentToken(setupTokenId: string): Promise<PaymentTokenResult> {
  const data = await call<{
    id: string;
    customer?: { id: string };
    payment_source?: { paypal?: { email_address?: string } };
  }>('POST', '/v3/vault/payment-tokens', { payment_source: { token: { id: setupTokenId, type: 'SETUP_TOKEN' } } }, { requestId: crypto.randomUUID() });
  return { id: data.id, customerId: data.customer?.id, payerEmail: data.payment_source?.paypal?.email_address };
}

export async function deletePaymentToken(paymentTokenId: string, mode: 'sandbox' | 'simulated') {
  if (mode === 'simulated' || paypalMode() === 'simulated') return;
  await call('DELETE', `/v3/vault/payment-tokens/${encodeURIComponent(paymentTokenId)}`);
}

// ---------------------------------------------------------------------------
// Orders v2: charge the vaulted wallet with the customer not present.
export interface ChargeInput {
  requestId: string;
  vaultId: string;
  mode: 'sandbox' | 'simulated';
  merchantName: string;
  items: { name: string; sku?: string; unitPrice: number; quantity: number; digital: boolean }[];
}

export interface ChargeResult {
  orderId: string;
  captureId?: string;
  status: string;
  debugId?: string;
  payerActionUrl?: string;
}

const cents = (n: number) => Math.round(n * 100);
const fmt = (c: number) => (c / 100).toFixed(2);

export async function chargeVault(input: ChargeInput): Promise<ChargeResult> {
  const itemCents = input.items.map((i) => cents(i.unitPrice) * i.quantity);
  const totalCents = itemCents.reduce((a, b) => a + b, 0);

  if (input.mode === 'simulated' || paypalMode() === 'simulated') {
    await sleep(350 + Math.random() * 300);
    return { orderId: simId('SIM-'), captureId: simId('SIMCAP-'), status: 'COMPLETED' };
  }

  const order = await call<{
    id: string;
    status: string;
    links?: { href: string; rel: string }[];
    purchase_units?: { payments?: { captures?: { id: string; status: string }[] } }[];
    _debugId?: string;
  }>(
    'POST',
    '/v2/checkout/orders',
    {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: input.requestId,
          custom_id: input.requestId,
          invoice_id: `VALET-${input.requestId}`,
          description: `Agent purchase at ${input.merchantName} via Valet`.slice(0, 127),
          amount: {
            currency_code: 'USD',
            value: fmt(totalCents),
            breakdown: { item_total: { currency_code: 'USD', value: fmt(totalCents) } },
          },
          items: input.items.map((i) => ({
            name: i.name.slice(0, 127),
            sku: i.sku?.slice(0, 127),
            quantity: String(i.quantity),
            unit_amount: { currency_code: 'USD', value: fmt(cents(i.unitPrice)) },
            category: i.digital ? 'DIGITAL_GOODS' : 'PHYSICAL_GOODS',
          })),
        },
      ],
      payment_source: { paypal: { vault_id: input.vaultId } },
    },
    // Idempotency: retrying the same Valet request can never double charge.
    { requestId: `valet-${input.requestId}` },
  );

  let status = order.status;
  let captureId = order.purchase_units?.[0]?.payments?.captures?.[0]?.id;
  let debugId = order._debugId;

  if (status === 'APPROVED' && !captureId) {
    const captured = await capture(order.id, input.requestId);
    status = captured.status;
    captureId = captured.captureId;
    debugId = captured.debugId ?? debugId;
  }
  const payerActionUrl = order.links?.find((l) => l.rel === 'payer-action')?.href;
  return { orderId: order.id, captureId, status, debugId, payerActionUrl };
}

async function capture(orderId: string, requestId: string) {
  const data = await call<{
    status: string;
    purchase_units?: { payments?: { captures?: { id: string }[] } }[];
    _debugId?: string;
  }>('POST', `/v2/checkout/orders/${orderId}/capture`, {}, { requestId: `valet-cap-${requestId}` });
  return { status: data.status, captureId: data.purchase_units?.[0]?.payments?.captures?.[0]?.id, debugId: data._debugId };
}

// ---------------------------------------------------------------------------
// Refunds: one-tap recourse for the owner.
export async function refundCapture(opts: {
  captureId: string;
  amount?: number;
  requestId: string;
  mode: 'sandbox' | 'simulated';
}): Promise<{ refundId: string; status: string; debugId?: string }> {
  if (opts.mode === 'simulated' || paypalMode() === 'simulated') {
    await sleep(300);
    return { refundId: simId('SIMREF-'), status: 'COMPLETED' };
  }
  const data = await call<{ id: string; status: string; _debugId?: string }>(
    'POST',
    `/v2/payments/captures/${encodeURIComponent(opts.captureId)}/refund`,
    {
      ...(opts.amount ? { amount: { value: round2(opts.amount).toFixed(2), currency_code: 'USD' } } : {}),
      note_to_payer: 'Refunded by the account owner in Valet',
    },
    { requestId: `valet-ref-${opts.requestId}-${opts.amount ?? 'full'}` },
  );
  return { refundId: data.id, status: data.status, debugId: data._debugId };
}

// ---------------------------------------------------------------------------
// Webhooks: verify that an event really came from PayPal.
export async function verifyWebhook(headers: Headers, event: unknown): Promise<boolean> {
  if (!config.paypal.webhookId || paypalMode() === 'simulated') return false;
  const data = await call<{ verification_status: string }>('POST', '/v1/notifications/verify-webhook-signature', {
    auth_algo: headers.get('paypal-auth-algo'),
    cert_url: headers.get('paypal-cert-url'),
    transmission_id: headers.get('paypal-transmission-id'),
    transmission_sig: headers.get('paypal-transmission-sig'),
    transmission_time: headers.get('paypal-transmission-time'),
    webhook_id: config.paypal.webhookId,
    webhook_event: event,
  });
  return data.verification_status === 'SUCCESS';
}
