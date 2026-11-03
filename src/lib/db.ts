// A tiny JSON-file store. One process, in-memory reads, debounced writes.
// Plenty for a hackathon demo; swap for Postgres behind the same functions later.
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config';
import type { DbShape, Owner, PaymentRequest, Permit, WebhookLogEntry } from './types';

type G = typeof globalThis & { __valetDb?: DbShape; __valetDbTimer?: NodeJS.Timeout | null };
const g = globalThis as G;

function filePath() {
  return path.resolve(process.cwd(), config.dataDir, 'valet.json');
}

function empty(): DbShape {
  return { owners: {}, permits: {}, requests: {}, webhooks: [], meta: { version: 1, createdAt: new Date().toISOString() } };
}

export function db(): DbShape {
  if (!g.__valetDb) {
    try {
      const raw = fs.readFileSync(filePath(), 'utf8');
      const parsed = JSON.parse(raw) as DbShape;
      g.__valetDb = { ...empty(), ...parsed };
    } catch {
      g.__valetDb = empty();
    }
  }
  return g.__valetDb;
}

export function persist() {
  if (g.__valetDbTimer) return;
  g.__valetDbTimer = setTimeout(() => {
    g.__valetDbTimer = null;
    try {
      const file = filePath();
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const tmp = `${file}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(db()));
      fs.renameSync(tmp, file);
    } catch (err) {
      console.error('[valet] failed to persist store', err);
    }
  }, 150);
}

// Owners
export function getOwner(id: string): Owner | undefined {
  return db().owners[id];
}
export function saveOwner(o: Owner) {
  db().owners[o.id] = o;
  persist();
  return o;
}

// Permits
export function getPermit(id: string): Permit | undefined {
  return db().permits[id];
}
export function permitByTokenHash(hash: string): Permit | undefined {
  return Object.values(db().permits).find((p) => p.tokenHash === hash);
}
export function permitsFor(ownerId: string): Permit[] {
  return Object.values(db().permits)
    .filter((p) => p.ownerId === ownerId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export function savePermit(p: Permit) {
  db().permits[p.id] = p;
  persist();
  return p;
}

// Requests
export function getRequest(id: string): PaymentRequest | undefined {
  return db().requests[id];
}
export function saveRequest(r: PaymentRequest) {
  db().requests[r.id] = r;
  persist();
  return r;
}
export function requestsFor(ownerId: string): PaymentRequest[] {
  return Object.values(db().requests)
    .filter((r) => r.ownerId === ownerId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export function requestsForPermit(permitId: string): PaymentRequest[] {
  return Object.values(db().requests).filter((r) => r.permitId === permitId);
}
export function allRequests(): PaymentRequest[] {
  return Object.values(db().requests).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export function findRequestByPayPal(ref: { orderId?: string; captureId?: string }): PaymentRequest | undefined {
  return Object.values(db().requests).find(
    (r) => (ref.orderId && r.paypal?.orderId === ref.orderId) || (ref.captureId && r.paypal?.captureId === ref.captureId),
  );
}

// Webhooks
export function logWebhook(entry: WebhookLogEntry) {
  const list = db().webhooks;
  list.unshift(entry);
  if (list.length > 200) list.length = 200;
  persist();
}

export function resetOwnerData(ownerId: string) {
  const d = db();
  for (const [id, p] of Object.entries(d.permits)) if (p.ownerId === ownerId) delete d.permits[id];
  for (const [id, r] of Object.entries(d.requests)) if (r.ownerId === ownerId) delete d.requests[id];
  persist();
}
