'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Sparkles, X } from 'lucide-react';
import { Spinner } from './ui';

type Msg = { role: 'user' | 'assistant'; text: string } | { role: 'tool'; text: string; detail?: string; source: string };

const SUGGESTIONS = ['What did my agents buy this week?', 'Why was the gift card purchase blocked?', 'Refund the tent'];

/** "Ask Valet": a floating assistant built on the PayPal Agent Toolkit (read and refund only). */
export function Concierge() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: 'assistant', text: 'Hi Maya. Ask what your agents bought, why something was blocked, or ask me to refund a purchase. I can fix mistakes; I can never spend.' },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [msgs, busy]);

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    const next: Msg[] = [...msgs, { role: 'user', text: text.trim() }];
    setMsgs(next);
    setInput('');
    setBusy(true);
    try {
      const history = next.filter((m): m is { role: 'user' | 'assistant'; text: string } => m.role !== 'tool').slice(1);
      const res = await fetch('/api/concierge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ history }) });
      if (!res.ok || !res.body) throw new Error((await res.json().catch(() => ({}))).error ?? 'Ask Valet failed');
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          const e = JSON.parse(line);
          if (e.type === 'assistant') setMsgs((m) => [...m, { role: 'assistant', text: e.text }]);
          if (e.type === 'tool') setMsgs((m) => [...m, { role: 'tool', text: e.label, detail: e.detail, source: e.source }]);
          if (e.type === 'error') setMsgs((m) => [...m, { role: 'assistant', text: `Something went wrong: ${e.message}` }]);
        }
      }
    } catch (e) {
      setMsgs((m) => [...m, { role: 'assistant', text: e instanceof Error ? e.message : String(e) }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {!open ? (
        <button onClick={() => setOpen(true)} className="fixed bottom-20 right-5 z-40 flex h-12 items-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-white shadow-float transition hover:bg-[#25272C] lg:bottom-6 lg:right-6" aria-label="Ask Valet">
          <Sparkles className="h-4 w-4 text-pp-sky" /> Ask Valet
        </button>
      ) : null}
      {open ? (
        <div className="fixed inset-x-3 bottom-20 z-40 flex max-h-[70vh] animate-sheet flex-col overflow-hidden rounded-card bg-white shadow-pop sm:left-auto sm:right-6 sm:w-[400px] lg:bottom-6" role="dialog" aria-label="Ask Valet">
          <div className="flex items-center gap-3 border-b border-pp-line px-5 py-4">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-ink text-white">
              <Sparkles className="h-4 w-4 text-pp-sky" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Ask Valet</p>
              <p className="text-xs text-ink-muted">PayPal Agent Toolkit · read and refund only</p>
            </div>
            <button className="grid h-9 w-9 place-items-center rounded-full hover:bg-fill" onClick={() => setOpen(false)} aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 space-y-2.5 overflow-y-auto px-4 py-4">
            {msgs.map((m, i) =>
              m.role === 'tool' ? (
                <p key={i} className="flex items-center gap-1.5 pl-1 text-xs text-ink-muted">
                  <span className={`h-1.5 w-1.5 rounded-full ${m.source === 'paypal-agent-toolkit' ? 'bg-pp-blue' : 'bg-ink/40'}`} />
                  {m.text}
                  {m.detail ? ` · ${m.detail}` : ''}
                </p>
              ) : (
                <div key={i} className={`max-w-[88%] rounded-[18px] px-3.5 py-2.5 text-sm ${m.role === 'user' ? 'ml-auto rounded-br-md bg-ink text-white' : 'rounded-bl-md bg-fill'}`}>
                  {m.text}
                </div>
              ),
            )}
            {busy ? (
              <p className="flex items-center gap-2 pl-1 text-xs text-ink-muted">
                <Spinner className="h-3.5 w-3.5" /> Working…
              </p>
            ) : null}
            <div ref={end} />
          </div>
          <div className="flex flex-wrap gap-1.5 px-4 pb-2">
            {SUGGESTIONS.map((s) => (
              <button key={s} className="pill bg-fill text-ink-muted hover:bg-fill-strong" onClick={() => void send(s)} disabled={busy}>
                {s}
              </button>
            ))}
          </div>
          <form
            className="flex items-center gap-2 p-4 pt-2"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <input className="input h-11 py-0" placeholder="Ask about your agents…" value={input} onChange={(e) => setInput(e.target.value)} aria-label="Ask Valet a question" />
            <button className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink text-white disabled:opacity-35" disabled={busy || !input.trim()} aria-label="Send question">
              <ArrowUp className="h-4 w-4" />
            </button>
          </form>
        </div>
      ) : null}
    </>
  );
}
