'use client';

import { useRef, useState } from 'react';
import { ArrowUp, Sparkles } from 'lucide-react';
import { Spinner } from './ui';

type Msg = { role: 'user' | 'assistant'; text: string } | { role: 'tool'; text: string; detail?: string; source: string };

const SUGGESTIONS = ['What did my agents buy this week?', 'Why was the gift card purchase blocked?', 'Refund the tent'];

export function Concierge() {
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: 'assistant', text: 'Hi Maya. Ask me what your agents bought, why something was blocked, or to refund a purchase. I can fix mistakes; I can never spend.' },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    const next: Msg[] = [...msgs, { role: 'user', text: text.trim() }];
    setMsgs(next);
    setInput('');
    setBusy(true);
    try {
      const history = next.filter((m): m is { role: 'user' | 'assistant'; text: string } => m.role !== 'tool').slice(1);
      const res = await fetch('/api/concierge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ history }) });
      if (!res.ok || !res.body) throw new Error((await res.json().catch(() => ({}))).error ?? 'Concierge failed');
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
        end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    } catch (e) {
      setMsgs((m) => [...m, { role: 'assistant', text: e instanceof Error ? e.message : String(e) }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card flex flex-col p-5">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-pp-blue" />
        <p className="font-semibold">Ask Valet</p>
        <span className="ml-auto text-xs text-ink-muted">PayPal Agent Toolkit · read and refund only</span>
      </div>
      <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
        {msgs.map((m, i) =>
          m.role === 'tool' ? (
            <p key={i} className="flex items-center gap-1.5 text-xs text-ink-muted">
              <span className={`h-1.5 w-1.5 rounded-full ${m.source === 'paypal-agent-toolkit' ? 'bg-pp-blue' : 'bg-black/40'}`} />
              {m.text}
              {m.detail ? ` · ${m.detail}` : ''}
            </p>
          ) : (
            <div key={i} className={`rounded-tile px-3.5 py-2.5 text-sm ${m.role === 'user' ? 'ml-8 bg-black text-white' : 'mr-4 bg-pp-surface'}`}>{m.text}</div>
          ),
        )}
        {busy ? (
          <p className="flex items-center gap-2 text-xs text-ink-muted">
            <Spinner className="h-3.5 w-3.5" /> Working…
          </p>
        ) : null}
        <div ref={end} />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((s) => (
          <button key={s} className="pill bg-pp-surface text-ink-muted hover:bg-pp-surface2" onClick={() => void send(s)} disabled={busy}>
            {s}
          </button>
        ))}
      </div>
      <form
        className="mt-3 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <input className="input h-11 py-0" placeholder="Ask about your agents…" value={input} onChange={(e) => setInput(e.target.value)} aria-label="Ask Valet" />
        <button className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-black text-white disabled:opacity-40" disabled={busy || !input.trim()} aria-label="Send">
          <ArrowUp className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
