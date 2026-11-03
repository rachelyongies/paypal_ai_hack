import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { HttpError } from './session';

export function json(data: unknown, init?: number | ResponseInit) {
  return NextResponse.json(data, typeof init === 'number' ? { status: init } : init);
}

/** Wraps a route handler with consistent JSON error responses. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message, code: err.code }, err.status);
      if (err instanceof ZodError) return json({ error: 'Invalid request', issues: err.issues }, 400);
      console.error('[valet] unhandled', err);
      return json({ error: err instanceof Error ? err.message : 'Unexpected error' }, 500);
    }
  };
}
