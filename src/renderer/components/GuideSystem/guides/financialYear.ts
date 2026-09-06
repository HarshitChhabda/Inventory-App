import { GuideData } from '../types';

export const financialYearGuide: GuideData = {
  pageId: 'financial-year',
  pageTitle: 'Financial Years',
  pageDescription: 'Manage financial years',
  route: '/financial-year',
  whatIsThis: 'On the Financial Year page you can define your financial years - start date, end date, and label. Each company has its own financial year. Transactions can only happen under an active financial year in the system. No new entries can be made in a closed FY.',
  whenToUse: 'Whenever a new financial year starts (e.g., April 2026 to March 2027), or when you need to close an old FY. Create the new FY before the FY starts.',
  prerequisites: [
    'Company must be set up',
    'Admin or Financial Year permission is required',
  ],
  sections: [
    {
      title: 'FY Status',
      icon: 'CalendarMonth',
      content: 'There are two statuses:\n1. Active - transactions can be made\n2. Closed - transactions are disabled, viewing only\n\nClosing an FY is irreversible - there are 7 pre-checks.',
    },
    {
      title: 'FY Closing Pre-checks',
      icon: 'Checklist',
      content: 'These checks are performed before closing an FY:\n1. FY must not already be closed\n2. No draft transactions\n3. No pending requisitions\n4. No pending purchase orders\n5. No pending GRNs\n6. No pending work orders\n7. No negative stock',
    },
  ],
  steps: [
    {
      stepNumber: 1,
      title: 'Click on New FY',
      description: 'Click the "Add Financial Year" button.',
    },
    {
      stepNumber: 2,
      title: 'Enter Label',
      description: 'Enter the FY label (e.g., "FY 2026-27").',
    },
    {
      stepNumber: 3,
      title: 'Enter Start Date and End Date',
      description: 'Enter the start date and end date.',
      warning: 'Dates should not overlap with another FY',
    },
    {
      stepNumber: 4,
      title: 'Save',
      description: 'Click the Save button.',
    },
  ],
  dos: [
    'Create the new FY in advance - do not wait until the last moment',
    'Close the old FY properly before the new FY starts',
    'Let all pre-checks pass before closing',
  ],
  donts: [
    'Do not cancel transactions in the active FY without reason',
    'Closing an FY is irreversible - proceed carefully',
    'Do not enter overlapping FY dates',
  ],
  validationRules: [
    { field: 'Company', rule: 'Required, positive integer' },
    { field: 'Label', rule: 'Required, min 1 character' },
    { field: 'Start Date', rule: 'Required, valid date' },
    { field: 'End Date', rule: 'Required, valid date, after start date' },
  ],
  relatedPages: [
    { title: 'Company', route: '/companies' },
    { title: 'Stock Ledger', route: '/inventory/stock-ledger' },
  ],
};
