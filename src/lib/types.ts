// Shared domain types for Valet.

export const CATEGORIES = [
  'groceries',
  'household',
  'outdoor',
  'apparel',
  'electronics',
  'pharmacy',
  'restaurants',
  'travel',
  'subscriptions',
  'digital_goods',
  'gift_cards',
  'crypto',
  'cash_equivalents',
  'alcohol',
  'gambling',
  'other',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABEL: Record<Category, string> = {
  groceries: 'Groceries',
  household: 'Household',
  outdoor: 'Outdoor gear',
  apparel: 'Apparel',
  electronics: 'Electronics',
  pharmacy: 'Pharmacy',
  restaurants: 'Restaurants',
  travel: 'Travel',
  subscriptions: 'Subscriptions',
  digital_goods: 'Digital goods',
  gift_cards: 'Gift cards',
  crypto: 'Crypto',
  cash_equivalents: 'Cash equivalents',
  alcohol: 'Alcohol',
  gambling: 'Gambling',
  other: 'Other',
};

export type Period = 'day' | 'week' | 'month';

export interface PermitRules {
  /** Short human summary of what the permit is for, e.g. "Weekly house shopping". */
  purpose: string;
  /** Spending cap per period; null means no recurring cap. */
  budget: { amount: number; period: Period } | null;
  /** Hard cap for a single purchase; above it the request is blocked. */
  perPurchaseMax: number | null;
  /** Purchases above this amount need the owner's tap. */
  autoApproveUpTo: number | null;
  /** If set, categories outside this list need the owner's tap. */
  allowedCategories: Category[] | null;
  /** Categories that are always blocked ("never"). */
  blockedCategories: Category[];
  /** If set, merchants outside this list need the owner's tap. */
  allowedMerchants: string[] | null;
  /** Merchants that are always blocked. */
  blockedMerchants: string[];
  /** Max executed purchases per rolling hour before a burst is blocked. */
  maxPurchasesPerHour: number | null;
  /** Days until the permit expires; null means no expiry. */
  expiresInDays: number | null;
  /** Anything the owner said that is not machine-enforced, kept for the guardian. */
  notes: string[];
}

export type AgentKind = 'demo' | 'mcp' | 'rest';

export interface Permit {
  id: string;
  ownerId: string;
  agentName: string;
  agentKind: AgentKind;
  sentence: string;
  rules: PermitRules;
  compiledBy: 'claude' | 'rules';
  tokenHash: string;
  tokenPreview: string;
  status: 'active' | 'paused' | 'revoked';
  createdAt: string;
  expiresAt: string | null;
}

export interface PayPalLink {
  paymentTokenId: string;
  customerId?: string;
  payerEmail?: string;
  mode: 'sandbox' | 'simulated';
  via: 'paypal_button' | 'demo_wallet';
  linkedAt: string;
}

export interface Owner {
  id: string;
  createdAt: string;
  displayName: string;
  frozen: boolean;
  paypal: PayPalLink | null;
}

export interface RequestItem {
  name: string;
  sku?: string;
  category: Category;
  unitPrice: number;
  quantity: number;
}

export type Verdict = 'approve' | 'ask' | 'block';

export type RequestStatus =
  | 'pending_approval'
  | 'executing'
  | 'paid'
  | 'blocked'
  | 'declined'
  | 'expired'
  | 'failed'
  | 'refunded'
  | 'partially_refunded';

export interface PolicyCheck {
  id: string;
  label: string;
  result: 'pass' | 'ask' | 'block' | 'info';
  detail: string;
}

export type GuardianSignal =
  | 'prompt_injection'
  | 'task_mismatch'
  | 'price_anomaly'
  | 'merchant_risk'
  | 'urgency_pressure'
  | 'duplicate'
  | 'policy_conflict';

export interface GuardianResult {
  verdict: 'allow' | 'escalate' | 'block';
  riskScore: number;
  signals: GuardianSignal[];
  taskAlignment: 'aligned' | 'partial' | 'unrelated';
  ownerExplanation: string;
  agentReason: string;
  mode: 'claude' | 'rules';
  model?: string;
  latencyMs: number;
  error?: string;
}

export interface TimelineEntry {
  at: string;
  label: string;
  detail?: string;
}

export type RequestSource = 'demo-agent' | 'mcp' | 'rest' | 'redteam';

export interface PaymentRequest {
  id: string;
  ownerId: string;
  permitId: string;
  agentName: string;
  source: RequestSource;
  scenario?: string;
  createdAt: string;
  merchant: { name: string; domain: string };
  items: RequestItem[];
  amount: number;
  currency: 'USD';
  task: string;
  agentNote?: string;
  /** Text the agent saw at the merchant, if it supplied it. Fed to the guardian. */
  context?: string;
  verdict: Verdict;
  status: RequestStatus;
  reason: string;
  policy: { checks: PolicyCheck[]; outcome: Verdict; latencyMs: number };
  guardian: GuardianResult | null;
  decisionMs: number;
  approval?: {
    key: string;
    requestedAt: string;
    expiresAt: string;
    decidedAt?: string;
    decision?: 'approved' | 'declined';
    via?: 'web' | 'phone';
  };
  paypal?: {
    mode: 'sandbox' | 'simulated';
    orderId?: string;
    captureId?: string;
    status?: string;
    debugId?: string;
    refundId?: string;
    refundStatus?: string;
    refundedAmount?: number;
    error?: string;
  };
  receipt?: string;
  dispute?: { id: string; reason?: string; at: string };
  timeline: TimelineEntry[];
}

export interface WebhookLogEntry {
  id: string;
  at: string;
  eventType: string;
  verified: boolean | 'skipped';
  resource?: string;
  matchedRequestId?: string;
}

export interface DbShape {
  owners: Record<string, Owner>;
  permits: Record<string, Permit>;
  requests: Record<string, PaymentRequest>;
  webhooks: WebhookLogEntry[];
  meta: { version: number; createdAt: string };
}
