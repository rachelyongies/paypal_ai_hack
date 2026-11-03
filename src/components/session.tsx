'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { PaymentRequest } from '@/lib/types';
import type { PermitView, SessionData } from './client-types';

export type LiveEvent = { type: 'request'; request: PaymentRequest } | { type: 'permit'; permit: PermitView } | { type: 'owner' };

// One EventSource per tab, shared by every component that listens.
const listeners = new Set<(e: LiveEvent) => void>();
let source: EventSource | null = null;

function ensureSource() {
  if (source || typeof window === 'undefined') return;
  source = new EventSource('/api/events');
  source.addEventListener('request', (m) => listeners.forEach((l) => l({ type: 'request', request: JSON.parse((m as MessageEvent).data) })));
  source.addEventListener('permit', (m) => listeners.forEach((l) => l({ type: 'permit', permit: JSON.parse((m as MessageEvent).data) })));
  source.addEventListener('owner', () => listeners.forEach((l) => l({ type: 'owner' })));
}

export function useLiveEvents(handler: (e: LiveEvent) => void) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    ensureSource();
    const fn = (e: LiveEvent) => ref.current(e);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
}

export async function api<T = unknown>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const res = await fetch(path, {
    ...init,
    method: init?.method ?? (init?.json !== undefined ? 'POST' : 'GET'),
    headers: { ...(init?.json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(init?.headers ?? {}) },
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  return data as T;
}

const Ctx = createContext<{ data: SessionData | null; refresh: () => Promise<void>; error: string | null }>({ data: null, refresh: async () => {}, error: null });

export function SessionProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<SessionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refresh = useCallback(async () => {
    try {
      setData(await api<SessionData>('/api/session'));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useLiveEvents(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void refresh(), 120);
  });
  return <Ctx.Provider value={{ data, refresh, error }}>{children}</Ctx.Provider>;
}

export function useSession() {
  return useContext(Ctx);
}
