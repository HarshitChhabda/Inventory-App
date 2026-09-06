import { GuideData } from '../types';

export const transferChallanGuide: GuideData = {
  pageId: 'transfer-challan',
  pageTitle: 'Transfer Challan',
  pageDescription: 'Transfer stock from one store to another',
  route: '/inventory/transfer-challan',
  whatIsThis: 'Transfer Challan means moving stock from one store to another. When stock from one store needs to be sent to another store - like from Main Store to Department Store - a transfer challan is created. The source store stock decreases and the destination store stock increases.',
  whenToUse: 'When stock needs to be sent from one store to another. Example: sending stock from Main Store to Warehouse, or maintaining balance across stores.',
  prerequisites: [
    'Company and Financial Year must be selected',
    'Both stores (source and destination) must exist',
    'Items must be created in Items Master',
    'Source store must have sufficient stock',
  ],
  sections: [
    {
      title: 'Transfer Matrix',
      icon: 'AccountTree',
      content: 'By default, transfers are allowed between all stores. However, some transfers require approval - like from Main Store to Dharamshala Store. The transfer matrix is set in the configuration.',
    },
    {
      title: 'Stock Effect',
      icon: 'SwapHoriz',
      content: 'As soon as a transfer is created:\n1. Source store stock decreases (DECREASE)\n2. Destination store stock increases (INCREASE)\n3. Ledger entries are made on both sides',
    },
    {
      title: 'Voucher Number',
      icon: 'ConfirmationNumber',
      content: 'Each transfer has a unique voucher number (e.g., TC-2026-000001).',
    },
  ],
  steps: [
    {
      stepNumber: 1,
      title: 'Click on New Transfer Challan',
      description: 'Click the "New Transfer Challan" button.',
    },
    {
      stepNumber: 2,
      title: 'Select Source Store',
      description: 'Select from the dropdown which store is sending stock.',
      warning: 'Source store must have sufficient stock',
    },
    {
      stepNumber: 3,
      title: 'Select Destination Store',
      description: 'Select from the dropdown which store is receiving stock.',
      warning: 'Source and destination cannot be the same',
    },
    {
      stepNumber: 4,
      title: 'Enter Date and Details',
      description: 'Enter the transfer date and transferred by name.',
    },
    {
      stepNumber: 5,
      title: 'Add Items',
      description: 'Add items using the "Add Item" button. Select the item and enter the quantity.',
      tip: 'You can add more than one item',
    },
    {
      stepNumber: 6,
      title: 'Save',
      description: 'Click the Save button. The transfer will be completed and both stores stock will be updated.',
      warning: 'After transfer, a reversal will be needed - it cannot be edited directly',
    },
  ],
  dos: [
    'Select source and destination store correctly',
    'Check the transfer matrix - approval may be required',
    'Keep quantity below the available stock of the source store',
    'Enter the reason - why the transfer is being made',
  ],
  donts: [
    'Do not transfer from a store to the same store',
    'Do not transfer more quantity than the available stock',
    'Do not send stock without a challan',
    'Do not send from Main Store to Dharamshala Store without approval',
  ],
  validationRules: [
    { field: 'Company', rule: 'Required, positive integer' },
    { field: 'Financial Year', rule: 'Required, positive integer' },
    { field: 'Date', rule: 'Required, valid date' },
    { field: 'From Store', rule: 'Required, positive integer, cannot be same as To Store' },
    { field: 'To Store', rule: 'Required, positive integer' },
    { field: 'Transferred By', rule: 'Required, min 1 character' },
    { field: 'Items', rule: 'At least 1 item required' },
    { field: 'Item ID', rule: 'Required, positive integer' },
    { field: 'Quantity', rule: 'Required, positive number' },
  ],
  relatedPages: [
    { title: 'Receipt Challan', route: '/inventory/receipt-challan' },
    { title: 'Store Master', route: '/enterprise/stores' },
    { title: 'Configuration', route: '/enterprise/configuration' },
  ],
};
