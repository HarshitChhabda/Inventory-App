import { GuideData } from '../types';

export const auditLogsGuide: GuideData = {
  pageId: 'audit-logs',
  pageTitle: 'Audit Logs',
  pageDescription: 'Detailed log and history of all actions in the system',
  route: '/admin/audit',
  whatIsThis: 'The Audit Log keeps a record of every important action in the system - who did it, when it was done, what was done, and what changed. This is essential for security and compliance.',
  whenToUse: 'When there is suspicious activity, when you need to fix an error, or just to check who did what. Also useful for compliance audits.',
  prerequisites: ['Login is required', 'Audit:view permission is required'],
  sections: [
    { title: 'Stats Cards', icon: 'Analytics', content: 'The top shows 4 cards: Total Entries, Actions Tracked, Tables Tracked, and Recent (24h) entries.' },
    { title: 'Filters', icon: 'FilterList', content: 'You can filter by action type, table name, and date range. You can search for logs of a specific user or time period.' },
    { title: 'Detail View', icon: 'Visibility', content: 'Each log shows Old Values and New Values - what was there before and what it became.' },
  ],
  steps: [
    { stepNumber: 1, title: 'Open the Page', description: 'Navigate to Sidebar > Administration > Audit Logs.' },
    { stepNumber: 2, title: 'Apply Filters', description: 'Select the action type or table name. You can also set a date range.' },
    { stepNumber: 3, title: 'Search', description: 'Click the "Search" button. Use the "Clear" button to clear filters.' },
    { stepNumber: 4, title: 'View Details', description: 'Click the "eye" icon on any row. Old Values and New Values will be displayed.' },
  ],
  dos: ['Check audit logs regularly', 'Report suspicious activity', 'Export and keep records'],
  donts: ['Do not delete logs', 'Do not take screenshots of sensitive data'],
  validationRules: [],
  relatedPages: [
    { title: 'Roles & Permissions', route: '/admin/roles' },
    { title: 'Security', route: '/admin/security' },
  ],
};
