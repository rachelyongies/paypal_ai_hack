// Streaming helpers: Server-Sent Events for live dashboards, NDJSON for agent runs.
import { subscribe, type ValetEvent } from './events';

export function sseResponse(req: Request, channel: string, map: (e: ValetEvent) => { event: string; data: unknown } | null) {
  const encoder = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          cleanup();
        }
      };
      send('hello', { at: new Date().toISOString() });
      const unsub = subscribe(channel, (e) => {
        const m = map(e);
        if (m) send(m.event, m.data);
      });
      const ping = setInterval(() => send('ping', {}), 15_000);
      cleanup = () => {
        clearInterval(ping);
        unsub();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      req.signal.addEventListener('abort', () => cleanup());
    },
    cancel() {
      cleanup();
    },
  });
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' },
  });
}

export function ndjsonResponse<E>(run: (emit: (e: E) => void) => Promise<void>) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let open = true;
      const emit = (e: E) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(e)}\n`));
        } catch {
          open = false;
        }
      };
      try {
        await run(emit);
      } finally {
        open = false;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' } });
}
