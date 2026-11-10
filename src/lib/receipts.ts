// Signed agent receipts (ES256 JWS). A merchant, or PayPal's risk team, can
// verify that the account owner's permit authorized a specific agent purchase.
import fs from 'node:fs';
import path from 'node:path';
import { SignJWT, createLocalJWKSet, exportJWK, exportPKCS8, generateKeyPair, importPKCS8, jwtVerify, type JWK, type JWTPayload, type CryptoKey } from 'jose';
import { config } from './config';
import type { PaymentRequest, Permit } from './types';
import { sha256 } from './util';

const KID = 'valet-es256-1';
const TYP = 'valet-receipt+jwt';
const ISSUER = 'valet';

type Keys = { privateKey: CryptoKey; publicJwk: JWK };
type G = typeof globalThis & { __valetKeys?: Promise<Keys> };
const g = globalThis as G;

async function loadKeys(): Promise<Keys> {
  let pem = config.signingKeyPem.replace(/\\n/g, '\n');
  const file = path.resolve(process.cwd(), config.dataDir, 'signing-key.pem');
  if (!pem) {
    try {
      pem = fs.readFileSync(file, 'utf8');
    } catch {
      const { privateKey } = await generateKeyPair('ES256', { extractable: true });
      pem = await exportPKCS8(privateKey);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, pem, { mode: 0o600 });
    }
  }
  const privateKey = await importPKCS8(pem, 'ES256', { extractable: true });
  const { kty, crv, x, y } = await exportJWK(privateKey);
  return { privateKey, publicJwk: { kty, crv, x, y, kid: KID, alg: 'ES256', use: 'sig' } };
}

function keys() {
  if (!g.__valetKeys) g.__valetKeys = loadKeys();
  return g.__valetKeys;
}

export async function jwks() {
  const { publicJwk } = await keys();
  return { keys: [publicJwk] };
}

export interface ReceiptClaims extends JWTPayload {
  v: 1;
  merchant: { name: string; domain: string };
  amount: string;
  currency: 'USD';
  items: { name: string; qty: number; unit: string }[];
  items_sha256: string;
  intent_sha256: string;
  permit: { id: string; purpose: string };
  agent: string;
  decision: { verdict: 'approve'; by: 'policy' | 'owner'; guardian?: { verdict: string; risk: number; mode: string } };
  paypal: { order_id?: string; capture_id?: string; env: 'sandbox' | 'simulated' };
}

export async function signReceipt(r: PaymentRequest, permit: Permit, approvedBy: 'policy' | 'owner'): Promise<string> {
  const { privateKey } = await keys();
  const items = r.items.map((i) => ({ name: i.name, qty: i.quantity, unit: i.unitPrice.toFixed(2) }));
  const claims: ReceiptClaims = {
    v: 1,
    merchant: r.merchant,
    amount: r.amount.toFixed(2),
    currency: 'USD',
    items,
    items_sha256: sha256(JSON.stringify(items)),
    intent_sha256: sha256(r.task),
    permit: { id: permit.id, purpose: permit.rules.purpose },
    agent: r.agentName,
    decision: {
      verdict: 'approve',
      by: approvedBy,
      guardian: r.guardian ? { verdict: r.guardian.verdict, risk: r.guardian.riskScore, mode: r.guardian.mode } : undefined,
    },
    paypal: { order_id: r.paypal?.orderId, capture_id: r.paypal?.captureId, env: r.paypal?.mode ?? 'simulated' },
  };
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'ES256', kid: KID, typ: TYP })
    .setIssuer(ISSUER)
    .setSubject(`owner:${sha256(r.ownerId).slice(0, 16)}`)
    .setAudience(r.merchant.domain)
    .setJti(r.id)
    .setIssuedAt()
    .sign(privateKey);
}

export async function verifyReceipt(token: string): Promise<{ valid: true; claims: ReceiptClaims; header: Record<string, unknown> } | { valid: false; error: string }> {
  try {
    const set = createLocalJWKSet(await jwks());
    const { payload, protectedHeader } = await jwtVerify(token.trim(), set, { issuer: ISSUER, typ: TYP, algorithms: ['ES256'] });
    return { valid: true, claims: payload as ReceiptClaims, header: protectedHeader as Record<string, unknown> };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { valid: false, error: msg.includes('signature') ? 'Signature does not match Valet’s public key. The receipt was altered or forged.' : msg };
  }
}

