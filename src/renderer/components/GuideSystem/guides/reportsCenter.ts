import { GuideData } from '../types';

export const reportsCenterGuide: GuideData = {
  pageId: 'reports-center',
  pageTitle: 'Reports Center',
  pageDescription: 'Complete report center for inventory, purchase, sales, and analytics',
  route: '/reports',
  whatIsThis: 'The Reports Center is a centralized place where you can view all reports - stock ledger, purchase history, damage reports, audit logs, visual analytics, and much more. You can customize each report with filters and export to Excel/CSV.',
  whenToUse: 'Whenever you need to view, analyze, or export any report. For daily stock checks, monthly purchase summaries, or deep dives into any data.',
  prerequisites: ['Logged in', 'Active Company selected', 'Financial Year set'],
  sections: [
    { title: 'Report Categories', icon: 'Category', content: 'Reports are divided into multiple categories: Purchase Reports, Issue Reports, Inventory Reports, Analytics, Enterprise, Stock Analysis, Movement Reports, Ledger Reports, Asset Reports, Purchase Analysis, Maintenance Reports, and Financial Reports.' },
    { title: 'Filters', icon: 'FilterList', content: 'You can apply filters to any report - date range, item, category, department, vendor, store, status, etc. Click the "Submit" button to apply filters.' },
    { title: 'Export', icon: 'Download', content: 'You can export report data to Excel or CSV. The export button is in the top-right corner when the report is open.' },
  ],
  steps: [
    { stepNumber: 1, title: 'Select report from sidebar', description: 'Report categories are in the left sidebar. Expand your category and click the report name.' },
    { stepNumber: 2, title: 'Apply filters', description: 'In the filters section, select date range, item, department, etc. Click the "Submit" button.', tip: 'Any filter is optional - you can skip all of them.' },
    { stepNumber: 3, title: 'View report', description: 'The filtered data will appear in the table. Scroll to view all the data.' },
    { stepNumber: 4, title: 'Export', description: 'The Excel/CSV button is in the top-right. Click it and the file will be saved.' },
  ],
  dos: ['Check stock reports regularly', 'Keep records by exporting', 'Use filters to extract specific data'],
  donts: ['Do not export without filters - the file will be very large', 'Do not share sensitive report data'],
  validationRules: [],
  relatedPages: [
    { title: 'Stock Ledger', route: '/inventory/stock-ledger' },
    { title: 'Store Stock', route: '/enterprise/stock' },
  ],
};
