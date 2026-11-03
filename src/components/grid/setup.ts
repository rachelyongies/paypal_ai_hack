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

// AG Grid's Theming API, tuned to the app: white rows, no column lines,
// soft separators, generous rows, PayPal blue accents.
export const valetTheme = themeQuartz.withParams({
  accentColor: '#0066F5',
  foregroundColor: '#0A0B0D',
  backgroundColor: '#FFFFFF',
  fontFamily: '"Inter Variable", "Helvetica Neue", Helvetica, Arial, sans-serif',
  fontSize: 13.5,
  headerFontSize: 12.5,
  headerFontWeight: 500,
  headerTextColor: 'rgba(10,11,13,0.5)',
  headerBackgroundColor: '#FFFFFF',
  borderColor: 'rgba(10,11,13,0.07)',
  wrapperBorder: false,
  columnBorder: false,
  headerColumnBorder: false,
  rowBorder: { style: 'solid', width: 1, color: 'rgba(10,11,13,0.06)' },
  rowHoverColor: '#F7F8FA',
  selectedRowBackgroundColor: 'rgba(0,102,245,0.06)',
  wrapperBorderRadius: 24,
  borderRadius: 12,
  spacing: 8,
  rowHeight: 60,
  headerHeight: 46,
  chromeBackgroundColor: '#FFFFFF',
  iconSize: 15,
});
