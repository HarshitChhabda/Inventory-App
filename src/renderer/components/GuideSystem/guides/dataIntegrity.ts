import { GuideData } from '../types';

export const dataIntegrityGuide: GuideData = {
  pageId: 'data-integrity',
  pageTitle: 'Data Integrity Auditor',
  pageDescription: 'Check the consistency and integrity of system data',
  route: '/admin/integrity',
  whatIsThis: 'The Data Integrity Auditor checks the health of data in the system - it finds negative stock, orphan transactions, duplicate vouchers, stock-ledger mismatches, and referential integrity issues.',
  whenToUse: 'When you suspect there is something wrong with the data, when stock appears incorrect, or during monthly audits. It is recommended to run this on a regular basis.',
  prerequisites: ['Login is required', 'Audit:view permission is required'],
  sections: [
    { title: 'Audit Summary', icon: 'Analytics', content: 'The top shows 4 cards: Total Checks, Passed, Failed, and Warnings. If any check fails, a red card will be displayed.' },
    { title: 'Check Results', icon: 'TableChart', content: 'All checks are shown in a table - check name, status (PASS/FAIL/WARNING), details, and count. Failed checks have a red background.' },
    { title: 'Run Audit', icon: 'PlayArrow', content: 'Click the "Run Full Audit" button to run a full system scan. It may take some time depending on data size.' },
  ],
  steps: [
    { stepNumber: 1, title: 'Run Audit', description: 'Click the "Run Full Audit" button. The scan will begin.', tip: 'Take a backup first if you are running this for the first time.' },
    { stepNumber: 2, title: 'View Results', description: 'Pass/fail/warnings will be shown in the summary cards. Details of each check are in the table below.' },
    { stepNumber: 3, title: 'Fix Issues', description: 'Address the failed checks. The details will help you understand the problem.' },
  ],
  dos: ['Run the audit monthly', 'Keep a backup ready', 'Prioritize fixing failed checks'],
  donts: ['Do not ignore the audit - data corruption can occur', 'Do not fix data without understanding the issue'],
  validationRules: [],
  relatedPages: [
    { title: 'Stock Ledger', route: '/inventory/stock-ledger' },
    { title: 'Audit Logs', route: '/admin/audit' },
  ],
};
