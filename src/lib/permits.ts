// Permits: plain-English rules compiled into enforceable policy, and the
// scoped, revocable tokens agents use to request payments.
import { z } from 'zod';
import { claudeJSON } from './claude';
import { aiMode } from './config';
import { permitByTokenHash, savePermit } from './db';
import { publish } from './events';
import { CATEGORIES, type AgentKind, type Category, type Owner, type Permit, type PermitRules } from './types';
import { id, nowIso, secret, sha256 } from './util';

/** Categories that are the classic cash-out routes for fraud. Blocked unless the owner opts in. */
export const DEFAULT_BLOCKED: Category[] = ['gift_cards', 'crypto', 'cash_equivalents', 'gambling'];

const nullable = (schema: Record<string, unknown>) => ({ anyOf: [schema, { type: 'null' }] });

export const RULES_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'purpose',
    'budget',
    'perPurchaseMax',
    'autoApproveUpTo',
    'allowedCategories',
    'blockedCategories',
    'allowedMerchants',
    'blockedMerchants',
    'maxPurchasesPerHour',
    'expiresInDays',
    'notes',
  ],
  properties: {
    purpose: { type: 'string', description: 'Five words or fewer, e.g. "Weekly house shopping"' },
    budget: nullable({
      type: 'object',
      additionalProperties: false,
      required: ['amount', 'period'],
      properties: { amount: { type: 'number' }, period: { type: 'string', enum: ['day', 'week', 'month'] } },
    }),
    perPurchaseMax: nullable({ type: 'number' }),
    autoApproveUpTo: nullable({ type: 'number' }),
    allowedCategories: nullable({ type: 'array', items: { type: 'string', enum: [...CATEGORIES] } }),
    blockedCategories: { type: 'array', items: { type: 'string', enum: [...CATEGORIES] } },
    allowedMerchants: nullable({ type: 'array', items: { type: 'string' } }),
    blockedMerchants: { type: 'array', items: { type: 'string' } },
    maxPurchasesPerHour: nullable({ type: 'integer' }),
    expiresInDays: nullable({ type: 'integer' }),
    notes: { type: 'array', items: { type: 'string' } },
  },
} as const;

const categoryZ = z.enum(CATEGORIES);
export const RulesZ = z.object({
  purpose: z.string().min(1).max(80),
  budget: z.object({ amount: z.number().positive(), period: z.enum(['day', 'week', 'month']) }).nullable(),
  perPurchaseMax: z.number().positive().nullable(),
  autoApproveUpTo: z.number().min(0).nullable(),
  allowedCategories: z.array(categoryZ).nullable(),
  blockedCategories: z.array(categoryZ),
  allowedMerchants: z.array(z.string()).nullable(),
  blockedMerchants: z.array(z.string()),
  maxPurchasesPerHour: z.number().int().positive().nullable(),
  expiresInDays: z.number().int().positive().nullable(),
  notes: z.array(z.string().max(200)).max(8),
});

const COMPILER_SYSTEM = `You turn a person's plain-English spending permission for an AI agent into enforceable rules for Valet, a PayPal permission layer.

Rules for interpretation:
- Money: "up to $X a week/day/month" sets budget. "ask me (for anything) over/above $X" sets autoApproveUpTo to X. "always ask me" sets autoApproveUpTo to 0. "never more than $X at once / per purchase" sets perPurchaseMax.
- Categories the person says the agent may buy go in allowedCategories (null if they did not limit categories). Map camping or hiking gear to outdoor, cleaning supplies or toiletries to household, food delivery to restaurants, flights or hotels to travel.
- Anything the person says "never" or "no" about goes in blockedCategories or blockedMerchants.
- Always include gift_cards, crypto, cash_equivalents and gambling in blockedCategories unless the person explicitly allows one of them. These are the most common ways stolen money is cashed out.
- Merchants: only fill allowedMerchants when the person names stores to stick to. Use the store name as written.
- If the person does not mention a burst limit, set maxPurchasesPerHour to 6. If they do not mention an end date, set expiresInDays to 30.
- When the sentence is ambiguous, choose the stricter reading and record what you assumed in notes, written to the person in under 12 words.
- purpose is a short label for the permit, five words or fewer.
Never invent limits the person did not imply, other than the defaults above.`;

export async function compileRules(sentence: string): Promise<{ rules: PermitRules; compiledBy: 'claude' | 'rules'; error?: string }> {
  const text = sentence.trim().slice(0, 1200);
  if (aiMode() === 'claude') {
    try {
      const rules = await claudeJSON({
        system: COMPILER_SYSTEM,
        prompt: `Permission sentence:\n"""${text}"""`,
        schema: RULES_JSON_SCHEMA as unknown as Record<string, unknown>,
        validate: RulesZ,
        effort: 'low',
      });
      return { rules: normalizeRules(rules), compiledBy: 'claude' };
    } catch (err) {
      return { rules: compileRulesOffline(text), compiledBy: 'rules', error: err instanceof Error ? err.message : String(err) };
    }
  }
  return { rules: compileRulesOffline(text), compiledBy: 'rules' };
}

export function normalizeRules(r: PermitRules): PermitRules {
  const blocked = Array.from(new Set(r.blockedCategories));
  const allowed = r.allowedCategories ? Array.from(new Set(r.allowedCategories)).filter((c) => !blocked.includes(c)) : null;
  return {
    ...r,
    purpose: r.purpose.trim() || 'Agent purchases',
    allowedCategories: allowed && allowed.length ? allowed : null,
    blockedCategories: blocked,
    allowedMerchants: r.allowedMerchants?.length ? r.allowedMerchants : null,
    notes: r.notes.filter(Boolean).slice(0, 6),
  };
}

// ---------------------------------------------------------------------------
// Deterministic fallback compiler, used when no Anthropic key is configured.
const CATEGORY_WORDS: [Category, RegExp][] = [
  ['groceries', /grocer|food|produce|milk|eggs/],
  ['household', /household|home (basics|supplies)|cleaning|toiletr|paper towel|detergent/],
  ['outdoor', /outdoor|camp|hik|tent|gear/],
  ['electronics', /electronic|gadget|tech|tv|laptop|phone/],
  ['apparel', /cloth|apparel|shoe|fashion/],
  ['pharmacy', /pharmac|medicine|prescription/],
  ['restaurants', /restaurant|takeout|food delivery|dinner/],
  ['travel', /travel|flight|hotel|airfare/],
  ['subscriptions', /subscription|streaming/],
  ['gift_cards', /gift ?cards?/],
  ['crypto', /crypto|bitcoin/],
  ['alcohol', /alcohol|wine|beer|liquor/],
  ['gambling', /gambl|betting|casino/],
];

const amount = (s: string) => Number(s.replace(/[,$]/g, ''));

export function compileRulesOffline(sentence: string): PermitRules {
  const s = sentence.toLowerCase();
  const notes: string[] = [];

  let budget: PermitRules['budget'] = null;
  const b = s.match(/(?:up to|max(?:imum)?|budget(?: of)?|spend(?: up to)?)\s*\$?([\d,]+(?:\.\d+)?)\s*(?:a|per|each|every|\/)\s*(day|week|month)/);
  if (b) budget = { amount: amount(b[1]), period: b[2] as 'day' | 'week' | 'month' };

  let autoApproveUpTo: number | null = null;
  const a = s.match(/ask (?:me )?(?:for |before )?(?:anything |any purchase |purchases )?(?:over|above|more than)\s*\$?([\d,]+(?:\.\d+)?)/);
  if (a) autoApproveUpTo = amount(a[1]);
  if (/always ask/.test(s)) autoApproveUpTo = 0;

  let perPurchaseMax: number | null = null;
  const m = s.match(/never (?:more than|over|above|spend more than)\s*\$?([\d,]+(?:\.\d+)?)\s*(?:at once|per (?:purchase|order|item)|in one)/);
  if (m) perPurchaseMax = amount(m[1]);

  const blocked = new Set<Category>(DEFAULT_BLOCKED);
  const allowed = new Set<Category>();
  // Split into clauses so "never gift cards" does not also allow gift cards.
  for (const clause of s.split(/[.;]|\bbut\b/)) {
    const negative = /\b(never|no|don't|do not|not|avoid)\b/.test(clause);
    for (const [cat, re] of CATEGORY_WORDS) {
      if (!re.test(clause)) continue;
      if (negative) blocked.add(cat);
      else if (!DEFAULT_BLOCKED.includes(cat)) allowed.add(cat);
    }
  }
  for (const c of blocked) allowed.delete(c);

  const merchants: string[] = [];
  const from = sentence.match(/\bfrom ([A-Z][\w&' ]{2,40}?)(?:[.,;]| only|$)/);
  if (from) merchants.push(from[1].trim());

  const names = [...allowed].slice(0, 2).map((c) => c.replace('_', ' '));
  const purpose = names.length ? `${names.join(' and ')} purchases`.replace(/^./, (ch) => ch.toUpperCase()) : 'Agent purchases';
  if (!budget) notes.push('No spending cap given');

  return normalizeRules({
    purpose,
    budget,
    perPurchaseMax,
    autoApproveUpTo,
    allowedCategories: allowed.size ? [...allowed] : null,
    blockedCategories: [...blocked],
    allowedMerchants: merchants.length ? merchants : null,
    blockedMerchants: [],
    maxPurchasesPerHour: 6,
    expiresInDays: 30,
    notes,
  });
}

// ---------------------------------------------------------------------------
// Issuing and resolving tokens.
export function issuePermit(
  owner: Owner,
  input: { agentName: string; agentKind: AgentKind; sentence: string; rules: PermitRules; compiledBy: 'claude' | 'rules' },
): { permit: Permit; token: string } {
  const token = `vlt_sb_${secret(24)}`;
  const createdAt = nowIso();
  const permit: Permit = {
    id: id('pmt', 6),
    ownerId: owner.id,
    agentName: input.agentName.trim().slice(0, 40) || 'My agent',
    agentKind: input.agentKind,
    sentence: input.sentence.trim().slice(0, 1200),
    rules: normalizeRules(input.rules),
    compiledBy: input.compiledBy,
    tokenHash: sha256(token),
    tokenPreview: `${token.slice(0, 11)}…${token.slice(-4)}`,
    status: 'active',
    createdAt,
    expiresAt: input.rules.expiresInDays ? new Date(Date.now() + input.rules.expiresInDays * 864e5).toISOString() : null,
  };
  savePermit(permit);
  publish(owner.id, { type: 'permit', permit });
  return { permit, token };
}

export function permitFromToken(token: string | null | undefined): Permit | undefined {
  if (!token || !token.startsWith('vlt_')) return undefined;
  return permitByTokenHash(sha256(token));
}

export function bearer(req: Request): string | null {
  const h = req.headers.get('authorization');
  if (h?.toLowerCase().startsWith('bearer ')) return h.slice(7).trim();
  const url = new URL(req.url);
  return url.searchParams.get('token');
}
