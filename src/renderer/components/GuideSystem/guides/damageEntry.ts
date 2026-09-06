import { GuideData } from '../types';

export const damageEntryGuide: GuideData = {
  pageId: 'damage-entry',
  pageTitle: 'Damage Entry',
  pageDescription: 'Report damaged, lost, or expired items',
  route: '/inventory/damage-entry',
  whatIsThis: 'In Damage Entry you report damaged, lost, broken, scrap, or expired items. When an item is spoiled, lost, broken, needs to go to scrap, or has passed its expiry date - a damage entry is created. This decreases the stock.',
  whenToUse: 'When there is an issue with an item - damage, loss, breakage, scrap, or expiry. A damage entry is required for every negative incident for proper tracking.',
  prerequisites: [
    'Company and Financial Year must be selected',
    'Item must be created in Item Master',
    'Store must have stock of the damaged item',
  ],
  sections: [
    {
      title: 'Damage Reasons',
      icon: 'ReportProblem',
      content: 'There are 5 reasons:\n1. Damaged - item is spoiled\n2. Lost - item is lost\n3. Broken - item is broken\n4. Scrap - item needs to go to scrap\n5. Expired - expiry date has passed',
    },
    {
      title: 'Stock Effect',
      icon: 'TrendingDown',
      content: 'As soon as a damage entry is created, the store stock decreases. An entry is made in the item ledger showing how much stock was damaged.',
    },
    {
      title: 'Voucher Number',
      icon: 'ConfirmationNumber',
      content: 'Each damage has a unique voucher number (e.g., DM-2026-000001).',
    },
  ],
  steps: [
    {
      stepNumber: 1,
      title: 'Select Item',
      description: 'Select from the dropdown which item is damaged.',
    },
    {
      stepNumber: 2,
      title: 'Select Damage Reason',
      description: 'Select from the dropdown - Damaged, Lost, Broken, Scrap, or Expired.',
      warning: 'Select the correct reason - it is necessary for reporting',
    },
    {
      stepNumber: 3,
      title: 'Enter Quantity',
      description: 'Enter how much quantity was damaged.',
      warning: 'Do not enter wrong quantity - it impacts stock',
    },
    {
      stepNumber: 4,
      title: 'Enter Date and Details',
      description: 'Enter the damage date and reported by name.',
    },
    {
      stepNumber: 5,
      title: 'Write Remarks',
      description: 'Write details about the damage - how it happened, who is responsible, etc.',
      tip: 'Keeping detailed remarks will provide a reference in the future',
    },
    {
      stepNumber: 6,
      title: 'Save',
      description: 'Click the Save button. The damage entry will be created and the stock will be updated.',
    },
  ],
  dos: [
    'Keep proper documentation for every damage entry',
    'Clearly specify the reason',
    'Enter the quantity accurately',
    'Include details in remarks - how it happened, who is responsible',
  ],
  donts: [
    'Do not create damage entries without a reason',
    'Do not use damage entry for regular stock movements',
    'Do not enter wrong quantity',
    'Do not ignore damage - it is necessary to track it',
  ],
  validationRules: [
    { field: 'Item', rule: 'Required, positive integer' },
    { field: 'Quantity', rule: 'Required, positive number' },
    { field: 'Reason', rule: 'Required - Damaged / Lost / Broken / Scrap / Expired' },
    { field: 'Reported By', rule: 'Required, min 1 character' },
    { field: 'Date', rule: 'Required, valid date' },
    { field: 'Remarks', rule: 'Optional, string' },
  ],
  relatedPages: [
    { title: 'Stock Adjustment', route: '/inventory/stock-adjustment' },
    { title: 'Stock Ledger', route: '/inventory/stock-ledger' },
    { title: 'Store Stock', route: '/enterprise/stock' },
  ],
};
