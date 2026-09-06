import { GuideData } from '../types';

export const stockLedgerGuide: GuideData = {
  pageId: 'stock-ledger',
  pageTitle: 'Stock Ledger',
  pageDescription: 'View detailed records of all stock movements',
  route: '/inventory/stock-ledger',
  whatIsThis: 'The Stock Ledger has a complete record of every stock movement - receipt, issue, transfer, damage, adjustment, vendor return - everything. This page is read-only. The stock is calculated from the ledger. This is the system single source of truth.',
  whenToUse: 'Whenever you need to verify how many entries an item has, where it came from, where it went, or how much was damaged. For audits, physical counts, or discrepancy checks.',
  prerequisites: [
    'Company and Financial Year must be selected',
    'There should be some transactions in the ledger',
  ],
  sections: [
    {
      title: 'Ledger Concept',
      icon: 'MenuBook',
      content: 'Stock is never stored directly. All entries are derived from the ledger:\nStock = SUM(quantityIn) - SUM(quantityOut)\nThis is append-only - entries can be added but not deleted.',
    },
    {
      title: 'Movement Types',
      icon: 'SwapHoriz',
      content: 'Each entry has a type:\n- RC: Receipt Challan (INCREASE)\n- IC: Issue Challan (DECREASE)\n- TC: Transfer Challan (INCREASE/DECREASE)\n- DM: Damage (DECREASE)\n- AD: Adjustment (CONDITIONAL)\n- VR: Vendor Return (DECREASE)',
    },
    {
      title: 'Stock Formula',
      icon: 'Calculate',
      content: 'Opening + Receipts + TransferIn + Uninstall + AdjustmentIn - Issues - TransferOut - Install - Damage - VendorReturn - AdjustmentOut = Current Stock',
    },
  ],
  steps: [
    {
      stepNumber: 1,
      title: 'Apply Filters',
      description: 'Filter by date range, item, store, or voucher type.',
      tip: 'Select an item to view its specific history',
    },
    {
      stepNumber: 2,
      title: 'View Entries',
      description: 'All entries will be displayed - date, voucher, type, quantity, running balance.',
    },
    {
      stepNumber: 3,
      title: 'Check Running Balance',
      description: 'The running balance is shown after each entry. Verify that the stock is correct.',
      tip: 'If the running balance is wrong, there is a discrepancy - investigate it',
    },
    {
      stepNumber: 4,
      title: 'Export',
      description: 'If you need a report, download it as CSV/PDF using the export button.',
    },
  ],
  dos: [
    'Check the ledger daily for discrepancies',
    'Verify the ledger after a physical count',
    'Export the ledger for audits',
    'Investigate suspicious entries',
  ],
  donts: [
    'Do not delete ledger entries - this is append-only',
    'Do not edit stock directly from the ledger',
    'Do not miss entries - every movement should have a record',
  ],
  validationRules: [],
  relatedPages: [
    { title: 'Store Stock', route: '/enterprise/stock' },
    { title: 'Receipt Challan', route: '/inventory/receipt-challan' },
    { title: 'Stock Adjustment', route: '/inventory/stock-adjustment' },
  ],
};
