// In-process pub/sub that feeds the Server-Sent Events streams.
import { EventEmitter } from 'node:events';
import type { PaymentRequest, Permit } from './types';

export type ValetEvent =
  | { type: 'request'; request: PaymentRequest }
  | { type: 'permit'; permit: Permit }
  | { type: 'owner'; ownerId: string }
  | { type: 'webhook'; eventType: string };

type G = typeof globalThis & { __valetBus?: EventEmitter };
const g = globalThis as G;

function bus() {
  if (!g.__valetBus) {
    g.__valetBus = new EventEmitter();
    g.__valetBus.setMaxListeners(500);
  }
  return g.__valetBus;
}

/** Publish to the owner's channel and to the global Risk Ops channel. */
export function publish(ownerId: string, event: ValetEvent) {
  bus().emit(`owner:${ownerId}`, event);
  bus().emit('ops', { ...event, ownerId });
}

export function subscribe(channel: string, fn: (e: ValetEvent) => void) {
  bus().on(channel, fn);
  return () => bus().off(channel, fn);
}
