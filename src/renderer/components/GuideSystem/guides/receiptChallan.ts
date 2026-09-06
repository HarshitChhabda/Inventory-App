import { GuideData } from '../types';

export const receiptChallanGuide: GuideData = {
  pageId: 'receipt-challan',
  pageTitle: 'Receipt Challan',
  pageDescription: 'Receive stock from vendors or other sources',
  route: '/inventory/receipt-challan',
  whatIsThis: 'Receipt Challan means bringing stock in - from a vendor, Jaipur office, another branch, donation, transfer, or department return. Whenever stock arrives, a receipt challan is created. This increases the store stock.',
  whenToUse: 'When stock physically arrives - vendor delivery, office transfer, return, or donation. A receipt challan is required for every incoming stock.',
  prerequisites: [
    'Company and Financial Year must be selected',
    'Store must be created in Store Master',
    'Items must be created in Items Master',
    'If from a vendor, the vendor must exist in Vendor Master',
  ],
  sections: [
    {
      title: 'Source Types',
      icon: 'Input',
      content: 'There are 6 types of sources:\n1. Vendor - delivery received from vendor\n2. JaipurOffice - stock received from office\n3. OtherBranch - transfer from another branch\n4. Donation - donation received\n5. Transfer - stock received from another store\n6. DepartmentReturn - return from department',
    },
    {
      title: 'Voucher Number',
      icon: 'ConfirmationNumber',
      content: 'Each receipt has a unique voucher number (e.g., RC-2026-000001). This is generated automatically. The voucher number is used to track the transaction.',
    },
    {
      title: 'Stock Effect',
      icon: 'TrendingUp',
      content: 'As soon as a receipt challan is created, the store stock increases. The entry goes directly into the ledger and the stock is updated automatically.',
    },
  ],
  steps: [
    {
      stepNumber: 1,
      title: 'Click on New Receipt Challan',
      description: 'Click the "New Receipt Challan" button from the list page.',
    },
    {
      stepNumber: 2,
      title: 'Select Source Type',
      description: 'Select from the dropdown where the stock is coming from - Vendor, Office, Branch, Donation, Transfer, or Department Return.',
      tip: 'If from a vendor, you must also fill in the Vendor field',
    },
    {
      stepNumber: 3,
      title: 'Enter Date and Details',
      description: 'Enter the receipt date, invoice number (if available), vehicle number (if available), and received by name.',
      warning: 'Do not enter a wrong date - it can cause FY mismatch',
    },
    {
      stepNumber: 4,
      title: 'Add Items',
      description: 'Add items using the "Add Item" button. Enter each item name, unit, quantity, and rate.',
      tip: 'At least one item is required',
    },
    {
      stepNumber: 5,
      title: 'Save',
      description: 'Click the Save button. The receipt will be saved and stock will increase automatically.',
      warning: 'After saving, the receipt cannot be edited - save carefully',
    },
  ],
  dos: [
    'Create a receipt challan for every incoming stock',
    'Enter invoice number and vehicle number for tracking',
    'Enter correct rate and amount for financial records',
    'Enter the correct received by name - for accountability',
  ],
  donts: [
    'Do not accept stock without a receipt challan - tracking will be lost',
    'Do not enter a wrong date - it can cause FY mismatch',
    'Do not enter negative quantity - receipt increases stock',
    'Do not create duplicate receipts - there should be only one entry',
  ],
  validationRules: [
    { field: 'Company', rule: 'Required, positive integer' },
    { field: 'Financial Year', rule: 'Required, positive integer' },
    { field: 'Date', rule: 'Required, valid date' },
    { field: 'Source Type', rule: 'Required - Vendor / JaipurOffice / OtherBranch / Donation / Transfer / DepartmentReturn' },
    { field: 'Received By', rule: 'Required, min 1 character' },
    { field: 'Items', rule: 'At least 1 item required' },
    { field: 'Item ID', rule: 'Required, positive integer' },
    { field: 'Unit ID', rule: 'Required, positive integer' },
    { field: 'Quantity', rule: 'Required, positive number' },
    { field: 'Rate', rule: 'Optional, min 0, default 0' },
  ],
  relatedPages: [
    { title: 'Issue Challan', route: '/inventory/issue-challan' },
    { title: 'Stock Ledger', route: '/inventory/stock-ledger' },
    { title: 'Store Stock', route: '/enterprise/stock' },
  ],
};
