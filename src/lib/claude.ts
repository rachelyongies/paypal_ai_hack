// Thin helpers over the Anthropic SDK. Server-only.
import Anthropic from '@anthropic-ai/sdk';
import type { z } from 'zod';
import { config } from './config';

type G = typeof globalThis & { __anthropic?: Anthropic };
const g = globalThis as G;

export function claudeClient(): Anthropic | null {
  if (!config.ai.hasKey) return null;
  if (!g.__anthropic) g.__anthropic = new Anthropic({ maxRetries: 2, timeout: 60_000 });
  return g.__anthropic;
}

export const MODEL = config.ai.model;

// Server-side refusal fallback: if the model declines, the API reroutes the
// same request instead of returning nothing.
export const FALLBACK = { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const };

export type Effort = 'low' | 'medium' | 'high';

/**
 * One structured-output call: Claude must answer with JSON matching `schema`,
 * which is then validated again with zod before Valet trusts it.
 */
export async function claudeJSON<T>(opts: {
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
  validate: z.ZodType<T>;
  effort?: Effort;
  maxTokens?: number;
}): Promise<T> {
  const client = claudeClient();
  if (!client) throw new Error('ANTHROPIC_API_KEY is not set');
  const res = await client.beta.messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 4000,
    system: opts.system,
    messages: [{ role: 'user', content: opts.prompt }],
    output_config: { effort: opts.effort ?? 'low', format: { type: 'json_schema', schema: opts.schema } },
    ...FALLBACK,
  });
  if (res.stop_reason === 'refusal') throw new Error('Claude declined this request');
  if (res.stop_reason === 'max_tokens') throw new Error('Claude response was cut off');
  const text = res.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')?.text;
  if (!text) throw new Error('Claude returned no JSON');
  return opts.validate.parse(JSON.parse(text));
}
