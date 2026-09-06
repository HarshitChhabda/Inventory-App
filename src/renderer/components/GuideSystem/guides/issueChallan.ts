import { GuideData } from '../types';

export const issueChallanGuide: GuideData = {
  pageId: 'issue-challan',
  pageTitle: 'Issue Challan',
  pageDescription: 'Issue stock to departments',
  route: '/inventory/issue-challan',
  whatIsThis: 'Issue Challan means giving stock - to a department. When stock is given from a store to a department, an issue challan is created. This decreases the store stock and increases the department stock.',
  whenToUse: 'When a department needs stock - raw material, consumables, or any item. An issue challan is required for giving stock to every department.',
  prerequisites: [
    'Company and Financial Year must be selected',
    'Department must be created in Department Master',
    'Items must be created in Items Master',
    'Store must have sufficient stock',
  ],
  sections: [
    {
      title: 'Stock Effect',
      icon: 'TrendingDown',
      content: 'As soon as an issue challan is created, the source store stock decreases. The department receives stock. Both sides are entered in the ledger.',
    },
    {
      title: 'Department Selection',
      icon: 'Business',
      content: 'It is necessary to select which department is receiving stock. The department record keeps track of how much stock it has taken.',
    },
    {
      title: 'Voucher Number',
      icon: 'ConfirmationNumber',
      content: 'Each issue has a unique voucher number (e.g., IC-2026-000001). This is generated automatically.',
    },
  ],
  steps: [
    {
      stepNumber: 1,
      title: 'Click on New Issue Challan',
      description: 'Click the "New Issue Challan" button from the list page.',
    },
    {
      stepNumber: 2,
      title: 'Select Department',
      description: 'Select from the dropdown which department is receiving stock.',
      warning: 'Select the correct department - it cannot be changed later',
    },
    {
      stepNumber: 3,
      title: 'Enter Date and Details',
      description: 'Enter the issue date and issued by name.',
      tip: 'Approved by field is optional but enter it if there is an approval process',
    },
    {
      stepNumber: 4,
      title: 'Add Items',
      description: 'Add items using the "Add Item" button. Enter each item name, unit, and quantity.',
      warning: 'Do not enter quantity more than the available stock in the store',
    },
    {
      stepNumber: 5,
      title: 'Save',
      description: 'Click the Save button. The issue will be saved and the stock will update automatically.',
      warning: 'After saving, the issue will need to be cancelled - it cannot be edited directly',
    },
  ],
  dos: [
    'Create an issue challan for giving stock to every department',
    'Check sufficient stock before issuing',
    'Enter the purpose - what work the stock is being given for',
    'Enter approved by if there is an approval process',
  ],
  donts: [
    'Do not issue more quantity than the available stock',
    'Do not issue without selecting a department',
    'Do not enter a wrong date',
    'Do not enter negative quantity',
  ],
  validationRules: [
    { field: 'Company', rule: 'Required, positive integer' },
    { field: 'Financial Year', rule: 'Required, positive integer' },
    { field: 'Department', rule: 'Required, positive integer' },
    { field: 'Date', rule: 'Required, valid date' },
    { field: 'Issued By', rule: 'Required, min 1 character' },
    { field: 'Items', rule: 'At least 1 item required' },
    { field: 'Item ID', rule: 'Required, positive integer' },
    { field: 'Unit ID', rule: 'Required, positive integer' },
    { field: 'Quantity', rule: 'Required, positive number' },
  ],
  relatedPages: [
    { title: 'Receipt Challan', route: '/inventory/receipt-challan' },
    { title: 'Stock Ledger', route: '/inventory/stock-ledger' },
    { title: 'Departments', route: '/masters/departments' },
  ],
};
