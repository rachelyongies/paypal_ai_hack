import type { PaymentRequest, Permit, PermitRules } from '@/lib/types';
import type { RuleChip } from '@/lib/rules-text';

export type PermitView = Omit<Permit, 'tokenHash'> & { chips: RuleChip[]; spent?: number };

export interface OwnerView {
  id: string;
  displayName: string;
  frozen: boolean;
  paypal: { mode: 'sandbox' | 'simulated'; via: 'paypal_button' | 'demo_wallet'; payerEmail?: string; linkedAt: string } | null;
}

export interface AppStatus {
  paypalMode: 'sandbox' | 'simulated';
  aiMode: 'claude' | 'rules';
  model: string;
  demoWallet: boolean;
  webhooksVerified: boolean;
}

export interface SessionData {
  owner: OwnerView;
  permits: PermitView[];
  pending: number;
  status: AppStatus;
}

export type OpsRequest = Omit<PaymentRequest, 'approval' | 'receipt' | 'ownerId'> & {
  owner: string;
  hasReceipt: boolean;
  approval?: { requestedAt: string; decidedAt?: string; decision?: string; via?: string; expiresAt: string };
};

export type { PaymentRequest, PermitRules };
