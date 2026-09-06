import { GuideData } from '../types';

export const stockAdjustmentGuide: GuideData = {
  pageId: 'stock-adjustment',
  pageTitle: 'Stock Adjustment',
  pageDescription: 'Manually adjust stock levels',
  route: '/inventory/stock-adjustment',
  whatIsThis: 'Stock Adjustment means manually adjusting the stock level - addition, subtraction, or correction. This happens when there is a difference between physical stock and system stock. Example: if the physical count shows more, it is an addition; if less, it is a subtraction.',
  whenToUse: 'When there is a difference between physical stock count and system stock. Or to correct a mistake. Adjustments should only be made in exceptional cases - always use a challan.',
  prerequisites: [
    'Company and Financial Year must be selected',
    'Item must be created in Item Master',
    'There must be a valid reason for the adjustment',
  ],
  sections: [
    {
      title: 'Adjustment Types',
      icon: 'Tune',
      content: 'There are three types:\n1. Addition - stock was low, needs to be increased\n2. Subtraction - stock was too high, needs to be decreased\n3. Correction - to correct a wrong entry',
    },
    {
      title: 'Stock Effect',
      icon: 'TrendingUp',
      content: 'Stock increases in Addition. Stock decreases in Subtraction. Changes depend on the type in Correction.',
    },
    {
      title: 'When to Use',
      icon: 'Warning',
      content: 'Make stock adjustments only in exceptional cases - like after a physical count. For regular stock movements, always create a challan (Receipt, Issue, Transfer).',
    },
  ],
  steps: [
    {
      stepNumber: 1,
      title: 'Select Adjustment Type',
      description: 'Select from the dropdown - Addition, Subtraction, or Correction.',
      warning: 'Select the correct type - it cannot be changed later',
    },
    {
      stepNumber: 2,
      title: 'Select Item',
      description: 'Select from the dropdown which item needs to be adjusted.',
    },
    {
      stepNumber: 3,
      title: 'Enter Quantity',
      description: 'Enter how much stock needs to be adjusted.',
      warning: 'Do not enter wrong quantity - it impacts stock',
    },
    {
      stepNumber: 4,
      title: 'Write the Reason Clearly',
      description: 'Clearly state why the adjustment is being made - physical count, damage, correction, etc.',
      tip: 'Keep the reason detailed - it is necessary for the audit trail',
    },
    {
      stepNumber: 5,
      title: 'Save',
      description: 'Click the Save button. The adjustment will be completed and the stock will be updated.',
      warning: 'A reversal will be needed after an adjustment',
    },
  ],
  dos: [
    'Always enter a valid reason',
    'Adjust only after a physical count',
    'Keep proper documentation of the adjustment',
    'Write a detailed reason for the audit trail',
  ],
  donts: [
    'Do not use adjustment for regular stock movements - create a challan',
    'Do not make adjustments without a reason',
    'Do not enter wrong quantity',
    'Do not make frequent adjustments - fix the system if it is wrong',
  ],
  validationRules: [
    { field: 'Company', rule: 'Required, positive integer' },
    { field: 'Financial Year', rule: 'Required, positive integer' },
    { field: 'Item', rule: 'Required, positive integer' },
    { field: 'Adjustment Type', rule: 'Required - Addition / Subtraction / Correction' },
    { field: 'Quantity', rule: 'Required, positive number' },
    { field: 'Reason', rule: 'Required, min 1 character' },
    { field: 'Adjusted By', rule: 'Required, min 1 character' },
    { field: 'Date', rule: 'Required, valid date' },
  ],
  relatedPages: [
    { title: 'Stock Ledger', route: '/inventory/stock-ledger' },
    { title: 'Store Stock', route: '/enterprise/stock' },
    { title: 'Damage Entry', route: '/inventory/damage-entry' },
  ],
};
