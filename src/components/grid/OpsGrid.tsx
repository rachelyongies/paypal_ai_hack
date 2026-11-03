'use client';

import { AgGridReact } from 'ag-grid-react';
import type { GetRowIdParams, GridApi, GridState, ICellRendererParams, StructuredSchemaFeature } from 'ag-grid-community';
import { useCallback, useMemo, useRef, useState } from 'react';
import { RotateCcw, Sparkles } from 'lucide-react';
import type { PaymentRequest } from '@/lib/types';
import { AI_COLUMN_HINTS, requestColumns } from './columns';
import { DetailPanel } from './DetailPanel';
import { setupGrid, valetTheme } from './setup';
import { api } from '../session';
import { Spinner } from '../ui';

setupGrid();

const SUGGESTIONS = ['Blocked payments over $50 by merchant', 'Prompt injection attempts, riskiest first', 'Everything that asked the owner, grouped by agent', 'Red team attacks by decision', 'Slowest decisions first'];

function Detail(p: ICellRendererParams<PaymentRequest>) {
  return p.data ? <DetailPanel r={p.data} /> : null;
}

export default function OpsGrid({ rows }: { rows: PaymentRequest[] }) {
  const apiRef = useRef<GridApi<PaymentRequest> | null>(null);
  const initial = useRef<GridState | null>(null);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [meta, setMeta] = useState<string | null>(null);
  const columnDefs = useMemo(() => requestColumns({ ops: true }), []);
  const getRowId = useCallback((p: GetRowIdParams<PaymentRequest>) => p.data.id, []);

  // AG Grid AI Toolkit: the grid describes its own state as a JSON schema,
  // Claude fills it from plain English, and the grid applies the result.
  const ask = async (text: string) => {
    const gridApi = apiRef.current;
    if (!gridApi || !text.trim()) return;
    setBusy(true);
    setExplanation(null);
    try {
      const schema = gridApi.getStructuredSchema({ exclude: ['columnSizing', 'pivot'] as StructuredSchemaFeature[], columns: AI_COLUMN_HINTS });
      const out = await api<{ gridState: GridState; propertiesToIgnore: string[]; explanation: string; mode: string; ms: number }>('/api/grid-query', {
        json: { query: text, schema, state: gridApi.getState() as Record<string, unknown> },
      });
      gridApi.setState(out.gridState, out.propertiesToIgnore as never);
      setExplanation(out.explanation);
      setMeta(`${out.mode === 'claude' ? 'Claude' : 'Keyword parser'} · ${(out.ms / 1000).toFixed(1)} s`);
    } catch (e) {
      setExplanation(e instanceof Error ? e.message : String(e));
      setMeta(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <form
        className="card flex flex-col gap-3 p-2 pl-5 md:flex-row md:items-center md:rounded-full"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(q);
        }}
      >
        <div className="flex flex-1 items-center gap-3">
          <Sparkles className="h-5 w-5 shrink-0 text-pp-blue" />
          <input className="h-12 w-full bg-transparent text-[15px] placeholder:text-ink-soft focus:outline-none" placeholder="Ask anything, e.g. blocked payments over $50 by merchant" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Ask the grid in plain English" />
        </div>
        <div className="flex gap-2">
          <button className="btn btn-primary" disabled={busy || !q.trim()}>
            {busy ? <Spinner /> : 'Ask'}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              if (apiRef.current && initial.current) apiRef.current.setState(initial.current);
              setExplanation(null);
              setMeta(null);
              setQ('');
            }}
          >
            <RotateCcw className="h-4 w-4" /> Reset
          </button>
        </div>
      </form>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            className="pill bg-white px-3 py-1.5 text-ink-muted shadow-card hover:text-ink"
            onClick={() => {
              setQ(s);
              void ask(s);
            }}
            disabled={busy}
          >
            {s}
          </button>
        ))}
      </div>
      {explanation ? (
        <p className="mt-3 text-sm">
          <span className="font-semibold">{explanation}</span> {meta ? <span className="text-ink-muted">· {meta} · via AG Grid AI Toolkit</span> : null}
        </p>
      ) : null}
      <div className="mt-5 overflow-hidden rounded-card shadow-card" style={{ height: 640 }}>
        <AgGridReact<PaymentRequest>
          theme={valetTheme}
          rowData={rows}
          columnDefs={columnDefs}
          defaultColDef={{ sortable: true, resizable: true, filter: true, suppressHeaderMenuButton: true }}
          autoGroupColumnDef={{ minWidth: 240, headerName: 'Group' }}
          getRowId={getRowId}
          masterDetail
          detailCellRenderer={Detail}
          detailRowAutoHeight
          rowGroupPanelShow="always"
          isGroupOpenByDefault={(p) => Boolean(p.rowNode.group)}
          suppressAggFuncInHeader
          animateRows
          sideBar={{ toolPanels: ['columns', 'filters'], hiddenByDefault: false, defaultToolPanel: undefined }}
          onGridReady={(e) => {
            apiRef.current = e.api;
            initial.current = e.api.getState();
          }}
          overlayNoRowsTemplate="<span style='color:rgba(0,0,0,.6)'>No agent payments yet.</span>"
        />
      </div>
    </div>
  );
}
