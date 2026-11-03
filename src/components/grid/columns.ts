'use client';

import type { ColDef, ValueGetterParams } from 'ag-grid-community';
import type { PaymentRequest } from '@/lib/types';
import { AmountCell, MerchantCell, RiskCell, SignalsCell, SourceCell, StatusCell, VerdictCell } from './renderers';

const CENTER = { display: 'flex', alignItems: 'center' };
const END = { display: 'flex', alignItems: 'center', justifyContent: 'flex-end' };

const time = (p: { value?: string }) => (p.value ? new Date(p.value).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' }) : '');

export function requestColumns(opts: { ops?: boolean } = {}): ColDef<PaymentRequest>[] {
  const cols: ColDef<PaymentRequest>[] = [
    { field: 'createdAt', headerName: 'Time', cellRenderer: 'agGroupCellRenderer', valueFormatter: time, sort: 'desc', minWidth: 170, filter: 'agDateColumnFilter' },
    { field: 'agentName', headerName: 'Agent', filter: 'agSetColumnFilter', enableRowGroup: true, minWidth: 120 },
    { field: 'source', headerName: 'Via', cellRenderer: SourceCell, filter: 'agSetColumnFilter', enableRowGroup: true, minWidth: 100, hide: !opts.ops },
    {
      colId: 'merchant',
      headerName: 'Merchant',
      valueGetter: (p: ValueGetterParams<PaymentRequest>) => p.data?.merchant.name,
      cellRenderer: MerchantCell,
      cellStyle: CENTER,
      filter: 'agSetColumnFilter',
      enableRowGroup: true,
      minWidth: 190,
    },
    {
      colId: 'items',
      headerName: 'Items',
      valueGetter: (p: ValueGetterParams<PaymentRequest>) => p.data?.items.map((i) => `${i.quantity > 1 ? `${i.quantity} × ` : ''}${i.name}`).join(', '),
      filter: 'agTextColumnFilter',
      minWidth: 220,
      flex: 1,
      tooltipValueGetter: (p) => p.value,
    },
    { field: 'amount', headerName: 'Amount', cellRenderer: AmountCell, cellStyle: END, filter: 'agNumberColumnFilter', aggFunc: 'sum', enableValue: true, type: 'rightAligned', minWidth: 110 },
    { field: 'verdict', headerName: 'Decision', cellRenderer: VerdictCell, cellStyle: CENTER, filter: 'agSetColumnFilter', enableRowGroup: true, enableCellChangeFlash: true, minWidth: 120, hide: !opts.ops },
    { field: 'status', headerName: 'Status', cellRenderer: StatusCell, cellStyle: CENTER, filter: 'agSetColumnFilter', enableRowGroup: true, enableCellChangeFlash: true, minWidth: 130 },
    {
      colId: 'riskScore',
      headerName: 'Risk',
      valueGetter: (p: ValueGetterParams<PaymentRequest>) => p.data?.guardian?.riskScore ?? 0,
      cellRenderer: RiskCell,
      cellStyle: CENTER,
      filter: 'agNumberColumnFilter',
      aggFunc: 'max',
      minWidth: 120,
      hide: !opts.ops,
    },
    {
      colId: 'signals',
      headerName: 'Signals',
      valueGetter: (p: ValueGetterParams<PaymentRequest>) => (p.data?.guardian?.signals ?? []).join(' '),
      cellRenderer: SignalsCell,
      cellStyle: CENTER,
      filter: 'agTextColumnFilter',
      minWidth: 200,
      hide: !opts.ops,
    },
    {
      colId: 'guardianMode',
      headerName: 'Guardian',
      valueGetter: (p: ValueGetterParams<PaymentRequest>) => p.data?.guardian?.mode ?? 'gate',
      filter: 'agSetColumnFilter',
      enableRowGroup: true,
      minWidth: 110,
      hide: !opts.ops,
    },
    { field: 'decisionMs', headerName: 'Decision ms', filter: 'agNumberColumnFilter', aggFunc: 'avg', type: 'rightAligned', minWidth: 120, hide: !opts.ops, valueFormatter: (p) => (p.value == null ? '' : Math.round(Number(p.value)).toLocaleString()) },
    { field: 'reason', headerName: 'Why', filter: 'agTextColumnFilter', minWidth: 260, flex: 1.4, tooltipField: 'reason' },
    { colId: 'orderId', headerName: 'PayPal order', valueGetter: (p: ValueGetterParams<PaymentRequest>) => p.data?.paypal?.orderId ?? '', minWidth: 170, cellClass: 'font-mono text-[11.5px]', hide: !opts.ops },
  ];
  return cols;
}

/** Column descriptions handed to AG Grid's AI Toolkit so the model understands the data. */
export const AI_COLUMN_HINTS: Record<string, { description: string; includeSetValues?: boolean }> = {
  createdAt: { description: 'When the agent asked to pay (ISO time)' },
  agentName: { description: 'Name of the AI agent', includeSetValues: true },
  source: { description: 'How the agent connected: demo-agent, mcp, rest, redteam', includeSetValues: true },
  merchant: { description: 'Merchant name', includeSetValues: true },
  items: { description: 'Items in the cart' },
  amount: { description: 'Total in USD' },
  verdict: { description: 'Valet decision: approve, ask (owner approval) or block', includeSetValues: true },
  status: { description: 'paid, pending_approval, blocked, declined, expired, failed, refunded, partially_refunded, executing', includeSetValues: true },
  riskScore: { description: 'Guardian risk score 0 to 100' },
  signals: { description: 'Guardian signals, e.g. prompt_injection task_mismatch price_anomaly merchant_risk' },
  guardianMode: { description: 'claude or rules', includeSetValues: true },
  decisionMs: { description: 'Milliseconds Valet took to decide' },
  reason: { description: 'Plain-English reason shown to the owner' },
};
