import { cookies } from 'next/headers';
import { getOwner, saveOwner } from './db';
import type { Owner } from './types';

const OWNER_COOKIE = 'valet_owner';

export async function ownerIdFromCookie(): Promise<string | null> {
  const store = await cookies();
  const v = store.get(OWNER_COOKIE)?.value;
  return v && /^own_[a-f0-9]{32}$/.test(v) ? v : null;
}

/** Returns the visitor's owner record, creating it on first use. */
export async function currentOwner(): Promise<Owner | null> {
  const ownerId = await ownerIdFromCookie();
  if (!ownerId) return null;
  return ensureOwner(ownerId);
}

export function ensureOwner(ownerId: string): Owner {
  const existing = getOwner(ownerId);
  if (existing) return existing;
  return saveOwner({
    id: ownerId,
    createdAt: new Date().toISOString(),
    displayName: 'Maya',
    frozen: false,
    paypal: null,
  });
}

export async function requireOwner(): Promise<Owner> {
  const o = await currentOwner();
  if (!o) throw new HttpError(401, 'No Valet session. Reload the page to start one.');
  return o;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}
