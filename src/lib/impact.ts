// A transparent, illustrative growth model for PayPal. Only two inputs are
// facts: active accounts and revenue per dollar of TPV, both from PayPal's
// Q3 2026 results (reported October 27, 2026). Everything else is an assumption
// the reader can move.

export const PAYPAL_Q3_2026 = {
  activeAccounts: 440e6,
  revenue: 8.6e9,
  tpv: 487.1e9,
  source: 'PayPal Q3 2026 results, reported October 27, 2026',
};

/** Revenue per dollar of TPV in Q3 2026: $8.6B / $487.1B, about 1.77%. */
export const TAKE_RATE = PAYPAL_Q3_2026.revenue / PAYPAL_Q3_2026.tpv;

export interface ModelInput {
  /** Share of existing active accounts that give an agent a permit. */
  adoption: number;
  /** Average agent spend per wallet per month, USD. */
  monthlySpend: number;
  /** New PayPal accounts opened to give an agent a wallet, per existing adopter. */
  newUserRatio: number;
  /** Revenue per dollar of agent TPV. */
  takeRate: number;
}

export const DEFAULT_MODEL: ModelInput = { adoption: 0.01, monthlySpend: 150, newUserRatio: 0.1, takeRate: TAKE_RATE };

export function runModel(m: ModelInput) {
  const existing = PAYPAL_Q3_2026.activeAccounts * m.adoption;
  const newAccounts = existing * m.newUserRatio;
  const wallets = existing + newAccounts;
  const annualTpv = wallets * m.monthlySpend * 12;
  const annualRevenue = annualTpv * m.takeRate;
  return { existing, newAccounts, wallets, annualTpv, annualRevenue };
}

export function compact(n: number, money = false) {
  const p = money ? '$' : '';
  if (n >= 1e9) return `${p}${(n / 1e9).toFixed(n >= 1e10 ? 0 : 1)}B`;
  if (n >= 1e6) return `${p}${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`;
  if (n >= 1e3) return `${p}${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}K`;
  return `${p}${Math.round(n)}`;
}
