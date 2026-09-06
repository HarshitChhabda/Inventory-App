import { GuideData } from '../types';

export const storeStockGuide: GuideData = {
  pageId: 'store-stock',
  pageTitle: 'Store Stock',
  pageDescription: 'View current stock level of every store',
  route: '/enterprise/stock',
  whatIsThis: 'On the Store Stock page you can see how much stock each store has. This page is read-only - stock cannot be edited directly. Stock is always calculated from ledger entries. Every movement has a record.',
  whenToUse: 'Whenever you need to check how much stock a store has, which items are low on stock, or which items are out of stock. For verifying stock levels.',
  prerequisites: [
    'Stores must be created in Store Master',
    'Receipt/Issue/Transfer entries must exist',
  ],
  sections: [
    {
      title: 'Stock Calculation',
      icon: 'Calculate',
      content: 'Stock = Opening + Receipts + TransferIn - Issues - TransferOut - Damage - VendorReturn. This is all calculated from ledger entries.',
    },
    {
      title: 'Stock Status',
      icon: 'Circle',
      content: 'There are three statuses:\n1. In Stock (Green) - sufficient stock available\n2. Low Stock (Warning) - below minimum level\n3. Out of Stock (Red) - stock is depleted',
    },
    {
      title: 'Read-Only Mode',
      icon: 'Lock',
      content: 'Stock cannot be edited directly. For every change, create a proper challan - Receipt, Issue, Transfer, Damage, or Adjustment.',
    },
  ],
  steps: [
    {
      stepNumber: 1,
      title: 'Select Store',
      description: 'Select the store from the dropdown whose stock you want to view.',
    },
    {
      stepNumber: 2,
      title: 'View Items',
      description: 'All items will be displayed with their stock levels.',
      tip: 'Low stock items are highlighted with a warning',
    },
    {
      stepNumber: 3,
      title: 'Verify Stock',
      description: 'If any item stock is low, create a Receipt Challan to increase stock.',
      warning: 'Manual stock editing is not allowed - always use a challan',
    },
  ],
  dos: [
    'Check stock levels daily for low stock alerts',
    'Match physical stock with system stock',
    'Create receipt challans immediately for low stock items',
  ],
  donts: [
    'Do not edit stock directly - it goes through the ledger',
    'Do not allow negative stock without approval',
    'Do not cancel old transactions without proper reversal',
  ],
  validationRules: [],
  relatedPages: [
    { title: 'Stock Ledger', route: '/inventory/stock-ledger' },
    { title: 'Receipt Challan', route: '/inventory/receipt-challan' },
    { title: 'Store Master', route: '/enterprise/stores' },
  ],
};
