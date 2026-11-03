// Plain-English queries for AG Grid, using AG Grid's AI Toolkit: the grid hands
// us its own JSON schema (getStructuredSchema), Claude fills it, the grid applies it.
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { claudeClient, FALLBACK, MODEL } from './claude';
import { aiMode } from './config';

const FEATURES = ['aggregation', 'filter', 'sort', 'pivot', 'columnVisibility', 'columnSizing', 'rowGroup'] as const;

const ResultZ = z.object({
  gridState: z.record(z.string(), z.unknown()),
  propertiesToIgnore: z.array(z.enum(FEATURES)),
  explanation: z.string(),
});
export type GridQueryResult = z.infer<typeof ResultZ> & { mode: 'claude' | 'rules' };

const SYSTEM = `You control an AG Grid of AI-agent payment requests in Valet, a PayPal permission layer for AI agents.
Translate the analyst's request into grid state that matches the schema exactly.
Columns: createdAt (time), agentName, source (demo-agent, mcp, rest, redteam), merchant, amount (USD number), verdict (approve, ask, block), status (paid, pending_approval, blocked, declined, expired, failed, refunded, partially_refunded, executing), riskScore (0 to 100), signals (text), guardianMode (claude or rules), decisionMs.
Include the current state of features you are not changing so they are kept, and list features you leave untouched in propertiesToIgnore.
explanation: one short sentence saying what the grid now shows.`;

export async function gridQuery(input: { query: string; schema: Record<string, unknown>; state: Record<string, unknown> }): Promise<GridQueryResult> {
  if (aiMode() !== 'claude') return { ...offlineGridQuery(input.query), mode: 'rules' };
  const client = claudeClient()!;
  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['gridState', 'propertiesToIgnore', 'explanation'],
    properties: {
      gridState: input.schema,
      propertiesToIgnore: { type: 'array', items: { type: 'string', enum: [...FEATURES] } },
      explanation: { type: 'string' },
    },
  };
  const prompt = `Current grid state:\n${JSON.stringify(input.state).slice(0, 6000)}\n\nAnalyst request: ${input.query.slice(0, 400)}\n\nAnswer with the requested changes, not a question.`;
  try {
    const res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: SYSTEM,
      messages: [{ role: 'user', content: prompt }],
      output_config: { effort: 'low', format: { type: 'json_schema', schema } },
      ...FALLBACK,
    });
    const text = res.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')?.text ?? '';
    return { ...ResultZ.parse(JSON.parse(text)), mode: 'claude' };
  } catch (err) {
    // The grid's schema can use keywords structured outputs do not accept.
    // Retry once asking for plain JSON that we validate ourselves.
    if (!(err instanceof Anthropic.BadRequestError)) throw err;
    const res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: `${SYSTEM}\nReply with one JSON object only: {"gridState": ..., "propertiesToIgnore": [...], "explanation": "..."}. gridState must follow this JSON schema:\n${JSON.stringify(input.schema).slice(0, 20000)}`,
      messages: [{ role: 'user', content: prompt }],
      output_config: { effort: 'low' },
      ...FALLBACK,
    });
    const text = res.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')?.text ?? '';
    const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
    return { ...ResultZ.parse(JSON.parse(json)), mode: 'claude' };
  }
}

/** Keyword fallback that covers the demo's common questions without a model. */
export function offlineGridQuery(q: string): Omit<GridQueryResult, 'mode'> {
  const s = q.toLowerCase();
  const filterModel: Record<string, unknown> = {};
  const parts: string[] = [];
  const verdict = /block/.test(s) ? 'block' : /(ask|approval|pending|held)/.test(s) ? 'ask' : /approv|paid|allowed/.test(s) ? 'approve' : null;
  if (verdict) {
    filterModel.verdict = { filterType: 'set', values: [verdict] };
    parts.push(`${verdict} decisions`);
  }
  const over = s.match(/(?:over|above|more than|>)\s*\$?(\d+(?:\.\d+)?)/);
  if (over) {
    filterModel.amount = { filterType: 'number', type: 'greaterThan', filter: Number(over[1]) };
    parts.push(`over $${over[1]}`);
  }
  if (/inject/.test(s)) {
    filterModel.signals = { filterType: 'text', type: 'contains', filter: 'prompt_injection' };
    parts.push('with prompt injection');
  }
  if (/red ?team|attack/.test(s)) {
    filterModel.source = { filterType: 'set', values: ['redteam'] };
    parts.push('from the red team');
  }
  const group = /by merchant/.test(s) ? 'merchant' : /by agent/.test(s) ? 'agentName' : /by (verdict|decision)/.test(s) ? 'verdict' : /by source/.test(s) ? 'source' : null;
  const sortCol = /risk/.test(s) ? 'riskScore' : /amount|biggest|largest|expensive/.test(s) ? 'amount' : /slow|latency/.test(s) ? 'decisionMs' : null;
  const gridState: Record<string, unknown> = { filter: { filterModel } };
  const ignore: (typeof FEATURES)[number][] = ['aggregation', 'pivot', 'columnVisibility', 'columnSizing'];
  if (group) {
    gridState.rowGroup = { groupColIds: [group] };
    parts.push(`grouped by ${group === 'agentName' ? 'agent' : group}`);
  } else ignore.push('rowGroup');
  if (sortCol) {
    gridState.sort = { sortModel: [{ colId: sortCol, sort: 'desc' }] };
    parts.push(`sorted by ${sortCol === 'riskScore' ? 'risk' : sortCol === 'decisionMs' ? 'latency' : 'amount'}`);
  } else ignore.push('sort');
  return { gridState, propertiesToIgnore: ignore, explanation: parts.length ? `Showing ${parts.join(', ')}.` : 'Showing everything.' };
}
