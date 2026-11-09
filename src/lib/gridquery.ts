// Plain-English queries for AG Grid, using AG Grid's AI Toolkit: the grid hands
// us its own JSON schema (getStructuredSchema), Claude fills it, the grid applies it.
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { claudeClient, FALLBACK, MODEL } from './claude';
import { aiMode } from './config';

const FEATURES = ['aggregation', 'filter', 'sort', 'pivot', 'columnVisibility', 'columnSizing', 'rowGroup'] as const;

const ResultZ = z.object({
  gridState: z.record(z.string(), z.unknown()),
  propertiesToIgnore: z.array(z.string()),
  explanation: z.string(),
});
export type GridQueryResult = z.infer<typeof ResultZ> & { mode: 'claude' | 'rules' };

// JSON Schema keywords that structured outputs reject: array, number and string constraints.
// AG Grid's schema uses some of them; the grid still validates the state it applies.
const UNSUPPORTED = new Set(['minItems', 'maxItems', 'uniqueItems', 'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf', 'minLength', 'maxLength', 'pattern']);

/** Returns a copy of a JSON schema that structured outputs accept. */
export function structuredSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(structuredSchema);
  if (!node || typeof node !== 'object') return node;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (UNSUPPORTED.has(key)) continue;
    // Under properties and $defs the keys are names, not keywords, so keep every one.
    out[key] =
      (key === 'properties' || key === '$defs') && value && typeof value === 'object'
        ? Object.fromEntries(Object.entries(value).map(([name, sub]) => [name, structuredSchema(sub)]))
        : structuredSchema(value);
  }
  if (out.properties && out.additionalProperties !== false) out.additionalProperties = false;
  return out;
}

/** Validates Claude's answer and keeps only the state properties the grid can be told to leave alone. */
export function cleanResult(raw: unknown, ignorable: readonly string[]): Omit<GridQueryResult, 'mode'> {
  const out = ResultZ.parse(raw);
  return { ...out, propertiesToIgnore: [...new Set(out.propertiesToIgnore.filter((p) => ignorable.includes(p)))] };
}

const SYSTEM = `You control an AG Grid of AI-agent payment requests in Valet, a PayPal permission layer for AI agents.
Translate the analyst's request into grid state that matches the schema exactly.
Columns: createdAt (time), agentName, source (demo-agent, mcp, rest, redteam), merchant, amount (USD number), verdict (approve, ask, block), status (paid, pending_approval, blocked, declined, expired, failed, refunded, partially_refunded, executing), riskScore (0 to 100), signals (text), guardianMode (claude or rules), decisionMs.
Include the current state of features you are not changing so they are kept, and list features you leave untouched in propertiesToIgnore.
explanation: one short sentence saying what the grid now shows.`;

type GridQueryInput = { query: string; schema: Record<string, unknown>; state: Record<string, unknown> };

export async function gridQuery(input: GridQueryInput): Promise<GridQueryResult> {
  if (aiMode() !== 'claude') return { ...offlineGridQuery(input.query), mode: 'rules' };
  try {
    return { ...(await claudeGridQuery(input)), mode: 'claude' };
  } catch (err) {
    // Never leave the analyst with an error: answer with the keyword parser, labelled as such.
    console.error('[valet] grid query fell back to keywords', err);
    return { ...offlineGridQuery(input.query), mode: 'rules' };
  }
}

async function claudeGridQuery(input: GridQueryInput): Promise<Omit<GridQueryResult, 'mode'>> {
  const client = claudeClient()!;
  // Features in the schema plus anything already in the grid's state (column order, pagination, ...).
  const ignorable = [...new Set([...FEATURES, ...Object.keys(input.state)])];
  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['gridState', 'propertiesToIgnore', 'explanation'],
    properties: {
      gridState: structuredSchema(input.schema),
      propertiesToIgnore: { type: 'array', items: { type: 'string', enum: ignorable } },
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
    return cleanResult(JSON.parse(text), ignorable);
  } catch (err) {
    // If the API still rejects the schema, retry once asking for plain JSON that we validate ourselves.
    if (!(err instanceof Anthropic.BadRequestError)) throw err;
    const res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: `${SYSTEM}\nReply with one JSON object only: {"gridState": ..., "propertiesToIgnore": [...], "explanation": "..."}. propertiesToIgnore may only contain: ${ignorable.join(', ')}. gridState must follow this JSON schema:\n${JSON.stringify(input.schema).slice(0, 20000)}`,
      messages: [{ role: 'user', content: prompt }],
      output_config: { effort: 'low' },
      ...FALLBACK,
    });
    const text = res.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')?.text ?? '';
    const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
    return cleanResult(JSON.parse(json), ignorable);
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
