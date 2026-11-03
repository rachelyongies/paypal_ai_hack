'use client';

import { AgGridReact } from 'ag-grid-react';
import type { GetRowIdParams, ICellRendererParams, IsExternalFilterPresentParams } from 'ag-grid-community';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { PaymentRequest } from '@/lib/types';
import { requestColumns } from './columns';
import { DetailPanel } from './DetailPanel';
import { setupGrid, valetTheme } from './setup';

setupGrid();

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'pending_approval', label: 'Needs you' },
  { id: 'paid', label: 'Paid' },
  { id: 'blocked', label: 'Blocked' },
  { id: 'refunded', label: 'Refunded' },
] as const;

function Detail(p: ICellRendererParams<PaymentRequest>) {
  return p.data ? <DetailPanel r={p.data} owner /> : null;
}

export default function ActivityGrid({ rows }: { rows: PaymentRequest[] }) {
  const grid = useRef<AgGridReact<PaymentRequest>>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('all');
  const [q, setQ] = useState('');
  const tabRef = useRef(tab);
  tabRef.current = tab;
  const columnDefs = useMemo(() => requestColumns(), []);
  const getRowId = useCallback((p: GetRowIdParams<PaymentRequest>) => p.data.id, []);
  const isExternalFilterPresent = useCallback((_p: IsExternalFilterPresentParams) => tabRef.current !== 'all', []);
  const doesExternalFilterPass = useCallback((node: { data?: PaymentRequest }) => {
    const t = tabRef.current;
    if (!node.data) return true;
    if (t === 'refunded') return node.data.status === 'refunded' || node.data.status === 'partially_refunded';
    return node.data.status === t;
  }, []);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setTab(t.id);
              setTimeout(() => grid.current?.api.onFilterChanged(), 0);
            }}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${tab === t.id ? 'bg-black text-white' : 'bg-pp-surface text-black hover:bg-pp-surface2'}`}
          >
            {t.label}
            {t.id !== 'all' ? <span className="ml-1.5 opacity-60">{rows.filter((r) => (t.id === 'refunded' ? r.status.includes('refund') : r.status === t.id)).length}</span> : null}
          </button>
        ))}
        <input className="input ml-auto h-10 max-w-xs py-0" placeholder="Search merchant, item, reason…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search activity" />
      </div>
      <div style={{ height: 620 }}>
        <AgGridReact<PaymentRequest>
          ref={grid}
          theme={valetTheme}
          rowData={rows}
          columnDefs={columnDefs}
          defaultColDef={{ sortable: true, resizable: true, filter: true, suppressHeaderMenuButton: true, suppressHeaderFilterButton: true }}
          getRowId={getRowId}
          masterDetail
          detailCellRenderer={Detail}
          detailRowAutoHeight
          quickFilterText={q}
          isExternalFilterPresent={isExternalFilterPresent}
          doesExternalFilterPass={doesExternalFilterPass}
          animateRows
          tooltipShowDelay={400}
          overlayNoRowsTemplate="<span style='color:rgba(0,0,0,.6)'>No agent activity yet. Run the demo agent or the red team.</span>"
        />
      </div>
    </div>
  );
}
