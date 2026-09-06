import { GuideData } from '../types';

export const vendorReturnGuide: GuideData = {
  pageId: 'vendor-return',
  pageTitle: 'Vendor Return',
  pageDescription: 'Send stock back to vendors',
  route: '/inventory/vendor-return',
  whatIsThis: 'A Vendor Return means sending back stock that originally came from the vendor. When an item is defective, has passed its expiry date, or has been cancelled - it is sent back to the vendor. This reduces the store stock.',
  whenToUse: 'When you need to send an item back to the vendor - defective items, expired items, or cancelled orders. A vendor return reduces stock and updates the vendor record.',
  prerequisites: [
    'Company and Financial Year must be selected',
    'The vendor must exist in the vendor master',
    'The items being returned must be in stock at the store',
  ],
  sections: [
    {
      title: 'Stock Effect',
      icon: 'TrendingDown',
      content: 'As soon as a Vendor Return is created, the store stock is reduced. An entry is made in the item ledger showing how much stock was sent back.',
    },
    {
      title: 'Voucher Number',
      icon: 'ConfirmationNumber',
      content: 'Each return has a unique voucher number (e.g., VR-2026-000001).',
    },
  ],
  steps: [
    {
      stepNumber: 1,
      title: 'Click on New Vendor Return',
      description: 'Click the "New Vendor Return" button.',
    },
    {
      stepNumber: 2,
      title: 'Select Vendor',
      description: 'Select from the dropdown which vendor is taking the stock back.',
    },
    {
      stepNumber: 3,
      title: 'Fill in Date and Details',
      description: 'Enter the return date and the reason for the return.',
      warning: 'Enter the reason clearly - there could be a dispute with the vendor',
    },
    {
      stepNumber: 4,
      title: 'Add Items',
      description: 'Add items using the "Add Item" button. Select the item and enter the quantity.',
      tip: 'Only add items that are actually being sent back',
    },
    {
      stepNumber: 5,
      title: 'Save',
      description: 'Click the Save button. The return will be saved and the stock will be updated.',
    },
  ],
  dos: [
    'Clearly enter the reason for each return',
    'Keep the original receipt challan reference',
    'Inform the vendor about the return',
    'Enter the correct return date',
  ],
  donts: [
    'Do not make a return without a reason',
    'Do not return more than the available stock',
    'Track the refund after the return',
  ],
  validationRules: [
    { field: 'Company', rule: 'Required, positive integer' },
    { field: 'Financial Year', rule: 'Required, positive integer' },
    { field: 'Vendor', rule: 'Required, positive integer' },
    { field: 'Date', rule: 'Required, valid date' },
    { field: 'Items', rule: 'At least 1 item required' },
    { field: 'Item ID', rule: 'Required, positive integer' },
    { field: 'Quantity', rule: 'Required, positive number' },
  ],
  relatedPages: [
    { title: 'Receipt Challan', route: '/inventory/receipt-challan' },
    { title: 'Vendors', route: '/masters/vendors' },
    { title: 'Stock Ledger', route: '/inventory/stock-ledger' },
  ],
};
