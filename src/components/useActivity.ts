'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PaymentRequest } from '@/lib/types';
import { api, useLiveEvents } from './session';

/** The owner's requests, kept live through the shared event stream. */
export function useActivity() {
  const [requests, setRequests] = useState<PaymentRequest[] | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const load = useCallback(async () => {
    const out = await api<{ requests: PaymentRequest[] }>('/api/activity');
    setRequests(out.requests);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useLiveEvents((e) => {
    if (e.type === 'request') {
      setFlash(e.request.id);
      setRequests((prev) => {
        const list = prev ?? [];
        const i = list.findIndex((r) => r.id === e.request.id);
        if (i === -1) return [e.request, ...list];
        const copy = list.slice();
        copy[i] = e.request;
        return copy;
      });
    }
    if (e.type === 'owner') void load();
  });
  return { requests, reload: load, flash };
}
