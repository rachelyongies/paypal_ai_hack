// Pure helpers shared by server and client: how a permit's rules read as chips.
import { CATEGORY_LABEL, type PermitRules } from './types';

export type ChipKind = 'purpose' | 'budget' | 'auto' | 'max' | 'allow' | 'block' | 'merchant' | 'rate' | 'expiry' | 'note';

export interface RuleChip {
  kind: ChipKind;
  label: string;
}

const usd = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;
const per = { day: 'a day', week: 'a week', month: 'a month' } as const;

export function ruleChips(r: PermitRules): RuleChip[] {
  const chips: RuleChip[] = [];
  if (r.budget) chips.push({ kind: 'budget', label: `Up to ${usd(r.budget.amount)} ${per[r.budget.period]}` });
  if (r.autoApproveUpTo !== null) chips.push({ kind: 'auto', label: `Ask me above ${usd(r.autoApproveUpTo)}` });
  if (r.perPurchaseMax !== null) chips.push({ kind: 'max', label: `Never over ${usd(r.perPurchaseMax)} at once` });
  if (r.allowedCategories?.length)
    chips.push({ kind: 'allow', label: `Only ${r.allowedCategories.map((c) => CATEGORY_LABEL[c].toLowerCase()).join(', ')}` });
  for (const c of r.blockedCategories) chips.push({ kind: 'block', label: `Never ${CATEGORY_LABEL[c].toLowerCase()}` });
  if (r.allowedMerchants?.length) chips.push({ kind: 'merchant', label: `Only at ${r.allowedMerchants.join(', ')}` });
  for (const m of r.blockedMerchants) chips.push({ kind: 'block', label: `Never at ${m}` });
  if (r.maxPurchasesPerHour !== null) chips.push({ kind: 'rate', label: `At most ${r.maxPurchasesPerHour} buys an hour` });
  if (r.expiresInDays !== null) chips.push({ kind: 'expiry', label: `Expires in ${r.expiresInDays} days` });
  for (const n of r.notes) chips.push({ kind: 'note', label: n });
  return chips;
}

export const EXAMPLE_SENTENCES = [
  'Weekly house shopping: groceries, household supplies and outdoor gear, up to $250 a week. Ask me for anything over $75. Never gift cards or crypto.',
  'Groceries only, up to $150 a week, from FreshCart. Ask me above $60.',
  'Book my work travel up to $1,200 a month. Always ask me before paying. Never more than $600 at once.',
];

export interface PermitTemplate {
  id: string;
  label: string;
  blurb: string;
  icon: 'basket' | 'plane' | 'repeat' | 'gift' | 'pen';
  sentence: string;
}

/** Ready-made permits: one tap fills a sentence the owner can still edit. */
export const TEMPLATES: PermitTemplate[] = [
  { id: 'home', label: 'Groceries and home', blurb: 'Weekly restocks', icon: 'basket', sentence: EXAMPLE_SENTENCES[0] },
  { id: 'travel', label: 'Work travel', blurb: 'Flights and hotels', icon: 'plane', sentence: EXAMPLE_SENTENCES[2] },
  {
    id: 'subs',
    label: 'Subscriptions',
    blurb: 'Renewals only',
    icon: 'repeat',
    sentence: 'Renew my software and streaming subscriptions, up to $80 a month. Ask me above $25. Never more than $40 at once.',
  },
  {
    id: 'gifts',
    label: 'Gifts',
    blurb: 'Birthdays and holidays',
    icon: 'gift',
    sentence: 'Buy birthday gifts for family, up to $150 a month. Ask me above $60. Never gift cards or crypto.',
  },
  { id: 'custom', label: 'Custom', blurb: 'Write your own', icon: 'pen', sentence: '' },
];
