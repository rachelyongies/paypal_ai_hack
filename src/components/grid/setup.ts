'use client';

import { ModuleRegistry, themeQuartz } from 'ag-grid-community';
import { AllEnterpriseModule, LicenseManager } from 'ag-grid-enterprise';

let done = false;
export function setupGrid() {
  if (done) return;
  done = true;
  ModuleRegistry.registerModules([AllEnterpriseModule]);
  const key = process.env.NEXT_PUBLIC_AG_GRID_LICENSE_KEY;
  if (key) LicenseManager.setLicenseKey(key);
}

// AG Grid's Theming API, tuned to paypal.com's 2026 tokens.
export const valetTheme = themeQuartz.withParams({
  accentColor: '#0066F5',
  foregroundColor: '#000000',
  backgroundColor: '#FFFFFF',
  fontFamily: '"Inter Variable", "Helvetica Neue", Helvetica, Arial, sans-serif',
  fontSize: 13,
  headerFontSize: 12,
  headerFontWeight: 600,
  headerTextColor: 'rgba(0,0,0,0.63)',
  headerBackgroundColor: '#F5F7FA',
  borderColor: 'rgba(0,0,0,0.08)',
  rowHoverColor: 'rgba(0,102,245,0.04)',
  selectedRowBackgroundColor: 'rgba(0,102,245,0.08)',
  wrapperBorderRadius: 20,
  borderRadius: 10,
  spacing: 7,
  rowHeight: 48,
  headerHeight: 42,
  chromeBackgroundColor: '#F5F7FA',
});
