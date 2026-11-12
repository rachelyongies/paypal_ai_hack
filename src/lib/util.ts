import crypto from 'node:crypto';

export function id(prefix: string, bytes = 9) {
  return `${prefix}_${crypto.randomBytes(bytes).toString('base64url')}`;
}

export function secret(bytes = 24) {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function sha256(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function money(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export function nowIso() {
  return new Date().toISOString();
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Levenshtein distance, for lookalike merchant detection. */
export function editDistance(a: string, b: string) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[m][n];
}

/** Normalizes look-alike characters so "trai1head" and "trailhead" compare equal. */
export function skeleton(s: string) {
  return s
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/[0]/g, 'o')
    .replace(/[1|!]/g, 'l')
    .replace(/[5$]/g, 's')
    .replace(/rn/g, 'm')
    .replace(/vv/g, 'w')
    .replace(/[^a-z]/g, '');
}

export function domainRoot(domain: string) {
  const d = domain.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  const parts = d.split('.');
  return parts.length > 1 ? parts.slice(0, -1).join('.') : d;
}
