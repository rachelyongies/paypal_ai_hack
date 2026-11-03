// Runtime configuration and mode detection. Server-only.

export const config = {
  appUrl: (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, ''),
  dataDir: process.env.DATA_DIR || '.data',
  paypal: {
    clientId: process.env.PAYPAL_CLIENT_ID || '',
    clientSecret: process.env.PAYPAL_CLIENT_SECRET || '',
    webhookId: process.env.PAYPAL_WEBHOOK_ID || '',
    demoVaultId: process.env.DEMO_VAULT_ID || '',
    apiBase: 'https://api-m.sandbox.paypal.com',
    sdkUrl: 'https://www.sandbox.paypal.com/web-sdk/v6/core',
  },
  ai: {
    hasKey: Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN),
    model: process.env.VALET_MODEL || 'claude-opus-5-5',
  },
  signingKeyPem: process.env.VALET_SIGNING_KEY || '',
  approvalTtlMs: 10 * 60 * 1000,
};

export type PayPalMode = 'sandbox' | 'simulated';

export function paypalMode(): PayPalMode {
  return config.paypal.clientId && config.paypal.clientSecret ? 'sandbox' : 'simulated';
}

export function aiMode(): 'claude' | 'rules' {
  return config.ai.hasKey ? 'claude' : 'rules';
}

export function publicStatus() {
  return {
    paypalMode: paypalMode(),
    aiMode: aiMode(),
    model: config.ai.model,
    demoWallet: paypalMode() === 'simulated' || Boolean(config.paypal.demoVaultId),
    webhooksVerified: Boolean(config.paypal.webhookId),
  };
}
